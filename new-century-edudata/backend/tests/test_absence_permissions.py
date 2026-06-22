from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routers.absence_management_api import (
    add_absence_scope_condition,
    ensure_can_access_absence_class,
)


def user(permission_code, user_id=1):
    return {"id": user_id, "permission_code": permission_code}


class FakeResult:
    def __init__(self, value):
        self.value = value

    def fetchone(self):
        return self.value


class FakeDB:
    def __init__(self, assignment_hit=True, term="2025-1"):
        self.assignment_hit = assignment_hit
        self.term = term
        self.calls = []

    def execute(self, sql, params=None):
        self.calls.append((str(sql), params or {}))
        if "FROM biz_exams" in str(sql):
            return FakeResult(SimpleNamespace(term=self.term) if self.term else None)
        return FakeResult(object() if self.assignment_hit else None)


def test_exam_manager_absence_scope_is_unrestricted():
    conditions = []
    params = {}

    add_absence_scope_condition(
        conditions,
        params,
        user("exam_admin", 7),
        FakeDB(),
        exam_id=1,
    )

    assert conditions == []
    assert params == {}


def test_headmaster_absence_scope_binds_class_and_exam_term():
    conditions = []
    params = {}

    add_absence_scope_condition(
        conditions,
        params,
        user("headmaster", 7),
        FakeDB(term="2025-1"),
        exam_id=1,
        class_field="class_name",
    )

    assert "class_name IN" in conditions[0]
    assert "term = :scope_term" in conditions[0]
    assert params["scope_teacher_id"] == 7
    assert params["scope_term"] == "2025-1"


def test_headmaster_can_access_owned_absence_class():
    db = FakeDB(assignment_hit=True, term="2025-1")

    ensure_can_access_absence_class(
        user("headmaster", 7),
        "701",
        db,
        exam_id=1,
    )

    assert db.calls[-1][1]["teacher_id"] == 7
    assert db.calls[-1][1]["class_name"] == "701"
    assert db.calls[-1][1]["term"] == "2025-1"


def test_parent_cannot_access_absence_class():
    with pytest.raises(HTTPException) as exc_info:
        ensure_can_access_absence_class(
            user("parent", 7),
            "701",
            FakeDB(assignment_hit=True),
            exam_id=1,
        )

    assert exc_info.value.status_code == 403
