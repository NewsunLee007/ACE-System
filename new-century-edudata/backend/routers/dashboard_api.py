"""
教务处核心分析看板API
提供统测大屏数据接口、班级Z值排名、学科有效分等核心功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging

from services.score_analysis_service import (
    ScoreAnalysisService, 
    WeakSubjectTracker,
    ZValueResult
)
from core.database import get_db
from core.security import require_permission_codes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/analysis", tags=["教务处核心分析看板"])

ANALYSIS_DASHBOARD_VIEW_CODES = (
    "sys_admin",
    "edu_admin",
    "exam_admin",
    "grade_leader",
    "subject_leader",
)

ANALYSIS_DASHBOARD_MANAGE_CODES = (
    "sys_admin",
    "edu_admin",
    "exam_admin",
)


# ============ Pydantic模型定义 ============

class ZValueResponse(BaseModel):
    """Z值计算结果响应模型"""
    class_name: str
    class_mean: float
    layer_mean: float
    layer_std: float
    standard_score: float
    top20_ratio: float
    top80_ratio: float
    final_z_value: float
    class_count: int
    top20_count: int
    top80_count: int
    
    class Config:
        from_attributes = True


class LayerStatsResponse(BaseModel):
    """分层统计响应模型"""
    layer_id: int
    layer_name: str
    total_students: int
    mean_score: float
    std_score: float
    max_score: float
    min_score: float
    median_score: float
    threshold_20: float
    threshold_40: float
    threshold_60: float
    threshold_80: float


class SubjectThresholdResponse(BaseModel):
    """学科有效分响应模型"""
    percentage: float
    label: str
    threshold_total: float
    threshold_chinese: float
    threshold_math: float
    threshold_english: float
    threshold_science: float
    threshold_society: float
    student_count: int


class ClassSubjectMeanResponse(BaseModel):
    """班级学科平均分响应模型"""
    class_name: str
    student_count: int
    total_mean: float
    subjects: Dict[str, Any]


class DashboardSummaryResponse(BaseModel):
    """教务处看板汇总响应模型"""
    exam_id: int
    exam_name: str
    layer_id: int
    layer_name: str
    layer_stats: LayerStatsResponse
    class_rankings: List[ZValueResponse]
    subject_thresholds: List[SubjectThresholdResponse]


class WeakSubjectTrackResponse(BaseModel):
    """薄弱学科追踪响应模型"""
    exam_id: int
    layer_id: int
    subject: str
    layer_subject_mean: float
    classes: List[Dict[str, Any]]


# ============ API路由 ============

@router.get("/exams/{exam_id}/layers/{layer_id}/dashboard", response_model=DashboardSummaryResponse)
def get_layer_dashboard(
    exam_id: int,
    layer_id: int,
    current_user: dict = Depends(require_permission_codes(*ANALYSIS_DASHBOARD_VIEW_CODES)),
    db: Session = Depends(get_db)
):
    """
    获取教务处统测大屏完整数据
    
    包含:
    - 分层整体统计数据
    - 所有班级Z值排名
    - 各学科有效分/下限分
    """
    try:
        service = ScoreAnalysisService(db)
        
        # 1. 获取考试信息
        exam = db.execute(
            text("SELECT exam_name FROM biz_exams WHERE id = :exam_id"),
            {"exam_id": exam_id}
        ).fetchone()
        
        if not exam:
            raise HTTPException(status_code=404, detail="考试不存在")
        
        # 2. 获取分层信息
        layer = db.execute(
            text("SELECT layer_name FROM biz_class_layers WHERE id = :layer_id"),
            {"layer_id": layer_id}
        ).fetchone()
        
        if not layer:
            raise HTTPException(status_code=404, detail="分层不存在")
        
        # 3. 计算分层统计数据
        layer_stats = service.calculate_layer_statistics(exam_id, layer_id)
        
        # 4. 计算所有班级Z值
        class_rankings = service.calculate_all_classes_z_values(exam_id, layer_id)
        
        # 5. 计算学科有效分
        thresholds = service.calculate_subject_thresholds(exam_id, layer_id)
        
        # 转换为响应模型
        return DashboardSummaryResponse(
            exam_id=exam_id,
            exam_name=exam.exam_name,
            layer_id=layer_id,
            layer_name=layer.layer_name,
            layer_stats=LayerStatsResponse(
                layer_id=layer_stats.layer_id,
                layer_name=layer_stats.layer_name,
                total_students=layer_stats.total_students,
                mean_score=layer_stats.mean_score,
                std_score=layer_stats.std_score,
                max_score=layer_stats.max_score,
                min_score=layer_stats.min_score,
                median_score=layer_stats.median_score,
                threshold_20=layer_stats.threshold_20,
                threshold_40=layer_stats.threshold_40,
                threshold_60=layer_stats.threshold_60,
                threshold_80=layer_stats.threshold_80
            ),
            class_rankings=[
                ZValueResponse(
                    class_name=r.class_name,
                    class_mean=r.class_mean,
                    layer_mean=r.layer_mean,
                    layer_std=r.layer_std,
                    standard_score=r.standard_score,
                    top20_ratio=r.top20_ratio,
                    top80_ratio=r.top80_ratio,
                    final_z_value=r.final_z_value,
                    class_count=r.class_count,
                    top20_count=r.top20_count,
                    top80_count=r.top80_count
                ) for r in class_rankings
            ],
            subject_thresholds=[
                SubjectThresholdResponse(
                    percentage=t.percentage,
                    label=f"前{int(t.percentage*100)}%",
                    threshold_total=t.threshold_total,
                    threshold_chinese=t.threshold_chinese,
                    threshold_math=t.threshold_math,
                    threshold_english=t.threshold_english,
                    threshold_science=t.threshold_science,
                    threshold_society=t.threshold_society,
                    student_count=t.student_count
                ) for t in thresholds
            ]
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"获取看板数据失败: {e}")
        raise HTTPException(status_code=500, detail="获取看板数据失败")


@router.get("/exams/{exam_id}/layers/{layer_id}/z-values", response_model=List[ZValueResponse])
def get_class_z_values(
    exam_id: int,
    layer_id: int,
    current_user: dict = Depends(require_permission_codes(*ANALYSIS_DASHBOARD_VIEW_CODES)),
    db: Session = Depends(get_db)
):
    """
    获取指定分层下所有班级的Z值排名
    
    按Z值从高到低排序
    """
    try:
        service = ScoreAnalysisService(db)
        results = service.calculate_all_classes_z_values(exam_id, layer_id)
        
        return [
            ZValueResponse(
                class_name=r.class_name,
                class_mean=r.class_mean,
                layer_mean=r.layer_mean,
                layer_std=r.layer_std,
                standard_score=r.standard_score,
                top20_ratio=r.top20_ratio,
                top80_ratio=r.top80_ratio,
                final_z_value=r.final_z_value,
                class_count=r.class_count,
                top20_count=r.top20_count,
                top80_count=r.top80_count
            ) for r in results
        ]
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"获取Z值排名失败: {e}")
        raise HTTPException(status_code=500, detail="获取Z值排名失败")


@router.get("/exams/{exam_id}/layers/{layer_id}/classes/{class_name}/z-value", response_model=ZValueResponse)
def get_single_class_z_value(
    exam_id: int,
    layer_id: int,
    class_name: str,
    current_user: dict = Depends(require_permission_codes(*ANALYSIS_DASHBOARD_VIEW_CODES)),
    db: Session = Depends(get_db)
):
    """
    获取指定班级的Z值详情
    """
    try:
        service = ScoreAnalysisService(db)
        result = service.calculate_class_z_value(exam_id, layer_id, class_name)
        
        return ZValueResponse(
            class_name=result.class_name,
            class_mean=result.class_mean,
            layer_mean=result.layer_mean,
            layer_std=result.layer_std,
            standard_score=result.standard_score,
            top20_ratio=result.top20_ratio,
            top80_ratio=result.top80_ratio,
            final_z_value=result.final_z_value,
            class_count=result.class_count,
            top20_count=result.top20_count,
            top80_count=result.top80_count
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"获取班级Z值失败: {e}")
        raise HTTPException(status_code=500, detail="获取班级Z值失败")


@router.get("/exams/{exam_id}/layers/{layer_id}/thresholds", response_model=List[SubjectThresholdResponse])
def get_subject_thresholds(
    exam_id: int,
    layer_id: int,
    percentages: Optional[str] = Query(None, description="百分比列表，如: 0.2,0.4,0.6,0.8"),
    current_user: dict = Depends(require_permission_codes(*ANALYSIS_DASHBOARD_VIEW_CODES)),
    db: Session = Depends(get_db)
):
    """
    获取各学科有效分/下限分
    
    基于总分划定的前N%人群，反向计算该人群在各单科的最低下限分
    """
    try:
        service = ScoreAnalysisService(db)
        
        # 解析百分比参数
        if percentages:
            pct_list = [float(p) for p in percentages.split(",")]
        else:
            pct_list = [0.20, 0.40, 0.60, 0.80]
        
        thresholds = service.calculate_subject_thresholds(exam_id, layer_id, pct_list)
        
        return [
            SubjectThresholdResponse(
                percentage=t.percentage,
                label=f"前{int(t.percentage*100)}%",
                threshold_total=t.threshold_total,
                threshold_chinese=t.threshold_chinese,
                threshold_math=t.threshold_math,
                threshold_english=t.threshold_english,
                threshold_science=t.threshold_science,
                threshold_society=t.threshold_society,
                student_count=t.student_count
            ) for t in thresholds
        ]
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"获取有效分失败: {e}")
        raise HTTPException(status_code=500, detail="获取有效分失败")


@router.get("/exams/{exam_id}/layers/{layer_id}/subject-means")
def get_layer_subject_means(
    exam_id: int,
    layer_id: int,
    class_name: Optional[str] = Query(None, description="指定班级，为空则返回所有班级"),
    current_user: dict = Depends(require_permission_codes(*ANALYSIS_DASHBOARD_VIEW_CODES)),
    db: Session = Depends(get_db)
):
    """
    获取班级各学科平均分及与分层平均的差值
    """
    try:
        service = ScoreAnalysisService(db)
        result = service.get_class_subject_means(exam_id, layer_id, class_name)
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"获取学科平均分失败: {e}")
        raise HTTPException(status_code=500, detail="获取学科平均分失败")


@router.get("/exams/{exam_id}/layers/{layer_id}/weak-subject-tracking")
def track_weak_subject(
    exam_id: int,
    layer_id: int,
    subject: str = Query(..., description="学科名称: chinese/math/english/science/society"),
    class_name: Optional[str] = Query(None, description="指定班级，为空则返回所有班级"),
    current_user: dict = Depends(require_permission_codes(*ANALYSIS_DASHBOARD_VIEW_CODES)),
    db: Session = Depends(get_db)
):
    """
    薄弱学科靶向追踪
    
    追踪指定学科与年级均分的差距，量化提升效果
    """
    try:
        tracker = WeakSubjectTracker(db)
        result = tracker.track_subject_gap(exam_id, layer_id, subject, class_name)
        
        return WeakSubjectTrackResponse(
            exam_id=result["exam_id"],
            layer_id=result["layer_id"],
            subject=result["subject"],
            layer_subject_mean=result["layer_subject_mean"],
            classes=result["classes"]
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"薄弱学科追踪失败: {e}")
        raise HTTPException(status_code=500, detail="薄弱学科追踪失败")


@router.post("/exams/{exam_id}/layers/{layer_id}/recalculate-z-values")
def recalculate_all_z_values(
    exam_id: int,
    layer_id: int,
    current_user: dict = Depends(require_permission_codes(*ANALYSIS_DASHBOARD_MANAGE_CODES)),
    db: Session = Depends(get_db)
):
    """
    重新计算并保存所有班级的Z值
    
    用于成绩数据更新后批量刷新Z值缓存
    """
    try:
        service = ScoreAnalysisService(db)
        results = service.calculate_all_classes_z_values(exam_id, layer_id)
        
        saved_count = 0
        for result in results:
            if service.save_z_value_calculation(result, exam_id, layer_id):
                saved_count += 1
        
        return {
            "message": "Z值计算完成",
            "exam_id": exam_id,
            "layer_id": layer_id,
            "total_classes": len(results),
            "saved_count": saved_count
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"重新计算Z值失败: {e}")
        raise HTTPException(status_code=500, detail="重新计算Z值失败")
