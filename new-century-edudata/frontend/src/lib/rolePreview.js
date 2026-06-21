export const ROLE_PREVIEW_STORAGE_KEY = 'ace.dashboardRolePreview';
export const ROLE_PREVIEW_CHANGED_EVENT = 'ace:dashboard-role-preview-changed';

export const DASHBOARD_PREVIEW_OPTIONS = [
  { id: 'actual', label: '实际账号', path: null },
  {
    id: 'principal',
    label: '校长',
    path: '/principal-dashboard',
    role_name: '校长',
    role: 'principal',
    permission_code: 'principal',
  },
  {
    id: 'vice_principal',
    label: '副校长',
    path: '/vice-principal-dashboard',
    role_name: '副校长',
    role: 'vice_principal',
    permission_code: 'vice_principal',
  },
  {
    id: 'edu_admin',
    label: '教务处',
    path: '/dashboard',
    role_name: '教务处主任',
    role: 'dean',
    permission_code: 'edu_admin',
  },
  {
    id: 'grade_leader',
    label: '段长',
    path: '/grade-leader-dashboard',
    role_name: '年段长',
    role: 'grade_leader',
    permission_code: 'grade_leader',
  },
  {
    id: 'headmaster',
    label: '班主任',
    path: '/headteacher',
    role_name: '班主任',
    role: 'head_teacher',
    permission_code: 'headmaster',
  },
  {
    id: 'subject_leader',
    label: '教研',
    path: '/research-dashboard',
    role_name: '教研组长',
    role: 'research_leader',
    permission_code: 'subject_leader',
  },
  {
    id: 'teacher',
    label: '教师',
    path: '/teacher-dashboard',
    role_name: '科任教师',
    role: 'subject_teacher',
    permission_code: 'teacher',
  },
  {
    id: 'parent',
    label: '家长',
    path: '/parent-dashboard',
    role_name: '家长',
    role: 'parent',
    permission_code: 'parent',
  },
];

const PREVIEW_CONTROLLER_CODES = ['edu_admin', 'sys_admin'];
const PREVIEW_CONTROLLER_ROLES = ['dean', 'super_admin', 'admin', '系统管理员', '管理员', '教务处主任'];

const normalizeText = (value) => String(value || '').trim();

const uniqueValues = (values = []) => (
  [...new Set(values.map(value => Number(value)).filter(Number.isFinite))]
);

const getBrowserStorage = () => (
  typeof window === 'undefined' ? null : window.localStorage
);

