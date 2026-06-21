"""
报表生成API
提供成绩单、班级分析报告、综合报告等PDF生成功能
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import json
import logging

from core.database import get_db
from core.security import require_permission_codes
from services.report_service import ReportService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/reports", tags=["报表生成"])

REPORT_VIEW_PERMISSION_CODES = (
    "exam_admin",
    "grade_leader",
    "subject_leader",
)
REPORT_MANAGE_PERMISSION_CODES = ("edu_admin",)


@router.get("/student/{student_id}/report-card")
def get_student_report_card(
    student_id: int,
    exam_id: int = Query(..., description="考试ID"),
    current_user: dict = Depends(require_permission_codes(*REPORT_VIEW_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    获取学生成绩单
    
    返回JSON格式的成绩单数据，可用于前端展示或PDF生成
    """
    try:
        service = ReportService(db)
        report_card = service.generate_student_report_card(student_id, exam_id)
        
        return {
            "success": True,
            "data": report_card
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"生成成绩单失败: {e}")
        raise HTTPException(status_code=500, detail="生成成绩单失败")


@router.get("/class/analysis")
def get_class_analysis_report(
    exam_id: int = Query(..., description="考试ID"),
    layer_id: int = Query(..., description="分层ID"),
    class_name: str = Query(..., description="班级名称"),
    current_user: dict = Depends(require_permission_codes(*REPORT_VIEW_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    获取班级分析报告
    
    包含班级整体统计、Z值分析、学科平均分、分数段分布、学生排名等
    """
    try:
        service = ReportService(db)
        report = service.generate_class_analysis_report(exam_id, layer_id, class_name)
        
        return {
            "success": True,
            "data": report
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"生成班级分析报告失败: {e}")
        raise HTTPException(status_code=500, detail="生成班级分析报告失败")


@router.get("/comprehensive")
def get_comprehensive_report(
    exam_id: int = Query(..., description="考试ID"),
    layer_id: int = Query(..., description="分层ID"),
    current_user: dict = Depends(require_permission_codes(*REPORT_MANAGE_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    获取综合分析报告
    
    需要教务主任权限，包含所有班级的Z值排名和学科有效分
    """
    try:
        service = ReportService(db)
        report = service.generate_comprehensive_report(exam_id, layer_id)
        
        return {
            "success": True,
            "data": report
        }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"生成综合报告失败: {e}")
        raise HTTPException(status_code=500, detail="生成综合报告失败")


@router.get("/student/{student_id}/report-card/export")
def export_student_report_card(
    student_id: int,
    exam_id: int = Query(..., description="考试ID"),
    format: str = Query("json", description="导出格式: json/pdf"),
    current_user: dict = Depends(require_permission_codes(*REPORT_VIEW_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    导出学生成绩单
    
    支持JSON格式导出，PDF格式需要额外实现
    """
    try:
        service = ReportService(db)
        report_card = service.generate_student_report_card(student_id, exam_id)
        
        if format.lower() == "json":
            # 返回JSON文件
            json_content = json.dumps(report_card, ensure_ascii=False, indent=2)
            return StreamingResponse(
                iter([json_content]),
                media_type="application/json",
                headers={
                    "Content-Disposition": f"attachment; filename=report_card_{student_id}_{exam_id}.json"
                }
            )
        else:
            # PDF格式暂未实现，返回提示
            return {
                "success": False,
                "message": "PDF导出功能需要安装额外依赖(如ReportLab或WeasyPrint)"
            }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"导出成绩单失败: {e}")
        raise HTTPException(status_code=500, detail="导出成绩单失败")


@router.get("/class/analysis/export")
def export_class_analysis_report(
    exam_id: int = Query(..., description="考试ID"),
    layer_id: int = Query(..., description="分层ID"),
    class_name: str = Query(..., description="班级名称"),
    format: str = Query("json", description="导出格式: json"),
    current_user: dict = Depends(require_permission_codes(*REPORT_VIEW_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    导出班级分析报告
    """
    try:
        service = ReportService(db)
        report = service.generate_class_analysis_report(exam_id, layer_id, class_name)
        
        if format.lower() == "json":
            json_content = json.dumps(report, ensure_ascii=False, indent=2)
            return StreamingResponse(
                iter([json_content]),
                media_type="application/json",
                headers={
                    "Content-Disposition": f"attachment; filename=class_report_{class_name}_{exam_id}.json"
                }
            )
        else:
            return {
                "success": False,
                "message": "仅支持JSON格式导出"
            }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"导出班级报告失败: {e}")
        raise HTTPException(status_code=500, detail="导出班级报告失败")


@router.get("/comprehensive/export")
def export_comprehensive_report(
    exam_id: int = Query(..., description="考试ID"),
    layer_id: int = Query(..., description="分层ID"),
    format: str = Query("json", description="导出格式: json"),
    current_user: dict = Depends(require_permission_codes(*REPORT_MANAGE_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    导出综合分析报告
    
    需要教务主任权限
    """
    try:
        service = ReportService(db)
        report = service.generate_comprehensive_report(exam_id, layer_id)
        
        if format.lower() == "json":
            json_content = json.dumps(report, ensure_ascii=False, indent=2)
            return StreamingResponse(
                iter([json_content]),
                media_type="application/json",
                headers={
                    "Content-Disposition": f"attachment; filename=comprehensive_report_exam_{exam_id}_layer_{layer_id}.json"
                }
            )
        else:
            return {
                "success": False,
                "message": "仅支持JSON格式导出"
            }
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"导出综合报告失败: {e}")
        raise HTTPException(status_code=500, detail="导出综合报告失败")


@router.post("/batch/generate")
def batch_generate_reports(
    exam_id: int = Query(..., description="考试ID"),
    layer_id: int = Query(..., description="分层ID"),
    report_type: str = Query("class", description="报告类型: class/student/comprehensive"),
    current_user: dict = Depends(require_permission_codes(*REPORT_MANAGE_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    批量生成报告
    
    需要教务主任权限，用于批量生成多个班级或学生的报告
    """
    try:
        service = ReportService(db)
        
        if report_type == "comprehensive":
            # 生成综合报告
            report = service.generate_comprehensive_report(exam_id, layer_id)
            return {
                "success": True,
                "message": "综合报告生成成功",
                "data": report
            }
        
        elif report_type == "class":
            # 查询分层下的所有班级
            classes_sql = """
                SELECT class_name FROM biz_class_layer_details
                WHERE layer_id = :layer_id
            """
            classes = db.execute(text(classes_sql), {"layer_id": layer_id}).fetchall()
            
            reports = []
            for cls in classes:
                try:
                    report = service.generate_class_analysis_report(exam_id, layer_id, cls.class_name)
                    reports.append({
                        "class_name": cls.class_name,
                        "success": True,
                        "data": report
                    })
                except Exception as e:
                    reports.append({
                        "class_name": cls.class_name,
                        "success": False,
                        "error": str(e)
                    })
            
            return {
                "success": True,
                "message": f"已生成{len(reports)}个班级报告",
                "reports": reports
            }
        
        else:
            return {
                "success": False,
                "message": "不支持的报告类型"
            }
        
    except Exception as e:
        logger.error(f"批量生成报告失败: {e}")
        raise HTTPException(status_code=500, detail="批量生成报告失败")
