"""
缺考管理API
提供缺考记录的上报、审核、查询、统计等功能
支持教务处统一录入和班主任上报两种模式
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import json
import logging

from core.database import get_db
from core.security import get_current_user, require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/absence", tags=["缺考管理"])


# ============ Pydantic模型定义 ============

class AbsenceCreateRequest(BaseModel):
    """创建缺考记录请求"""
    exam_id: int
    student_id: int
    student_code: str
    student_name: str
    class_name: str
    absent_subjects: List[str]
    reason_type: str = "其他"  # 病假/事假/旷考/其他
    reason_detail: Optional[str] = None
    report_source: str = "教务处"  # 教务处/班主任
    attachments: Optional[List[str]] = None  # 附件URL列表


class AbsenceUpdateRequest(BaseModel):
    """更新缺考记录请求"""
    absent_subjects: Optional[List[str]] = None
    reason_type: Optional[str] = None
    reason_detail: Optional[str] = None
    attachments: Optional[List[str]] = None


class AbsenceAuditRequest(BaseModel):
    """审核缺考记录请求"""
    status: str  # 已通过/已驳回
    audit_comment: Optional[str] = None


class AbsenceResponse(BaseModel):
    """缺考记录响应"""
    id: int
    exam_id: int
    exam_name: str
    student_id: int
    student_code: str
    student_name: str
    class_name: str
    absent_subjects: List[str]
    reason_type: str
    reason_detail: Optional[str]
    report_source: str
    reported_by: Optional[int]
    reported_by_name: Optional[str]
    report_time: str
    status: str
    audit_by: Optional[int]
    audit_by_name: Optional[str]
    audit_time: Optional[str]
    audit_comment: Optional[str]
    attachments: Optional[List[str]]
    created_at: str


class AbsenceListResponse(BaseModel):
    """缺考列表响应"""
    total: int
    page: int
    page_size: int
    records: List[AbsenceResponse]


class AbsenceStatisticsResponse(BaseModel):
    """缺考统计响应"""
    exam_id: int
    exam_name: str
    total_absence: int
    pending_count: int
    approved_count: int
    rejected_count: int
    by_reason_type: dict  # 按原因类型统计
    by_class: dict  # 按班级统计


# ============ 辅助函数 ============

def get_exam_name(db: Session, exam_id: int) -> str:
    """获取考试名称"""
    sql = "SELECT exam_name FROM biz_exams WHERE id = :exam_id"
    result = db.execute(text(sql), {"exam_id": exam_id}).fetchone()
    return result.exam_name if result else ""


def log_absence_action(db: Session, absence_id: int, action: str, 
                       action_by: int, action_by_name: str,
                       old_values: dict = None, new_values: dict = None, 
                       remark: str = None):
    """记录缺考操作日志"""
    try:
        sql = """
            INSERT INTO biz_absence_logs 
            (absence_id, action, action_by, action_by_name, old_values, new_values, remark)
            VALUES 
            (:absence_id, :action, :action_by, :action_by_name, :old_values, :new_values, :remark)
        """
        db.execute(text(sql), {
            "absence_id": absence_id,
            "action": action,
            "action_by": action_by,
            "action_by_name": action_by_name,
            "old_values": json.dumps(old_values, ensure_ascii=False) if old_values else None,
            "new_values": json.dumps(new_values, ensure_ascii=False) if new_values else None,
            "remark": remark
        })
        db.commit()
    except Exception as e:
        logger.error(f"记录缺考操作日志失败: {e}")


# ============ API路由 ============

@router.post("/create")
def create_absence(
    request: AbsenceCreateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    创建缺考记录
    
    教务处可直接创建，班主任上报需审核
    """
    try:
        # 检查是否已存在该学生的缺考记录
        check_sql = """
            SELECT id FROM biz_absence_records 
            WHERE exam_id = :exam_id AND student_id = :student_id
        """
        existing = db.execute(text(check_sql), {
            "exam_id": request.exam_id,
            "student_id": request.student_id
        }).fetchone()
        
        if existing:
            return {
                "success": False,
                "message": "该学生已存在缺考记录，请使用更新功能"
            }
        
        # 获取考试名称
        exam_name = get_exam_name(db, request.exam_id)
        
        # 如果是教务处录入，自动通过审核
        status = "已通过" if request.report_source == "教务处" else "待审核"
        
        # 创建缺考记录
        subjects_json = json.dumps(request.absent_subjects, ensure_ascii=False)
        attachments_json = json.dumps(request.attachments, ensure_ascii=False) if request.attachments else None
        
        insert_sql = """
            INSERT INTO biz_absence_records 
            (exam_id, student_id, student_code, student_name, class_name,
             absent_subjects, reason_type, reason_detail, report_source,
             reported_by, reported_by_name, status, attachments)
            VALUES 
            (:exam_id, :student_id, :student_code, :student_name, :class_name,
             :absent_subjects, :reason_type, :reason_detail, :report_source,
             :reported_by, :reported_by_name, :status, :attachments)
        """
        
        result = db.execute(text(insert_sql), {
            "exam_id": request.exam_id,
            "student_id": request.student_id,
            "student_code": request.student_code,
            "student_name": request.student_name,
            "class_name": request.class_name,
            "absent_subjects": subjects_json,
            "reason_type": request.reason_type,
            "reason_detail": request.reason_detail,
            "report_source": request.report_source,
            "reported_by": current_user["id"],
            "reported_by_name": current_user.get("real_name", current_user["username"]),
            "status": status,
            "attachments": attachments_json
        })
        
        absence_id = result.lastrowid
        
        # 如果是教务处录入，自动记录审核信息
        if status == "已通过":
            audit_sql = """
                UPDATE biz_absence_records 
                SET audit_by = :audit_by, audit_by_name = :audit_by_name, 
                    audit_time = NOW(), audit_comment = '教务处直接录入，自动通过'
                WHERE id = :absence_id
            """
            db.execute(text(audit_sql), {
                "absence_id": absence_id,
                "audit_by": current_user["id"],
                "audit_by_name": current_user.get("real_name", current_user["username"])
            })
        
        db.commit()
        
        # 记录操作日志
        log_absence_action(
            db, absence_id, "创建", current_user["id"],
            current_user.get("real_name", current_user["username"]),
            None, request.dict(), f"由{request.report_source}录入"
        )
        
        logger.info(f"创建缺考记录成功: exam_id={request.exam_id}, student={request.student_name}, 操作人={current_user['username']}")
        
        return {
            "success": True,
            "message": "缺考记录创建成功" if status == "已通过" else "缺考记录创建成功，等待审核",
            "absence_id": absence_id,
            "status": status
        }
        
    except Exception as e:
        logger.error(f"创建缺考记录失败: {e}")
        raise HTTPException(status_code=500, detail="创建缺考记录失败")


