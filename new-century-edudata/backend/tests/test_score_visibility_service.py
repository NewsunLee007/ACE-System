from services.score_visibility_service import (
    filter_rank_fields_by_visibility,
    normalize_visibility_settings,
)


def test_visibility_defaults_keep_parent_grade_rank_closed():
    settings = normalize_visibility_settings({})

    assert settings["parent"]["show_class_rank"] is True
    assert settings["parent"]["show_grade_rank"] is False
    assert settings["edu_admin"]["show_grade_rank"] is True


def test_filter_rank_fields_removes_disallowed_values_recursively():
    visibility = normalize_visibility_settings({
        "parent": {
            "show_class_rank": True,
            "show_grade_rank": False,
            "show_layer_rank": False,
            "show_percentile": False,
        }
    })["parent"]

    filtered = filter_rank_fields_by_visibility({
        "student_name": "甲",
        "class_rank": 3,
        "grade_rank": 20,
        "children": [
            {"subject": "语文", "rank_in_class": 2, "grade_percentile": 88.5}
        ],
    }, visibility)

    assert filtered == {
        "student_name": "甲",
        "class_rank": 3,
        "children": [{"subject": "语文", "rank_in_class": 2}],
    }
