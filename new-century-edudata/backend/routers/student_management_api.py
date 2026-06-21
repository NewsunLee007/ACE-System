"""
学生管理API
提供学生信息管理、学籍异动记录、学生查询等功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from pydantic import BaseModel
from datetime import date
import logging

from core.database import get_db
from core.security import require_permission_codes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/students", tags=["学生管理"])

STUDENT_MANAGEMENT_PERMISSION_CODES = ("exam_admin",)


# ============ Pydantic模型定义 ============

class StudentCreateRequest(BaseModel):
    """创建学生请求"""
    student_code: str
    name: str
    gender: int = 1  # 1男, 0女
    enrollment_year: int
    current_grade: Optional[str] = None
    current_class: Optional[str] = None
    id_card_last6: Optional[str] = None


class StudentUpdateRequest(BaseModel):
    """更新学生请求"""
    name: Optional[str] = None
    gender: Optional[int] = None
    current_grade: Optional[str] = None
    current_class: Optional[str] = None
    id_card_last6: Optional[str] = None
    status: Optional[str] = None


class StudentResponse(BaseModel):
    """学生响应"""
    id: int
    student_code: str
    name: str
    gender: int
    enrollment_year: int
    current_grade: Optional[str]
    current_class: Optional[str]
    id_card_last6: Optional[str]
    status: str
    created_at: str


class StatusChangeRequest(BaseModel):
    """学籍异动请求"""
    student_id: int
    term: str
    change_type: str  # 转学/休学/复学/借读/退学
    change_date: date
    reason: Optional[str] = None
    from_class: Optional[str] = None
    to_class: Optional[str] = None


class StatusChangeResponse(BaseModel):
    """学籍异动响应"""
    id: int
    student_id: int
    student_name: str
    term: str
    change_type: str
    change_date: str
    reason: Optional[str]
    from_class: Optional[str]
    to_class: Optional[str]
    created_at: str


# ============ API路由 ============

@router.get("/list")
def get_student_list(
    grade: Optional[str] = Query(None, description="年级筛选"),
    class_name: Optional[str] = Query(None, description="班级筛选"),
    status: Optional[str] = Query("在读", description="状态筛选"),
    keyword: Optional[str] = Query(None, description="关键字搜索(姓名/学籍号)"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: dict = Depends(require_permission_codes(*STUDENT_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    获取学生列表
    """
    try:
        offset = (page - 1) * page_size
        
        # 构建查询条件
        conditions = []
        params = {}
        
        if grade:
            conditions.append("current_grade = :grade")
            params["grade"] = grade
        
        if class_name:
            conditions.append("current_class = :class_name")
            params["class_name"] = class_name
            
        if status:
            conditions.append("status = :status")
            params["status"] = status
        
        if keyword:
            conditions.append("(name LIKE :keyword OR student_code LIKE :keyword)")
            params["keyword"] = f"%{keyword}%"
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        # 查询总数
        count_sql = f"SELECT COUNT(*) as total FROM biz_students {where_clause}"
        count_result = db.execute(text(count_sql), params).fetchone()
        total = count_result.total if count_result else 0
        
        # 查询列表
        list_sql = f"""
            SELECT id, student_code, name, gender, enrollment_year, 
                   current_grade, current_class, id_card_last6, status, created_at
            FROM biz_students
            {where_clause}
            ORDER BY enrollment_year DESC, current_class, student_code
            LIMIT :limit OFFSET :offset
        """
        params["limit"] = page_size
        params["offset"] = offset
        
        results = db.execute(text(list_sql), params).fetchall()
        
        students = []
        for result in results:
            students.append({
                "id": result.id,
                "student_code": result.student_code,
                "name": result.name,
                "gender": result.gender,
                "enrollment_year": result.enrollment_year,
                "current_grade": result.current_grade,
                "current_class": result.current_class,
                "id_card_last6": result.id_card_last6,
                "status": result.status,
                "created_at": result.created_at.isoformat() if result.created_at else ""
            })
        
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "students": students
        }
        
    except Exception as e:
        logger.error(f"获取学生列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取学生列表失败")