export const readStoredUser = () => {
  const storage = getBrowserStorage();
  if (!storage) return {};

  try {
    return JSON.parse(storage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

export const isDashboardPreviewController = (user = {}) => {
  const safeUser = user || {};
  const permissionCode = normalizeText(safeUser.permission_code);
  const roleValues = [safeUser.role, safeUser.role_name, safeUser.legacy_role].map(normalizeText);

  return (
    PREVIEW_CONTROLLER_CODES.includes(permissionCode) ||
    roleValues.some(role => PREVIEW_CONTROLLER_ROLES.includes(role)) ||
    (Array.isArray(safeUser.permissions) && safeUser.permissions.includes('all_permissions'))
  );
};

export const getStoredDashboardPreviewRole = () => {
  const storage = getBrowserStorage();
  if (!storage) return 'actual';

  const storedRole = storage.getItem(ROLE_PREVIEW_STORAGE_KEY);
  return DASHBOARD_PREVIEW_OPTIONS.some(option => option.id === storedRole) ? storedRole : 'actual';
};

export const setStoredDashboardPreviewRole = (roleId) => {
  const storage = getBrowserStorage();
  if (!storage) return;

  if (!roleId || roleId === 'actual') {
    storage.removeItem(ROLE_PREVIEW_STORAGE_KEY);
  } else {
    storage.setItem(ROLE_PREVIEW_STORAGE_KEY, roleId);
  }

  window.dispatchEvent(new CustomEvent(ROLE_PREVIEW_CHANGED_EVENT, { detail: { roleId: roleId || 'actual' } }));
};

export const clearStoredDashboardPreviewRole = () => {
  setStoredDashboardPreviewRole('actual');
};

export const getDashboardPreviewOption = (roleId) => (
  DASHBOARD_PREVIEW_OPTIONS.find(option => option.id === roleId) || DASHBOARD_PREVIEW_OPTIONS[0]
);

const getActiveClasses = (classes = []) => (
  (classes || [])
    .filter(cls => cls.status !== 'inactive')
    .map(cls => ({ ...cls, id: Number(cls.id) }))
    .filter(cls => Number.isFinite(cls.id))
    .sort((a, b) => a.id - b.id)
);

const getTeacherClassIds = (teacher) => (
  uniqueValues((teacher?.teaching_classes || []).map(item => item.class_id))
);

const getTeacherSubjects = (teacher) => (
  [...new Set([
    ...(Array.isArray(teacher?.subjects) ? teacher.subjects : []),
    ...(teacher?.teaching_classes || []).map(item => item.subject),
  ].map(normalizeText).filter(Boolean))]
);

const normalizeGradeLevel = (value) => {
  const text = normalizeText(value);
  const numericMatch = text.match(/([789])\s*年?级?/);
  if (numericMatch) return `${numericMatch[1]}年级`;
  const chineseMap = { 七: 7, 八: 8, 九: 9 };
  const chineseMatch = text.match(/([七八九])\s*年级?/);
  return chineseMatch ? `${chineseMap[chineseMatch[1]]}年级` : '';
};

const getClassGradeLevel = (classItem) => (
  normalizeGradeLevel(classItem?.grade_level || classItem?.grade_name || classItem?.current_grade) ||
  normalizeGradeLevel(Math.floor(Number(classItem?.id) / 100))
);

const getHeadTeacherClassIds = (teacher, classes = []) => {
  if (!teacher) return [];

  const fromClassMaster = (classes || [])
    .filter(cls => Number(cls.head_teacher_id) === Number(teacher.id))
    .map(cls => cls.id);
  const fromRoleDetails = (teacher.role_details || [])
    .filter(role => role.role_type === 'head_teacher')
    .map(role => role.class_id);
  const fromTeachingClasses = (teacher.teaching_classes || [])
    .filter(item => item.is_head_teacher || item.role === 'head_teacher' || item.role_type === 'head_teacher')
    .map(item => item.class_id);

  return uniqueValues([...fromClassMaster, ...fromRoleDetails, ...fromTeachingClasses]);
};

const findTeacherForRole = (roleId, teachers = [], classes = []) => {
  const activeTeachers = (teachers || []).filter(teacher => teacher.status !== 'inactive');
  if (!activeTeachers.length) return null;

  if (roleId === 'headmaster') {
    return activeTeachers.find(teacher => getHeadTeacherClassIds(teacher, classes).length > 0) ||
      activeTeachers.find(teacher => getTeacherClassIds(teacher).length > 0) ||
      activeTeachers[0];
  }

  if (roleId === 'subject_leader') {
    return activeTeachers.find(teacher => getTeacherSubjects(teacher).length > 0 && getTeacherClassIds(teacher).length > 1) ||
      activeTeachers.find(teacher => getTeacherSubjects(teacher).length > 0) ||
      activeTeachers[0];
  }

  if (roleId === 'teacher') {
    return activeTeachers.find(teacher => getTeacherSubjects(teacher).length > 0 && getTeacherClassIds(teacher).length > 0) ||
      activeTeachers[0];
  }

  if (roleId === 'grade_leader') {
    return activeTeachers.find(teacher => (
      (teacher.role_details || []).some(role => role.role_type === 'grade_leader' || role.duty_type === 'grade_leader')
    )) || activeTeachers.find(teacher => getTeacherClassIds(teacher).length > 0) || activeTeachers[0];
  }

  return activeTeachers[0];
};

const getPreviewGradeLevels = ({ roleId, teacher, classes = [] }) => {
  if (roleId !== 'grade_leader') return [];

  const fromTeacher = [
    teacher?.grade_level,
    teacher?.grade_name,
    teacher?.grade,
    ...(teacher?.role_details || []).flatMap(role => [role.grade_level, role.grade_name, role.grade]),
    ...(teacher?.teaching_classes || []).flatMap(item => [item.grade_level, item.grade_name, item.grade]),
  ].map(normalizeGradeLevel).filter(Boolean);

  if (fromTeacher.length) return [...new Set(fromTeacher)];

  const firstGrade = getClassGradeLevel(getActiveClasses(classes)[0]);
  return firstGrade ? [firstGrade] : ['7年级'];
};

const getPreviewClassIds = ({ roleId, teacher, classes = [] }) => {
  const activeClasses = getActiveClasses(classes);
  const previewGradeLevels = getPreviewGradeLevels({ roleId, teacher, classes });
  if (roleId === 'grade_leader') {
    const gradeSet = new Set(previewGradeLevels);
    return activeClasses
      .filter(cls => gradeSet.has(getClassGradeLevel(cls)))
      .map(cls => cls.id);
  }

  const activeClassIds = new Set(activeClasses.map(cls => cls.id));
  const fallbackClassIds = activeClasses.slice(0, roleId === 'headmaster' ? 1 : 2).map(cls => cls.id);

  if (!teacher) return fallbackClassIds;

  const teacherClassIds = roleId === 'headmaster'
    ? getHeadTeacherClassIds(teacher, classes)
    : getTeacherClassIds(teacher);
  const scopedIds = teacherClassIds.filter(classId => activeClassIds.has(Number(classId)));

  if (roleId === 'headmaster') return (scopedIds.length ? scopedIds : fallbackClassIds).slice(0, 1);
  return (scopedIds.length ? scopedIds : fallbackClassIds).slice(0, 3);
};

const getPreviewStudent = (students = [], classIds = []) => {
  const allowedClassIds = new Set(classIds.map(Number));
  return (students || []).find(student => allowedClassIds.has(Number(student.class_id))) ||
    (students || [])[0] ||
    null;
};

export const buildDashboardPreviewUser = (roleId, data = {}) => {
  const option = getDashboardPreviewOption(roleId);
  const teacher = findTeacherForRole(roleId, data.teachers || [], data.classes || []);
  const gradeLevels = getPreviewGradeLevels({ roleId, teacher, classes: data.classes || [] });
  const classIds = getPreviewClassIds({ roleId, teacher, classes: data.classes || [] });
  const subjects = getTeacherSubjects(teacher);
  const student = roleId === 'parent' ? getPreviewStudent(data.students || [], classIds) : null;

  return {
    id: teacher?.id || student?.id || `preview_${roleId}`,
    username: teacher?.code || student?.student_code || `preview_${roleId}`,
    code: teacher?.code || student?.student_code || '',
    real_name: teacher?.name || student?.name || `${option.label}预览`,
    name: teacher?.name || student?.name || `${option.label}预览`,
    role: option.role,
    role_name: option.role_name,
    permission_code: option.permission_code,
    permissions: [],
    is_role_preview: true,
    preview_role: roleId,
    preview_label: `${option.label}视图`,
    preview_class_ids: classIds,
    preview_grade_levels: gradeLevels,
    preview_subjects: subjects.length ? subjects : ['语文'],
    preview_teacher: teacher ? {
      id: teacher.id,
      code: teacher.code,
      name: teacher.name,
    } : null,
    preview_student: student ? {
      id: student.id,
      student_code: student.student_code,
      name: student.name,
      class_id: student.class_id,
    } : null,
  };
};

export const getEffectiveDashboardUser = (actualUser = readStoredUser(), data = {}) => {
  if (!isDashboardPreviewController(actualUser)) return actualUser || {};

  const previewRole = getStoredDashboardPreviewRole();
  if (previewRole === 'actual') return actualUser || {};

  return buildDashboardPreviewUser(previewRole, data);
};