@router.get("/list")
def get_absence_list(
    exam_id: Optional[int] = Query(None, description="考试ID筛选"),
    class_name: Optional[str] = Query(None, description="班级筛选"),
    status: Optional[str] = Query(None, description="状态筛选: 待审核/已通过/已驳回"),
    report_source: Optional[str] = Query(None, description="上报来源筛选: 教务处/班主任"),
    reason_type: Optional[str] = Query(None, description="原因类型筛选"),
    keyword: Optional[str] = Query(None, description="关键字搜索(姓名/学籍号)"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取缺考记录列表
    
    支持多条件筛选和分页
    """
    try:
        offset = (page - 1) * page_size
        
        # 构建查询条件
        conditions = []
        params = {}
        
        if exam_id:
            conditions.append("a.exam_id = :exam_id")
            params["exam_id"] = exam_id
        
        if class_name:
            conditions.append("a.class_name = :class_name")
            params["class_name"] = class_name
            
        if status:
            conditions.append("a.status = :status")
            params["status"] = status
            
        if report_source:
            conditions.append("a.report_source = :report_source")
            params["report_source"] = report_source
            
        if reason_type:
            conditions.append("a.reason_type = :reason_type")
            params["reason_type"] = reason_type
            
        if keyword:
            conditions.append("(a.student_name LIKE :keyword OR a.student_code LIKE :keyword)")
            params["keyword"] = f"%{keyword}%"
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        # 查询总数
        count_sql = f"""
            SELECT COUNT(*) as total 
            FROM biz_absence_records a 
            {where_clause}
        """
        count_result = db.execute(text(count_sql), params).fetchone()
        total = count_result.total if count_result else 0
        
        # 查询列表
        list_sql = f"""
            SELECT 
                a.*,
                e.exam_name
            FROM biz_absence_records a
            LEFT JOIN biz_exams e ON a.exam_id = e.id
            {where_clause}
            ORDER BY a.report_time DESC
            LIMIT :limit OFFSET :offset
        """
        params["limit"] = page_size
        params["offset"] = offset
        
        results = db.execute(text(list_sql), params).fetchall()
        
        records = []
        for result in results:
            absent_subjects = json.loads(result.absent_subjects) if result.absent_subjects else []
            attachments = json.loads(result.attachments) if result.attachments else []
            
            records.append({
                "id": result.id,
                "exam_id": result.exam_id,
                "exam_name": result.exam_name or "",
                "student_id": result.student_id,
                "student_code": result.student_code,
                "student_name": result.student_name,
                "class_name": result.class_name,
                "absent_subjects": absent_subjects,
                "reason_type": result.reason_type,
                "reason_detail": result.reason_detail,
                "report_source": result.report_source,
                "reported_by": result.reported_by,
                "reported_by_name": result.reported_by_name,
                "report_time": result.report_time.isoformat() if result.report_time else "",
                "status": result.status,
                "audit_by": result.audit_by,
                "audit_by_name": result.audit_by_name,
                "audit_time": result.audit_time.isoformat() if result.audit_time else None,
                "audit_comment": result.audit_comment,
                "attachments": attachments,
                "created_at": result.created_at.isoformat() if result.created_at else ""
            })
        
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "records": records
        }
        
    except Exception as e:
        logger.error(f"获取缺考列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取缺考列表失败")


@router.put("/{absence_id}/update")
def update_absence(
    absence_id: int,
    request: AbsenceUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    更新缺考记录
    
    只能更新待审核的记录，已审核的记录不能修改
    """
    try:
        # 检查记录是否存在
        check_sql = "SELECT * FROM biz_absence_records WHERE id = :absence_id"
        existing = db.execute(text(check_sql), {"absence_id": absence_id}).fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail="缺考记录不存在")
        
        # 检查状态
        if existing.status != "待审核":
            return {
                "success": False,
                "message": "已审核的记录不能修改"
            }
        
        # 保存旧值用于日志
        old_values = {
            "absent_subjects": json.loads(existing.absent_subjects) if existing.absent_subjects else [],
            "reason_type": existing.reason_type,
            "reason_detail": existing.reason_detail,
            "attachments": json.loads(existing.attachments) if existing.attachments else []
        }
        
        # 构建更新字段
        update_fields = []
        params = {"absence_id": absence_id}
        
        if request.absent_subjects is not None:
            update_fields.append("absent_subjects = :absent_subjects")
            params["absent_subjects"] = json.dumps(request.absent_subjects, ensure_ascii=False)
            
        if request.reason_type is not None:
            update_fields.append("reason_type = :reason_type")
            params["reason_type"] = request.reason_type
            
        if request.reason_detail is not None:
            update_fields.append("reason_detail = :reason_detail")
            params["reason_detail"] = request.reason_detail
            
        if request.attachments is not None:
            update_fields.append("attachments = :attachments")
            params["attachments"] = json.dumps(request.attachments, ensure_ascii=False)
        
        if not update_fields:
            return {"success": False, "message": "没有要更新的字段"}
        
        update_fields.append("updated_at = NOW()")
        
        update_sql = f"""
            UPDATE biz_absence_records 
            SET {', '.join(update_fields)}
            WHERE id = :absence_id
        """
        
        db.execute(text(update_sql), params)
        db.commit()
        
        # 记录操作日志
        new_values = request.dict(exclude_unset=True)
        log_absence_action(
            db, absence_id, "修改", current_user["id"],
            current_user.get("real_name", current_user["username"]),
            old_values, new_values
        )
        
        logger.info(f"更新缺考记录成功: absence_id={absence_id}, 操作人={current_user['username']}")
        
        return {"success": True, "message": "缺考记录更新成功"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新缺考记录失败: {e}")
        raise HTTPException(status_code=500, detail="更新缺考记录失败")


@router.post("/{absence_id}/audit")
def audit_absence(
    absence_id: int,
    request: AbsenceAuditRequest,
    current_user: dict = Depends(require_permission("exam_admin")),
    db: Session = Depends(get_db)
):
    """
    审核缺考记录
    
    需要考务管理员或教务主任权限
    """
    try:
        # 检查记录是否存在
        check_sql = "SELECT * FROM biz_absence_records WHERE id = :absence_id"
        existing = db.execute(text(check_sql), {"absence_id": absence_id}).fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail="缺考记录不存在")
        
        # 检查状态
        if existing.status != "待审核":
            return {
                "success": False,
                "message": "该记录已经审核过了"
            }
        
        # 更新审核信息
        audit_sql = """
            UPDATE biz_absence_records 
            SET status = :status,
                audit_by = :audit_by,
                audit_by_name = :audit_by_name,
                audit_time = NOW(),
                audit_comment = :audit_comment
            WHERE id = :absence_id
        """
        
        db.execute(text(audit_sql), {
            "absence_id": absence_id,
            "status": request.status,
            "audit_by": current_user["id"],
            "audit_by_name": current_user.get("real_name", current_user["username"]),
            "audit_comment": request.audit_comment
        })
        
        db.commit()
        
        # 记录操作日志
        log_absence_action(
            db, absence_id, "审核", current_user["id"],
            current_user.get("real_name", current_user["username"]),
            {"status": "待审核"}, {"status": request.status},
            request.audit_comment
        )
        
        logger.info(f"审核缺考记录成功: absence_id={absence_id}, status={request.status}, 操作人={current_user['username']}")
        
        return {
            "success": True,
            "message": f"审核{request.status}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"审核缺考记录失败: {e}")
        raise HTTPException(status_code=500, detail="审核缺考记录失败")


@router.delete("/{absence_id}/delete")
def delete_absence(
    absence_id: int,
    current_user: dict = Depends(require_permission("exam_admin")),
    db: Session = Depends(get_db)
):
    """
    删除缺考记录
    
    需要考务管理员或教务主任权限
    """
    try:
        # 检查记录是否存在
        check_sql = "SELECT student_name FROM biz_absence_records WHERE id = :absence_id"
        existing = db.execute(text(check_sql), {"absence_id": absence_id}).fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail="缺考记录不存在")
        
        # 删除记录
        delete_sql = "DELETE FROM biz_absence_records WHERE id = :absence_id"
        db.execute(text(delete_sql), {"absence_id": absence_id})
        db.commit()
        
        # 记录操作日志
        log_absence_action(
            db, absence_id, "删除", current_user["id"],
            current_user.get("real_name", current_user["username"]),
            None, None, f"删除学生 {existing.student_name} 的缺考记录"
        )
        
        logger.info(f"删除缺考记录成功: absence_id={absence_id}, 操作人={current_user['username']}")
        
        return {"success": True, "message": "缺考记录删除成功"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除缺考记录失败: {e}")
        raise HTTPException(status_code=500, detail="删除缺考记录失败")


@router.get("/statistics/{exam_id}")
def get_absence_statistics(
    exam_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取考试缺考统计
    """
    try:
        # 获取考试名称
        exam_name = get_exam_name(db, exam_id)
        
        # 总体统计
        total_sql = """
            SELECT 
                COUNT(*) as total_absence,
                SUM(CASE WHEN status = '待审核' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = '已通过' THEN 1 ELSE 0 END) as approved_count,
                SUM(CASE WHEN status = '已驳回' THEN 1 ELSE 0 END) as rejected_count
            FROM biz_absence_records
            WHERE exam_id = :exam_id
        """
        total_stats = db.execute(text(total_sql), {"exam_id": exam_id}).fetchone()
        
        # 按原因类型统计
        reason_sql = """
            SELECT reason_type, COUNT(*) as count
            FROM biz_absence_records
            WHERE exam_id = :exam_id
            GROUP BY reason_type
        """
        reason_results = db.execute(text(reason_sql), {"exam_id": exam_id}).fetchall()
        by_reason_type = {r.reason_type: r.count for r in reason_results}
        
        # 按班级统计
        class_sql = """
            SELECT class_name, COUNT(*) as count
            FROM biz_absence_records
            WHERE exam_id = :exam_id
            GROUP BY class_name
            ORDER BY class_name
        """
        class_results = db.execute(text(class_sql), {"exam_id": exam_id}).fetchall()
        by_class = {r.class_name: r.count for r in class_results}
        
        return {
            "success": True,
            "exam_id": exam_id,
            "exam_name": exam_name,
            "total_absence": total_stats.total_absence if total_stats else 0,
            "pending_count": total_stats.pending_count if total_stats else 0,
            "approved_count": total_stats.approved_count if total_stats else 0,
            "rejected_count": total_stats.rejected_count if total_stats else 0,
            "by_reason_type": by_reason_type,
            "by_class": by_class
        }
        
    except Exception as e:
        logger.error(f"获取缺考统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取缺考统计失败")


@router.get("/pending/count")
def get_pending_count(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取待审核缺考记录数量
    
    用于首页提醒
    """
    try:
        sql = "SELECT COUNT(*) as count FROM biz_absence_records WHERE status = '待审核'"
        result = db.execute(text(sql)).fetchone()
        
        return {
            "success": True,
            "pending_count": result.count if result else 0
        }
        
    except Exception as e:
        logger.error(f"获取待审核数量失败: {e}")
        raise HTTPException(status_code=500, detail="获取待审核数量失败")
