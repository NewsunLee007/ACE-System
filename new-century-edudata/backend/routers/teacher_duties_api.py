"""
教师职务API
保存班主任、中层管理、校级职务等多职务信息，不覆盖 sys_users 的基础角色。
"""

from datetime import datetime
from typing import Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.database import get_db, is_postgresql, is_sqlite
from core.security import require_permission_codes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/teacher-duties", tags=["教师职务"])

TEACHER_DUTY_PERMISSION_CODES = ("edu_admin",)

VALID_DUTY_TYPES = {
    "head_teacher",
    "lesson_leader",
    "research_leader",
    "grade_leader",
    "grade_deputy",
    "dept_director",
    "dept_deputy",
    "vice_principal",
    "principal",
}


class TeacherDutyRequest(BaseModel):
    teacher_id: int
    duty_type: str
    term: str
    grade_name: Optional[str] = None
    subject_name: Optional[str] = None
    class_name: Optional[str] = None
    scope_label: Optional[str] = None


def normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text_value = str(value).strip()
    return text_value or None


def normalize_duty_type(duty_type: str) -> str:
    normalized = str(duty_type or "").strip()
    if normalized not in VALID_DUTY_TYPES:
        raise HTTPException(status_code=400, detail="未知职务类型")
    return normalized


def ensure_teacher_duties_table(db: Session) -> None:
    if is_postgresql(db) or is_sqlite(db):
        duty_id_type = "BIGSERIAL" if is_postgresql(db) else "INTEGER"
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS biz_teacher_duties (
              id {duty_id_type} PRIMARY KEY,
              teacher_id BIGINT NOT NULL,
              duty_type VARCHAR(50) NOT NULL,
              term VARCHAR(20) NOT NULL,
              grade_name VARCHAR(20),
              subject_name VARCHAR(50),
              class_name VARCHAR(20),
              scope_label VARCHAR(100),
              is_active SMALLINT DEFAULT 1,
              assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              ended_at TIMESTAMP NULL,
              created_by BIGINT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (teacher_id) REFERENCES sys_users(id)
            )
        """))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_teacher_duty_term ON biz_teacher_duties (teacher_id, term, duty_type)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_duty_scope ON biz_teacher_duties (duty_type, term, grade_name, subject_name, class_name)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_duty_active ON biz_teacher_duties (is_active)"))
    else:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS biz_teacher_duties (
              id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '教师职务ID',
              teacher_id BIGINT NOT NULL COMMENT '教师用户ID',
              duty_type VARCHAR(50) NOT NULL COMMENT '职务类型',
              term VARCHAR(20) NOT NULL COMMENT '学期',
              grade_name VARCHAR(20) COMMENT '职务年级',
              subject_name VARCHAR(50) COMMENT '职务学科',
              class_name VARCHAR(20) COMMENT '班级范围',
              scope_label VARCHAR(100) COMMENT '职务范围说明',
              is_active TINYINT(1) DEFAULT 1 COMMENT '是否有效',
              assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '任命时间',
              ended_at TIMESTAMP NULL COMMENT '解除时间',
              created_by BIGINT COMMENT '创建人ID',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
              FOREIGN KEY (teacher_id) REFERENCES sys_users(id),
              INDEX idx_teacher_duty_term (teacher_id, term, duty_type),
              INDEX idx_duty_scope (duty_type, term, grade_name, subject_name, class_name),
              INDEX idx_duty_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='教师职务任命表'
        """))
    db.commit()


def normalize_duty_row(row):
    return {
        "id": row.id,
        "teacher_id": row.teacher_id,
        "teacher_name": row.teacher_name,
        "teacher_code": row.teacher_code,
        "phone": row.phone or "",
        "duty_type": row.duty_type,
        "term": row.term,
        "grade_name": row.grade_name or "",
        "subject_name": row.subject_name or "",
        "class_name": row.class_name or "",
        "scope_label": row.scope_label or "",
        "is_active": row.is_active == 1,
        "assigned_at": row.assigned_at.isoformat() if row.assigned_at else "",
        "ended_at": row.ended_at.isoformat() if row.ended_at else None,
    }


