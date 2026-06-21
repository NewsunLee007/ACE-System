"""
学科管理API
提供基础学科目录的查询与维护能力，逐步替代前端本地静态 schoolData。
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
router = APIRouter(prefix="/api/v1/subjects", tags=["学科管理"])

SUBJECT_VIEW_PERMISSION_CODES = (
    "sys_admin",
    "edu_admin",
    "exam_admin",
    "grade_leader",
    "subject_leader",
    "lesson_leader",
    "headmaster",
    "teacher",
)
SUBJECT_MANAGE_PERMISSION_CODES = ("sys_admin", "edu_admin")
DEFAULT_SUBJECTS = [
    {"name": "语文", "code": "YW", "description": "基础学科", "sort_order": 1},
    {"name": "数学", "code": "SX", "description": "基础学科", "sort_order": 2},
    {"name": "英语", "code": "YY", "description": "外语学科", "sort_order": 3},
    {"name": "科学", "code": "KX", "description": "综合科学", "sort_order": 4},
    {"name": "社会", "code": "SH", "description": "社会学科", "sort_order": 5},
]


class SubjectMutationRequest(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None


class BulkDeleteRequest(BaseModel):
    ids: List[int]


def normalize_name(value: str) -> str:
    return (value or "").strip()


def normalize_code(name: str, code: Optional[str]) -> str:
    explicit_code = (code or "").strip()
    return explicit_code or name[:2].upper()


def ensure_subject_table(db: Session) -> None:
    if is_postgresql(db) or is_sqlite(db):
        subject_id_type = "BIGSERIAL" if is_postgresql(db) else "INTEGER"
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS biz_subjects (
              id {subject_id_type} PRIMARY KEY,
              name VARCHAR(50) NOT NULL UNIQUE,
              code VARCHAR(20),
              description VARCHAR(255),
              sort_order INT DEFAULT 0,
              is_active SMALLINT DEFAULT 1,
              created_by BIGINT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_subject_active_order ON biz_subjects (is_active, sort_order)"))
    else:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS biz_subjects (
              id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '学科ID',
              name VARCHAR(50) NOT NULL COMMENT '学科名称',
              code VARCHAR(20) COMMENT '学科代码',
              description VARCHAR(255) COMMENT '学科说明',
              sort_order INT DEFAULT 0 COMMENT '排序',
              is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
              created_by BIGINT COMMENT '创建人ID',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
              UNIQUE KEY uk_subject_name (name),
              INDEX idx_subject_active_order (is_active, sort_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学科目录表'
        """))
    db.commit()


def parse_subjects_json(raw_value) -> List[str]:
    if not raw_value:
        return []
    if isinstance(raw_value, list):
        return [normalize_name(item) for item in raw_value if normalize_name(item)]
    try:
        parsed = json.loads(raw_value)
    except (TypeError, json.JSONDecodeError):
        return []
    if not isinstance(parsed, list):
        return []
    return [normalize_name(item) for item in parsed if normalize_name(item)]


def derive_subjects_from_existing_data(db: Session) -> List[str]:
    derived = []

    try:
        exam_rows = db.execute(text("""
            SELECT subjects
            FROM biz_exams
            WHERE subjects IS NOT NULL
            ORDER BY id DESC
            LIMIT 200
        """)).fetchall()
        for row in exam_rows:
            derived.extend(parse_subjects_json(row.subjects))
    except Exception as exc:
        logger.info("从考试科目派生学科失败，使用默认学科: %s", exc)

    try:
        teacher_rows = db.execute(text("""
            SELECT DISTINCT subject_name
            FROM biz_teacher_class_rel
            WHERE subject_name IS NOT NULL AND subject_name <> ''
        """)).fetchall()
        derived.extend(normalize_name(row.subject_name) for row in teacher_rows if normalize_name(row.subject_name))
    except Exception as exc:
        logger.info("从任课关系派生学科失败，使用默认学科: %s", exc)

    ordered = []
    seen = set()
    for subject in [item["name"] for item in DEFAULT_SUBJECTS] + derived:
        if subject and subject not in seen:
            ordered.append(subject)
            seen.add(subject)
    return ordered


def seed_subjects_if_empty(db: Session, current_user: dict) -> None:
    result = db.execute(text("SELECT COUNT(*) AS total FROM biz_subjects")).fetchone()
    if result and result.total > 0:
        return

    subjects = derive_subjects_from_existing_data(db)
    default_by_name = {item["name"]: item for item in DEFAULT_SUBJECTS}
    for index, name in enumerate(subjects):
        default_item = default_by_name.get(name, {})
        db.execute(text("""
            INSERT INTO biz_subjects
              (name, code, description, sort_order, is_active, created_by)
            VALUES
              (:name, :code, :description, :sort_order, 1, :created_by)
        """), {
            "name": name,
            "code": normalize_code(name, default_item.get("code")),
            "description": default_item.get("description", ""),
            "sort_order": default_item.get("sort_order", index + 1),
            "created_by": current_user.get("id")
        })
    db.commit()


def serialize_subject(row) -> dict:
    return {
        "id": int(row.id),
        "name": row.name,
        "code": row.code or normalize_code(row.name, None),
        "description": row.description or "",
        "sort_order": int(row.sort_order or 0),
        "is_active": bool(row.is_active)
    }


def get_subject_row(db: Session, subject_id: int):
    return db.execute(text("""
        SELECT id, name, code, description, sort_order, is_active
        FROM biz_subjects
        WHERE id = :subject_id
    """), {"subject_id": subject_id}).fetchone()


