"""
数据导入/导出 API
提供成绩导入、学籍导入、数据导出等功能
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import io
import logging

from services.data_import_service import DataImportService, DataExportService
from core.database import get_db
from core.security import require_permission_codes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/data", tags=["数据导入导出"])

DATA_IMPORT_PERMISSION_CODES = (
    "sys_admin",
    "edu_admin",
    "exam_admin",
)

DATA_EXPORT_PERMISSION_CODES = (
    "sys_admin",
    "edu_admin",
    "exam_admin",
    "grade_leader",
    "subject_leader",
)


@router.post("/import/scores/{exam_id}")
async def import_scores(
    exam_id: int,
    file: UploadFile = File(...),
    skip_invalid: bool = Query(True, description="是否跳过无效记录"),
    current_user: dict = Depends(require_permission_codes(*DATA_IMPORT_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    导入成绩数据(Excel/CSV)
    
    文件格式要求:
    - 必需列: 学籍辅号(或姓名)、班级
    - 成绩列: 语文、数学、英语、科学、社会、总分
    - 可选列: 考号、是否参与统计、备注
    """
    try:
        # 读取文件
        content = await file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="不支持的文件格式，请上传Excel或CSV文件")
        
        # 导入数据
        service = DataImportService(db)
        result = service.import_scores(exam_id, df, skip_invalid)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导入成绩失败: {e}")
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/import/students")
async def import_students(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_permission_codes(*DATA_IMPORT_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    导入学生学籍数据(Excel/CSV)
    
    文件格式要求:
    - 必需列: 学籍辅号、姓名、入学年份
    - 可选列: 性别、当前年级、当前班级、身份证号后6位
    """
    try:
        content = await file.read()
        
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif file.filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="不支持的文件格式")
        
        service = DataImportService(db)
        result = service.import_students(df)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导入学生失败: {e}")
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/layers/create")
def create_class_layer(
    exam_id: int = Query(..., description="考试ID"),
    layer_name: str = Query(..., description="分层名称，如'A层'"),
    class_names: str = Query(..., description="班级列表，逗号分隔，如'701,702,703'"),
    description: Optional[str] = Query(None, description="分层描述"),
    current_user: dict = Depends(require_permission_codes(*DATA_IMPORT_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    创建班级分层
    
    用于定义对比层级，如A层=701-710班
    """
    try:
        service = DataImportService(db)
        class_list = [c.strip() for c in class_names.split(',')]
        
        result = service.create_class_layer(exam_id, layer_name, class_list, description)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建分层失败: {e}")
        raise HTTPException(status_code=500, detail="创建分层失败")


@router.get("/export/scores/{exam_id}")
def export_scores(
    exam_id: int,
    layer_id: Optional[int] = Query(None, description="分层ID，为空则导出全部"),
    current_user: dict = Depends(require_permission_codes(*DATA_EXPORT_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    导出成绩数据为Excel
    """
    try:
        service = DataExportService(db)
        excel_data = service.export_scores_to_excel(exam_id, layer_id)
        
        return StreamingResponse(
            io.BytesIO(excel_data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=scores_exam_{exam_id}.xlsx"
            }
        )
        
    except Exception as e:
        logger.error(f"导出成绩失败: {e}")
        raise HTTPException(status_code=500, detail="导出失败")


@router.get("/export/z-values/{exam_id}/{layer_id}")
def export_z_values(
    exam_id: int,
    layer_id: int,
    current_user: dict = Depends(require_permission_codes(*DATA_EXPORT_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    导出班级Z值排名
    """
    try:
        service = DataExportService(db)
        excel_data = service.export_class_z_values(exam_id, layer_id)
        
        return StreamingResponse(
            io.BytesIO(excel_data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=z_values_exam_{exam_id}_layer_{layer_id}.xlsx"
            }
        )
        
    except Exception as e:
        logger.error(f"导出Z值失败: {e}")
        raise HTTPException(status_code=500, detail="导出失败")


@router.get("/export/thresholds/{exam_id}/{layer_id}")
def export_thresholds(
    exam_id: int,
    layer_id: int,
    current_user: dict = Depends(require_permission_codes(*DATA_EXPORT_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """
    导出学科有效分/下限分
    """
    try:
        service = DataExportService(db)
        excel_data = service.export_subject_thresholds(exam_id, layer_id)
        
        return StreamingResponse(
            io.BytesIO(excel_data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=thresholds_exam_{exam_id}_layer_{layer_id}.xlsx"
            }
        )
        
    except Exception as e:
        logger.error(f"导出有效分失败: {e}")
        raise HTTPException(status_code=500, detail="导出失败")
