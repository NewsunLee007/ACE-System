"""
班主任专属视图API
提供班级历史趋势、学生进退步分析、单科追踪等功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging

from services.score_analysis_service import ScoreAnalysisService, WeakSubjectTracker
from core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/analysis", tags=["班主任专属视图"])


# ============ Pydantic模型定义 ============

class HistoricalTrendItem(BaseModel):
    """历史趋势单项"""
    exam_id: int
    exam_name: str
    exam_date: Optional[str]
    z_value: Optional[float]
    class_mean: Optional[float]
    layer_mean: Optional[float]
    mean_diff: Optional[float]
    top20_ratio: Optional[float]
    top80_ratio: Optional[float]


class ClassLongitudinalResponse(BaseModel):
    """班级纵向追踪响应模型"""
    class_name: str
    term: str
    total_exams: int
    trends: List[HistoricalTrendItem]
    current_stats: Dict[str, Any]


class StudentRankChange(BaseModel):
    """学生排名变化模型"""
    student_id: int
    student_name: str
    student_code: str
    current_score: float
    previous_score: Optional[float]
    current_rank: int
    previous_rank: Optional[int]
    rank_change: int
    change_direction: str


class SubjectGapTrend(BaseModel):
    """学科差距趋势模型"""
    term: str
    exam_id: int
    exam_name: str
    class_mean: float
    layer_mean: float
    gap: float
    status: str


class WeakSubjectAnalysisResponse(BaseModel):
    """薄弱学科分析响应模型"""
    class_name: str
    subject: str
    trends: List[SubjectGapTrend]
    total_exams: int
    overall_improvement: float
    trend_direction: str


# ============ API路由 ============

@router.get("/classes/{class_name}/longitudinal", response_model=ClassLongitudinalResponse)
def get_class_longitudinal_view(
    class_name: str,
    term: str = Query("2025-1", description="当前学期，如: 2025-1"),
    limit: int = Query(5, description="返回最近几次考试的数据"),
    db: Session = Depends(get_db)
):
    """
    获取班级历史成绩纵向追踪视图
    
    包含:
    - 历次考试的Z值走势
    - 班级均分与年级均分的差距变化
    - 前20%、前80%贡献率变化
    """
    try:
        service = ScoreAnalysisService(db)
        
        # 获取历史趋势数据
        trends = service.get_class_historical_trends(class_name, term, limit)
        
        # 获取最近一次考试的统计
        latest = trends[0] if trends else None
        
        return ClassLongitudinalResponse(
            class_name=class_name,
            term=term,
            total_exams=len(trends),
            trends=[
                HistoricalTrendItem(
                    exam_id=t["exam_id"],
                    exam_name=t["exam_name"],
                    exam_date=t["exam_date"],
                    z_value=t["z_value"],
                    class_mean=t["class_mean"],
                    layer_mean=t["layer_mean"],
                    mean_diff=t["mean_diff"],
                    top20_ratio=t["top20_ratio"],
                    top80_ratio=t["top80_ratio"]
                ) for t in trends
            ],
            current_stats={
                "latest_z_value": latest["z_value"] if latest else None,
                "latest_mean_diff": latest["mean_diff"] if latest else None,
                "trend_direction": "上升" if len(trends) >= 2 and trends[0]["z_value"] and trends[-1]["z_value"] and trends[0]["z_value"] > trends[-1]["z_value"] else "下降"
            }
        )
        
    except Exception as e:
        logger.error(f"获取班级纵向视图失败: {e}")
        raise HTTPException(status_code=500, detail="获取班级纵向视图失败")


@router.get("/classes/{class_name}/student-rank-changes")
def get_student_rank_changes(
    class_name: str,
    exam_id: int,
    previous_exam_id: Optional[int] = Query(None, description="前一次考试ID，为空则自动查找"),
    db: Session = Depends(get_db)
):
    """
    获取班级学生进退步名单
    
    对比两次考试，计算每位学生的排名变化
    """
    try:
        # 如果没有提供前一次考试ID，自动查找
        if not previous_exam_id:
            prev_exam = db.execute(
                text("""
                    SELECT id FROM biz_exams 
                    WHERE exam_date < (SELECT exam_date FROM biz_exams WHERE id = :exam_id)
                    ORDER BY exam_date DESC LIMIT 1
                """),
                {"exam_id": exam_id}
            ).fetchone()
            
            if prev_exam:
                previous_exam_id = prev_exam.id
            else:
                return {
                    "class_name": class_name,
                    "exam_id": exam_id,
                    "previous_exam_id": None,
                    "students": [],
                    "message": "没有更早的考试数据可供对比"
                }
        
        # 查询当前考试班级排名
        current_sql = """
            SELECT 
                s.student_id,
                st.name as student_name,
                st.student_code,
                s.total_score,
                RANK() OVER (ORDER BY s.total_score DESC) as class_rank
            FROM biz_scores s
            JOIN biz_students st ON s.student_id = st.id
            WHERE s.exam_id = :exam_id 
              AND s.class_name = :class_name
              AND s.is_included = 1
        """
        
        current_results = db.execute(
            text(current_sql),
            {"exam_id": exam_id, "class_name": class_name}
        ).fetchall()
        
        # 查询前一次考试班级排名
        previous_sql = """
            SELECT 
                s.student_id,
                s.total_score,
                RANK() OVER (ORDER BY s.total_score DESC) as class_rank
            FROM biz_scores s
            WHERE s.exam_id = :exam_id 
              AND s.class_name = :class_name
              AND s.is_included = 1
        """
        
        previous_results = db.execute(
            text(previous_sql),
            {"exam_id": previous_exam_id, "class_name": class_name}
        ).fetchall()
        
        # 构建前一次考试的字典
        previous_dict = {r.student_id: r for r in previous_results}
        
        # 计算排名变化
        students = []
        for curr in current_results:
            prev = previous_dict.get(curr.student_id)
            
            rank_change = 0
            change_direction = "持平"
            
            if prev:
                rank_change = prev.class_rank - curr.class_rank  # 正数表示进步
                if rank_change > 0:
                    change_direction = "进步"
                elif rank_change < 0:
                    change_direction = "退步"
            
            students.append({
                "student_id": curr.student_id,
                "student_name": curr.student_name,
                "student_code": curr.student_code,
                "current_score": float(curr.total_score) if curr.total_score else 0,
                "previous_score": float(prev.total_score) if prev and prev.total_score else None,
                "current_rank": curr.class_rank,
                "previous_rank": prev.class_rank if prev else None,
                "rank_change": rank_change,
                "change_direction": change_direction
            })
        
        # 按排名变化排序（进步多的在前）
        students.sort(key=lambda x: (x["change_direction"] != "进步", -x["rank_change"]))
        
        return {
            "class_name": class_name,
            "exam_id": exam_id,
            "previous_exam_id": previous_exam_id,
            "total_students": len(students),
            "progress_count": len([s for s in students if s["change_direction"] == "进步"]),
            "regress_count": len([s for s in students if s["change_direction"] == "退步"]),
            "students": students
        }
        
    except Exception as e:
        logger.error(f"获取学生进退步名单失败: {e}")
        raise HTTPException(status_code=500, detail="获取学生进退步名单失败")


@router.get("/classes/{class_name}/weak-subject-trend", response_model=WeakSubjectAnalysisResponse)
def get_class_weak_subject_trend(
    class_name: str,
    subject: str = Query(..., description="学科名称: chinese/math/english/science/society"),
    terms: str = Query("2024-2,2025-1", description="学期列表，逗号分隔"),
    db: Session = Depends(get_db)
):
    """
    获取班级薄弱学科趋势分析
    
    追踪指定学科与年级均分的差距变化，量化提升效果
    """
    try:
        tracker = WeakSubjectTracker(db)
        term_list = [t.strip() for t in terms.split(",")]
        
        result = tracker.get_subject_trend_analysis(class_name, subject, term_list)
        
        return WeakSubjectAnalysisResponse(
            class_name=result["class_name"],
            subject=result["subject"],
            trends=[
                SubjectGapTrend(
                    term=t["term"],
                    exam_id=t["exam_id"],
                    exam_name=t["exam_name"],
                    class_mean=t["class_mean"],
                    layer_mean=t["layer_mean"],
                    gap=t["gap"],
                    status=t["status"]
                ) for t in result["trends"]
            ],
            total_exams=result["total_exams"],
            overall_improvement=result["overall_improvement"],
            trend_direction=result["trend_direction"]
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"获取薄弱学科趋势失败: {e}")
        raise HTTPException(status_code=500, detail="获取薄弱学科趋势失败")


@router.get("/classes/{class_name}/exam/{exam_id}/detail")
def get_class_exam_detail(
    class_name: str,
    exam_id: int,
    db: Session = Depends(get_db)
):
    """
    获取班级单次考试详细数据
    
    包含:
    - 班级整体统计
    - 各学科平均分及与年级平均的差值
    - 分数段分布
    - 学生名单及成绩
    """
    try:
        # 获取考试信息
        exam = db.execute(
            text("SELECT exam_name, term, grade_level FROM biz_exams WHERE id = :exam_id"),
            {"exam_id": exam_id}
        ).fetchone()
        
        if not exam:
            raise HTTPException(status_code=404, detail="考试不存在")
        
        # 获取班级成绩数据
        sql = """
            SELECT 
                s.student_id,
                st.name as student_name,
                st.student_code,
                s.exam_number,
                s.score_chinese,
                s.score_math,
                s.score_english,
                s.score_science,
                s.score_society,
                s.total_score,
                s.is_included,
                s.remarks
            FROM biz_scores s
            JOIN biz_students st ON s.student_id = st.id
            WHERE s.exam_id = :exam_id 
              AND s.class_name = :class_name
            ORDER BY s.total_score DESC
        """
        
        results = db.execute(text(sql), {"exam_id": exam_id, "class_name": class_name}).fetchall()
        
        if not results:
            raise HTTPException(status_code=404, detail="该班级暂无成绩数据")
        
        # 计算统计数据
        valid_scores = [r for r in results if r.is_included == 1 and r.total_score is not None]
        
        if valid_scores:
            total_scores = [r.total_score for r in valid_scores]
            avg_score = sum(total_scores) / len(total_scores)
            max_score = max(total_scores)
            min_score = min(total_scores)
            
            # 分数段统计
            score_ranges = {
                "450-500": 0,
                "400-449": 0,
                "350-399": 0,
                "300-349": 0,
                "250-299": 0,
                "200-249": 0,
                "below_200": 0
            }
            
            for score in total_scores:
                if score >= 450:
                    score_ranges["450-500"] += 1
                elif score >= 400:
                    score_ranges["400-449"] += 1
                elif score >= 350:
                    score_ranges["350-399"] += 1
                elif score >= 300:
                    score_ranges["300-349"] += 1
                elif score >= 250:
                    score_ranges["250-299"] += 1
                elif score >= 200:
                    score_ranges["200-249"] += 1
                else:
                    score_ranges["below_200"] += 1
        else:
            avg_score = max_score = min_score = 0
            score_ranges = {}
        
        # 学科平均分
        subject_avgs = {}
        for subject in ['score_chinese', 'score_math', 'score_english', 'score_science', 'score_society']:
            scores = [getattr(r, subject) for r in valid_scores if getattr(r, subject) is not None]
            if scores:
                subject_avgs[subject.replace('score_', '')] = round(sum(scores) / len(scores), 2)
        
        # 学生列表
        students = []
        for i, r in enumerate(results, 1):
            students.append({
                "rank": i,
                "student_id": r.student_id,
                "student_name": r.student_name,
                "student_code": r.student_code,
                "exam_number": r.exam_number,
                "scores": {
                    "chinese": float(r.score_chinese) if r.score_chinese else None,
                    "math": float(r.score_math) if r.score_math else None,
                    "english": float(r.score_english) if r.score_english else None,
                    "science": float(r.score_science) if r.score_science else None,
                    "society": float(r.score_society) if r.score_society else None,
                    "total": float(r.total_score) if r.total_score else None
                },
                "is_included": r.is_included == 1,
                "remarks": r.remarks
            })
        
        return {
            "exam_id": exam_id,
            "exam_name": exam.exam_name,
            "term": exam.term,
            "grade_level": exam.grade_level,
            "class_name": class_name,
            "statistics": {
                "total_students": len(results),
                "valid_students": len(valid_scores),
                "average_score": round(avg_score, 2) if avg_score else 0,
                "max_score": round(max_score, 1) if max_score else 0,
                "min_score": round(min_score, 1) if min_score else 0,
                "subject_averages": subject_avgs,
                "score_distribution": score_ranges
            },
            "students": students
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取班级考试详情失败: {e}")
        raise HTTPException(status_code=500, detail="获取班级考试详情失败")
