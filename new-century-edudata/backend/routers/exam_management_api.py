"""
考试管理API
提供考试创建、编辑、删除、列表查询等功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from pydantic import BaseModel
from datetime import date
import json
import logging

from core.database import get_db
from core.security import get_current_user, require_permission

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/exams", tags=["考试管理"])


# ============ Pydantic模型定义 ============

class ExamCreateRequest(BaseModel):
    """创建考试请求"""
    exam_name: str
    term: str
    exam_type: str  # 期中/期末/月考/统测
    grade_level: str
    exam_date: date
    subjects: List[str]
    full_score: float = 500.0
    description: Optional[str] = None


class ExamUpdateRequest(BaseModel):
    """更新考试请求"""
    exam_name: Optional[str] = None
    term: Optional[str] = None
    exam_type: Optional[str] = None
    grade_level: Optional[str] = None
    exam_date: Optional[date] = None
    subjects: Optional[List[str]] = None
    full_score: Optional[float] = None
    description: Optional[str] = None


class ExamResponse(BaseModel):
    """考试响应"""
    id: int
    exam_name: str
    term: str
    exam_type: str
    grade_level: str
    exam_date: str
    subjects: List[str]
    full_score: float
    description: Optional[str]
    created_at: str


class ExamListResponse(BaseModel):
    """考试列表响应"""
    total: int
    page: int
    page_size: int
    exams: List[ExamResponse]


class ExamDetailResponse(BaseModel):
    """考试详情响应"""
    id: int
    exam_name: str
    term: str
    exam_type: str
    grade_level: str
    exam_date: str
    subjects: List[str]
    full_score: float
    description: Optional[str]
    total_students: int
    valid_students: int
    class_count: int
    created_at: str


# ============ API路由 ============

@router.post("/create")
def create_exam(
    request: ExamCreateRequest,
    current_user: dict = Depends(require_permission("exam_admin")),
    db: Session = Depends(get_db)
):
    """
    创建新考试
    
    需要考务管理员或教务主任权限
    """
    try:
        # 检查同学期同类型考试是否已存在
        check_sql = """
            SELECT id FROM biz_exams 
            WHERE term = :term 
              AND exam_type = :exam_type 
              AND grade_level = :grade_level
        """
        existing = db.execute(text(check_sql), {
            "term": request.term,
            "exam_type": request.exam_type,
            "grade_level": request.grade_level
        }).fetchone()
        
        if existing:
            return {
                "success": False,
                "message": f"该学期已存在{request.exam_type}考试"
            }
        
        # 创建考试
        subjects_json = json.dumps(request.subjects, ensure_ascii=False)
        
        insert_sql = """
            INSERT INTO biz_exams 
            (exam_name, term, exam_type, grade_level, exam_date, subjects, full_score, description, created_by, created_at)
            VALUES 
            (:exam_name, :term, :exam_type, :grade_level, :exam_date, :subjects, :full_score, :description, :created_by, NOW())
        """
        
        result = db.execute(text(insert_sql), {
            "exam_name": request.exam_name,
            "term": request.term,
            "exam_type": request.exam_type,
            "grade_level": request.grade_level,
            "exam_date": request.exam_date,
            "subjects": subjects_json,
            "full_score": request.full_score,
            "description": request.description,
            "created_by": current_user["id"]
        })
        
        exam_id = result.lastrowid
        db.commit()
        
        logger.info(f"创建考试成功: {request.exam_name}, 操作人: {current_user['username']}")
        
        return {
            "success": True,
            "message": "考试创建成功",
            "exam_id": exam_id
        }
        
    except Exception as e:
        logger.error(f"创建考试失败: {e}")
        raise HTTPException(status_code=500, detail="创建考试失败")


@router.get("/list", response_model=ExamListResponse)
def get_exam_list(
    term: Optional[str] = Query(None, description="学期筛选"),
    grade_level: Optional[str] = Query(None, description="年级筛选"),
    exam_type: Optional[str] = Query(None, description="考试类型筛选"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取考试列表
    """
    try:
        offset = (page - 1) * page_size
        
        # 构建查询条件
        conditions = []
        params = {}
        
        if term:
            conditions.append("term = :term")
            params["term"] = term
        
        if grade_level:
            conditions.append("grade_level = :grade_level")
            params["grade_level"] = grade_level
            
        if exam_type:
            conditions.append("exam_type = :exam_type")
            params["exam_type"] = exam_type
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        # 查询总数
        count_sql = f"SELECT COUNT(*) as total FROM biz_exams {where_clause}"
        count_result = db.execute(text(count_sql), params).fetchone()
        total = count_result.total if count_result else 0
        
        # 查询列表
        list_sql = f"""
            SELECT id, exam_name, term, exam_type, grade_level, exam_date, 
                   subjects, full_score, description, created_at
            FROM biz_exams
            {where_clause}
            ORDER BY exam_date DESC
            LIMIT :limit OFFSET :offset
        """
        params["limit"] = page_size
        params["offset"] = offset
        
        results = db.execute(text(list_sql), params).fetchall()
        
        exams = []
        for result in results:
            subjects = json.loads(result.subjects) if result.subjects else []
            exams.append(ExamResponse(
                id=result.id,
                exam_name=result.exam_name,
                term=result.term,
                exam_type=result.exam_type,
                grade_level=result.grade_level,
                exam_date=result.exam_date.isoformat() if result.exam_date else "",
                subjects=subjects,
                full_score=float(result.full_score) if result.full_score else 500.0,
                description=result.description,
                created_at=result.created_at.isoformat() if result.created_at else ""
            ))
        
        return ExamListResponse(
            total=total,
            page=page,
            page_size=page_size,
            exams=exams
        )
        
    except Exception as e:
        logger.error(f"获取考试列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取考试列表失败")


