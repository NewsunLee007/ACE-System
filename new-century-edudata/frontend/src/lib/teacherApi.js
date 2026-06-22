import { apiRequest } from './api';
import { normalizeClassNo } from './classImport';

const normalizeText = (value) => String(value ?? '').trim();

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const BACKEND_PERMISSION_TO_FRONTEND_ROLE = {
  teacher: 'subject_teacher',
  headmaster: 'head_teacher',
  lesson_leader: 'lesson_leader',
  subject_leader: 'research_leader',
  grade_leader: 'grade_leader',
};

export const FRONTEND_ROLE_TO_BACKEND_PERMISSION = {
  subject_teacher: 'teacher',
  head_teacher: 'headmaster',
  lesson_leader: 'lesson_leader',
  research_leader: 'subject_leader',
  grade_leader: 'grade_leader',
};

const ROLE_PRIORITY = [
  'grade_leader',
  'research_leader',
  'lesson_leader',
  'head_teacher',
  'subject_teacher',
];

const unique = (items) => [...new Set((items || []).filter(Boolean))];

const extractClassNoCandidate = (value) => {
  const text = normalizeText(value).replace(/班$/, '');
  if (!text) return '';

  const gradeClassMatch = text.match(/级\s*(\d{1,2})$/);
  if (gradeClassMatch) return gradeClassMatch[1].padStart(2, '0');

  const gradeNameMatch = text.match(/年级\s*(\d{1,2})$/);
  if (gradeNameMatch) return gradeNameMatch[1].padStart(2, '0');

  const shortMatch = text.match(/^(\d{1,2})$/);
  if (shortMatch) return shortMatch[1].padStart(2, '0');

  return normalizeClassNo(text);
};

export const resolveTeacherClass = ({ classId, className, classes = [] }) => {
  const text = normalizeText(className || classId);
  const numericMatch = text.match(/\d{3,4}/);
  const numericClassId = numericMatch ? Number(numericMatch[0]) : toNumber(classId || text, null);
  const classNo = extractClassNoCandidate(text);

  return (classes || []).find(cls => Number(cls.id) === Number(classId)) ||
    (Number.isFinite(numericClassId) ? (classes || []).find(cls => Number(cls.id) === numericClassId) : null) ||
    (classes || []).find(cls => normalizeText(cls.name) === text) ||
    (classes || []).find(cls => normalizeClassNo(cls.class_no || cls.id) === classNo) ||
    null;
};

const normalizeAssignmentRecord = (assignment = {}, classes = []) => {
  const matchedClass = resolveTeacherClass({
    className: assignment.class_name,
    classes,
  });
  const fallbackClassId = toNumber(assignment.class_id || assignment.class_name, null);
  const classId = matchedClass?.id ?? fallbackClassId;

  return {
    assignment_id: toNumber(assignment.id, null),
    class_id: classId,
    class_name: normalizeText(assignment.class_name || classId || ''),
    grade_name: normalizeText(assignment.grade_name),
    subject: normalizeText(assignment.subject_name || assignment.subject),
    is_headmaster: Boolean(assignment.is_headmaster),
    term: normalizeText(assignment.term),
    start_date: assignment.start_date || null,
    end_date: assignment.end_date || null,
  };
};

export const normalizeTeacherRecord = (teacher = {}, assignments = [], classes = []) => {
  const teachingClasses = (assignments || [])
    .map(assignment => normalizeAssignmentRecord(assignment, classes))
    .filter(item => item.class_id || item.class_name);
  const backendRole = BACKEND_PERMISSION_TO_FRONTEND_ROLE[teacher.permission_code] || 'subject_teacher';
  const roles = unique([
    backendRole,
    ...teachingClasses.filter(item => item.is_headmaster).map(() => 'head_teacher'),
  ]);
  const subjects = unique(teachingClasses.map(item => item.subject));
  const isActive = teacher.is_active ?? teacher.status !== 'suspended';

  return {
    ...teacher,
    id: toNumber(teacher.id),
    code: normalizeText(teacher.username || teacher.code),
    name: normalizeText(teacher.real_name || teacher.name),
    phone: normalizeText(teacher.phone),
    email: normalizeText(teacher.email),
    status: isActive ? 'active' : 'suspended',
    roles,
    subjects,
    teaching_classes: teachingClasses,
    custom_permissions: teacher.custom_permissions || [],
    permission_code: teacher.permission_code,
    role_name: teacher.role_name,
    created_at: teacher.created_at || '',
  };
};

const buildTeacherListQuery = ({
  keyword,
  roleId,
  isActive,
  page = 1,
  pageSize = 100,
} = {}) => {
  const params = new URLSearchParams();
  if (keyword) params.set('keyword', keyword);
  if (roleId) params.set('role_id', String(roleId));
  if (typeof isActive === 'boolean') params.set('is_active', String(isActive));
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  return params.toString();
};

const fetchTeacherDirectoryPage = (filters = {}) => (
  apiRequest(`/teachers/list?${buildTeacherListQuery(filters)}`)
);

export const fetchTeacherAssignments = async (teacherId, term) => {
  const query = term ? `?term=${encodeURIComponent(term)}` : '';
  const payload = await apiRequest(`/teachers/${teacherId}/assignments${query}`);
  return payload?.assignments || [];
};

