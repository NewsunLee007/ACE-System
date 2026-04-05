"""
教师管理API
提供教师信息管理、任课关系管理、教师成绩查询等功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from pydantic import BaseModel
from datetime import date
import logging

from core.database import get_db
from core.security import get_current_user, require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/teachers", tags=["教师管理"])


# ============ Pydantic模型定义 ============

class TeacherAssignmentRequest(BaseModel):
    """教师任课分配请求"""
    teacher_id: int
    term: str
    grade_name: str
    class_name: str
    subject_name: Optional[str] = None  # 为空表示班主任
    is_headmaster: bool = False
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class TeacherAssignmentResponse(BaseModel):
    """教师任课响应"""
    id: int
    teacher_id: int
    teacher_name: str
    term: str
    grade_name: str
    class_name: str
    subject_name: Optional[str]
    is_headmaster: bool
    start_date: Optional[str]
    end_date: Optional[str]


class TeacherPerformance(BaseModel):
    """教师教学业绩"""
    teacher_id: int
    teacher_name: str
    subject_name: str
    class_name: str
    exam_id: int
    exam_name: str
    class_mean: float
    layer_mean: float
    diff: float
    z_value: float


# ============ API路由 ============

@router.get("/list")
def get_teacher_list(
    role_id: Optional[int] = Query(None, description="角色筛选"),
    keyword: Optional[str] = Query(None, description="关键字搜索(姓名/工号)"),
    is_active: Optional[bool] = Query(True, description="是否在职"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取教师列表
    """
    try:
        offset = (page - 1) * page_size
        
        # 构建查询条件
        conditions = ["r.permission_code IN ('teacher', 'headmaster', 'lesson_leader', 'subject_leader', 'grade_leader')"]
        params = {}
        
        if role_id:
            conditions.append("u.role_id = :role_id")
            params["role_id"] = role_id
        
        if keyword:
            conditions.append("(u.real_name LIKE :keyword OR u.username LIKE :keyword)")
            params["keyword"] = f"%{keyword}%"
        
        if is_active is not None:
            conditions.append("u.is_active = :is_active")
            params["is_active"] = 1 if is_active else 0
        
        where_clause = "WHERE " + " AND ".join(conditions)
        
        # 查询总数
        count_sql = f"""
            SELECT COUNT(*) as total 
            FROM sys_users u
            JOIN sys_roles r ON u.role_id = r.id
            {where_clause}
        """
        count_result = db.execute(text(count_sql), params).fetchone()
        total = count_result.total if count_result else 0
        
        # 查询列表
        list_sql = f"""
            SELECT u.id, u.username, u.real_name, u.phone, u.email, 
                   u.is_active, r.role_name, r.permission_code, u.created_at
            FROM sys_users u
            JOIN sys_roles r ON u.role_id = r.id
            {where_clause}
            ORDER BY u.created_at DESC
            LIMIT :limit OFFSET :offset
        """
        params["limit"] = page_size
        params["offset"] = offset
        
        results = db.execute(text(list_sql), params).fetchall()
        
        teachers = []
        for result in results:
            teachers.append({
                "id": result.id,
                "username": result.username,
                "real_name": result.real_name,
                "phone": result.phone,
                "email": result.email,
                "is_active": result.is_active == 1,
                "role_name": result.role_name,
                "permission_code": result.permission_code,
                "created_at": result.created_at.isoformat() if result.created_at else ""
            })
        
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "teachers": teachers
        }
        
    except Exception as e:
        logger.error(f"获取教师列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取教师列表失败")


