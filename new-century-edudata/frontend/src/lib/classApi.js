import { apiRequest } from './api';
import { allocateClassId, normalizeClassNo } from './classImport';

const normalizeText = (value) => String(value ?? '').trim();

export const normalizeClassRecord = (record = {}) => {
  const classCode = normalizeText(record.class_code || record.id);
  const numericId = Number(classCode);
  const classNo = normalizeClassNo(record.class_no || classCode);
  const enrollmentYear = Number(record.enrollment_year);

  return {
    ...record,
    id: Number.isFinite(numericId) ? numericId : classCode,
    class_code: classCode,
    class_no: classNo,
    name: normalizeText(record.name) || `${enrollmentYear}级${classNo}班`,
    enrollment_year: enrollmentYear,
    classroom_location: normalizeText(record.classroom_location),
    status: record.status === 'inactive' ? 'inactive' : 'active',
    created_at: record.created_at || '',
    student_count: Number(record.student_count) || 0,
    derived_from_students: Boolean(record.derived_from_students),
  };
};

const buildClassListQuery = ({ status, keyword, page = 1, pageSize = 200 } = {}) => {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (keyword) params.set('keyword', keyword);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  return params.toString();
};

export const fetchClassList = async (filters = {}) => {
  const payload = await apiRequest(`/classes/list?${buildClassListQuery(filters)}`);
  return {
    ...payload,
    classes: (payload?.classes || []).map(normalizeClassRecord),
  };
};

export const buildClassPayload = ({
  form = {},
  classes = [],
  currentAcademicYear,
  calculateGradeLevel,
}) => {
  const classNo = normalizeClassNo(form.class_no);
  const enrollmentYear = Number(form.enrollment_year);
  const classId = form.id || form.class_code || allocateClassId({
    classNo,
    enrollmentYear,
    classes,
    currentAcademicYear,
    calculateGradeLevel,
  });

  return {
    class_code: String(classId),
    class_no: classNo,
    name: normalizeText(form.name) || `${enrollmentYear}级${classNo}班`,
    enrollment_year: enrollmentYear,
    classroom_location: normalizeText(form.classroom_location) || undefined,
    status: form.status || 'active',
  };
};

export const createClassRecord = (payload) => (
  apiRequest('/classes/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
);

export const updateClassRecord = (classCode, payload) => (
  apiRequest(`/classes/${classCode}/update`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
);

export const deactivateClassRecord = (classCode) => (
  apiRequest(`/classes/${classCode}/deactivate`, {
    method: 'POST',
  })
);
