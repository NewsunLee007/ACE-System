"""
班级基础数据管理API
班级是学生、教师任课和成绩导入的基础维度。
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import Optional
import logging

from core.database import get_db, is_postgresql, is_sqlite
from core.security import require_permission_codes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/classes", tags=["班级管理"])

CLASS_MANAGEMENT_PERMISSION_CODES = ("edu_admin", "exam_admin")


class ClassRequest(BaseModel):
    class_code: Optional[str] = None
    class_no: str
    name: Optional[str] = None
    enrollment_year: int
    classroom_location: Optional[str] = None
    status: Optional[str] = "active"


def normalize_text(value) -> str:
    return str(value or "").strip()


def normalize_class_no(value) -> str:
    text_value = normalize_text(value)
    if not text_value:
        return ""
    digits = "".join(char for char in text_value if char.isdigit())
    if not digits:
        return text_value
    number = int(digits)
    sequence = number % 100 if number >= 100 else number
    return str(sequence).zfill(2)


def normalize_status(value) -> str:
    return "inactive" if value in ("inactive", "已毕业", "毕业", "disabled", "0") else "active"


def derive_class_code(request: ClassRequest) -> str:
    if request.class_code:
        return normalize_text(request.class_code)
    class_no = normalize_class_no(request.class_no)
    return f"{str(request.enrollment_year)[-2:]}{class_no}"


def ensure_class_table(db: Session) -> None:
    if is_postgresql(db) or is_sqlite(db):
        class_id_type = "BIGSERIAL" if is_postgresql(db) else "INTEGER"
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS biz_classes (
              id {class_id_type} PRIMARY KEY,
              class_code VARCHAR(20) NOT NULL UNIQUE,
              class_no VARCHAR(20) NOT NULL,
              name VARCHAR(100) NOT NULL,
              enrollment_year INT NOT NULL,
              classroom_location VARCHAR(100),
              status VARCHAR(20) DEFAULT 'active',
              created_by BIGINT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT uk_enrollment_class_no UNIQUE (enrollment_year, class_no)
            )
        """))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_class_status ON biz_classes (status)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_enrollment_year ON biz_classes (enrollment_year)"))
    else:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS biz_classes (
              id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '内部ID',
              class_code VARCHAR(20) NOT NULL UNIQUE COMMENT '班级编号，如701',
              class_no VARCHAR(20) NOT NULL COMMENT '班级序号，如01',
              name VARCHAR(100) NOT NULL COMMENT '班级名称',
              enrollment_year INT NOT NULL COMMENT '入学年份',
              classroom_location VARCHAR(100) COMMENT '教室位置',
              status VARCHAR(20) DEFAULT 'active' COMMENT 'active/inactive',
              created_by BIGINT COMMENT '创建人ID',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              UNIQUE KEY uk_enrollment_class_no (enrollment_year, class_no),
              INDEX idx_class_status (status),
              INDEX idx_enrollment_year (enrollment_year)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='班级基础信息表'
        """))
    db.commit()


def row_to_class(row, student_count=0):
    class_code = normalize_text(row.class_code)
    numeric_id = int(class_code) if class_code.isdigit() else class_code
    return {
        "id": numeric_id,
        "class_code": class_code,
        "class_no": normalize_class_no(row.class_no or class_code),
        "name": row.name,
        "enrollment_year": row.enrollment_year,
        "classroom_location": row.classroom_location or "",
        "status": row.status or "active",
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "updated_at": row.updated_at.isoformat() if getattr(row, "updated_at", None) else "",
        "student_count": student_count,
    }


@router.get("/list")
def get_class_list(
    status: Optional[str] = Query(None, description="active/inactive"),
    keyword: Optional[str] = Query(None, description="班级编号/名称"),
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=500),
    current_user: dict = Depends(require_permission_codes(*CLASS_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_class_table(db)
        offset = (page - 1) * page_size
        conditions = []
        params = {}

        if status:
            conditions.append("c.status = :status")
            params["status"] = normalize_status(status)
        if keyword:
            conditions.append("(c.class_code LIKE :keyword OR c.name LIKE :keyword)")
            params["keyword"] = f"%{keyword}%"

        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        total = db.execute(text(f"""
            SELECT COUNT(*) as total
            FROM biz_classes c
            {where_clause}
        """), params).fetchone().total

        rows = db.execute(text(f"""
            SELECT c.class_code, c.class_no, c.name, c.enrollment_year,
                   c.classroom_location, c.status, c.created_at, c.updated_at
            FROM biz_classes c
            {where_clause}
            ORDER BY c.enrollment_year DESC, c.class_no
            LIMIT :limit OFFSET :offset
        """), {**params, "limit": page_size, "offset": offset}).fetchall()

        counts = {
            row.current_class: row.student_count
            for row in db.execute(text("""
                SELECT current_class, COUNT(*) as student_count
                FROM biz_students
                WHERE current_class IS NOT NULL AND current_class <> ''
                GROUP BY current_class
            """)).fetchall()
        }

        classes = [row_to_class(row, counts.get(row.class_code, 0)) for row in rows]
        known_codes = {item["class_code"] for item in classes}

        if not keyword and not status:
            derived_rows = db.execute(text("""
                SELECT current_class as class_code,
                       MIN(enrollment_year) as enrollment_year,
                       current_grade,
                       COUNT(*) as student_count
                FROM biz_students
                WHERE current_class IS NOT NULL AND current_class <> ''
                GROUP BY current_class, current_grade
                ORDER BY current_class
            """)).fetchall()
            for row in derived_rows:
                class_code = normalize_text(row.class_code)
                if class_code in known_codes:
                    continue
                class_no = normalize_class_no(class_code)
                numeric_id = int(class_code) if class_code.isdigit() else class_code
                classes.append({
                    "id": numeric_id,
                    "class_code": class_code,
                    "class_no": class_no,
                    "name": f"{row.enrollment_year}级{class_no}班",
                    "enrollment_year": row.enrollment_year,
                    "classroom_location": "",
                    "status": "active",
                    "created_at": "",
                    "updated_at": "",
                    "student_count": row.student_count,
                    "derived_from_students": True,
                })

        return {
            "success": True,
            "total": max(total, len(classes)),
            "page": page,
            "page_size": page_size,
            "classes": classes,
        }
    except Exception as e:
        logger.error(f"获取班级列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取班级列表失败")


@router.post("/create")
def create_class(
    request: ClassRequest,
    current_user: dict = Depends(require_permission_codes(*CLASS_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_class_table(db)
        class_no = normalize_class_no(request.class_no)
        class_code = derive_class_code(request)
        name = request.name or f"{request.enrollment_year}级{class_no}班"

        existing = db.execute(text("""
            SELECT id FROM biz_classes
            WHERE class_code = :class_code OR (enrollment_year = :enrollment_year AND class_no = :class_no)
        """), {
            "class_code": class_code,
            "enrollment_year": request.enrollment_year,
            "class_no": class_no,
        }).fetchone()
        if existing:
            return {"success": False, "message": "该班级已存在，请直接编辑原班级"}

        db.execute(text("""
            INSERT INTO biz_classes
            (class_code, class_no, name, enrollment_year, classroom_location, status, created_by, created_at, updated_at)
            VALUES
            (:class_code, :class_no, :name, :enrollment_year, :classroom_location, :status, :created_by, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """), {
            "class_code": class_code,
            "class_no": class_no,
            "name": name,
            "enrollment_year": request.enrollment_year,
            "classroom_location": request.classroom_location,
            "status": normalize_status(request.status),
            "created_by": current_user["id"],
        })
        db.commit()
        return {"success": True, "message": "班级创建成功", "class_code": class_code}
    except Exception as e:
        db.rollback()
        logger.error(f"创建班级失败: {e}")
        raise HTTPException(status_code=500, detail="创建班级失败")


@router.put("/{class_code}/update")
def update_class(
    class_code: str,
    request: ClassRequest,
    current_user: dict = Depends(require_permission_codes(*CLASS_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_class_table(db)
        existing = db.execute(
            text("SELECT id FROM biz_classes WHERE class_code = :class_code"),
            {"class_code": class_code},
        ).fetchone()
        if not existing:
            return {"success": False, "message": "班级不存在"}

        class_no = normalize_class_no(request.class_no)
        name = request.name or f"{request.enrollment_year}级{class_no}班"
        db.execute(text("""
            UPDATE biz_classes
            SET class_no = :class_no,
                name = :name,
                enrollment_year = :enrollment_year,
                classroom_location = :classroom_location,
                status = :status,
                updated_at = CURRENT_TIMESTAMP
            WHERE class_code = :class_code
        """), {
            "class_code": class_code,
            "class_no": class_no,
            "name": name,
            "enrollment_year": request.enrollment_year,
            "classroom_location": request.classroom_location,
            "status": normalize_status(request.status),
        })
        db.commit()
        return {"success": True, "message": "班级信息更新成功"}
    except Exception as e:
        db.rollback()
        logger.error(f"更新班级失败: {e}")
        raise HTTPException(status_code=500, detail="更新班级失败")


@router.post("/{class_code}/deactivate")
def deactivate_class(
    class_code: str,
    current_user: dict = Depends(require_permission_codes(*CLASS_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_class_table(db)
        db.execute(text("""
            UPDATE biz_classes
            SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
            WHERE class_code = :class_code
        """), {"class_code": class_code})
        db.commit()
        return {"success": True, "message": "班级已标记为已毕业"}
    except Exception as e:
        db.rollback()
        logger.error(f"停用班级失败: {e}")
        raise HTTPException(status_code=500, detail="停用班级失败")
