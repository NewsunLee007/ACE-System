import pytest
from fastapi import HTTPException

from routers.class_longitudinal_api import ensure_can_view_class_longitudinal


def user(permission_code, user_id=1):
    return {"id": user_id, "permission_code": permission_code}


class FakeResult:
    def __init__(self, hit):
        self.hit = hit

    def fetchone(self):
        return object() if self.hit else None


class FakeDB:
    def __init__(self, hit):
        self.hit = hit
        self.calls = 0
        self.params = None
        self.sql = None

    def execute(self, sql, params):
        self.calls += 1
        self.sql = str(sql)
        self.params = params
        return FakeResult(self.hit)


def test_management_scope_can_view_without_assignment_lookup():
    db = FakeDB(hit=False)

    ensure_can_view_class_longitudinal(
        user("exam_admin", 7),
        "701",
        db,
        terms=["2025-1"],
    )

    assert db.calls == 0


def test_headmaster_scope_uses_teacher_class_relation():
    db = FakeDB(hit=True)

    ensure_can_view_class_longitudinal(
        user("headmaster", 7),
        "701",
        db,
        terms=["2025-1"],
    )

    assert db.params["teacher_id"] == 7
    assert db.params["class_name"] == "701"
    assert db.params["term_0"] == "2025-1"
    assert "is_headmaster = 1" in db.sql
    assert "end_date" not in db.sql


def test_assignment_without_term_uses_active_relation_window():
    db = FakeDB(hit=True)

    ensure_can_view_class_longitudinal(
        user("headmaster", 7),
        "701",
        db,
    )

    assert "end_date IS NULL" in db.sql


def test_subject_teacher_can_view_matching_weak_subject_scope():
    db = FakeDB(hit=True)

    ensure_can_view_class_longitudinal(
        user("teacher", 9),
        "702",
        db,
        terms=["2025-1"],
        subject="english",
        allow_subject_teacher=True,
    )

    assert db.params["teacher_id"] == 9
    assert db.params["class_name"] == "702"
    assert db.params["subject_code"] == "english"
    assert db.params["subject_label"] == "英语"


def test_subject_teacher_cannot_view_full_class_detail_without_headmaster_scope():
    db = FakeDB(hit=False)

    with pytest.raises(HTTPException) as exc_info:
        ensure_can_view_class_longitudinal(
            user("teacher", 9),
            "702",
            db,
            terms=["2025-1"],
            allow_subject_teacher=False,
        )

    assert exc_info.value.status_code == 403


def test_parent_scope_is_denied_without_assignment_lookup():
    db = FakeDB(hit=True)

    with pytest.raises(HTTPException) as exc_info:
        ensure_can_view_class_longitudinal(
            user("parent", 9),
            "702",
            db,
            terms=["2025-1"],
        )

    assert exc_info.value.status_code == 403
    assert db.calls == 0