@router.get("/{teacher_id}/assignments")
def get_teacher_assignments(
    teacher_id: int,
    term: Optional[str] = Query(None, description="学期筛选"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取教师任课安排
    """
    try:
        # 查询教师基本信息
        teacher_sql = """
            SELECT u.id, u.real_name, r.role_name
            FROM sys_users u
            JOIN sys_roles r ON u.role_id = r.id
            WHERE u.id = :teacher_id
        """
        teacher = db.execute(text(teacher_sql), {"teacher_id": teacher_id}).fetchone()
        
        if not teacher:
            raise HTTPException(status_code=404, detail="教师不存在")
        
        # 构建查询条件
        where_clause = "WHERE teacher_id = :teacher_id"
        params = {"teacher_id": teacher_id}
        
        if term:
            where_clause += " AND term = :term"
            params["term"] = term
        
        # 查询任课安排
        sql = f"""
            SELECT id, term, grade_name, class_name, subject_name, 
                   is_headmaster, start_date, end_date, created_at
            FROM biz_teacher_class_rel
            {where_clause}
            ORDER BY term DESC, class_name
        """
        
        results = db.execute(text(sql), params).fetchall()
        
        assignments = []
        for result in results:
            assignments.append({
                "id": result.id,
                "term": result.term,
                "grade_name": result.grade_name,
                "class_name": result.class_name,
                "subject_name": result.subject_name,
                "is_headmaster": result.is_headmaster == 1,
                "start_date": result.start_date.isoformat() if result.start_date else None,
                "end_date": result.end_date.isoformat() if result.end_date else None,
                "created_at": result.created_at.isoformat() if result.created_at else ""
            })
        
        return {
            "success": True,
            "teacher": {
                "id": teacher.id,
                "real_name": teacher.real_name,
                "role_name": teacher.role_name
            },
            "total_assignments": len(assignments),
            "assignments": assignments
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取教师任课安排失败: {e}")
        raise HTTPException(status_code=500, detail="获取教师任课安排失败")


@router.post("/assign")
def assign_teacher(
    request: TeacherAssignmentRequest,
    current_user: dict = Depends(require_permission("edu_admin")),
    db: Session = Depends(get_db)
):
    """
    分配教师任课
    
    需要教务主任权限
    """
    try:
        # 检查教师是否存在
        teacher_sql = "SELECT id FROM sys_users WHERE id = :teacher_id"
        teacher = db.execute(text(teacher_sql), {"teacher_id": request.teacher_id}).fetchone()
        
        if not teacher:
            raise HTTPException(status_code=404, detail="教师不存在")
        
        # 检查是否已存在相同安排
        check_sql = """
            SELECT id FROM biz_teacher_class_rel 
            WHERE teacher_id = :teacher_id 
              AND term = :term 
              AND class_name = :class_name
              AND (subject_name = :subject_name OR (subject_name IS NULL AND :subject_name IS NULL))
        """
        existing = db.execute(text(check_sql), {
            "teacher_id": request.teacher_id,
            "term": request.term,
            "class_name": request.class_name,
            "subject_name": request.subject_name
        }).fetchone()
        
        if existing:
            return {
                "success": False,
                "message": "该教师在此学期已有相同任课安排"
            }
        
        # 创建任课关系
        insert_sql = """
            INSERT INTO biz_teacher_class_rel 
            (teacher_id, term, grade_name, class_name, subject_name, is_headmaster, start_date, end_date, created_at)
            VALUES 
            (:teacher_id, :term, :grade_name, :class_name, :subject_name, :is_headmaster, :start_date, :end_date, NOW())
        """
        
        db.execute(text(insert_sql), {
            "teacher_id": request.teacher_id,
            "term": request.term,
            "grade_name": request.grade_name,
            "class_name": request.class_name,
            "subject_name": request.subject_name,
            "is_headmaster": 1 if request.is_headmaster else 0,
            "start_date": request.start_date,
            "end_date": request.end_date
        })
        db.commit()
        
        logger.info(f"分配教师任课成功: teacher_id={request.teacher_id}, 操作人: {current_user['username']}")
        
        return {
            "success": True,
            "message": "任课分配成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"分配教师任课失败: {e}")
        raise HTTPException(status_code=500, detail="分配教师任课失败")


@router.delete("/assignments/{assignment_id}")
def remove_assignment(
    assignment_id: int,
    current_user: dict = Depends(require_permission("edu_admin")),
    db: Session = Depends(get_db)
):
    """
    删除任课安排
    
    需要教务主任权限
    """
    try:
        # 检查是否存在
        check_sql = "SELECT id FROM biz_teacher_class_rel WHERE id = :id"
        existing = db.execute(text(check_sql), {"id": assignment_id}).fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail="任课安排不存在")
        
        # 删除
        delete_sql = "DELETE FROM biz_teacher_class_rel WHERE id = :id"
        db.execute(text(delete_sql), {"id": assignment_id})
        db.commit()
        
        logger.info(f"删除任课安排成功: assignment_id={assignment_id}, 操作人: {current_user['username']}")
        
        return {"success": True, "message": "任课安排已删除"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除任课安排失败: {e}")
        raise HTTPException(status_code=500, detail="删除任课安排失败")


@router.get("/{teacher_id}/performance")
def get_teacher_performance(
    teacher_id: int,
    term: Optional[str] = Query(None, description="学期筛选"),
    subject: Optional[str] = Query(None, description="学科筛选"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取教师教学业绩
    
    查询教师所教班级的成绩表现
    """
    try:
        # 查询教师任课信息
        assignment_sql = """
            SELECT tcr.class_name, tcr.subject_name, tcr.term,
                   u.real_name as teacher_name
            FROM biz_teacher_class_rel tcr
            JOIN sys_users u ON tcr.teacher_id = u.id
            WHERE tcr.teacher_id = :teacher_id
        """
        
        if term:
            assignment_sql += " AND tcr.term = :term"
        if subject:
            assignment_sql += " AND tcr.subject_name = :subject"
            
        assignments = db.execute(text(assignment_sql), {
            "teacher_id": teacher_id,
            "term": term,
            "subject": subject
        }).fetchall()
        
        if not assignments:
            return {
                "success": True,
                "teacher_id": teacher_id,
                "performance": [],
                "message": "该教师暂无任课记录"
            }
        
        # 查询各班级成绩
        performance_list = []
        
        for assignment in assignments:
            # 查询该班级最新一次考试的成绩
            score_sql = """
                SELECT 
                    e.id as exam_id,
                    e.exam_name,
                    e.term,
                    AVG(s.total_score) as class_mean,
                    (SELECT AVG(total_score) FROM biz_scores WHERE exam_id = e.id AND is_included = 1) as layer_mean
                FROM biz_scores s
                JOIN biz_exams e ON s.exam_id = e.id
                WHERE s.class_name = :class_name
                  AND s.is_included = 1
                ORDER BY e.exam_date DESC
                LIMIT 1
            """
            
            score_result = db.execute(text(score_sql), {
                "class_name": assignment.class_name
            }).fetchone()
            
            if score_result and score_result.class_mean:
                diff = float(score_result.class_mean) - float(score_result.layer_mean or 0)
                
                performance_list.append({
                    "teacher_id": teacher_id,
                    "teacher_name": assignment.teacher_name,
                    "subject_name": assignment.subject_name or "班主任",
                    "class_name": assignment.class_name,
                    "term": assignment.term,
                    "exam_id": score_result.exam_id,
                    "exam_name": score_result.exam_name,
                    "class_mean": round(float(score_result.class_mean), 2),
                    "layer_mean": round(float(score_result.layer_mean or 0), 2),
                    "diff": round(diff, 2)
                })
        
        return {
            "success": True,
            "teacher_id": teacher_id,
            "teacher_name": assignments[0].teacher_name if assignments else "",
            "total_records": len(performance_list),
            "performance": performance_list
        }
        
    except Exception as e:
        logger.error(f"获取教师业绩失败: {e}")
        raise HTTPException(status_code=500, detail="获取教师业绩失败")


@router.get("/{teacher_id}/classes")
def get_teacher_classes(
    teacher_id: int,
    term: Optional[str] = Query(None, description="学期"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取教师所教班级列表
    """
    try:
        sql = """
            SELECT DISTINCT class_name, grade_name, subject_name, is_headmaster
            FROM biz_teacher_class_rel
            WHERE teacher_id = :teacher_id
        """
        
        params = {"teacher_id": teacher_id}
        
        if term:
            sql += " AND term = :term"
            params["term"] = term
        
        sql += " ORDER BY class_name"
        
        results = db.execute(text(sql), params).fetchall()
        
        classes = []
        for result in results:
            classes.append({
                "class_name": result.class_name,
                "grade_name": result.grade_name,
                "subject_name": result.subject_name,
                "is_headmaster": result.is_headmaster == 1
            })
        
        return {
            "success": True,
            "teacher_id": teacher_id,
            "total_classes": len(classes),
            "classes": classes
        }
        
    except Exception as e:
        logger.error(f"获取教师班级列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取教师班级列表失败")


@router.get("/statistics/overview")
def get_teacher_statistics(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取教师统计概览
    """
    try:
        # 总体统计
        total_sql = """
            SELECT 
                COUNT(*) as total_teachers,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_teachers,
                SUM(CASE WHEN r.permission_code = 'headmaster' THEN 1 ELSE 0 END) as headmaster_count,
                SUM(CASE WHEN r.permission_code = 'subject_leader' THEN 1 ELSE 0 END) as subject_leader_count,
                SUM(CASE WHEN r.permission_code = 'lesson_leader' THEN 1 ELSE 0 END) as lesson_leader_count
            FROM sys_users u
            JOIN sys_roles r ON u.role_id = r.id
            WHERE r.permission_code IN ('teacher', 'headmaster', 'lesson_leader', 'subject_leader', 'grade_leader')
        """
        total_stats = db.execute(text(total_sql)).fetchone()
        
        # 学科分布
        subject_sql = """
            SELECT subject_name, COUNT(*) as count
            FROM biz_teacher_class_rel
            WHERE subject_name IS NOT NULL
            GROUP BY subject_name
            ORDER BY count DESC
        """
        subject_results = db.execute(text(subject_sql)).fetchall()
        
        return {
            "success": True,
            "overview": {
                "total_teachers": total_stats.total_teachers if total_stats else 0,
                "active_teachers": total_stats.active_teachers if total_stats else 0,
                "headmaster_count": total_stats.headmaster_count if total_stats else 0,
                "subject_leader_count": total_stats.subject_leader_count if total_stats else 0,
                "lesson_leader_count": total_stats.lesson_leader_count if total_stats else 0
            },
            "subject_distribution": [
                {"subject_name": r.subject_name, "count": r.count} for r in subject_results
            ]
        }
        
    except Exception as e:
        logger.error(f"获取教师统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取教师统计失败")
