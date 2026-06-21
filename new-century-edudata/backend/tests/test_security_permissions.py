from core.security import (
    check_permission,
    has_own_resource_or_permission_code,
    has_permission_code,
    is_parent_student_token_valid,
)


def user(permission_code, user_id=1):
    return {"id": user_id, "permission_code": permission_code}


def test_explicit_permission_codes_allow_superusers():
    assert has_permission_code(user("sys_admin"), ["exam_admin"]) is True
    assert has_permission_code(user("edu_admin"), ["exam_admin"]) is True


def test_explicit_permission_codes_allow_listed_roles_only():
    allowed = ["exam_admin", "grade_leader", "subject_leader"]

    assert has_permission_code(user("exam_admin"), allowed) is True
    assert has_permission_code(user("grade_leader"), allowed) is True
    assert has_permission_code(user("teacher"), allowed) is False
    assert has_permission_code(user("parent"), allowed) is False


def test_unknown_permission_names_are_not_treated_as_public_access():
    assert has_permission_code(user("teacher"), ["analysis_view"]) is False
    assert has_permission_code(user("parent"), ["analysis_execute"]) is False


def test_superuser_bypass_can_be_disabled_for_exact_checks():
    assert has_permission_code(
        user("edu_admin"),
        ["exam_admin"],
        include_superusers=False,
    ) is False


def test_check_permission_denies_unknown_required_permission_for_non_admins():
    assert check_permission(user("teacher"), "not_a_real_permission") is False
    assert check_permission(user("parent"), "not_a_real_permission") is False
    assert check_permission(user("sys_admin"), "not_a_real_permission") is True
    assert check_permission(user("edu_admin"), "not_a_real_permission") is True


def test_analysis_semantic_permissions_have_real_minimum_levels():
    assert check_permission(user("parent"), "analysis_view") is False
    assert check_permission(user("teacher"), "analysis_view") is False
    assert check_permission(user("subject_leader"), "analysis_view") is True

    assert check_permission(user("grade_leader"), "analysis_publish") is True
    assert check_permission(user("subject_leader"), "analysis_publish") is False

    assert check_permission(user("exam_admin"), "analysis_execute") is True
    assert check_permission(user("grade_leader"), "analysis_execute") is False

    assert check_permission(user("edu_admin"), "analysis_admin") is True
    assert check_permission(user("exam_admin"), "analysis_admin") is False

    assert check_permission(user("exam_admin"), "layer_manage") is True
    assert check_permission(user("grade_leader"), "layer_manage") is False


def test_student_management_requires_exam_admin_or_superuser():
    allowed = ["exam_admin"]

    assert has_permission_code(user("sys_admin"), allowed) is True
    assert has_permission_code(user("edu_admin"), allowed) is True
    assert has_permission_code(user("exam_admin"), allowed) is True
    assert has_permission_code(user("grade_leader"), allowed) is False
    assert has_permission_code(user("teacher"), allowed) is False
    assert has_permission_code(user("parent"), allowed) is False


def test_teacher_directory_requires_edu_admin_or_superuser():
    allowed = ["edu_admin"]

    assert has_permission_code(user("sys_admin"), allowed) is True
    assert has_permission_code(user("edu_admin"), allowed) is True
    assert has_permission_code(user("exam_admin"), allowed) is False
    assert has_permission_code(user("grade_leader"), allowed) is False
    assert has_permission_code(user("teacher"), allowed) is False


def test_teacher_record_access_allows_self_or_directory_admins_only():
    allowed = ["edu_admin"]

    assert has_own_resource_or_permission_code(user("edu_admin", 1), 99, allowed) is True
    assert has_own_resource_or_permission_code(user("teacher", 7), 7, allowed) is True
    assert has_own_resource_or_permission_code(user("teacher", 7), 8, allowed) is False
    assert has_own_resource_or_permission_code(user("parent", 7), 8, allowed) is False


def test_parent_student_token_is_scoped_to_exact_student():
    payload = {"token_type": "parent_student_access", "student_id": 101}

    assert is_parent_student_token_valid(payload, 101) is True
    assert is_parent_student_token_valid(payload, "101") is True
    assert is_parent_student_token_valid(payload, 102) is False
    assert is_parent_student_token_valid({"token_type": "access", "student_id": 101}, 101) is False
    assert is_parent_student_token_valid(None, 101) is False


def test_report_view_requires_management_scope():
    allowed = ["exam_admin", "grade_leader", "subject_leader"]

    assert has_permission_code(user("sys_admin"), allowed) is True
    assert has_permission_code(user("edu_admin"), allowed) is True
    assert has_permission_code(user("exam_admin"), allowed) is True
    assert has_permission_code(user("grade_leader"), allowed) is True
    assert has_permission_code(user("subject_leader"), allowed) is True
    assert has_permission_code(user("lesson_leader"), allowed) is False
    assert has_permission_code(user("headmaster"), allowed) is False
    assert has_permission_code(user("teacher"), allowed) is False
    assert has_permission_code(user("parent"), allowed) is False


def test_report_manage_requires_edu_admin_or_superuser():
    allowed = ["edu_admin"]

    assert has_permission_code(user("sys_admin"), allowed) is True
    assert has_permission_code(user("edu_admin"), allowed) is True
    assert has_permission_code(user("exam_admin"), allowed) is False
    assert has_permission_code(user("grade_leader"), allowed) is False
    assert has_permission_code(user("teacher"), allowed) is False
