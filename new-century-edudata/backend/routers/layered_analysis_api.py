"""
成绩分析分层体系API路由
支持全年级范围分析、分层维度统计、分层推送
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

from core.database import get_db
from core.security import get_current_user, require_permission
from services.layered_analysis_service import (
    LayeredAnalysisService, 
    LayeredPushService,
    LayerStatistics,
    LayerThreshold
)

router = APIRouter(prefix="/api/v1/layered-analysis", tags=["分层成绩分析"])


# ============== 请求/响应模型 ==============

class LayerStatisticsRequest(BaseModel):
    exam_id: int
    layer_code: str
    subject_name: str = "total"


class LayerThresholdRequest(BaseModel):
    exam_id: int
    layer_code: str
    percentages: List[float] = [0.20, 0.40, 0.60, 0.80]


class GradeRangeAnalysisRequest(BaseModel):
    exam_id: int
    save_results: bool = True


class LayeredNotificationRequest(BaseModel):
    exam_id: int
    layer_code: str
    title: str
    content: str
    notification_type: str  # teacher/parent
    target_role: str  # headmaster/teacher/all


class LayeredStatisticsResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None


class LayerComparisonResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None


# ============== API路由 ==============

@router.get("/layers/definitions")
def get_layer_definitions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """获取分层定义列表"""
    try:
        service = LayeredAnalysisService(db)
        
        sql = """
            SELECT layer_code, layer_name, layer_type, description, sort_order
            FROM biz_layer_definitions
            WHERE is_active = 1
            ORDER BY sort_order
        """
        result = db.execute(sql).fetchall()
        
        layers = []
        for row in result:
            layers.append({
                "layer_code": row.layer_code,
                "layer_name": row.layer_name,
                "layer_type": row.layer_type,
                "description": row.description,
                "sort_order": row.sort_order
            })
        
        return {
            "success": True,
            "message": "获取分层定义成功",
            "data": layers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取分层定义失败: {str(e)}")


@router.post("/statistics/calculate")
def calculate_layer_statistics(
    request: LayerStatisticsRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("analysis_execute"))
):
    """
    计算指定层次指定学科的统计数据
    
    - layer_code: ALL(全年级)/A/B/C
    - subject_name: total/chinese/math/english/science/society
    """
    try:
        service = LayeredAnalysisService(db)
        
        stats = service.calculate_layer_statistics(
            exam_id=request.exam_id,
            layer_code=request.layer_code,
            subject_name=request.subject_name
        )
        
        # 记录操作日志
        service.log_layered_analysis_action(
            action_type="calculate",
            action_by=current_user.get("id"),
            action_by_name=current_user.get("real_name"),
            action_by_role=current_user.get("role_name"),
            exam_id=request.exam_id,
            layer_code=request.layer_code,
            action_detail={"subject": request.subject_name}
        )
        
        return {
            "success": True,
            "message": "统计计算成功",
            "data": {
                "exam_id": stats.exam_id,
                "layer_code": stats.layer_code,
                "subject_name": stats.subject_name,
                "total_students": stats.total_students,
                "valid_students": stats.valid_students,
                "mean_score": stats.mean_score,
                "median_score": stats.median_score,
                "std_score": stats.std_score,
                "max_score": stats.max_score,
                "min_score": stats.min_score,
                "q1_score": stats.q1_score,
                "q3_score": stats.q3_score,
                "pass_count": stats.pass_count,
                "pass_rate": stats.pass_rate,
                "excellent_count": stats.excellent_count,
                "excellent_rate": stats.excellent_rate,
                "fail_count": stats.fail_count,
                "fail_rate": stats.fail_rate,
                "score_distribution": stats.score_distribution
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"统计计算失败: {str(e)}")


@router.post("/statistics/calculate-all")
def calculate_all_layers_statistics(
    request: GradeRangeAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("analysis_execute"))
):
    """
    计算所有层次所有学科的统计数据并保存
    
    - 自动计算ALL(全年级)、A层、B层、C层的统计数据
    - 包含总分及各学科的统计
    """
    try:
        service = LayeredAnalysisService(db)
        
        # 计算所有层次统计
        all_stats = service.calculate_all_layers_statistics(request.exam_id)
        
        # 保存结果
        saved_count = 0
        if request.save_results:
            for layer_code, layer_stats_list in all_stats.items():
                for stats in layer_stats_list:
                    if service.save_layer_statistics(stats):
                        saved_count += 1
        
        # 记录操作日志
        service.log_layered_analysis_action(
            action_type="calculate",
            action_by=current_user.get("id"),
            action_by_name=current_user.get("real_name"),
            action_by_role=current_user.get("role_name"),
            exam_id=request.exam_id,
            action_detail={"saved_count": saved_count}
        )
        
        # 构建响应数据
        response_data = {}
        for layer_code, layer_stats_list in all_stats.items():
            response_data[layer_code] = []
            for stats in layer_stats_list:
                response_data[layer_code].append({
                    "subject_name": stats.subject_name,
                    "valid_students": stats.valid_students,
                    "mean_score": stats.mean_score,
                    "pass_rate": stats.pass_rate,
                    "excellent_rate": stats.excellent_rate
                })
        
        return {
            "success": True,
            "message": f"全部分层统计计算完成，已保存{saved_count}条记录",
            "data": response_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量统计计算失败: {str(e)}")


@router.get("/statistics/query")
def query_layer_statistics(
    exam_id: int = Query(..., description="考试ID"),
    layer_code: Optional[str] = Query(None, description="层次代码(ALL/A/B/C)"),
    subject_name: Optional[str] = Query(None, description="学科名称"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """查询分层统计数据"""
    try:
        service = LayeredAnalysisService(db)
        
        stats_list = service.get_layer_statistics_from_db(
            exam_id=exam_id,
            layer_code=layer_code,
            subject_name=subject_name
        )
        
        return {
            "success": True,
            "message": "查询成功",
            "data": stats_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.post("/thresholds/calculate")
def calculate_layer_thresholds(
    request: LayerThresholdRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("analysis_execute"))
):
    """
    计算指定层次的各学科临界分
    
    - 基于总分划定的前N%人群，反向计算该人群在各单科的最低下限分
    """
    try:
        service = LayeredAnalysisService(db)
        
        thresholds = service.calculate_layer_thresholds(
            exam_id=request.exam_id,
            layer_code=request.layer_code,
            percentages=request.percentages
        )
        
        # 保存结果
        service.save_layer_thresholds(thresholds)
        
        # 记录操作日志
        service.log_layered_analysis_action(
            action_type="calculate",
            action_by=current_user.get("id"),
            action_by_name=current_user.get("real_name"),
            action_by_role=current_user.get("role_name"),
            exam_id=request.exam_id,
            layer_code=request.layer_code,
            action_detail={"percentages": request.percentages}
        )
        
        return {
            "success": True,
            "message": "临界分计算成功",
            "data": [
                {
                    "percentage": t.percentage,
                    "threshold_total": t.threshold_total,
                    "threshold_chinese": t.threshold_chinese,
                    "threshold_math": t.threshold_math,
                    "threshold_english": t.threshold_english,
                    "threshold_science": t.threshold_science,
                    "threshold_society": t.threshold_society,
                    "student_count": t.student_count
                }
                for t in thresholds
            ]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"临界分计算失败: {str(e)}")


@router.get("/thresholds/query")
def query_layer_thresholds(
    exam_id: int = Query(..., description="考试ID"),
    layer_code: Optional[str] = Query(None, description="层次代码"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """查询分层临界分数据"""
    try:
        sql = """
            SELECT * FROM biz_layered_thresholds
            WHERE exam_id = :exam_id
        """
        params = {"exam_id": exam_id}
        
        if layer_code:
            sql += " AND layer_code = :layer_code"
            params["layer_code"] = layer_code
        
        sql += " ORDER BY layer_code, percentage"
        
        result = db.execute(sql, params).fetchall()
        
        thresholds = []
        for row in result:
            thresholds.append({
                "layer_code": row.layer_code,
                "percentage": float(row.percentage),
                "threshold_total": float(row.threshold_total) if row.threshold_total else None,
                "threshold_chinese": float(row.threshold_chinese) if row.threshold_chinese else None,
                "threshold_math": float(row.threshold_math) if row.threshold_math else None,
                "threshold_english": float(row.threshold_english) if row.threshold_english else None,
                "threshold_science": float(row.threshold_science) if row.threshold_science else None,
                "threshold_society": float(row.threshold_society) if row.threshold_society else None,
                "student_count": row.student_count,
                "calculated_at": row.calculated_at.isoformat() if row.calculated_at else None
            })
        
        return {
            "success": True,
            "message": "查询成功",
            "data": thresholds
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")


@router.post("/grade-range/analysis")
def perform_grade_range_analysis(
    request: GradeRangeAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("analysis_execute"))
):
    """
    执行全年级范围的综合分析
    
    - 全年级整体统计
    - 各层次对比分析
    - 各学科统计分析
    - 分数段分布
    """
    try:
        service = LayeredAnalysisService(db)
        
        analysis = service.perform_grade_range_analysis(request.exam_id)
        
        # 记录操作日志
        service.log_layered_analysis_action(
            action_type="calculate",
            action_by=current_user.get("id"),
            action_by_name=current_user.get("real_name"),
            action_by_role=current_user.get("role_name"),
            exam_id=request.exam_id,
            layer_code="ALL",
            action_detail={"analysis_type": "grade_range"}
        )
        
        return {
            "success": True,
            "message": "全年级分析完成",
            "data": {
                "exam_id": analysis.exam_id,
                "exam_name": analysis.exam_name,
                "grade_level": analysis.grade_level,
                "total_students": analysis.total_students,
                "valid_students": analysis.valid_students,
                "overall_stats": analysis.overall_stats,
                "layer_comparison": analysis.layer_comparison,
                "subject_analysis": analysis.subject_analysis,
                "score_distribution": analysis.score_distribution
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"全年级分析失败: {str(e)}")


@router.get("/layer-comparison")
def get_layer_comparison(
    exam_id: int = Query(..., description="考试ID"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    获取各层次对比数据
    
    - 各层次平均分、及格率、优秀率对比
    - 分数段分布对比
    """
    try:
        service = LayeredAnalysisService(db)
        
        # 获取各层次总分统计
        layer_codes = ['ALL', 'A', 'B', 'C']
        comparison_data = {}
        
        for layer_code in layer_codes:
            try:
                stats = service.calculate_layer_statistics(exam_id, layer_code, 'total')
                comparison_data[layer_code] = {
                    "layer_name": "全年级" if layer_code == 'ALL' else f"{layer_code}层",
                    "student_count": stats.valid_students,
                    "mean_score": stats.mean_score,
                    "median_score": stats.median_score,
                    "std_score": stats.std_score,
                    "max_score": stats.max_score,
                    "min_score": stats.min_score,
                    "pass_rate": stats.pass_rate,
                    "excellent_rate": stats.excellent_rate,
                    "score_distribution": stats.score_distribution
                }
            except ValueError:
                continue
        
        return {
            "success": True,
            "message": "获取层次对比数据成功",
            "data": comparison_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取层次对比数据失败: {str(e)}")


# ============== 分层推送API ==============

@router.post("/push/create")
def create_layered_push(
    request: LayeredNotificationRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("analysis_publish"))
):
    """
    创建分层推送通知
    
    - notification_type: teacher(教师)/parent(家长)
    - target_role: headmaster(班主任)/teacher(任课教师)/all(全部)
    """
    try:
        push_service = LayeredPushService(db)
        
        # 检查推送权限
        if not push_service.check_push_permission(
            current_user.get("id"), 
            request.layer_code,
            "push"
        ):
            raise HTTPException(status_code=403, detail="没有该层次的推送权限")
        
        # 创建推送
        notification_id = push_service.create_layered_notification(
            exam_id=request.exam_id,
            layer_code=request.layer_code,
            title=request.title,
            content=request.content,
            notification_type=request.notification_type,
            target_role=request.target_role,
            created_by=current_user.get("id")
        )
        
        if not notification_id:
            raise HTTPException(status_code=400, detail="创建推送失败，可能没有目标用户")
        
        # 发送推送
        push_service.send_notification(notification_id)
        
        return {
            "success": True,
            "message": "分层推送已创建并发送",
            "data": {
                "notification_id": notification_id
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建推送失败: {str(e)}")


@router.get("/push/teachers")
def get_teachers_by_layer(
    layer_code: str = Query(..., description="层次代码"),
    class_name: Optional[str] = Query(None, description="班级名称"),
    role: Optional[str] = Query(None, description="角色筛选(headmaster/teacher)"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("analysis_view"))
):
    """获取指定层次的教师列表"""
    try:
        push_service = LayeredPushService(db)
        
        teachers = push_service.get_teachers_by_layer(
            layer_code=layer_code,
            class_name=class_name,
            role=role
        )
        
        return {
            "success": True,
            "message": "获取教师列表成功",
            "data": teachers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取教师列表失败: {str(e)}")


@router.get("/push/parents")
def get_parents_by_layer(
    layer_code: str = Query(..., description="层次代码"),
    class_name: Optional[str] = Query(None, description="班级名称"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("analysis_view"))
):
    """获取指定层次的家长列表"""
    try:
        push_service = LayeredPushService(db)
        
        parents = push_service.get_parents_by_layer(
            layer_code=layer_code,
            class_name=class_name
        )
        
        return {
            "success": True,
            "message": "获取家长列表成功",
            "data": parents
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取家长列表失败: {str(e)}")


@router.get("/push/notifications")
def get_push_notifications(
    exam_id: Optional[int] = Query(None, description="考试ID"),
    layer_code: Optional[str] = Query(None, description="层次代码"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """获取分层推送记录列表"""
    try:
        sql = """
            SELECT * FROM biz_layered_notifications
            WHERE 1=1
        """
        params = {}
        
        if exam_id:
            sql += " AND exam_id = :exam_id"
            params["exam_id"] = exam_id
        
        if layer_code:
            sql += " AND layer_code = :layer_code"
            params["layer_code"] = layer_code
        
        sql += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        params["limit"] = page_size
        params["offset"] = (page - 1) * page_size
        
        result = db.execute(sql, params).fetchall()
        
        notifications = []
        for row in result:
            notifications.append({
                "notification_id": row.notification_id,
                "exam_id": row.exam_id,
                "layer_code": row.layer_code,
                "title": row.title,
                "content": row.content,
                "notification_type": row.notification_type,
                "target_role": row.target_role,
                "sent_count": row.sent_count,
                "read_count": row.read_count,
                "status": row.status,
                "sent_at": row.sent_at.isoformat() if row.sent_at else None,
                "created_at": row.created_at.isoformat() if row.created_at else None
            })
        
        return {
            "success": True,
            "message": "获取推送记录成功",
            "data": {
                "notifications": notifications,
                "page": page,
                "page_size": page_size
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取推送记录失败: {str(e)}")


# ============== 权限控制API ==============

@router.get("/permissions/check")
def check_layer_permission(
    layer_code: str = Query(..., description="层次代码"),
    permission_type: str = Query("view", description="权限类型(view/push/admin)"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """检查当前用户对指定层次的权限"""
    try:
        push_service = LayeredPushService(db)
        
        has_permission = push_service.check_push_permission(
            user_id=current_user.get("id"),
            layer_code=layer_code,
            permission_type=permission_type
        )
        
        return {
            "success": True,
            "message": "权限检查完成",
            "data": {
                "has_permission": has_permission,
                "layer_code": layer_code,
                "permission_type": permission_type
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"权限检查失败: {str(e)}")


@router.get("/permissions/my-layers")
def get_my_accessible_layers(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """获取当前用户可访问的层次列表"""
    try:
        # 系统管理员可以访问所有层次
        user_role = current_user.get("permission_code") or current_user.get("role", "")
        
        if user_role in ["sys_admin", "edu_admin"]:
            sql = """
                SELECT layer_code, layer_name, layer_type, description
                FROM biz_layer_definitions
                WHERE is_active = 1
                ORDER BY sort_order
            """
            result = db.execute(sql).fetchall()
        else:
            # 查询用户有权限的层次
            sql = """
                SELECT DISTINCT
                    ld.layer_code,
                    ld.layer_name,
                    ld.layer_type,
                    ld.description
                FROM biz_user_layer_permissions ulp
                JOIN biz_layer_definitions ld ON ulp.layer_code = ld.layer_code
                WHERE ulp.user_id = :user_id
                  AND ulp.permission_type IN ('view', 'push', 'admin')
                  AND ld.is_active = 1
                ORDER BY ld.sort_order
            """
            result = db.execute(sql, {"user_id": current_user.get("id")}).fetchall()
        
        layers = []
        for row in result:
            layers.append({
                "layer_code": row.layer_code,
                "layer_name": row.layer_name,
                "layer_type": row.layer_type,
                "description": row.description
            })
        
        return {
            "success": True,
            "message": "获取可访问层次成功",
            "data": layers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取可访问层次失败: {str(e)}")


# ============== 日志API ==============

@router.get("/logs")
def get_layered_analysis_logs(
    exam_id: Optional[int] = Query(None, description="考试ID"),
    layer_code: Optional[str] = Query(None, description="层次代码"),
    action_type: Optional[str] = Query(None, description="操作类型"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("analysis_view"))
):
    """获取分层分析操作日志"""
    try:
        sql = """
            SELECT * FROM biz_layered_analysis_logs
            WHERE 1=1
        """
        params = {}
        
        if exam_id:
            sql += " AND exam_id = :exam_id"
            params["exam_id"] = exam_id
        
        if layer_code:
            sql += " AND layer_code = :layer_code"
            params["layer_code"] = layer_code
        
        if action_type:
            sql += " AND action_type = :action_type"
            params["action_type"] = action_type
        
        sql += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
        params["limit"] = page_size
        params["offset"] = (page - 1) * page_size
        
        result = db.execute(sql, params).fetchall()
        
        logs = []
        for row in result:
            logs.append({
                "id": row.id,
                "exam_id": row.exam_id,
                "layer_code": row.layer_code,
                "action_type": row.action_type,
                "action_by": row.action_by,
                "action_by_name": row.action_by_name,
                "action_by_role": row.action_by_role,
                "action_detail": row.action_detail,
                "created_at": row.created_at.isoformat() if row.created_at else None
            })
        
        return {
            "success": True,
            "message": "获取日志成功",
            "data": {
                "logs": logs,
                "page": page,
                "page_size": page_size
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取日志失败: {str(e)}")