export const fetchTeacherListWithAssignments = async (filters = {}, classes = []) => {
  const statuses = filters.includeInactive === false ? [true] : [true, false];
  const pages = await Promise.all(statuses.map(isActive => (
    fetchTeacherDirectoryPage({ ...filters, isActive })
  )));
  const byId = new Map();
  pages.forEach(page => {
    (page?.teachers || []).forEach(teacher => {
      byId.set(Number(teacher.id), teacher);
    });
  });
  const teacherRows = [...byId.values()];
  const assignmentsById = await Promise.all(teacherRows.map(async (teacher) => {
    try {
      const assignments = await fetchTeacherAssignments(teacher.id, filters.term);
      return [teacher.id, assignments];
    } catch {
      return [teacher.id, []];
    }
  }));
  const assignmentMap = new Map(assignmentsById);

  return {
    success: true,
    total: teacherRows.length,
    teachers: teacherRows.map(teacher => normalizeTeacherRecord(
      teacher,
      assignmentMap.get(teacher.id) || [],
      classes
    )),
  };
};

export const fetchAuthRoles = async () => {
  const payload = await apiRequest('/auth/roles');
  return payload?.roles || [];
};

export const resolveBackendRoleId = (frontendRoles = [], backendRoles = []) => {
  const selectedRole = ROLE_PRIORITY.find(role => frontendRoles.includes(role)) ||
    frontendRoles[0] ||
    'subject_teacher';
  const permission = FRONTEND_ROLE_TO_BACKEND_PERMISSION[selectedRole] || 'teacher';
  const matchedRole = (backendRoles || []).find(role => role.permission_code === permission) ||
    (backendRoles || []).find(role => role.permission_code === 'teacher');

  if (!matchedRole) {
    throw new Error('后端未配置教师角色，请先在系统角色中配置 teacher/headmaster 等权限码');
  }

  return matchedRole.id;
};

export const buildTeacherUserPayload = (form = {}, backendRoles = []) => {
  const password = normalizeText(form.initial_password);
  if (password.length < 6) {
    throw new Error('初始密码至少需要 6 位');
  }

  return {
    username: normalizeText(form.code),
    password,
    real_name: normalizeText(form.name),
    role_id: resolveBackendRoleId(form.roles || ['subject_teacher'], backendRoles),
    phone: normalizeText(form.phone) || undefined,
    email: normalizeText(form.email) || undefined,
  };
};

export const createTeacherUser = async (form, backendRoles = []) => {
  const roles = backendRoles.length > 0 ? backendRoles : await fetchAuthRoles();
  const userPayload = buildTeacherUserPayload(form, roles);
  const result = await apiRequest('/auth/users/create', {
    method: 'POST',
    body: JSON.stringify(userPayload),
  });

  if (result?.success === false) {
    return result;
  }

  const lookup = await fetchTeacherDirectoryPage({
    keyword: userPayload.username,
    isActive: true,
    pageSize: 100,
  });
  const createdTeacher = (lookup?.teachers || []).find(teacher => (
    normalizeText(teacher.username) === userPayload.username
  ));

  return {
    ...result,
    teacher_id: createdTeacher?.id,
  };
};

const normalizeAssignmentKey = (item = {}) => {
  const classId = normalizeText(item.class_id || item.class_name);
  const subject = normalizeText(item.subject || item.subject_name);
  const kind = item.is_headmaster ? 'headmaster' : 'subject';
  return `${classId}:${subject}:${kind}`;
};

export const buildTeacherAssignmentPayload = ({
  teacherId,
  teachingClass,
  classes = [],
  term,
}) => {
  const matchedClass = resolveTeacherClass({
    classId: teachingClass.class_id,
    className: teachingClass.class_name,
    classes,
  });
  const classId = matchedClass?.id ?? teachingClass.class_id;
  const className = normalizeText(classId || teachingClass.class_name);
  const gradeNumber = Number.isFinite(Number(classId)) ? Math.floor(Number(classId) / 100) : null;

  return {
    teacher_id: Number(teacherId),
    term,
    grade_name: teachingClass.grade_name || (gradeNumber ? `${gradeNumber}年级` : ''),
    class_name: className,
    subject_name: normalizeText(teachingClass.subject) || null,
    is_headmaster: Boolean(teachingClass.is_headmaster),
  };
};

export const assignTeacherClass = (payload) => (
  apiRequest('/teachers/assign', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
);

export const removeTeacherAssignment = (assignmentId) => (
  apiRequest(`/teachers/assignments/${assignmentId}`, {
    method: 'DELETE',
  })
);

export const syncTeacherAssignments = async ({
  teacher,
  form,
  classes = [],
  term,
}) => {
  const existing = teacher?.teaching_classes || [];
  const desired = (form?.teaching_classes || [])
    .map(item => ({
      ...item,
      subject: normalizeText(item.subject) || normalizeText(form?.subjects?.[0]),
    }))
    .filter(item => item.class_id || item.class_name);
  const existingByKey = new Map(existing.map(item => [normalizeAssignmentKey(item), item]));
  const desiredByKey = new Map(desired.map(item => [normalizeAssignmentKey(item), item]));
  const removed = [];
  const created = [];

  for (const item of existing) {
    if (!desiredByKey.has(normalizeAssignmentKey(item)) && item.assignment_id) {
      await removeTeacherAssignment(item.assignment_id);
      removed.push(item);
    }
  }

  for (const item of desired) {
    if (!existingByKey.has(normalizeAssignmentKey(item))) {
      const payload = buildTeacherAssignmentPayload({
        teacherId: teacher.id,
        teachingClass: item,
        classes,
        term,
      });
      const result = await assignTeacherClass(payload);
      created.push({ item, result });
    }
  }

  return {
    createdCount: created.length,
    removedCount: removed.length,
    created,
    removed,
  };
};

export const toggleTeacherStatus = (teacherId) => (
  apiRequest(`/auth/users/${teacherId}/toggle-status`, {
    method: 'POST',
  })
);
