import { apiRequest } from './api';

const normalizeText = (value) => String(value ?? '').trim();

export const normalizeParentRecord = (parent = {}) => {
  const students = (parent.students || []).map(student => ({
    ...student,
    id: Number(student.student_id || student.id),
    student_id: Number(student.student_id || student.id),
    student_code: normalizeText(student.student_code),
    name: normalizeText(student.name),
    class_id: Number(student.class_id) || student.class_id,
    class_name: normalizeText(student.class_name || student.class_id),
    relation: normalizeText(student.relation || parent.relation || '父亲'),
  }));

  return {
    ...parent,
    id: Number(parent.id),
    name: normalizeText(parent.name || parent.real_name),
    phone: normalizeText(parent.phone || parent.username),
    email: normalizeText(parent.email),
    relation: normalizeText(parent.relation) || students[0]?.relation || '父亲',
    status: parent.status === 'inactive' || parent.is_active === false ? 'inactive' : 'active',
    student_ids: (parent.student_ids || students.map(student => student.student_id))
      .map(Number)
      .filter(Number.isFinite),
    students,
    created_at: parent.created_at || '',
  };
};

const buildParentListQuery = ({ keyword, status, page = 1, pageSize = 100 } = {}) => {
  const params = new URLSearchParams();
  if (keyword) params.set('keyword', keyword);
  if (status && status !== 'all') params.set('status', status);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  return params.toString();
};

export const fetchParentList = async (filters = {}) => {
  const payload = await apiRequest(`/parent-management/list?${buildParentListQuery(filters)}`);
  return {
    ...payload,
    parents: (payload?.parents || []).map(normalizeParentRecord),
  };
};

export const buildParentPayload = (form = {}) => ({
  name: normalizeText(form.name),
  phone: normalizeText(form.phone),
  email: normalizeText(form.email) || undefined,
  relation: normalizeText(form.relation) || '父亲',
  status: form.status || 'active',
});

export const createParentRecord = (form = {}) => {
  const password = normalizeText(form.initial_password);
  if (password.length < 6) {
    throw new Error('初始密码至少需要 6 位');
  }

  return apiRequest('/parent-management/create', {
    method: 'POST',
    body: JSON.stringify({
      ...buildParentPayload(form),
      password,
    }),
  });
};

export const updateParentRecord = (parentId, form = {}) => (
  apiRequest(`/parent-management/${parentId}/update`, {
    method: 'PUT',
    body: JSON.stringify(buildParentPayload(form)),
  })
);

export const bindParentStudent = ({ parentId, studentId, relation }) => (
  apiRequest(`/parent-management/${parentId}/bind`, {
    method: 'POST',
    body: JSON.stringify({
      student_id: Number(studentId),
      relation: normalizeText(relation) || '父亲',
    }),
  })
);

export const unbindParentStudent = ({ parentId, studentId }) => (
  apiRequest(`/parent-management/${parentId}/bindings/${studentId}`, {
    method: 'DELETE',
  })
);
