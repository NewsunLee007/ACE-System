import { apiRequest } from './api';

const normalizeText = (value) => String(value ?? '').trim();

export const DUTY_TYPE_TO_FRONTEND_ROLE = {
  head_teacher: 'head_teacher',
  lesson_leader: 'lesson_leader',
  research_leader: 'research_leader',
  grade_leader: 'grade_leader',
  grade_deputy: 'grade_deputy',
  dept_director: 'dept_director',
  dept_deputy: 'dept_deputy',
  vice_principal: 'vice_principal',
  principal: 'principal',
};

export const normalizeTeacherDuty = (record = {}) => ({
  id: Number(record.id),
  teacher_id: Number(record.teacher_id),
  teacher_name: normalizeText(record.teacher_name),
  teacher_code: normalizeText(record.teacher_code),
  phone: normalizeText(record.phone),
  duty_type: normalizeText(record.duty_type),
  role_type: DUTY_TYPE_TO_FRONTEND_ROLE[record.duty_type] || normalizeText(record.duty_type),
  term: normalizeText(record.term),
  grade: normalizeText(record.grade_name),
  subject: normalizeText(record.subject_name),
  class_id: normalizeText(record.class_name),
  class_name: normalizeText(record.class_name),
  scope_label: normalizeText(record.scope_label),
  assigned_at: record.assigned_at || '',
  is_active: record.is_active !== false,
});

const buildDutyListQuery = ({ term, includeInactive = false } = {}) => {
  const params = new URLSearchParams();
  if (term) params.set('term', String(term));
  if (includeInactive) params.set('include_inactive', 'true');
  return params.toString();
};

export const fetchTeacherDuties = async (filters = {}) => {
  const query = buildDutyListQuery(filters);
  const payload = await apiRequest(`/teacher-duties/list${query ? `?${query}` : ''}`);
  return {
    ...payload,
    duties: (payload?.duties || []).map(normalizeTeacherDuty),
  };
};

export const buildTeacherDutyPayload = ({
  teacherId,
  dutyType,
  term,
  gradeName,
  subjectName,
  className,
  scopeLabel,
}) => ({
  teacher_id: Number(teacherId),
  duty_type: normalizeText(dutyType),
  term: normalizeText(term),
  grade_name: normalizeText(gradeName) || undefined,
  subject_name: normalizeText(subjectName) || undefined,
  class_name: normalizeText(className) || undefined,
  scope_label: normalizeText(scopeLabel) || undefined,
});

export const assignTeacherDuty = (payload) => (
  apiRequest('/teacher-duties/assign', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
);

export const deactivateTeacherDuty = (dutyId) => (
  apiRequest(`/teacher-duties/${dutyId}`, {
    method: 'DELETE',
  })
);
