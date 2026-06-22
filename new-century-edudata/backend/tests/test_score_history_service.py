from services.score_history_service import (
    ScoreHistoryService,
    term_in_academic_year,
)
from services.score_visibility_service import filter_rank_fields_by_visibility


def test_academic_year_matches_school_term_start_year():
    assert term_in_academic_year("2025-1", "2025-2026") is True
    assert term_in_academic_year("2025-2", "2025-2026") is True
    assert term_in_academic_year("2024-2", "2025-2026") is False


def test_history_rank_metrics_include_grade_class_layer_and_changes():
    service = ScoreHistoryService(db=None)
    records = service.add_rank_metrics([
        {
            "exam_id": 1,
            "exam_name": "2025-1 7年级期中",
            "term": "2025-1",
            "academic_year": "2025-2026",
            "exam_date": "2025-11-01",
            "grade_level": "7年级",
            "subjects_config": ["语文", "数学"],
            "full_score": 200,
            "student_id": 1,
            "student_name": "甲",
            "student_code": "S001",
            "class_name": "701",
            "class_id": 701,
            "layer_code": "A",
            "scores": {"语文": 80, "数学": 90},
            "total_score": 170,
        },
        {
            "exam_id": 1,
            "exam_name": "2025-1 7年级期中",
            "term": "2025-1",
            "academic_year": "2025-2026",
            "exam_date": "2025-11-01",
            "grade_level": "7年级",
            "subjects_config": ["语文", "数学"],
            "full_score": 200,
            "student_id": 2,
            "student_name": "乙",
            "student_code": "S002",
            "class_name": "702",
            "class_id": 702,
            "layer_code": "A",
            "scores": {"语文": 70, "数学": 80},
            "total_score": 150,
        },
        {
            "exam_id": 2,
            "exam_name": "2025-1 7年级期末",
            "term": "2025-1",
            "academic_year": "2025-2026",
            "exam_date": "2026-01-01",
            "grade_level": "7年级",
            "subjects_config": ["语文", "数学"],
            "full_score": 200,
            "student_id": 1,
            "student_name": "甲",
            "student_code": "S001",
            "class_name": "701",
            "class_id": 701,
            "layer_code": "A",
            "scores": {"语文": 85, "数学": 95},
            "total_score": 180,
        },
        {
            "exam_id": 2,
            "exam_name": "2025-1 7年级期末",
            "term": "2025-1",
            "academic_year": "2025-2026",
            "exam_date": "2026-01-01",
            "grade_level": "7年级",
            "subjects_config": ["语文", "数学"],
            "full_score": 200,
            "student_id": 2,
            "student_name": "乙",
            "student_code": "S002",
            "class_name": "702",
            "class_id": 702,
            "layer_code": "A",
            "scores": {"语文": 80, "数学": 82},
            "total_score": 162,
        },
    ])

    latest = [row for row in records if row["exam_id"] == 2 and row["student_id"] == 1][0]

    assert latest["total"]["grade_rank"] == 1
    assert latest["total"]["class_rank"] == 1
    assert latest["total"]["layer_rank"] == 1
    assert latest["total"]["grade_percentile"] == 100.0
    assert latest["total"]["gap_to_layer_mean"] == 9.0
    assert latest["subjects"]["数学"]["score_delta"] == 5.0
    assert latest["changes"]["score_delta"] == 10.0
    assert latest["changes"]["rank_change"] == 0


def test_history_visibility_filters_rank_change_and_percentiles():
    payload = {
        "total": {
            "grade_rank": 12,
            "class_rank": 3,
            "layer_rank": 5,
            "grade_percentile": 88.5,
        },
        "changes": {
            "rank_change": 4,
            "percentile_change": 3.5,
        },
    }

    filtered = filter_rank_fields_by_visibility(payload, {
        "show_grade_rank": False,
        "show_class_rank": True,
        "show_layer_rank": False,
        "show_percentile": False,
    })

    assert filtered["total"] == {"class_rank": 3}
    assert filtered["changes"] == {}
