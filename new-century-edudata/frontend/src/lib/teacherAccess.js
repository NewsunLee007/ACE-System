const normalizeText = (value) => String(value || '').trim();
const FULL_RESEARCH_ROLES = ['教务处主任', '管理员', '系统管理员', '校长', '副校长', 'super_admin', 'dean', 'principal', 'vice_principal', 'school_leader', 'edu_admin', 'sys_admin'];
const FULL_HEAD_TEACHER_ROLES = ['教务处主任', '管理员', '系统管理员', 'super_admin', 'dean', 'edu_admin', 'sys_admin'];
const GRADE_LEADER_ROLES = ['年段长', '段长', '副段长', 'grade_leader', 'grade_deputy'];

const hasSameValue = (leftValues, rightValues) => {
  const left = leftValues.map(normalizeText).filter(Boolean);
  const right = rightValues.map(normalizeText).filter(Boolean);
  return left.some((item) => right.includes(item));
};

export const teacherMatchesUser = (teacher, user = {}) => {
  if (!teacher || !user) return false;

  return hasSameValue(
    [teacher.code, teacher.username, teacher.name, teacher.real_name, teacher.phone],
    [user.username, user.code, user.real_name, user.name, user.phone]
  );
};

export const findTeacherForUser = (teachers = [], user = {}) => (
  teachers.find((teacher) => teacherMatchesUser(teacher, user)) || null
);

export const getTeacherSubjects = (teacher) => {
  const subjects = Array.isArray(teacher?.subjects) ? teacher.subjects : [];
  const classSubjects = (teacher?.teaching_classes || [])
    .map((item) => item.subject)
    .filter(Boolean);

  return [...new Set([...subjects, ...classSubjects])];
};

export const getTeacherClassIds = (teacher) => (
  [...new Set((teacher?.teaching_classes || [])
    .map((item) => Number(item.class_id))
    .filter(Number.isFinite))]
);

export const isFullResearchAccessRole = (role) => FULL_RESEARCH_ROLES.includes(normalizeText(role));
export const isFullHeadTeacherAccessRole = (role) => FULL_HEAD_TEACHER_ROLES.includes(normalizeText(role));
export const isGradeLeaderRole = (role) => GRADE_LEADER_ROLES.includes(normalizeText(role));

const getUserRoleValues = (user = {}) => (
  [user.role_name, user.role, user.permission_code, user.legacy_role].map(normalizeText).filter(Boolean)
);

const CHINESE_GRADE_NUMBER = {
  七: 7,
  八: 8,
  九: 9,
};

export const normalizeGradeLevel = (value) => {
  const text = normalizeText(value);
  if (!text) return '';
  const numericMatch = text.match(/([789])\s*年?级?/);
  if (numericMatch) return `${numericMatch[1]}年级`;
  const chineseMatch = text.match(/([七八九])\s*年级?/);
  if (chineseMatch) return `${CHINESE_GRADE_NUMBER[chineseMatch[1]]}年级`;
  return '';
};

const getClassGradeLevel = (classItem) => (
  normalizeGradeLevel(classItem?.grade_level || classItem?.grade_name || classItem?.current_grade) ||
  normalizeGradeLevel(Math.floor(Number(classItem?.id) / 100))
);

export const getGradeLevelsFromClassIds = (classIds = []) => (
  [...new Set(classIds
    .map((classId) => Math.floor(Number(classId) / 100))
    .filter(Number.isFinite)
    .map((grade) => `${grade}年级`))]
);

const getGradeLevelsFromValues = (values = []) => (
  [...new Set(values.flatMap((value) => {
    if (Array.isArray(value)) return value.map(normalizeGradeLevel).filter(Boolean);
    return [normalizeGradeLevel(value)].filter(Boolean);
  }))]
);

const getGradeLevelsFromTeacher = (teacher) => {
  if (!teacher) return [];

  return getGradeLevelsFromValues([
    teacher.grade_level,
    teacher.grade_name,
    teacher.grade,
    ...(teacher.role_details || []).flatMap(role => [role.grade_level, role.grade_name, role.grade]),
    ...(teacher.teaching_classes || []).flatMap(item => [item.grade_level, item.grade_name, item.grade]),
    getGradeLevelsFromClassIds(getTeacherClassIds(teacher)),
  ]);
};

const getGradeLevelsFromUser = (user = {}) => getGradeLevelsFromValues([
  user.grade_level,
  user.grade_name,
  user.grade,
  user.current_grade,
  user.managed_grade,
  user.managed_grade_level,
  user.managed_grades,
  user.managed_grade_levels,
  user.grade_levels,
  user.grades,
  user.preview_grade_levels,
]);

export const getClassIdsForGradeLevels = (classes = [], gradeLevels = []) => {
  const gradeSet = new Set(gradeLevels.map(normalizeGradeLevel).filter(Boolean));
  if (gradeSet.size === 0) return [];

  return [...new Set((classes || [])
    .filter(cls => cls.status !== 'inactive')
    .filter(cls => gradeSet.has(getClassGradeLevel(cls)))
    .map(cls => Number(cls.id))
    .filter(Number.isFinite))];
};

export const getManagedGradeLevelsForUser = ({ teachers = [], user = {} } = {}) => {
  const teacher = findTeacherForUser(teachers, user);
  return [...new Set([
    ...getGradeLevelsFromUser(user),
    ...getGradeLevelsFromTeacher(teacher),
  ])];
};