@router.get("/list")
def get_teacher_duties(
    term: Optional[str] = Query(None, description="学期筛选"),
    include_inactive: bool = Query(False, description="是否包含已解除职务"),
    current_user: dict = Depends(require_permission_codes(*TEACHER_DUTY_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_teacher_duties_table(db)

        conditions = []
        params = {}
        if term:
            conditions.append("d.term = :term")
            params["term"] = term
        if not include_inactive:
            conditions.append("d.is_active = 1")

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        rows = db.execute(text(f"""
            SELECT d.id, d.teacher_id, u.real_name as teacher_name, u.username as teacher_code,
                   u.phone, d.duty_type, d.term, d.grade_name, d.subject_name, d.class_name,
                   d.scope_label, d.is_active, d.assigned_at, d.ended_at
            FROM biz_teacher_duties d
            JOIN sys_users u ON u.id = d.teacher_id
            {where_clause}
            ORDER BY d.is_active DESC, d.term DESC, d.duty_type, u.real_name
        """), params).fetchall()

        return {
            "success": True,
            "duties": [normalize_duty_row(row) for row in rows],
        }
    except Exception as e:
        logger.error(f"获取教师职务失败: {e}")
        raise HTTPException(status_code=500, detail="获取教师职务失败")


@router.post("/assign")
def assign_teacher_duty(
    request: TeacherDutyRequest,
    current_user: dict = Depends(require_permission_codes(*TEACHER_DUTY_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_teacher_duties_table(db)
        duty_type = normalize_duty_type(request.duty_type)
        term = normalize_text(request.term)
        if not term:
            return {"success": False, "message": "请选择任教学期"}

        teacher = db.execute(
            text("SELECT id FROM sys_users WHERE id = :teacher_id AND is_active = 1"),
            {"teacher_id": request.teacher_id},
        ).fetchone()
        if not teacher:
            raise HTTPException(status_code=404, detail="教师不存在或已停用")

        payload = {
            "teacher_id": request.teacher_id,
            "duty_type": duty_type,
            "term": term,
            "grade_name": normalize_text(request.grade_name),
            "subject_name": normalize_text(request.subject_name),
            "class_name": normalize_text(request.class_name),
            "scope_label": normalize_text(request.scope_label),
        }

        if duty_type == "head_teacher" and payload["class_name"]:
            class_head_teacher = db.execute(text("""
                SELECT id FROM biz_teacher_duties
                WHERE duty_type = 'head_teacher'
                  AND term = :term
                  AND COALESCE(class_name, '') = COALESCE(:class_name, '')
                  AND teacher_id <> :teacher_id
                  AND is_active = 1
            """), payload).fetchone()
            if class_head_teacher:
                return {"success": False, "message": "该班级已设置班主任", "duty_id": class_head_teacher.id}

        duplicate = db.execute(text("""
            SELECT id FROM biz_teacher_duties
            WHERE teacher_id = :teacher_id
              AND duty_type = :duty_type
              AND term = :term
              AND COALESCE(grade_name, '') = COALESCE(:grade_name, '')
              AND COALESCE(subject_name, '') = COALESCE(:subject_name, '')
              AND COALESCE(class_name, '') = COALESCE(:class_name, '')
              AND is_active = 1
        """), payload).fetchone()
        if duplicate:
            return {"success": False, "message": "该教师已有相同职务安排", "duty_id": duplicate.id}

        insert_sql = """
            INSERT INTO biz_teacher_duties
            (teacher_id, duty_type, term, grade_name, subject_name, class_name, scope_label, created_by)
            VALUES
            (:teacher_id, :duty_type, :term, :grade_name, :subject_name, :class_name, :scope_label, :created_by)
        """
        if is_postgresql(db):
            insert_sql += " RETURNING id"
            duty_id = db.execute(text(insert_sql), {
                **payload,
                "created_by": current_user.get("id"),
            }).fetchone().id
        else:
            result = db.execute(text(insert_sql), {
            **payload,
            "created_by": current_user.get("id"),
            })
            duty_id = result.lastrowid if is_sqlite(db) else db.execute(text("SELECT LAST_INSERT_ID() as id")).fetchone().id
        db.commit()

        logger.info(
            "分配教师职务成功: teacher_id=%s, duty_type=%s, 操作人=%s",
            request.teacher_id,
            duty_type,
            current_user.get("username"),
        )
        return {"success": True, "message": "职务分配成功", "duty_id": duty_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"分配教师职务失败: {e}")
        raise HTTPException(status_code=500, detail="分配教师职务失败")


@router.delete("/{duty_id}")
def deactivate_teacher_duty(
    duty_id: int,
    current_user: dict = Depends(require_permission_codes(*TEACHER_DUTY_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_teacher_duties_table(db)
        duty = db.execute(
            text("SELECT id FROM biz_teacher_duties WHERE id = :duty_id AND is_active = 1"),
            {"duty_id": duty_id},
        ).fetchone()
        if not duty:
            raise HTTPException(status_code=404, detail="职务不存在或已解除")

        db.execute(text("""
            UPDATE biz_teacher_duties
            SET is_active = 0, ended_at = :ended_at, updated_at = CURRENT_TIMESTAMP
            WHERE id = :duty_id
        """), {
            "duty_id": duty_id,
            "ended_at": datetime.utcnow(),
        })
        db.commit()

        return {"success": True, "message": "职务已解除"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"解除教师职务失败: {e}")
        raise HTTPException(status_code=500, detail="解除教师职务失败")
