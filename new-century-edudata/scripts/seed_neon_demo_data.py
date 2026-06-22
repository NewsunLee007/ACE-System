#!/usr/bin/env python3
"""
Seed Neon/PostgreSQL with the real imported demo dataset used by the frontend.

Usage:
  DATABASE_URL="postgresql://..." python scripts/seed_neon_demo_data.py --with-schema

Optional:
  SEED_DEFAULT_PASSWORD="change-me" python scripts/seed_neon_demo_data.py
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path

import psycopg2
from passlib.hash import bcrypt
from psycopg2.extras import execute_values


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = PROJECT_ROOT / "frontend" / "src" / "data" / "demoSchoolData.js"
SCHEMA_FILE = PROJECT_ROOT / "database" / "neon_postgres_schema.sql"

TEACHER_USER_OFFSET = 10000
PARENT_USER_OFFSET = 20000
DEFAULT_TERM = "2025-1"
DEFAULT_ACADEMIC_YEAR = "2025-2026"

ROLE_FRONTEND_META = {
    "sys_admin": ("admin", 9, ["all_permissions", "system_config"]),
    "edu_admin": ("edu_admin", 8, ["view_school_all", "manage_departments", "analysis_execute"]),
    "exam_admin": ("exam_admin", 6, ["manage_exams", "manage_students", "import_scores"]),
    "grade_leader": ("grade_leader", 5, ["view_grade_all", "analysis_view"]),
    "subject_leader": ("subject_leader", 4, ["view_subject_all", "analysis_view"]),
    "lesson_leader": ("lesson_leader", 3, ["view_lesson_group", "analysis_view"]),
    "headmaster": ("head_teacher", 2, ["view_own_class"]),
    "teacher": ("subject_teacher", 1, ["view_teaching_classes"]),
    "parent": ("parent", 0, ["view_own_student"]),
    "custom": ("custom", 0, []),
}


def load_demo_data() -> dict:
    node_code = f"""
      const {{ DEMO_SCHOOL_DATA }} = require({json.dumps(str(DATA_FILE))});
      process.stdout.write(JSON.stringify(DEMO_SCHOOL_DATA));
    """
    result = subprocess.run(
        ["node", "-e", node_code],
        cwd=str(PROJECT_ROOT),
        check=True,
        text=True,
        capture_output=True,
    )
    return json.loads(result.stdout)


def normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


def execute_schema(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(SCHEMA_FILE.read_text(encoding="utf-8"))
    conn.commit()


def fetch_role_ids(cur) -> dict:
    cur.execute("SELECT id, permission_code FROM sys_roles")
    return {permission_code: role_id for role_id, permission_code in cur.fetchall()}


def grade_from_class_id(class_id: int | str | None) -> str:
    text = str(class_id or "").strip()
    if text and text[0].isdigit():
        return f"{text[0]}年级"
    return ""


def class_code(value) -> str:
    return str(value or "").replace("班", "").strip()


def layer_name_for_code(layer_code: str) -> str:
    return "全年级" if layer_code == "ALL" else f"{layer_code}层"


def class_layer_lookup(data: dict) -> dict[str, dict]:
    return {
        class_code(layer.get("class_name") or layer.get("class_id")): layer
        for layer in data.get("classLayers") or []
    }


def reset_sequence(cur, table: str) -> None:
    cur.execute(
        """
        SELECT setval(
          pg_get_serial_sequence(%s, 'id'),
          GREATEST(COALESCE((SELECT MAX(id) FROM """ + table + """), 1), 1),
          true
        )
        """,
        (table,),
    )


def seed_roles(cur, role_ids: dict) -> None:
    rows = []
    for permission_code, (frontend_id, level, permissions) in ROLE_FRONTEND_META.items():
        role_id = role_ids.get(permission_code)
        if role_id:
            rows.append((role_id, frontend_id, level, json.dumps(permissions, ensure_ascii=False), 1))
    execute_values(
        cur,
        """
        INSERT INTO sys_role_settings
          (role_id, frontend_role_id, display_level, permissions_json, is_system)
        VALUES %s
        ON CONFLICT (role_id) DO UPDATE SET
          frontend_role_id = excluded.frontend_role_id,
          display_level = excluded.display_level,
          permissions_json = excluded.permissions_json,
          is_system = excluded.is_system,
          updated_at = CURRENT_TIMESTAMP
        """,
        rows,
    )


def seed_users(cur, data: dict, role_ids: dict, default_password: str) -> None:
    password_hash = bcrypt.hash(default_password)
    admin_users = [
        (1, role_ids["sys_admin"], "admin", password_hash, "系统管理员", "", "", 1),
        (2, role_ids["edu_admin"], "dean", password_hash, "李主任", "", "", 1),
    ]
    teacher_users = [
        (
            TEACHER_USER_OFFSET + int(teacher["id"]),
            role_ids["teacher"],
            teacher["code"],
            password_hash,
            teacher["name"],
            teacher.get("phone") or "",
            teacher.get("email") or "",
            1 if teacher.get("status") == "active" else 0,
        )
        for teacher in data["teachers"]
    ]
    parent_users = [
        (
            PARENT_USER_OFFSET + int(parent["id"]),
            role_ids["parent"],
            parent["phone"],
            password_hash,
            parent["name"],
            parent.get("phone") or "",
            parent.get("email") or "",
            1 if parent.get("status") in {"normal", "active"} else 0,
        )
        for parent in data["parents"]
    ]
    execute_values(
        cur,
        """
        INSERT INTO sys_users
          (id, role_id, username, password_hash, real_name, phone, email, is_active, created_at, updated_at)
        VALUES %s
        ON CONFLICT (username) DO UPDATE SET
          role_id = excluded.role_id,
          password_hash = excluded.password_hash,
          real_name = excluded.real_name,
          phone = excluded.phone,
          email = excluded.email,
          is_active = excluded.is_active,
          updated_at = CURRENT_TIMESTAMP
        """,
        admin_users + teacher_users + parent_users,
    )
    reset_sequence(cur, "sys_users")


def seed_classes_and_subjects(cur, data: dict) -> None:
    execute_values(
        cur,
        """
        INSERT INTO biz_subjects (name, code, description, sort_order, is_active)
        VALUES %s
        ON CONFLICT (name) DO UPDATE SET
          code = excluded.code,
          description = excluded.description,
          sort_order = excluded.sort_order,
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP
        """,
        [(subject, subject[:2].upper(), "真实导入学科", index + 1, 1) for index, subject in enumerate(data["subjects"])],
    )
    execute_values(
        cur,
        """
        INSERT INTO biz_classes
          (class_code, class_no, name, enrollment_year, classroom_location, status, created_at, updated_at)
        VALUES %s
        ON CONFLICT (class_code) DO UPDATE SET
          class_no = excluded.class_no,
          name = excluded.name,
          enrollment_year = excluded.enrollment_year,
          classroom_location = excluded.classroom_location,
          status = excluded.status,
          updated_at = CURRENT_TIMESTAMP
        """,
        [
            (
                str(item["id"]),
                item["class_no"],
                item["name"],
                item["enrollment_year"],
                item.get("classroom_location") or "",
                item.get("status") or "active",
                item.get("created_at"),
                item.get("created_at"),
            )
            for item in data["classes"]
        ],
    )


def seed_class_layer_settings(cur, data: dict) -> None:
    rows = []
    for layer in data.get("classLayers") or []:
        rows.append((
            layer.get("grade_level") or grade_from_class_id(layer.get("class_id")),
            int(layer["class_id"]),
            class_code(layer.get("class_name") or layer.get("class_id")),
            layer.get("layer_code") or "C",
            layer.get("layer_name") or layer_name_for_code(layer.get("layer_code") or "C"),
            DEFAULT_ACADEMIC_YEAR,
            DEFAULT_TERM,
            "由真实导入班级层次生成",
            layer.get("created_at"),
            layer.get("created_at"),
        ))
    if not rows:
        return

    execute_values(
        cur,
        """
        INSERT INTO biz_class_layers
          (grade_level, class_id, class_name, layer_code, layer_name,
           academic_year, term, description, created_at, updated_at)
        VALUES %s
        ON CONFLICT (grade_level, class_id, academic_year, term) DO UPDATE SET
          class_name = excluded.class_name,
          layer_code = excluded.layer_code,
          layer_name = excluded.layer_name,
          description = excluded.description,
          updated_at = CURRENT_TIMESTAMP
        """,
        rows,
    )


def seed_students(cur, data: dict) -> None:
    execute_values(
        cur,
        """
        INSERT INTO biz_students
          (id, student_code, name, gender, enrollment_year, current_grade, current_class, id_card_last6, status, created_at, updated_at)
        VALUES %s
        ON CONFLICT (student_code) DO UPDATE SET
          name = excluded.name,
          gender = excluded.gender,
          enrollment_year = excluded.enrollment_year,
          current_grade = excluded.current_grade,
          current_class = excluded.current_class,
          id_card_last6 = excluded.id_card_last6,
          status = excluded.status,
          updated_at = CURRENT_TIMESTAMP
        """,
        [
            (
                int(student["id"]),
                student["student_code"],
                student["name"],
                int(student.get("gender") or 1),
                int(student["enrollment_year"]),
                grade_from_class_id(student.get("class_id")),
                str(student.get("class_id") or ""),
                str(student.get("student_code") or "")[-6:],
                student.get("status") or "在籍",
                student.get("created_at"),
                student.get("created_at"),
            )
            for student in data["students"]
        ],
        page_size=500,
    )
    reset_sequence(cur, "biz_students")


def seed_teaching_relations(cur, data: dict) -> None:
    rows = []
    for teacher in data["teachers"]:
        teacher_id = TEACHER_USER_OFFSET + int(teacher["id"])
        for assignment in teacher.get("teaching_classes") or []:
            class_id = assignment.get("class_id")
            rows.append((
                teacher_id,
                "2025-1",
                grade_from_class_id(class_id),
                str(class_id),
                assignment.get("subject") or "",
                0,
            ))
    execute_values(
        cur,
        """
        INSERT INTO biz_teacher_class_rel
          (teacher_id, term, grade_name, class_name, subject_name, is_headmaster)
        VALUES %s
        ON CONFLICT (term, class_name, subject_name) DO UPDATE SET
          teacher_id = excluded.teacher_id,
          grade_name = excluded.grade_name,
          is_headmaster = excluded.is_headmaster
        """,
        rows,
        page_size=500,
    )


def seed_parents(cur, data: dict) -> None:
    profile_rows = [
        (PARENT_USER_OFFSET + int(parent["id"]), parent.get("relation") or "父亲")
        for parent in data["parents"]
    ]
    binding_rows = []
    for parent in data["parents"]:
        parent_id = PARENT_USER_OFFSET + int(parent["id"])
        for student_id in parent.get("student_ids") or []:
            binding_rows.append((parent_id, int(student_id), parent.get("relation") or "父亲", 1))
    execute_values(
        cur,
        """
        INSERT INTO biz_parent_profiles (parent_user_id, relation)
        VALUES %s
        ON CONFLICT (parent_user_id) DO UPDATE SET
          relation = excluded.relation,
          updated_at = CURRENT_TIMESTAMP
        """,
        profile_rows,
    )
    execute_values(
        cur,
        """
        INSERT INTO biz_parent_student_rel (parent_user_id, student_id, relation, is_active)
        VALUES %s
        ON CONFLICT (parent_user_id, student_id) DO UPDATE SET
          relation = excluded.relation,
          is_active = excluded.is_active,
          updated_at = CURRENT_TIMESTAMP
        """,
        binding_rows,
    )


def seed_parent_student_layers(cur, data: dict) -> None:
    layer_by_class = class_layer_lookup(data)
    student_by_id = {int(student["id"]): student for student in data["students"]}
    rows = []

    for parent in data["parents"]:
        parent_id = PARENT_USER_OFFSET + int(parent["id"])
        for student_id in parent.get("student_ids") or []:
            student = student_by_id.get(int(student_id))
            if not student:
                continue
            class_name = class_code(student.get("class_id"))
            layer = layer_by_class.get(class_name, {})
            rows.append((
                parent_id,
                int(student_id),
                layer.get("layer_code") or "C",
                class_name,
                DEFAULT_ACADEMIC_YEAR,
                DEFAULT_TERM,
                1,
            ))
    if not rows:
        return

    execute_values(
        cur,
        """
        INSERT INTO biz_parent_student_layer
          (parent_user_id, student_id, layer_code, class_name, academic_year, term, is_active)
        VALUES %s
        ON CONFLICT (parent_user_id, student_id, academic_year, term) DO UPDATE SET
          layer_code = excluded.layer_code,
          class_name = excluded.class_name,
          is_active = excluded.is_active,
          updated_at = CURRENT_TIMESTAMP
        """,
        rows,
    )


def seed_user_layer_permissions(cur, data: dict) -> None:
    layer_by_class = class_layer_lookup(data)
    rows = []

    for layer_code in ["ALL", "A", "B", "C"]:
        rows.extend([
            (1, "sys_admin", layer_code, "*", "view", 1),
            (1, "sys_admin", layer_code, "*", "push", 1),
            (2, "edu_admin", layer_code, "*", "view", 1),
            (2, "edu_admin", layer_code, "*", "push", 1),
        ])

    for teacher in data["teachers"]:
        teacher_id = TEACHER_USER_OFFSET + int(teacher["id"])
        for assignment in teacher.get("teaching_classes") or []:
            class_name = class_code(assignment.get("class_id"))
            layer = layer_by_class.get(class_name, {})
            rows.append((
                teacher_id,
                "teacher",
                layer.get("layer_code") or "C",
                class_name,
                "view",
                2,
            ))

    student_by_id = {int(student["id"]): student for student in data["students"]}
    for parent in data["parents"]:
        parent_id = PARENT_USER_OFFSET + int(parent["id"])
        for student_id in parent.get("student_ids") or []:
            student = student_by_id.get(int(student_id))
            if not student:
                continue
            class_name = class_code(student.get("class_id"))
            layer = layer_by_class.get(class_name, {})
            rows.append((
                parent_id,
                "parent",
                layer.get("layer_code") or "C",
                class_name,
                "view",
                2,
            ))

    if not rows:
        return

    execute_values(
        cur,
        """
        INSERT INTO biz_user_layer_permissions
          (user_id, user_role, layer_code, class_name, permission_type, grant_by)
        VALUES %s
        ON CONFLICT (user_id, layer_code, class_name, permission_type) DO UPDATE SET
          user_role = excluded.user_role,
          grant_by = excluded.grant_by,
          updated_at = CURRENT_TIMESTAMP
        """,
        rows,
        page_size=500,
    )


def seed_exams_scores_and_layers(cur, data: dict) -> None:
    execute_values(
        cur,
        """
        INSERT INTO biz_exams
          (id, exam_name, term, exam_type, grade_level, exam_date, subjects, full_score, created_at)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
          exam_name = excluded.exam_name,
          term = excluded.term,
          exam_type = excluded.exam_type,
          grade_level = excluded.grade_level,
          exam_date = excluded.exam_date,
          subjects = excluded.subjects,
          full_score = excluded.full_score
        """,
        [
            (
                int(exam["id"]),
                exam["exam_name"],
                exam["term"],
                exam.get("exam_type") or "统测",
                exam.get("grade_level") or grade_from_class_id(str(exam["id"])[0]),
                exam.get("exam_date"),
                json.dumps(exam.get("subjects") or data["subjects"], ensure_ascii=False),
                exam.get("full_score") or 500,
                exam.get("created_at"),
            )
            for exam in data["exams"]
        ],
    )
    reset_sequence(cur, "biz_exams")

    layer_by_grade = {}
    for layer in data.get("classLayers") or []:
        layer_by_grade.setdefault(layer["grade_level"], []).append(layer)

    for exam in data["exams"]:
        exam_id = int(exam["id"])
        grade_level = exam.get("grade_level")
        layer_names = sorted({layer["layer_name"] for layer in layer_by_grade.get(grade_level, [])})
        for layer_name in layer_names:
            cur.execute(
                """
                INSERT INTO biz_class_layers (exam_id, layer_name, description)
                VALUES (%s, %s, %s)
                ON CONFLICT (exam_id, layer_name) DO UPDATE SET description = excluded.description
                RETURNING id
                """,
                (exam_id, layer_name, "由真实导入班级层次生成"),
            )
            layer_id = cur.fetchone()[0]
            detail_rows = [
                (layer_id, class_code(layer["class_name"]))
                for layer in layer_by_grade.get(grade_level, [])
                if layer["layer_name"] == layer_name
            ]
            if detail_rows:
                execute_values(
                    cur,
                    """
                    INSERT INTO biz_class_layer_details (layer_id, class_name)
                    VALUES %s
                    ON CONFLICT (layer_id, class_name) DO NOTHING
                    """,
                    detail_rows,
                )

    score_rows = []
    for score in data["examScores"]:
        values = score.get("scores") or {}
        score_rows.append((
            int(score["exam_id"]),
            int(score["student_id"]),
            score.get("student_code"),
            str(score.get("class_id") or ""),
            values.get("语文"),
            values.get("数学"),
            values.get("英语"),
            values.get("科学"),
            values.get("社会"),
            score.get("total_score"),
            1 if score.get("is_valid", True) else 0,
            None,
            score.get("created_at"),
            score.get("updated_at"),
        ))
    execute_values(
        cur,
        """
        INSERT INTO biz_scores
          (exam_id, student_id, exam_number, class_name,
           score_chinese, score_math, score_english, score_science, score_society,
           total_score, is_included, remarks, created_at, updated_at)
        VALUES %s
        ON CONFLICT (exam_id, student_id) DO UPDATE SET
          exam_number = excluded.exam_number,
          class_name = excluded.class_name,
          score_chinese = excluded.score_chinese,
          score_math = excluded.score_math,
          score_english = excluded.score_english,
          score_science = excluded.score_science,
          score_society = excluded.score_society,
          total_score = excluded.total_score,
          is_included = excluded.is_included,
          remarks = excluded.remarks,
          updated_at = CURRENT_TIMESTAMP
        """,
        score_rows,
        page_size=500,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--with-schema", action="store_true", help="Run database/neon_postgres_schema.sql before seeding")
    parser.add_argument("--dry-run", action="store_true", help="Load and summarize the demo dataset without touching a database")
    args = parser.parse_args()

    default_password = os.getenv("SEED_DEFAULT_PASSWORD", "NewCentury2025!")

    data = load_demo_data()
    if args.dry_run:
        parent = next((item for item in data["parents"] if item.get("phone")), None)
        print(
            "Seed dry run: "
            f"{len(data['classes'])} classes, {len(data['students'])} students, "
            f"{len(data['teachers'])} teachers, {len(data['parents'])} parents, "
            f"{len(data['classLayers'])} class layers, {len(data['exams'])} exams, "
            f"{len(data['examScores'])} score rows. "
            f"Sample login: dean / {default_password}; "
            f"parent {parent['phone']} / {default_password}."
        )
        return

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is required")

    conn = psycopg2.connect(normalize_database_url(database_url))
    try:
        if args.with_schema:
            execute_schema(conn)
        with conn.cursor() as cur:
            role_ids = fetch_role_ids(cur)
            seed_roles(cur, role_ids)
            seed_users(cur, data, role_ids, default_password)
            seed_classes_and_subjects(cur, data)
            seed_class_layer_settings(cur, data)
            seed_students(cur, data)
            seed_teaching_relations(cur, data)
            seed_parents(cur, data)
            seed_parent_student_layers(cur, data)
            seed_user_layer_permissions(cur, data)
            seed_exams_scores_and_layers(cur, data)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(
        "Seed complete: "
        f"{len(data['classes'])} classes, {len(data['students'])} students, "
        f"{len(data['teachers'])} teachers, {len(data['parents'])} parents, "
        f"{len(data['exams'])} exams, {len(data['examScores'])} score rows."
    )


if __name__ == "__main__":
    main()
