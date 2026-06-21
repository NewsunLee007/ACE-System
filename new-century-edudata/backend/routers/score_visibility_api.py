"""
成绩可见性设置API

用于教务主任/管理员按角色控制排名、AI分析和导出权限。
"""

import logging
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import require_permission_codes
from services.score_visibility_service import (
    fetch_score_visibility_settings,
    save_score_visibility_settings,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/score-visibility", tags=["成绩可见性"])

SCORE_VISIBILITY_ADMIN_CODES = ("sys_admin", "edu_admin")


class ScoreVisibilityRequest(BaseModel):
    settings: Dict[str, Dict[str, Any]]


@router.get("/settings")
def get_score_visibility_settings(
    current_user: dict = Depends(require_permission_codes(*SCORE_VISIBILITY_ADMIN_CODES)),
    db: Session = Depends(get_db),
):
    try:
        return {
            "success": True,
            "settings": fetch_score_visibility_settings(db),
        }
    except Exception as exc:
        logger.error(f"获取成绩可见性设置失败: {exc}")
        raise HTTPException(status_code=500, detail="获取成绩可见性设置失败")


@router.put("/settings")
def update_score_visibility_settings(
    request: ScoreVisibilityRequest,
    current_user: dict = Depends(require_permission_codes(*SCORE_VISIBILITY_ADMIN_CODES)),
    db: Session = Depends(get_db),
):
    try:
        settings = save_score_visibility_settings(
            db,
            request.settings,
            updated_by=current_user.get("id"),
        )
        return {
            "success": True,
            "message": "成绩可见性设置已更新",
            "settings": settings,
        }
    except Exception as exc:
        db.rollback()
        logger.error(f"更新成绩可见性设置失败: {exc}")
        raise HTTPException(status_code=500, detail="更新成绩可见性设置失败")
