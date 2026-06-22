import copy
import json
from typing import Any, Dict

from sqlalchemy import text
from sqlalchemy.orm import Session

from core.database import is_postgresql, is_sqlite


DEFAULT_SCORE_VISIBILITY_SETTINGS: Dict[str, Dict[str, bool]] = {
    "sys_admin": {
        "show_class_rank": True,
        "show_grade_rank": True,
        "show_layer_rank": True,
        "show_percentile": True,
        "allow_ai_analysis": True,
        "allow_export": True,
    },
    "edu_admin": {
        "show_class_rank": True,
        "show_grade_rank": True,
        "show_layer_rank": True,
        "show_percentile": True,
        "allow_ai_analysis": True,
        "allow_export": True,
    },
    "exam_admin": {
        "show_class_rank": True,
        "show_grade_rank": True,
        "show_layer_rank": True,
        "show_percentile": True,
        "allow_ai_analysis": True,
        "allow_export": True,
    },
    "grade_leader": {
        "show_class_rank": True,
        "show_grade_rank": True,
        "show_layer_rank": True,
        "show_percentile": True,
        "allow_ai_analysis": True,
        "allow_export": True,
    },
    "subject_leader": {
        "show_class_rank": True,
        "show_grade_rank": True,
        "show_layer_rank": True,
        "show_percentile": False,
        "allow_ai_analysis": True,
        "allow_export": True,
    },
    "lesson_leader": {
        "show_class_rank": True,
        "show_grade_rank": False,
        "show_layer_rank": True,
        "show_percentile": False,
        "allow_ai_analysis": True,
        "allow_export": True,
    },
    "headmaster": {
        "show_class_rank": True,
        "show_grade_rank": False,
        "show_layer_rank": False,
        "show_percentile": False,
        "allow_ai_analysis": True,
        "allow_export": True,
    },
    "teacher": {
        "show_class_rank": False,
        "show_grade_rank": False,
        "show_layer_rank": False,
        "show_percentile": False,
        "allow_ai_analysis": True,
        "allow_export": False,
    },
    "parent": {
        "show_class_rank": True,
        "show_grade_rank": False,
        "show_layer_rank": False,
        "show_percentile": False,
        "allow_ai_analysis": True,
        "allow_export": False,
    },
    "custom": {
        "show_class_rank": False,
        "show_grade_rank": False,
        "show_layer_rank": False,
        "show_percentile": False,
        "allow_ai_analysis": False,
        "allow_export": False,
    },
}

RANK_FIELD_VISIBILITY = {
    "class_rank": "show_class_rank",
    "rank_in_class": "show_class_rank",
    "grade_rank": "show_grade_rank",
    "rank": "show_grade_rank",
    "layer_rank": "show_layer_rank",
    "grade_percentile": "show_percentile",
    "percentile": "show_percentile",
    "percentile_change": "show_percentile",
}


def default_score_visibility_settings() -> Dict[str, Dict[str, bool]]:
    return copy.deepcopy(DEFAULT_SCORE_VISIBILITY_SETTINGS)


def ensure_score_visibility_table(db: Session) -> None:
    if is_postgresql(db) or is_sqlite(db):
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS sys_score_visibility_settings (
              role_code VARCHAR(50) PRIMARY KEY,
              settings_json TEXT NOT NULL,
              updated_by BIGINT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
    else:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS sys_score_visibility_settings (
              role_code VARCHAR(50) PRIMARY KEY COMMENT '权限角色代码',
              settings_json TEXT NOT NULL COMMENT '成绩可见性JSON',
              updated_by BIGINT NULL COMMENT '最后修改人',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成绩排名与分析可见性设置'
        """))
    db.commit()


def normalize_visibility_settings(settings: Dict[str, Any]) -> Dict[str, Dict[str, bool]]:
    normalized = default_score_visibility_settings()
    for role_code, values in (settings or {}).items():
        role = str(role_code or "").strip()
        if not role or not isinstance(values, dict):
            continue
        base = normalized.get(role, DEFAULT_SCORE_VISIBILITY_SETTINGS["custom"]).copy()
        for key in DEFAULT_SCORE_VISIBILITY_SETTINGS["custom"].keys():
            if key in values:
                base[key] = bool(values[key])
        normalized[role] = base
    return normalized


def fetch_score_visibility_settings(db: Session) -> Dict[str, Dict[str, bool]]:
    ensure_score_visibility_table(db)
    rows = db.execute(text("""
        SELECT role_code, settings_json
        FROM sys_score_visibility_settings
    """)).fetchall()
    stored = {}
    for row in rows:
        try:
            stored[row.role_code] = json.loads(row.settings_json or "{}")
        except Exception:
            stored[row.role_code] = {}
    return normalize_visibility_settings(stored)


def save_score_visibility_settings(
    db: Session,
    settings: Dict[str, Any],
    updated_by: Any = None,
) -> Dict[str, Dict[str, bool]]:
    ensure_score_visibility_table(db)
    normalized = normalize_visibility_settings(settings)
    if is_postgresql(db) or is_sqlite(db):
        upsert_sql = """
            INSERT INTO sys_score_visibility_settings
              (role_code, settings_json, updated_by, updated_at)
            VALUES
              (:role_code, :settings_json, :updated_by, CURRENT_TIMESTAMP)
            ON CONFLICT (role_code) DO UPDATE SET
              settings_json = excluded.settings_json,
              updated_by = excluded.updated_by,
              updated_at = CURRENT_TIMESTAMP
        """
    else:
        upsert_sql = """
            INSERT INTO sys_score_visibility_settings
              (role_code, settings_json, updated_by)
            VALUES
              (:role_code, :settings_json, :updated_by)
            ON DUPLICATE KEY UPDATE
              settings_json = VALUES(settings_json),
              updated_by = VALUES(updated_by)
        """
    for role_code, values in normalized.items():
        db.execute(text(upsert_sql), {
            "role_code": role_code,
            "settings_json": json.dumps(values, ensure_ascii=False),
            "updated_by": updated_by,
        })
    db.commit()
    return normalized


def resolve_visibility_for_user(
    current_user: Dict[str, Any],
    settings: Dict[str, Dict[str, bool]],
) -> Dict[str, bool]:
    role_code = current_user.get("permission_code") or current_user.get("role") or current_user.get("role_name") or "custom"
    return {
        **DEFAULT_SCORE_VISIBILITY_SETTINGS["custom"],
        **DEFAULT_SCORE_VISIBILITY_SETTINGS.get(role_code, {}),
        **(settings or {}).get(role_code, {}),
    }


def filter_rank_fields_by_visibility(value: Any, visibility: Dict[str, bool]) -> Any:
    if isinstance(value, list):
        return [filter_rank_fields_by_visibility(item, visibility) for item in value]

    if isinstance(value, dict):
        filtered = {}
        for key, child in value.items():
            rule_key = RANK_FIELD_VISIBILITY.get(str(key))
            if rule_key and not visibility.get(rule_key, False):
                continue
            filtered[key] = filter_rank_fields_by_visibility(child, visibility)
        return filtered

    return value
