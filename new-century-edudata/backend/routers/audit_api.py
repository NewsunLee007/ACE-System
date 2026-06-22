"""
审计日志API
提供操作日志查询、统计、管理等功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
import logging

from core.database import get_db
from core.security import get_current_user, require_permission
from services.audit_service import AuditService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/audit", tags=["审计日志"])


@router.get("/logs")
def get_audit_logs(
    user_id: Optional[int] = Query(None, description="用户ID筛选"),
    operation: Optional[str] = Query(None, description="操作类型筛选"),
    module: Optional[str] = Query(None, description="模块筛选"),
    status: Optional[str] = Query(None, description="状态筛选: success/failed"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: dict = Depends(require_permission("sys_admin")),
    db: Session = Depends(get_db)
):
    """
    查询操作日志
    
    需要系统管理员权限
    """
    try:
        service = AuditService(db)
        result = service.get_logs(
            user_id=user_id,
            operation=operation,
            module=module,
            status=status,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size
        )
        
        return result
        
    except Exception as e:
        logger.error(f"查询审计日志失败: {e}")
        raise HTTPException(status_code=500, detail="查询审计日志失败")


@router.get("/statistics")
def get_audit_statistics(
    days: int = Query(7, ge=1, le=365, description="统计最近几天的数据"),
    current_user: dict = Depends(require_permission("sys_admin")),
    db: Session = Depends(get_db)
):
    """
    获取审计日志统计
    
    需要系统管理员权限
    """
    try:
        service = AuditService(db)
        result = service.get_statistics(days=days)
        
        return result
        
    except Exception as e:
        logger.error(f"获取审计统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取审计统计失败")


@router.post("/clean")
def clean_old_logs(
    days: int = Query(90, ge=30, le=365, description="保留最近几天的日志"),
    current_user: dict = Depends(require_permission("sys_admin")),
    db: Session = Depends(get_db)
):
    """
    清理旧日志
    
    需要系统管理员权限，用于定期清理历史日志
    """
    try:
        service = AuditService(db)
        result = service.clean_old_logs(days=days)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"清理旧日志失败: {e}")
        raise HTTPException(status_code=500, detail="清理旧日志失败")


@router.get("/my-logs")
def get_my_logs(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取当前用户的操作日志
    
    普通用户可查看自己的操作记录
    """
    try:
        service = AuditService(db)
        result = service.get_logs(
            user_id=current_user["id"],
            page=page,
            page_size=page_size
        )
        
        return result
        
    except Exception as e:
        logger.error(f"获取个人日志失败: {e}")
        raise HTTPException(status_code=500, detail="获取个人日志失败")
