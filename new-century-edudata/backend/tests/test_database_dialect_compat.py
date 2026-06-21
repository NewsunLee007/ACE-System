from types import SimpleNamespace

from routers.parent_management_api import (
    ensure_parent_management_tables,
    upsert_parent_profile,
    upsert_parent_student_binding,
)
from routers.score_analysis_api import _fetch_bundle_scores, _store_result_bundle
from services.score_visibility_service import save_score_visibility_settings


class FakeResult:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.lastrowid = 1

    def fetchall(self):
        return self.rows

    def fetchone(self):
        return self.rows[0] if self.rows else SimpleNamespace(id=1)


class FakeDB:
    def __init__(self, dialect="postgresql", rows=None):
        self.dialect = dialect
        self.rows = rows or []
        self.calls = []

    def get_bind(self):
        return SimpleNamespace(dialect=SimpleNamespace(name=self.dialect))

    def execute(self, sql, params=None):
        self.calls.append((str(sql), params or {}))
        return FakeResult(self.rows)

    def commit(self):
        self.calls.append(("COMMIT", {}))


def joined_sql(db):
    return "\n".join(sql for sql, _ in db.calls)


def test_score_visibility_uses_postgres_upsert():
    db = FakeDB("postgresql")

    save_score_visibility_settings(db, {"parent": {"show_grade_rank": False}}, updated_by=7)

    sql = joined_sql(db)
    assert "ON CONFLICT (role_code) DO UPDATE" in sql
    assert "ON DUPLICATE KEY" not in sql
    assert "ENGINE=InnoDB" not in sql


def test_parent_management_tables_and_upserts_are_postgres_compatible():
    db = FakeDB("postgresql")

    ensure_parent_management_tables(db)
    upsert_parent_profile(db, 10, "母亲")
    upsert_parent_student_binding(db, 10, 22, "母亲")

    sql = joined_sql(db)
    assert "BIGSERIAL PRIMARY KEY" in sql
    assert "ON CONFLICT (parent_user_id) DO UPDATE" in sql
    assert "ON CONFLICT (parent_user_id, student_id) DO UPDATE" in sql
    assert "AUTO_INCREMENT" not in sql
    assert "ON DUPLICATE KEY" not in sql


def test_bundle_fetch_builds_subject_scores_without_database_json_function():
    row = SimpleNamespace(
        id=1,
        exam_id=2,
        student_id=3,
        student_name="甲",
        exam_number="001",
        class_name="701",
        score_chinese=90,
        score_math=91,
        score_english=92,
        score_science=93,
        score_society=94,
        total_score=460,
        is_included=1,
        layer_code="A",
    )
    db = FakeDB("postgresql", rows=[row])

    results = _fetch_bundle_scores(db, 2)

    sql = joined_sql(db)
    assert "JSON_OBJECT" not in sql
    assert results[0].scores
    assert '"math": 91' in results[0].scores


def test_bundle_store_uses_postgres_conflict_update():
    db = FakeDB("postgresql")
    exam = SimpleNamespace(id=5, exam_name="7年级期末", grade_level="7年级")

    bundle_id = _store_result_bundle(
        db,
        exam,
        {"generated_at": "2026-06-21T00:00:00", "modules": {}},
        {"id": 1, "username": "dean", "real_name": "李主任"},
    )

    sql = joined_sql(db)
    assert bundle_id.startswith("BUNDLE_5_")
    assert "ON CONFLICT (exam_id, grade_level) DO UPDATE" in sql
    assert "LONGTEXT" not in sql
    assert "ON DUPLICATE KEY" not in sql