@router.get("")
def get_subjects(
    current_user: dict = Depends(require_permission_codes(*SUBJECT_VIEW_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """获取启用中的学科目录。"""
    try:
        ensure_subject_table(db)
        seed_subjects_if_empty(db, current_user)

        rows = db.execute(text("""
            SELECT id, name, code, description, sort_order, is_active
            FROM biz_subjects
            WHERE is_active = 1
            ORDER BY sort_order ASC, id ASC
        """)).fetchall()

        return {
            "success": True,
            "subjects": [serialize_subject(row) for row in rows]
        }
    except Exception as exc:
        logger.error("获取学科列表失败: %s", exc)
        raise HTTPException(status_code=500, detail="获取学科列表失败")


@router.post("")
def create_subject(
    request: SubjectMutationRequest,
    current_user: dict = Depends(require_permission_codes(*SUBJECT_MANAGE_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """新增学科。"""
    name = normalize_name(request.name)
    if not name:
        raise HTTPException(status_code=400, detail="学科名称不能为空")

    try:
        ensure_subject_table(db)
        existing = db.execute(text("""
            SELECT id, is_active
            FROM biz_subjects
            WHERE name = :name
        """), {"name": name}).fetchone()

        if existing and existing.is_active:
            raise HTTPException(status_code=409, detail="该学科已存在")

        params = {
            "name": name,
            "code": normalize_code(name, request.code),
            "description": (request.description or "").strip(),
            "sort_order": request.sort_order or 0,
            "created_by": current_user.get("id")
        }

        if existing:
            db.execute(text("""
                UPDATE biz_subjects
                SET code = :code,
                    description = :description,
                    sort_order = :sort_order,
                    is_active = 1,
                    created_by = :created_by
                WHERE id = :subject_id
            """), {**params, "subject_id": existing.id})
            subject_id = existing.id
        else:
            insert_sql = """
                INSERT INTO biz_subjects
                  (name, code, description, sort_order, is_active, created_by)
                VALUES
                  (:name, :code, :description, :sort_order, 1, :created_by)
            """
            if is_postgresql(db):
                insert_sql += " RETURNING id"
                subject_id = db.execute(text(insert_sql), params).fetchone().id
            else:
                result = db.execute(text(insert_sql), params)
                subject_id = result.lastrowid

        db.commit()
        return serialize_subject(get_subject_row(db, subject_id))
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error("新增学科失败: %s", exc)
        raise HTTPException(status_code=500, detail="新增学科失败")


@router.put("/{subject_id}")
def update_subject(
    subject_id: int,
    request: SubjectMutationRequest,
    current_user: dict = Depends(require_permission_codes(*SUBJECT_MANAGE_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """更新学科。"""
    name = normalize_name(request.name)
    if not name:
        raise HTTPException(status_code=400, detail="学科名称不能为空")

    try:
        ensure_subject_table(db)
        subject = get_subject_row(db, subject_id)
        if not subject or not subject.is_active:
            raise HTTPException(status_code=404, detail="学科不存在")

        duplicate = db.execute(text("""
            SELECT id
            FROM biz_subjects
            WHERE name = :name AND id <> :subject_id AND is_active = 1
        """), {"name": name, "subject_id": subject_id}).fetchone()
        if duplicate:
            raise HTTPException(status_code=409, detail="该学科已存在")

        db.execute(text("""
            UPDATE biz_subjects
            SET name = :name,
                code = :code,
                description = :description,
                sort_order = :sort_order,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :subject_id
        """), {
            "subject_id": subject_id,
            "name": name,
            "code": normalize_code(name, request.code),
            "description": (request.description or "").strip(),
            "sort_order": request.sort_order if request.sort_order is not None else subject.sort_order
        })
        db.commit()
        return serialize_subject(get_subject_row(db, subject_id))
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error("更新学科失败: %s", exc)
        raise HTTPException(status_code=500, detail="更新学科失败")


@router.delete("/{subject_id}")
def delete_subject(
    subject_id: int,
    current_user: dict = Depends(require_permission_codes(*SUBJECT_MANAGE_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """停用学科。历史考试成绩仍保留。"""
    try:
        ensure_subject_table(db)
        subject = get_subject_row(db, subject_id)
        if not subject or not subject.is_active:
            raise HTTPException(status_code=404, detail="学科不存在")

        db.execute(text("""
            UPDATE biz_subjects
            SET is_active = 0,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :subject_id
        """), {"subject_id": subject_id})
        db.commit()
        return {"success": True, "deleted": 1}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.error("删除学科失败: %s", exc)
        raise HTTPException(status_code=500, detail="删除学科失败")


@router.post("/bulk-delete")
def bulk_delete_subjects(
    request: BulkDeleteRequest,
    current_user: dict = Depends(require_permission_codes(*SUBJECT_MANAGE_PERMISSION_CODES)),
    db: Session = Depends(get_db)
):
    """批量停用学科。"""
    ids = [int(subject_id) for subject_id in request.ids if int(subject_id) > 0]
    if not ids:
        raise HTTPException(status_code=400, detail="请选择要删除的学科")

    try:
        ensure_subject_table(db)
        deleted = 0
        for subject_id in ids:
            result = db.execute(text("""
                UPDATE biz_subjects
                SET is_active = 0,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = :subject_id AND is_active = 1
            """), {"subject_id": subject_id})
            deleted += result.rowcount or 0
        db.commit()
        return {"success": True, "deleted": deleted}
    except Exception as exc:
        db.rollback()
        logger.error("批量删除学科失败: %s", exc)
        raise HTTPException(status_code=500, detail="批量删除学科失败")
