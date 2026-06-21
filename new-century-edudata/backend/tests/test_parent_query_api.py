from routers.parent_query_api import ParentQueryService, get_student_all_exams


class FakeResult:
    def __init__(self, one=None, rows=None):
        self.one = one
        self.rows = rows or []

    def fetchone(self):
        return self.one

    def fetchall(self):
        return self.rows


class CapturingDB:
    def __init__(self):
        self.calls = []

    def execute(self, sql, params=None):
        self.calls.append((str(sql), params or {}))
        return FakeResult()


def assert_ranked_before_student_filter(sql):
    assert "WITH ranked_scores AS" in sql
    assert "FROM biz_scores s" in sql
    assert "WHERE s.is_included = 1" in sql
    assert "FROM ranked_scores s" in sql
    assert sql.index("WITH ranked_scores AS") < sql.rindex("WHERE s.student_id")


def test_latest_exam_calculates_rank_before_filtering_to_student():
    db = CapturingDB()

    assert ParentQueryService(db).get_student_latest_exam(7) is None

    assert_ranked_before_student_filter(db.calls[0][0])
    assert db.calls[0][1]["student_id"] == 7


def test_historical_trends_calculate_rank_before_filtering_to_student():
    db = CapturingDB()

    assert ParentQueryService(db).get_historical_trends(7) == []

    assert_ranked_before_student_filter(db.calls[0][0])
    assert db.calls[0][1] == {"student_id": 7, "limit": 5}


def test_parent_exam_list_calculates_rank_before_filtering_to_student():
    db = CapturingDB()

    result = get_student_all_exams(7, limit=10, parent_payload={}, db=db)

    assert result == {"student_id": 7, "total_exams": 0, "exams": []}
    assert_ranked_before_student_filter(db.calls[0][0])
    assert db.calls[0][1] == {"student_id": 7, "limit": 10}