export const getHeadTeacherClassIds = ({ classes = [], teacher = null }) => {
  if (!teacher) return [];

  const idsFromClasses = (classes || [])
    .filter((cls) => hasSameValue([cls.head_teacher_id], [teacher.id]))
    .map((cls) => Number(cls.id));
  const idsFromRoleDetails = (teacher.role_details || [])
    .filter((role) => role.role_type === 'head_teacher')
    .map((role) => Number(role.class_id));
  const idsFromExplicitFields = [
    ...(Array.isArray(teacher.head_teacher_class_ids) ? teacher.head_teacher_class_ids : []),
    teacher.head_teacher_class_id,
  ].map(Number);
  const idsFromTeachingClasses = (teacher.teaching_classes || [])
    .filter((item) => item.is_head_teacher || item.role === 'head_teacher' || item.role_type === 'head_teacher')
    .map((item) => Number(item.class_id));

  return [...new Set([
    ...idsFromClasses,
    ...idsFromRoleDetails,
    ...idsFromExplicitFields,
    ...idsFromTeachingClasses,
  ].filter(Number.isFinite))];
};

export const getTeacherAccessState = ({ teachers = [], user = {} }) => {
  if (user?.is_role_preview && Array.isArray(user.preview_class_ids) && user.preview_class_ids.length > 0) {
    const classIds = [...new Set(user.preview_class_ids.map(Number).filter(Number.isFinite))];
    const subjects = Array.isArray(user.preview_subjects)
      ? [...new Set(user.preview_subjects.map(normalizeText).filter(Boolean))]
      : [];

    return {
      status: subjects.length ? 'ready' : 'no-subjects',
      teacher: user.preview_teacher || null,
      subjects,
      classIds,
    };
  }

  const teacher = findTeacherForUser(teachers, user);

  if (!teacher) {
    return {
      status: 'no-teacher',
      teacher: null,
      subjects: [],
      classIds: [],
    };
  }

  const subjects = getTeacherSubjects(teacher);
  const classIds = getTeacherClassIds(teacher);

  if (classIds.length === 0) {
    return {
      status: 'no-classes',
      teacher,
      subjects,
      classIds,
    };
  }

  if (subjects.length === 0) {
    return {
      status: 'no-subjects',
      teacher,
      subjects,
      classIds,
    };
  }

  return {
    status: 'ready',
    teacher,
    subjects,
    classIds,
  };
};

export const getResearchAccessState = ({ teachers = [], classes = [], user = {} }) => {
  const roleValues = getUserRoleValues(user);

  if (roleValues.some(isFullResearchAccessRole)) {
    return {
      status: 'ready',
      fullAccess: true,
      teacher: null,
      subjects: [],
      classIds: [],
      gradeLevels: [],
    };
  }

  if (roleValues.some(isGradeLeaderRole)) {
    const teacher = findTeacherForUser(teachers, user);
    const gradeLevels = getManagedGradeLevelsForUser({ teachers, user });
    const classIdsFromGrades = getClassIdsForGradeLevels(classes, gradeLevels);
    const teacherClassIds = teacher ? getTeacherClassIds(teacher) : [];
    const classIds = classIdsFromGrades.length
      ? classIdsFromGrades
      : teacherClassIds;

    if (classIds.length === 0) {
      return {
        status: gradeLevels.length ? 'no-classes' : 'no-teacher',
        fullAccess: false,
        allSubjects: true,
        teacher,
        subjects: [],
        classIds: [],
        gradeLevels,
      };
    }

    return {
      status: 'ready',
      fullAccess: false,
      allSubjects: true,
      teacher,
      subjects: teacher ? getTeacherSubjects(teacher) : [],
      classIds,
      gradeLevels: gradeLevels.length ? gradeLevels : getGradeLevelsFromClassIds(classIds),
    };
  }

  const teacherAccess = getTeacherAccessState({ teachers, user });
  const gradeLevels = getGradeLevelsFromClassIds(teacherAccess.classIds);

  return {
    ...teacherAccess,
    fullAccess: false,
    gradeLevels,
  };
};

export const getHeadTeacherAccessState = ({ teachers = [], classes = [], user = {} }) => {
  const role = user.role_name || user.role || '';
  const activeClassIds = (classes || [])
    .filter((cls) => cls.status !== 'inactive')
    .map((cls) => Number(cls.id))
    .filter(Number.isFinite);

  if (user?.is_role_preview && Array.isArray(user.preview_class_ids) && user.preview_class_ids.length > 0) {
    const activeClassIdSet = new Set(activeClassIds);
    const classIds = [...new Set(user.preview_class_ids.map(Number).filter(Number.isFinite))]
      .filter((classId) => activeClassIdSet.has(classId));

    return {
      status: classIds.length ? 'ready' : 'no-classes',
      fullAccess: false,
      teacher: user.preview_teacher || null,
      classIds,
    };
  }

  if (isFullHeadTeacherAccessRole(role)) {
    return {
      status: activeClassIds.length ? 'ready' : 'no-classes',
      fullAccess: true,
      teacher: null,
      classIds: activeClassIds,
    };
  }

  const teacher = findTeacherForUser(teachers, user);
  if (!teacher) {
    return {
      status: 'no-teacher',
      fullAccess: false,
      teacher: null,
      classIds: [],
    };
  }

  const activeClassIdSet = new Set(activeClassIds);
  const classIds = getHeadTeacherClassIds({ classes, teacher })
    .filter((classId) => activeClassIdSet.has(Number(classId)));

  if (classIds.length === 0) {
    return {
      status: 'no-classes',
      fullAccess: false,
      teacher,
      classIds: [],
    };
  }

  return {
    status: 'ready',
    fullAccess: false,
    teacher,
    classIds,
  };
};
