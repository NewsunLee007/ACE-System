"""
角色设定API
将前端职务角色配置对齐到后端 sys_roles，并保存级别/权限元数据。
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import logging

from core.database import get_db, is_postgresql, is_sqlite
from core.security import require_permission_codes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/role-settings", tags=["角色设定"])

ROLE_SETTINGS_PERMISSION_CODES = ("sys_admin", "edu_admin")

DEFAULT_ROLE_META = {
    "teacher": {
        "frontend_id": "subject_teacher",
        "level": 1,
        "permissions": ["view_own_class", "view_own_students", "input_scores"],
    },
    "headmaster": {
        "frontend_id": "head_teacher",
        "level": 2,
        "permissions": ["view_own_class", "view_own_students", "input_scores", "manage_class_students", "view_class_reports"],
    },
    "lesson_leader": {
        "frontend_id": "lesson_leader",
        "level": 3,
        "permissions": ["view_subject_classes", "view_subject_scores", "manage_subject_materials"],
    },
    "subject_leader": {
        "frontend_id": "research_leader",
        "level": 4,
        "permissions": ["view_grade_subject", "manage_subject_teachers", "approve_subject_activities"],
    },
    "grade_leader": {
        "frontend_id": "grade_leader",
        "level": 5,
        "permissions": ["view_grade_all", "manage_grade_teachers", "approve_grade_activities", "view_grade_reports"],
    },
    "exam_admin": {
        "frontend_id": "exam_admin",
        "level": 6,
        "permissions": ["manage_exams", "manage_students", "import_scores"],
    },
    "edu_admin": {
        "frontend_id": "edu_admin",
        "level": 8,
        "permissions": ["view_school_all", "manage_departments", "analysis_execute"],
    },
    "sys_admin": {
        "frontend_id": "admin",
        "level": 9,
        "permissions": ["all_permissions", "system_config"],
    },
    "parent": {
        "frontend_id": "parent",
        "level": 0,
        "permissions": ["view_own_student"],
    },
}

SYSTEM_PERMISSION_CODES = set(DEFAULT_ROLE_META.keys()) | {"custom"}


class RoleSettingRequest(BaseModel):
    id: str
    name: str
    level: int = 1
    permissions: List[str] = []
    description: Optional[str] = None


def ensure_role_settings_table(db: Session) -> None:
    if is_postgresql(db) or is_sqlite(db):
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS sys_role_settings (
              role_id INT PRIMARY KEY,
              frontend_role_id VARCHAR(80) NOT NULL UNIQUE,
              display_level INT DEFAULT 1,
              permissions_json TEXT,
              is_system SMALLINT DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (role_id) REFERENCES sys_roles(id) ON DELETE CASCADE
            )
        """))
    else:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS sys_role_settings (
              role_id INT PRIMARY KEY COMMENT '系统角色ID',
              frontend_role_id VARCHAR(80) NOT NULL UNIQUE COMMENT '前端角色标识',
              display_level INT DEFAULT 1 COMMENT '前端显示级别',
              permissions_json TEXT COMMENT '权限标识JSON数组',
              is_system TINYINT(1) DEFAULT 0 COMMENT '是否系统预设角色',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (role_id) REFERENCES sys_roles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色前端配置扩展表'
        """))
    db.commit()


def parse_permissions(value, fallback):
    if not value:
        return fallback
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else fallback
    except Exception:
        return fallback


def serialize_permissions(permissions):
    return json.dumps(permissions or [], ensure_ascii=False)


def normalize_role(row):
    default_meta = DEFAULT_ROLE_META.get(row.permission_code, {})
    frontend_id = row.frontend_role_id or default_meta.get("frontend_id") or row.permission_code
    permissions = parse_permissions(row.permissions_json, default_meta.get("permissions", []))
    is_system = bool(row.is_system) or row.permission_code in SYSTEM_PERMISSION_CODES

    return {
        "backend_id": row.id,
        "id": frontend_id,
        "permission_code": row.permission_code,
        "name": row.role_name,
        "level": row.display_level if row.display_level is not None else default_meta.get("level", 1),
        "permissions": permissions,
        "description": row.description or "",
        "is_system": is_system,
    }


@router.get("/list")
def get_role_settings(
    current_user: dict = Depends(require_permission_codes(*ROLE_SETTINGS_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_role_settings_table(db)
        rows = db.execute(text("""
            SELECT r.id, r.role_name, r.permission_code, r.description,
                   s.frontend_role_id, s.display_level, s.permissions_json, s.is_system
            FROM sys_roles r
            LEFT JOIN sys_role_settings s ON s.role_id = r.id
            ORDER BY COALESCE(s.display_level, 0), r.id
        """)).fetchall()

        return {
            "success": True,
            "roles": [normalize_role(row) for row in rows],
        }
    except Exception as e:
        logger.error(f"获取角色设定失败: {e}")
        raise HTTPException(status_code=500, detail="获取角色设定失败")


@router.post("/create")
def create_role_setting(
    request: RoleSettingRequest,
    current_user: dict = Depends(require_permission_codes(*ROLE_SETTINGS_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_role_settings_table(db)
        role_key = request.id.strip()
        if not role_key or not request.name.strip():
            return {"success": False, "message": "请填写角色ID和名称"}

        existing = db.execute(text("""
            SELECT r.id
            FROM sys_roles r
            LEFT JOIN sys_role_settings s ON s.role_id = r.id
            WHERE r.permission_code = :role_key OR s.frontend_role_id = :role_key
        """), {"role_key": role_key}).fetchone()
        if existing:
            return {"success": False, "message": "角色ID已存在"}

        if is_postgresql(db):
            role_id = db.execute(text("""
                INSERT INTO sys_roles (role_name, permission_code, description, created_at)
                VALUES (:role_name, :permission_code, :description, CURRENT_TIMESTAMP)
                RETURNING id
            """), {
                "role_name": request.name.strip(),
                "permission_code": role_key,
                "description": request.description or "自定义角色",
            }).fetchone().id
        else:
            result = db.execute(text("""
                INSERT INTO sys_roles (role_name, permission_code, description, created_at)
                VALUES (:role_name, :permission_code, :description, CURRENT_TIMESTAMP)
            """), {
                "role_name": request.name.strip(),
                "permission_code": role_key,
                "description": request.description or "自定义角色",
            })
            role_id = result.lastrowid if is_sqlite(db) else db.execute(text("SELECT LAST_INSERT_ID() as id")).fetchone().id
        db.execute(text("""
            INSERT INTO sys_role_settings
            (role_id, frontend_role_id, display_level, permissions_json, is_system)
            VALUES (:role_id, :frontend_role_id, :display_level, :permissions_json, 0)
        """), {
            "role_id": role_id,
            "frontend_role_id": role_key,
            "display_level": request.level,
            "permissions_json": serialize_permissions(request.permissions or ["view_own_class"]),
        })
        db.commit()

        return {"success": True, "message": "角色添加成功", "role_id": role_id}
    except Exception as e:
        db.rollback()
        logger.error(f"添加角色失败: {e}")
        raise HTTPException(status_code=500, detail="添加角色失败")


@router.delete("/{role_key}")
def delete_role_setting(
    role_key: str,
    current_user: dict = Depends(require_permission_codes(*ROLE_SETTINGS_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_role_settings_table(db)
        role = db.execute(text("""
            SELECT r.id, r.role_name, r.permission_code, s.frontend_role_id, s.is_system
            FROM sys_roles r
            LEFT JOIN sys_role_settings s ON s.role_id = r.id
            WHERE r.permission_code = :role_key OR s.frontend_role_id = :role_key
        """), {"role_key": role_key}).fetchone()
        if not role:
            return {"success": False, "message": "角色不存在"}

        if role.permission_code in SYSTEM_PERMISSION_CODES or role.is_system:
            return {"success": False, "message": "系统预设角色不能删除"}

        user_count = db.execute(
            text("SELECT COUNT(*) as total FROM sys_users WHERE role_id = :role_id"),
            {"role_id": role.id},
        ).fetchone().total
        if user_count:
            return {"success": False, "message": "该角色已有用户使用，不能删除"}

        db.execute(text("DELETE FROM sys_roles WHERE id = :role_id"), {"role_id": role.id})
        db.commit()

        return {"success": True, "message": "角色已删除"}
    except Exception as e:
        db.rollback()
        logger.error(f"删除角色失败: {e}")
        raise HTTPException(status_code=500, detail="删除角色失败")
