"""
审计日志服务
提供操作日志记录、查询、分析等功能
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json
import logging

logger = logging.getLogger(__name__)


class AuditService:
    """审计日志服务类"""
    
    def __init__(self, db_session: Session):
        self.db = db_session
    
    def log_operation(
        self,
        user_id: Optional[int],
        username: Optional[str],
        operation: str,
        module: str,
        description: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_data: Optional[Dict] = None,
        response_data: Optional[Dict] = None,
        status: str = "success",
        error_message: Optional[str] = None
    ) -> bool:
        """
        记录操作日志
        
        Args:
            user_id: 用户ID
            username: 用户名
            operation: 操作类型
            module: 操作模块
            description: 操作描述
            ip_address: IP地址
            user_agent: 浏览器信息
            request_data: 请求数据
            response_data: 响应数据
            status: 操作状态
            error_message: 错误信息
            
        Returns:
            bool: 是否记录成功
        """
        try:
            sql = """
                INSERT INTO sys_audit_logs 
                (user_id, username, operation, module, description, ip_address, user_agent,
                 request_data, response_data, status, error_message, created_at)
                VALUES 
                (:user_id, :username, :operation, :module, :description, :ip_address, :user_agent,
                 :request_data, :response_data, :status, :error_message, NOW())
            """
            
            self.db.execute(text(sql), {
                "user_id": user_id,
                "username": username,
                "operation": operation,
                "module": module,
                "description": description,
                "ip_address": ip_address,
                "user_agent": user_agent,
                "request_data": json.dumps(request_data, ensure_ascii=False) if request_data else None,
                "response_data": json.dumps(response_data, ensure_ascii=False) if response_data else None,
                "status": status,
                "error_message": error_message
            })
            self.db.commit()
            
            return True
            
        except Exception as e:
            logger.error(f"记录操作日志失败: {e}")
            self.db.rollback()
            return False
    
    def get_logs(
        self,
        user_id: Optional[int] = None,
        operation: Optional[str] = None,
        module: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """
        查询操作日志
        
        Args:
            user_id: 用户ID筛选
            operation: 操作类型筛选
            module: 模块筛选
            status: 状态筛选
            start_date: 开始日期
            end_date: 结束日期
            page: 页码
            page_size: 每页数量
            
        Returns:
            Dict: 日志列表和分页信息
        """
        try:
            offset = (page - 1) * page_size
            
            # 构建查询条件
            conditions = []
            params = {}
            
            if user_id:
                conditions.append("user_id = :user_id")
                params["user_id"] = user_id
            
            if operation:
                conditions.append("operation = :operation")
                params["operation"] = operation
                
            if module:
                conditions.append("module = :module")
                params["module"] = module
                
            if status:
                conditions.append("status = :status")
                params["status"] = status
                
            if start_date:
                conditions.append("created_at >= :start_date")
                params["start_date"] = start_date
                
            if end_date:
                conditions.append("created_at <= :end_date")
                params["end_date"] = end_date
            
            where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
            
            # 查询总数
            count_sql = f"SELECT COUNT(*) as total FROM sys_audit_logs {where_clause}"
            count_result = self.db.execute(text(count_sql), params).fetchone()
            total = count_result.total if count_result else 0
            
            # 查询列表
            list_sql = f"""
                SELECT id, user_id, username, operation, module, description, 
                       ip_address, status, error_message, created_at
                FROM sys_audit_logs
                {where_clause}
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """
            params["limit"] = page_size
            params["offset"] = offset
            
            results = self.db.execute(text(list_sql), params).fetchall()
            
            logs = []
            for result in results:
                logs.append({
                    "id": result.id,
                    "user_id": result.user_id,
                    "username": result.username,
                    "operation": result.operation,
                    "module": result.module,
                    "description": result.description,
                    "ip_address": result.ip_address,
                    "status": result.status,
                    "error_message": result.error_message,
                    "created_at": result.created_at.isoformat() if result.created_at else ""
                })
            
            return {
                "success": True,
                "total": total,
                "page": page,
                "page_size": page_size,
                "logs": logs
            }
            
        except Exception as e:
            logger.error(f"查询操作日志失败: {e}")
            return {
                "success": False,
                "message": f"查询失败: {str(e)}"
            }
    
    def get_statistics(self, days: int = 7) -> Dict[str, Any]:
        """
        获取日志统计信息
        
        Args:
            days: 统计最近几天的数据
            
        Returns:
            Dict: 统计信息
        """
        try:
            start_date = datetime.now() - timedelta(days=days)
            
            # 总操作数
            total_sql = """
                SELECT COUNT(*) as count FROM sys_audit_logs 
                WHERE created_at >= :start_date
            """
            total_result = self.db.execute(text(total_sql), {"start_date": start_date}).fetchone()
            
            # 成功/失败数
            status_sql = """
                SELECT status, COUNT(*) as count 
                FROM sys_audit_logs 
                WHERE created_at >= :start_date
                GROUP BY status
            """
            status_results = self.db.execute(text(status_sql), {"start_date": start_date}).fetchall()
            
            # 模块分布
            module_sql = """
                SELECT module, COUNT(*) as count 
                FROM sys_audit_logs 
                WHERE created_at >= :start_date
                GROUP BY module
                ORDER BY count DESC
                LIMIT 10
            """
            module_results = self.db.execute(text(module_sql), {"start_date": start_date}).fetchall()
            
            # 活跃用户
            user_sql = """
                SELECT username, COUNT(*) as count 
                FROM sys_audit_logs 
                WHERE created_at >= :start_date AND user_id IS NOT NULL
                GROUP BY username
                ORDER BY count DESC
                LIMIT 10
            """
            user_results = self.db.execute(text(user_sql), {"start_date": start_date}).fetchall()
            
            return {
                "success": True,
                "period_days": days,
                "total_operations": total_result.count if total_result else 0,
                "status_distribution": {r.status: r.count for r in status_results},
                "module_distribution": [{"module": r.module, "count": r.count} for r in module_results],
                "active_users": [{"username": r.username, "count": r.count} for r in user_results]
            }
            
        except Exception as e:
            logger.error(f"获取日志统计失败: {e}")
            return {
                "success": False,
                "message": f"获取统计失败: {str(e)}"
            }
    
    def clean_old_logs(self, days: int = 90) -> Dict[str, Any]:
        """
        清理旧日志
        
        Args:
            days: 保留最近几天的日志
            
        Returns:
            Dict: 清理结果
        """
        try:
            cutoff_date = datetime.now() - timedelta(days=days)
            
            # 查询要删除的数量
            count_sql = "SELECT COUNT(*) as count FROM sys_audit_logs WHERE created_at < :cutoff_date"
            count_result = self.db.execute(text(count_sql), {"cutoff_date": cutoff_date}).fetchone()
            delete_count = count_result.count if count_result else 0
            
            # 删除旧日志
            delete_sql = "DELETE FROM sys_audit_logs WHERE created_at < :cutoff_date"
            self.db.execute(text(delete_sql), {"cutoff_date": cutoff_date})
            self.db.commit()
            
            logger.info(f"清理旧日志完成: 删除了{delete_count}条记录")
            
            return {
                "success": True,
                "message": f"已清理{delete_count}条旧日志",
                "deleted_count": delete_count,
                "retention_days": days
            }
            
        except Exception as e:
            logger.error(f"清理旧日志失败: {e}")
            self.db.rollback()
            return {
                "success": False,
                "message": f"清理失败: {str(e)}"
            }