@router.get("/{exam_id}/detail", response_model=ExamDetailResponse)
def get_exam_detail(
    exam_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取考试详情
    """
    try:
        # 查询考试基本信息
        exam_sql = """
            SELECT id, exam_name, term, exam_type, grade_level, exam_date, 
                   subjects, full_score, description, created_at
            FROM biz_exams
            WHERE id = :exam_id
        """
        exam = db.execute(text(exam_sql), {"exam_id": exam_id}).fetchone()
        
        if not exam:
            raise HTTPException(status_code=404, detail="考试不存在")
        
        # 查询统计数据
        stats_sql = """
            SELECT 
                COUNT(*) as total_students,
                SUM(CASE WHEN is_included = 1 THEN 1 ELSE 0 END) as valid_students,
                COUNT(DISTINCT class_name) as class_count
            FROM biz_scores
            WHERE exam_id = :exam_id
        """
        stats = db.execute(text(stats_sql), {"exam_id": exam_id}).fetchone()
        
        subjects = json.loads(exam.subjects) if exam.subjects else []
        
        return ExamDetailResponse(
            id=exam.id,
            exam_name=exam.exam_name,
            term=exam.term,
            exam_type=exam.exam_type,
            grade_level=exam.grade_level,
            exam_date=exam.exam_date.isoformat() if exam.exam_date else "",
            subjects=subjects,
            full_score=float(exam.full_score) if exam.full_score else 500.0,
            description=exam.description,
            total_students=stats.total_students if stats else 0,
            valid_students=stats.valid_students if stats else 0,
            class_count=stats.class_count if stats else 0,
            created_at=exam.created_at.isoformat() if exam.created_at else ""
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取考试详情失败: {e}")
        raise HTTPException(status_code=500, detail="获取考试详情失败")


@router.put("/{exam_id}/update")
def update_exam(
    exam_id: int,
    request: ExamUpdateRequest,
    current_user: dict = Depends(require_permission("exam_admin")),
    db: Session = Depends(get_db)
):
    """
    更新考试信息
    
    需要考务管理员或教务主任权限
    """
    try:
        # 检查考试是否存在
        check_sql = "SELECT id FROM biz_exams WHERE id = :exam_id"
        existing = db.execute(text(check_sql), {"exam_id": exam_id}).fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail="考试不存在")
        
        # 构建更新字段
        update_fields = []
        params = {"exam_id": exam_id}
        
        if request.exam_name is not None:
            update_fields.append("exam_name = :exam_name")
            params["exam_name"] = request.exam_name
            
        if request.term is not None:
            update_fields.append("term = :term")
            params["term"] = request.term
            
        if request.exam_type is not None:
            update_fields.append("exam_type = :exam_type")
            params["exam_type"] = request.exam_type
            
        if request.grade_level is not None:
            update_fields.append("grade_level = :grade_level")
            params["grade_level"] = request.grade_level
            
        if request.exam_date is not None:
            update_fields.append("exam_date = :exam_date")
            params["exam_date"] = request.exam_date
            
        if request.subjects is not None:
            update_fields.append("subjects = :subjects")
            params["subjects"] = json.dumps(request.subjects, ensure_ascii=False)
            
        if request.full_score is not None:
            update_fields.append("full_score = :full_score")
            params["full_score"] = request.full_score
            
        if request.description is not None:
            update_fields.append("description = :description")
            params["description"] = request.description
        
        if not update_fields:
            return {"success": False, "message": "没有要更新的字段"}
        
        update_fields.append("updated_at = NOW()")
        
        update_sql = f"""
            UPDATE biz_exams 
            SET {', '.join(update_fields)}
            WHERE id = :exam_id
        """
        
        db.execute(text(update_sql), params)
        db.commit()
        
        logger.info(f"更新考试成功: exam_id={exam_id}, 操作人: {current_user['username']}")
        
        return {"success": True, "message": "考试信息更新成功"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新考试失败: {e}")
        raise HTTPException(status_code=500, detail="更新考试失败")


@router.delete("/{exam_id}/delete")
def delete_exam(
    exam_id: int,
    current_user: dict = Depends(require_permission("edu_admin")),
    db: Session = Depends(get_db)
):
    """
    删除考试
    
    需要教务主任权限(危险操作，会级联删除成绩数据)
    """
    try:
        # 检查考试是否存在
        check_sql = "SELECT exam_name FROM biz_exams WHERE id = :exam_id"
        exam = db.execute(text(check_sql), {"exam_id": exam_id}).fetchone()
        
        if not exam:
            raise HTTPException(status_code=404, detail="考试不存在")
        
        # 检查是否已有成绩数据
        score_check_sql = "SELECT COUNT(*) as count FROM biz_scores WHERE exam_id = :exam_id"
        score_count = db.execute(text(score_check_sql), {"exam_id": exam_id}).fetchone()
        
        if score_count and score_count.count > 0:
            return {
                "success": False,
                "message": f"该考试已有{score_count.count}条成绩数据，无法删除"
            }
        
        # 删除考试(级联删除分层和Z值缓存)
        delete_sql = "DELETE FROM biz_exams WHERE id = :exam_id"
        db.execute(text(delete_sql), {"exam_id": exam_id})
        db.commit()
        
        logger.info(f"删除考试成功: {exam.exam_name}, 操作人: {current_user['username']}")
        
        return {"success": True, "message": "考试删除成功"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除考试失败: {e}")
        raise HTTPException(status_code=500, detail="删除考试失败")


@router.get("/{exam_id}/classes")
def get_exam_classes(
    exam_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取考试涉及的班级列表
    """
    try:
        sql = """
            SELECT DISTINCT class_name
            FROM biz_scores
            WHERE exam_id = :exam_id
            ORDER BY class_name
        """
        
        results = db.execute(text(sql), {"exam_id": exam_id}).fetchall()
        
        classes = [r.class_name for r in results]
        
        return {
            "success": True,
            "exam_id": exam_id,
            "class_count": len(classes),
            "classes": classes
        }
        
    except Exception as e:
        logger.error(f"获取考试班级列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取考试班级列表失败")


@router.get("/{exam_id}/statistics")
def get_exam_statistics(
    exam_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取考试统计概览
    """
    try:
        # 总体统计
        total_sql = """
            SELECT 
                COUNT(*) as total_students,
                SUM(CASE WHEN is_included = 1 THEN 1 ELSE 0 END) as valid_students,
                AVG(CASE WHEN is_included = 1 THEN total_score END) as avg_score,
                MAX(CASE WHEN is_included = 1 THEN total_score END) as max_score,
                MIN(CASE WHEN is_included = 1 THEN total_score END) as min_score,
                COUNT(DISTINCT class_name) as class_count
            FROM biz_scores
            WHERE exam_id = :exam_id
        """
        total_stats = db.execute(text(total_sql), {"exam_id": exam_id}).fetchone()
        
        # 分数段统计
        range_sql = """
            SELECT 
                SUM(CASE WHEN total_score >= 450 THEN 1 ELSE 0 END) as range_450_500,
                SUM(CASE WHEN total_score >= 400 AND total_score < 450 THEN 1 ELSE 0 END) as range_400_449,
                SUM(CASE WHEN total_score >= 350 AND total_score < 400 THEN 1 ELSE 0 END) as range_350_399,
                SUM(CASE WHEN total_score >= 300 AND total_score < 350 THEN 1 ELSE 0 END) as range_300_349,
                SUM(CASE WHEN total_score >= 250 AND total_score < 300 THEN 1 ELSE 0 END) as range_250_299,
                SUM(CASE WHEN total_score < 250 THEN 1 ELSE 0 END) as range_below_250
            FROM biz_scores
            WHERE exam_id = :exam_id AND is_included = 1
        """
        range_stats = db.execute(text(range_sql), {"exam_id": exam_id}).fetchone()
        
        return {
            "success": True,
            "exam_id": exam_id,
            "overview": {
                "total_students": total_stats.total_students if total_stats else 0,
                "valid_students": total_stats.valid_students if total_stats else 0,
                "class_count": total_stats.class_count if total_stats else 0,
                "avg_score": round(float(total_stats.avg_score), 2) if total_stats and total_stats.avg_score else 0,
                "max_score": round(float(total_stats.max_score), 1) if total_stats and total_stats.max_score else 0,
                "min_score": round(float(total_stats.min_score), 1) if total_stats and total_stats.min_score else 0
            },
            "score_distribution": {
                "450-500": range_stats.range_450_500 if range_stats else 0,
                "400-449": range_stats.range_400_449 if range_stats else 0,
                "350-399": range_stats.range_350_399 if range_stats else 0,
                "300-349": range_stats.range_300_349 if range_stats else 0,
                "250-299": range_stats.range_250_299 if range_stats else 0,
                "below_250": range_stats.range_below_250 if range_stats else 0
            }
        }
        
    except Exception as e:
        logger.error(f"获取考试统计失败: {e}")
        raise HTTPException(status_code=500, detail="获取考试统计失败")
