"""
家长账号与学生绑定管理API
用于教务端维护家长账号、联系方式和学生绑定关系。
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import Optional
import logging

from core.database import get_db, is_postgresql, is_sqlite
from core.security import (
    get_password_hash,
    is_bcrypt_password_length_valid,
    require_permission_codes,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/parent-management", tags=["家长管理"])

PARENT_MANAGEMENT_PERMISSION_CODES = ("edu_admin", "exam_admin")


class ParentCreateRequest(BaseModel):
    name: str
    phone: str
    password: str
    email: Optional[str] = None
    relation: Optional[str] = "父亲"


class ParentUpdateRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    relation: Optional[str] = "父亲"
    status: Optional[str] = "active"


class ParentBindRequest(BaseModel):
    student_id: int
    relation: Optional[str] = "父亲"


def ensure_parent_management_tables(db: Session) -> None:
    if is_postgresql(db) or is_sqlite(db):
        rel_id_type = "BIGSERIAL" if is_postgresql(db) else "INTEGER"
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS biz_parent_profiles (
              parent_user_id BIGINT PRIMARY KEY,
              relation VARCHAR(20) DEFAULT '父亲',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (parent_user_id) REFERENCES sys_users(id) ON DELETE CASCADE
            )
        """))
        db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS biz_parent_student_rel (
              id {rel_id_type} PRIMARY KEY,
              parent_user_id BIGINT NOT NULL,
              student_id BIGINT NOT NULL,
              relation VARCHAR(20) DEFAULT '父亲',
              is_active SMALLINT DEFAULT 1,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (parent_user_id) REFERENCES sys_users(id) ON DELETE CASCADE,
              FOREIGN KEY (student_id) REFERENCES biz_students(id) ON DELETE CASCADE,
              CONSTRAINT uk_parent_student UNIQUE (parent_user_id, student_id)
            )
        """))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_parent_user ON biz_parent_student_rel (parent_user_id)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_student ON biz_parent_student_rel (student_id)"))
    else:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS biz_parent_profiles (
              parent_user_id BIGINT PRIMARY KEY COMMENT '家长用户ID',
              relation VARCHAR(20) DEFAULT '父亲' COMMENT '默认亲属关系',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (parent_user_id) REFERENCES sys_users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='家长资料扩展表'
        """))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS biz_parent_student_rel (
              id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '绑定ID',
              parent_user_id BIGINT NOT NULL COMMENT '家长用户ID',
              student_id BIGINT NOT NULL COMMENT '学生ID',
              relation VARCHAR(20) DEFAULT '父亲' COMMENT '亲属关系',
              is_active TINYINT(1) DEFAULT 1 COMMENT '是否有效',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (parent_user_id) REFERENCES sys_users(id) ON DELETE CASCADE,
              FOREIGN KEY (student_id) REFERENCES biz_students(id) ON DELETE CASCADE,
              UNIQUE KEY uk_parent_student (parent_user_id, student_id),
              INDEX idx_parent_user (parent_user_id),
              INDEX idx_student (student_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='家长学生绑定关系表'
        """))
    db.commit()


def upsert_parent_profile(db: Session, parent_id: int, relation: Optional[str]) -> None:
    if is_postgresql(db) or is_sqlite(db):
        db.execute(text("""
            INSERT INTO biz_parent_profiles (parent_user_id, relation, updated_at)
            VALUES (:parent_id, :relation, CURRENT_TIMESTAMP)
            ON CONFLICT (parent_user_id) DO UPDATE SET
              relation = excluded.relation,
              updated_at = CURRENT_TIMESTAMP
        """), {"parent_id": parent_id, "relation": relation or "父亲"})
    else:
        db.execute(text("""
            INSERT INTO biz_parent_profiles (parent_user_id, relation)
            VALUES (:parent_id, :relation)
            ON DUPLICATE KEY UPDATE relation = VALUES(relation)
        """), {"parent_id": parent_id, "relation": relation or "父亲"})


def upsert_parent_student_binding(db: Session, parent_id: int, student_id: int, relation: Optional[str]) -> None:
    if is_postgresql(db) or is_sqlite(db):
        db.execute(text("""
            INSERT INTO biz_parent_student_rel (parent_user_id, student_id, relation, is_active, updated_at)
            VALUES (:parent_id, :student_id, :relation, 1, CURRENT_TIMESTAMP)
            ON CONFLICT (parent_user_id, student_id) DO UPDATE SET
              relation = excluded.relation,
              is_active = 1,
              updated_at = CURRENT_TIMESTAMP
        """), {
            "parent_id": parent_id,
            "student_id": student_id,
            "relation": relation or "父亲",
        })
    else:
        db.execute(text("""
            INSERT INTO biz_parent_student_rel (parent_user_id, student_id, relation, is_active)
            VALUES (:parent_id, :student_id, :relation, 1)
            ON DUPLICATE KEY UPDATE relation = VALUES(relation), is_active = 1, updated_at = NOW()
        """), {
            "parent_id": parent_id,
            "student_id": student_id,
            "relation": relation or "父亲",
        })


def get_parent_role_id(db: Session) -> int:
    role = db.execute(
        text("SELECT id FROM sys_roles WHERE permission_code = 'parent' LIMIT 1")
    ).fetchone()
    if not role:
        raise HTTPException(status_code=500, detail="系统未配置家长角色(parent)")
    return role.id


def normalize_status(status: Optional[str]) -> int:
    return 0 if status in ("inactive", "停用", "disabled", "0") else 1


def get_parent_user_or_404(parent_id: int, db: Session):
    parent = db.execute(text("""
        SELECT u.id, u.username
        FROM sys_users u
        JOIN sys_roles r ON u.role_id = r.id
        WHERE u.id = :parent_id AND r.permission_code = 'parent'
    """), {"parent_id": parent_id}).fetchone()
    if not parent:
        raise HTTPException(status_code=404, detail="家长账号不存在")
    return parent


def get_parent_bindings(parent_ids, db: Session):
    if not parent_ids:
        return {}

    placeholders = ", ".join([f":id_{index}" for index, _ in enumerate(parent_ids)])
    params = {f"id_{index}": parent_id for index, parent_id in enumerate(parent_ids)}
    rows = db.execute(text(f"""
        SELECT rel.parent_user_id, rel.student_id, rel.relation,
               s.student_code, s.name as student_name, s.current_class, s.current_grade
        FROM biz_parent_student_rel rel
        JOIN biz_students s ON rel.student_id = s.id
        WHERE rel.is_active = 1 AND rel.parent_user_id IN ({placeholders})
        ORDER BY s.current_class, s.name
    """), params).fetchall()

    bindings = {}
    for row in rows:
        bindings.setdefault(row.parent_user_id, []).append({
            "id": row.student_id,
            "student_id": row.student_id,
            "student_code": row.student_code,
            "name": row.student_name,
            "relation": row.relation,
            "class_id": row.current_class,
            "class_name": row.current_class,
            "current_grade": row.current_grade,
        })
    return bindings


@router.get("/list")
def get_parent_list(
    keyword: Optional[str] = Query(None, description="关键字(姓名/手机号)"),
    status: Optional[str] = Query(None, description="active/inactive"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=200),
    current_user: dict = Depends(require_permission_codes(*PARENT_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_parent_management_tables(db)
        offset = (page - 1) * page_size
        conditions = ["r.permission_code = 'parent'"]
        params = {}

        if keyword:
            conditions.append("(u.real_name LIKE :keyword OR u.username LIKE :keyword OR u.phone LIKE :keyword)")
            params["keyword"] = f"%{keyword}%"
        if status:
            conditions.append("u.is_active = :is_active")
            params["is_active"] = normalize_status(status)

        where_clause = "WHERE " + " AND ".join(conditions)
        total = db.execute(text(f"""
            SELECT COUNT(*) as total
            FROM sys_users u
            JOIN sys_roles r ON u.role_id = r.id
            LEFT JOIN biz_parent_profiles p ON p.parent_user_id = u.id
            {where_clause}
        """), params).fetchone().total

        rows = db.execute(text(f"""
            SELECT u.id, u.username, u.real_name, u.phone, u.email, u.is_active,
                   u.created_at, p.relation
            FROM sys_users u
            JOIN sys_roles r ON u.role_id = r.id
            LEFT JOIN biz_parent_profiles p ON p.parent_user_id = u.id
            {where_clause}
            ORDER BY u.created_at DESC
            LIMIT :limit OFFSET :offset
        """), {**params, "limit": page_size, "offset": offset}).fetchall()

        parent_ids = [row.id for row in rows]
        bindings = get_parent_bindings(parent_ids, db)
        parents = []
        for row in rows:
            students = bindings.get(row.id, [])
            relation = row.relation or (students[0]["relation"] if students else "父亲")
            parents.append({
                "id": row.id,
                "username": row.username,
                "name": row.real_name,
                "phone": row.phone or row.username,
                "email": row.email,
                "relation": relation,
                "status": "active" if row.is_active == 1 else "inactive",
                "student_ids": [student["student_id"] for student in students],
                "students": students,
                "created_at": row.created_at.isoformat() if row.created_at else "",
            })

        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "parents": parents,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取家长列表失败: {e}")
        raise HTTPException(status_code=500, detail="获取家长列表失败")


@router.post("/create")
def create_parent(
    request: ParentCreateRequest,
    current_user: dict = Depends(require_permission_codes(*PARENT_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_parent_management_tables(db)
        phone = request.phone.strip()
        if len(request.password.strip()) < 6:
            return {"success": False, "message": "初始密码长度不能少于6位"}
        if not is_bcrypt_password_length_valid(request.password):
            return {"success": False, "message": "初始密码过长，请控制在72字节以内"}

        existing = db.execute(
            text("SELECT id FROM sys_users WHERE username = :username"),
            {"username": phone},
        ).fetchone()
        if existing:
            return {"success": False, "message": "该手机号已存在家长账号"}

        role_id = get_parent_role_id(db)
        if is_postgresql(db):
            parent_id = db.execute(text("""
                INSERT INTO sys_users
                (role_id, username, password_hash, real_name, phone, email, is_active, created_at, updated_at)
                VALUES
                (:role_id, :username, :password_hash, :real_name, :phone, :email, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
            """), {
                "role_id": role_id,
                "username": phone,
                "password_hash": get_password_hash(request.password.strip()),
                "real_name": request.name.strip(),
                "phone": phone,
                "email": request.email,
            }).fetchone().id
        else:
            result = db.execute(text("""
            INSERT INTO sys_users
            (role_id, username, password_hash, real_name, phone, email, is_active, created_at, updated_at)
            VALUES
            (:role_id, :username, :password_hash, :real_name, :phone, :email, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """), {
                "role_id": role_id,
                "username": phone,
                "password_hash": get_password_hash(request.password.strip()),
                "real_name": request.name.strip(),
                "phone": phone,
                "email": request.email,
            })
            parent_id = result.lastrowid if is_sqlite(db) else db.execute(text("SELECT LAST_INSERT_ID() as id")).fetchone().id
        upsert_parent_profile(db, parent_id, request.relation)
        db.commit()

        return {"success": True, "message": "家长账号创建成功", "parent_id": parent_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"创建家长账号失败: {e}")
        raise HTTPException(status_code=500, detail="创建家长账号失败")


@router.put("/{parent_id}/update")
def update_parent(
    parent_id: int,
    request: ParentUpdateRequest,
    current_user: dict = Depends(require_permission_codes(*PARENT_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_parent_management_tables(db)
        get_parent_user_or_404(parent_id, db)
        phone = request.phone.strip()
        duplicate = db.execute(text("""
            SELECT id FROM sys_users
            WHERE username = :username AND id <> :parent_id
        """), {"username": phone, "parent_id": parent_id}).fetchone()
        if duplicate:
            return {"success": False, "message": "该手机号已被其他账号使用"}

        db.execute(text("""
            UPDATE sys_users
            SET username = :username, real_name = :real_name, phone = :phone,
                email = :email, is_active = :is_active, updated_at = CURRENT_TIMESTAMP
            WHERE id = :parent_id
        """), {
            "parent_id": parent_id,
            "username": phone,
            "real_name": request.name.strip(),
            "phone": phone,
            "email": request.email,
            "is_active": normalize_status(request.status),
        })
        upsert_parent_profile(db, parent_id, request.relation)
        db.commit()

        return {"success": True, "message": "家长信息更新成功"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"更新家长信息失败: {e}")
        raise HTTPException(status_code=500, detail="更新家长信息失败")


@router.post("/{parent_id}/bind")
def bind_parent_student(
    parent_id: int,
    request: ParentBindRequest,
    current_user: dict = Depends(require_permission_codes(*PARENT_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_parent_management_tables(db)
        get_parent_user_or_404(parent_id, db)
        student = db.execute(
            text("SELECT id FROM biz_students WHERE id = :student_id"),
            {"student_id": request.student_id},
        ).fetchone()
        if not student:
            return {"success": False, "message": "学生不存在"}

        upsert_parent_student_binding(db, parent_id, request.student_id, request.relation)
        db.commit()

        return {"success": True, "message": "学生绑定成功"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"绑定学生失败: {e}")
        raise HTTPException(status_code=500, detail="绑定学生失败")


@router.delete("/{parent_id}/bindings/{student_id}")
def unbind_parent_student(
    parent_id: int,
    student_id: int,
    current_user: dict = Depends(require_permission_codes(*PARENT_MANAGEMENT_PERMISSION_CODES)),
    db: Session = Depends(get_db),
):
    try:
        ensure_parent_management_tables(db)
        get_parent_user_or_404(parent_id, db)
        db.execute(text("""
            UPDATE biz_parent_student_rel
            SET is_active = 0, updated_at = CURRENT_TIMESTAMP
            WHERE parent_user_id = :parent_id AND student_id = :student_id
        """), {"parent_id": parent_id, "student_id": student_id})
        db.commit()

        return {"success": True, "message": "学生绑定已解除"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"解除学生绑定失败: {e}")
        raise HTTPException(status_code=500, detail="解除学生绑定失败")