@router.get("/{student_id}/detail")
def get_student_detail(
    student_id: int,
    current_user: dict = Depends(require_permission_codes(*STUDENT_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    获取学生详情
    """
    try:
        # 查询学生基本信息
        student_sql = """
            SELECT id, student_code, name, gender, enrollment_year, 
                   current_grade, current_class, id_card_last6, status, created_at
            FROM biz_students
            WHERE id = :student_id
        """
        student = db.execute(text(student_sql), {"student_id": student_id}).fetchone()
        
        if not student:
            raise HTTPException(status_code=404, detail="学生不存在")
        
        # 查询学籍异动记录
        changes_sql = """
            SELECT id, term, change_type, change_date, reason, from_class, to_class, created_at
            FROM biz_status_changes
            WHERE student_id = :student_id
            ORDER BY change_date DESC
        """
        changes = db.execute(text(changes_sql), {"student_id": student_id}).fetchall()
        
        # 查询成绩统计
        scores_sql = """
            SELECT COUNT(*) as exam_count, 
                   AVG(total_score) as avg_score,
                   MAX(total_score) as max_score
            FROM biz_scores
            WHERE student_id = :student_id AND is_included = 1
        """
        scores = db.execute(text(scores_sql), {"student_id": student_id}).fetchone()
        
        return {
            "success": True,
            "student": {
                "id": student.id,
                "student_code": student.student_code,
                "name": student.name,
                "gender": student.gender,
                "enrollment_year": student.enrollment_year,
                "current_grade": student.current_grade,
                "current_class": student.current_class,
                "id_card_last6": student.id_card_last6,
                "status": student.status,
                "created_at": student.created_at.isoformat() if student.created_at else ""
            },
            "status_changes": [
                {
                    "id": c.id,
                    "term": c.term,
                    "change_type": c.change_type,
                    "change_date": c.change_date.isoformat() if c.change_date else "",
                    "reason": c.reason,
                    "from_class": c.from_class,
                    "to_class": c.to_class,
                    "created_at": c.created_at.isoformat() if c.created_at else ""
                } for c in changes
            ],
            "score_statistics": {
                "exam_count": scores.exam_count if scores else 0,
                "avg_score": round(float(scores.avg_score), 2) if scores and scores.avg_score else 0,
                "max_score": round(float(scores.max_score), 1) if scores and scores.max_score else 0
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取学生详情失败: {e}")
        raise HTTPException(status_code=500, detail="获取学生详情失败")


@router.post("/create")
def create_student(
    request: StudentCreateRequest,
    current_user: dict = Depends(require_permission_codes(*STUDENT_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    创建学生
    
    需要考务管理员或教务主任权限
    """
    try:
        # 检查学籍辅号是否已存在
        check_sql = "SELECT id FROM biz_students WHERE student_code = :student_code"
        existing = db.execute(text(check_sql), {"student_code": request.student_code}).fetchone()
        
        if existing:
            return {
                "success": False,
                "message": "学籍辅号已存在"
            }
        
        # 创建学生
        insert_sql = """
            INSERT INTO biz_students 
            (student_code, name, gender, enrollment_year, current_grade, current_class, id_card_last6, status, created_at, updated_at)
            VALUES 
            (:student_code, :name, :gender, :enrollment_year, :current_grade, :current_class, :id_card_last6, '在读', NOW(), NOW())
        """
        
        result = db.execute(text(insert_sql), {
            "student_code": request.student_code,
            "name": request.name,
            "gender": request.gender,
            "enrollment_year": request.enrollment_year,
            "current_grade": request.current_grade,
            "current_class": request.current_class,
            "id_card_last6": request.id_card_last6
        })
        
        student_id = result.lastrowid
        db.commit()
        
        logger.info(f"创建学生成功: {request.name}({request.student_code}), 操作人: {current_user['username']}")
        
        return {
            "success": True,
            "message": "学生创建成功",
            "student_id": student_id
        }
        
    except Exception as e:
        logger.error(f"创建学生失败: {e}")
        raise HTTPException(status_code=500, detail="创建学生失败")


@router.put("/{student_id}/update")
def update_student(
    student_id: int,
    request: StudentUpdateRequest,
    current_user: dict = Depends(require_permission_codes(*STUDENT_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    更新学生信息
    
    需要考务管理员或教务主任权限
    """
    try:
        # 检查学生是否存在
        check_sql = "SELECT id FROM biz_students WHERE id = :student_id"
        existing = db.execute(text(check_sql), {"student_id": student_id}).fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail="学生不存在")
        
        # 构建更新字段
        update_fields = []
        params = {"student_id": student_id}
        
        if request.name is not None:
            update_fields.append("name = :name")
            params["name"] = request.name
            
        if request.gender is not None:
            update_fields.append("gender = :gender")
            params["gender"] = request.gender
            
        if request.current_grade is not None:
            update_fields.append("current_grade = :current_grade")
            params["current_grade"] = request.current_grade
            
        if request.current_class is not None:
            update_fields.append("current_class = :current_class")
            params["current_class"] = request.current_class
            
        if request.id_card_last6 is not None:
            update_fields.append("id_card_last6 = :id_card_last6")
            params["id_card_last6"] = request.id_card_last6
            
        if request.status is not None:
            update_fields.append("status = :status")
            params["status"] = request.status
        
        if not update_fields:
            return {"success": False, "message": "没有要更新的字段"}
        
        update_fields.append("updated_at = NOW()")
        
        update_sql = f"""
            UPDATE biz_students 
            SET {', '.join(update_fields)}
            WHERE id = :student_id
        """
        
        db.execute(text(update_sql), params)
        db.commit()
        
        logger.info(f"更新学生成功: student_id={student_id}, 操作人: {current_user['username']}")
        
        return {"success": True, "message": "学生信息更新成功"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新学生失败: {e}")
        raise HTTPException(status_code=500, detail="更新学生失败")


@router.post("/status-change")
def record_status_change(
    request: StatusChangeRequest,
    current_user: dict = Depends(require_permission_codes(*STUDENT_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    记录学籍异动
    
    需要考务管理员或教务主任权限
    """
    try:
        # 检查学生是否存在
        student_sql = "SELECT name, current_class FROM biz_students WHERE id = :student_id"
        student = db.execute(text(student_sql), {"student_id": request.student_id}).fetchone()
        
        if not student:
            raise HTTPException(status_code=404, detail="学生不存在")
        
        # 记录异动
        insert_sql = """
            INSERT INTO biz_status_changes 
            (student_id, term, change_type, change_date, reason, from_class, to_class, created_by, created_at)
            VALUES 
            (:student_id, :term, :change_type, :change_date, :reason, :from_class, :to_class, :created_by, NOW())
        """
        
        db.execute(text(insert_sql), {
            "student_id": request.student_id,
            "term": request.term,
            "change_type": request.change_type,
            "change_date": request.change_date,
            "reason": request.reason,
            "from_class": request.from_class or student.current_class,
            "to_class": request.to_class,
            "created_by": current_user["id"]
        })
        
        # 更新学生状态
        status_map = {
            "休学": "休学",
            "复学": "在读",
            "转学": "转学",
            "退学": "退学",
            "借读": "借读"
        }
        
        new_status = status_map.get(request.change_type, "在读")
        
        update_sql = """
            UPDATE biz_students 
            SET status = :status, updated_at = NOW()
            WHERE id = :student_id
        """
        db.execute(text(update_sql), {"status": new_status, "student_id": request.student_id})
        
        db.commit()
        
        logger.info(f"记录学籍异动成功: {student.name} - {request.change_type}, 操作人: {current_user['username']}")
        
        return {
            "success": True,
            "message": "学籍异动记录成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"记录学籍异动失败: {e}")
        raise HTTPException(status_code=500, detail="记录学籍异动失败")


@router.get("/{student_id}/exams")
def get_student_exams(
    student_id: int,
    limit: int = Query(10, description="返回最近几次考试"),
    current_user: dict = Depends(require_permission_codes(*STUDENT_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    获取学生考试历史
    """
    try:
        sql = """
            SELECT 
                s.exam_id,
                e.exam_name,
                e.exam_date,
                e.term,
                s.total_score,
                s.score_chinese,
                s.score_math,
                s.score_english,
                s.score_science,
                s.score_society,
                s.class_name,
                RANK() OVER (PARTITION BY s.exam_id, s.class_name ORDER BY s.total_score DESC) as class_rank
            FROM biz_scores s
            JOIN biz_exams e ON s.exam_id = e.id
            WHERE s.student_id = :student_id
              AND s.is_included = 1
            ORDER BY e.exam_date DESC
            LIMIT :limit
        """
        
        results = db.execute(text(sql), {"student_id": student_id, "limit": limit}).fetchall()
        
        exams = []
        for result in results:
            exams.append({
                "exam_id": result.exam_id,
                "exam_name": result.exam_name,
                "exam_date": result.exam_date.isoformat() if result.exam_date else "",
                "term": result.term,
                "total_score": float(result.total_score) if result.total_score else 0,
                "class_rank": result.class_rank,
                "class_name": result.class_name,
                "subjects": {
                    "语文": float(result.score_chinese) if result.score_chinese else None,
                    "数学": float(result.score_math) if result.score_math else None,
                    "英语": float(result.score_english) if result.score_english else None,
                    "科学": float(result.score_science) if result.score_science else None,
                    "社会": float(result.score_society) if result.score_society else None
                }
            })
        
        return {
            "success": True,
            "student_id": student_id,
            "total_exams": len(exams),
            "exams": exams
        }
        
    except Exception as e:
        logger.error(f"获取学生考试历史失败: {e}")
        raise HTTPException(status_code=500, detail="获取学生考试历史失败")


@router.get("/statistics/overview")
def get_student_statistics(
    grade: Optional[str] = Query(None, description="年级筛选"),
    current_user: dict = Depends(require_permission_codes(*STUDENT_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    获取学生统计概览
    """
    try:
        # 构建查询条件
        where_clause = "WHERE current_grade = :grade" if grade else ""
        params = {"grade": grade} if grade else {}
        
        # 总体统计
        total_sql = f"""
            SELECT 
                COUNT(*) as total_students,
                SUM(CASE WHEN gender = 1 THEN 1 ELSE 0 END) as male_count,
                SUM(CASE WHEN gender = 0 THEN 1 ELSE 0 END) as female_count,
                SUM(CASE WHEN status = '在读' THEN 1 ELSE 0 END) as active_count,
                SUM(CASE WHEN status = '休学' THEN 1 ELSE 0 END) as suspended_count,
                SUM(CASE WHEN status = '转学' THEN 1 ELSE 0 END) as transferred_count
            FROM biz_students
            {where_clause}
        """
        total_stats = db.execute(text(total_sql), params).fetchone()
        
        # 班级分布
        class_sql = f"""
            SELECT current_class, COUNT(*) as count
            FROM biz_students
            {where_clause}
            GROUP BY current_class
            ORDER BY current_class
        """
        class_results = db.execute(text(class_sql), params).fetchall()
        
        return {
            "success": True,
            "overview": {
                "total_students": total_stats.total_students if total_stats else 0,
                "male_count": total_stats.male_count if total_stats else 0,
                "female_count": total_stats.female_count if total_stats else 0,
                "active_count": total_stats.active_count if total_stats else 0,
                "suspended_count": total_stats.suspended_count if total_stats else 0,
                "transferred_count": total_stats.transferred_count if total_stats else 0
            },
            "class_distribution": [
                {"class_name": r.current_class, "count": r.count} for r in class_results
            ]
        }
        
    except Exception as e:
        logger.error(f"获取学生统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取学生统计失败")
