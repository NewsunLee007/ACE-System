import { apiRequest } from './api';
import { normalizeClassNo } from './classImport';
import { normalizeStudentRecordForRegistry } from './studentRegistry';

const normalizeText = (value) => String(value ?? '').trim();

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const resolveClass = ({ classId, currentClass, classes = [] }) => {
  const classText = normalizeText(currentClass || classId);
  const normalizedClassNo = normalizeClassNo(classText);

  return (classes || []).find(cls => Number(cls.id) === Number(classId)) ||
    (classes || []).find(cls => normalizeText(cls.id) === classText) ||
    (classes || []).find(cls => normalizeText(cls.name) === classText) ||
    (classes || []).find(cls => normalizeClassNo(cls.class_no || cls.id) === normalizedClassNo) ||
    null;
};

export const normalizeStudentRecord = (student = {}, classes = []) => {
  const matchedClass = resolveClass({
    classId: student.class_id,
    currentClass: student.current_class,
    classes,
  });
  const classId = matchedClass?.id ?? toNumber(student.class_id || student.current_class, null);
  const grade = student.current_grade || (classId ? `${Math.floor(Number(classId) / 100)}年级` : '');

  return normalizeStudentRecordForRegistry({
    ...student,
    id: toNumber(student.id),
    student_code: normalizeText(student.student_code),
    name: normalizeText(student.name),
    gender: toNumber(student.gender, 1),
    enrollment_year: toNumber(student.enrollment_year),
    class_id: classId,
    current_grade: grade,
    current_class: normalizeText(student.current_class || classId || ''),
    id_card_last6: normalizeText(student.id_card_last6),
    status: normalizeText(student.status) || '在读',
  });
};

export const buildStudentPayload = (form = {}, classes = []) => {
  const matchedClass = resolveClass({
    classId: form.class_id,
    currentClass: form.current_class,
    classes,
  });
  const classId = matchedClass?.id ?? form.class_id;
  const currentClass = classId ? String(classId) : normalizeText(form.current_class);

  return {
    student_code: normalizeText(form.student_code),
    name: normalizeText(form.name),
    gender: toNumber(form.gender, 1),
    enrollment_year: toNumber(form.enrollment_year),
    current_grade: form.current_grade || (classId ? `${Math.floor(Number(classId) / 100)}年级` : undefined),
    current_class: currentClass || undefined,
    id_card_last6: normalizeText(form.id_card_last6) || undefined,
  };
};

export const buildStudentUpdatePayload = (form = {}, classes = []) => {
  const payload = buildStudentPayload(form, classes);
  return {
    name: payload.name,
    gender: payload.gender,
    current_grade: payload.current_grade,
    current_class: payload.current_class,
    id_card_last6: payload.id_card_last6,
    status: normalizeText(form.status) || '在读',
  };
};

const buildStudentListQuery = ({ grade, className, status, keyword, page = 1, pageSize = 100 } = {}) => {
  const params = new URLSearchParams();
  if (grade) params.set('grade', grade);
  if (className) params.set('class_name', className);
  if (status !== undefined) params.set('status', status);
  if (keyword) params.set('keyword', keyword);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  return params.toString();
};

export const fetchStudentList = async (filters = {}, classes = []) => {
  const query = buildStudentListQuery(filters);
  const payload = await apiRequest(`/students/list?${query}`);
  return {
    ...payload,
    students: (payload?.students || []).map(student => normalizeStudentRecord(student, classes)),
  };
};

export const createStudentRecord = (form, classes = []) => (
  apiRequest('/students/create', {
    method: 'POST',
    body: JSON.stringify(buildStudentPayload(form, classes)),
  })
);

export const updateStudentRecord = (studentId, form, classes = []) => (
  apiRequest(`/students/${studentId}/update`, {
    method: 'PUT',
    body: JSON.stringify(buildStudentUpdatePayload(form, classes)),
  })
);

export const uploadStudentImportFile = ({ file, filename }) => {
  if (!file) {
    throw new Error('请选择要导入的学生文件');
  }

  const formData = new FormData();
  formData.append('file', file, filename || file.name || 'students.csv');

  return apiRequest('/data/import/students', {
    method: 'POST',
    body: formData,
  });
};

export const studentImportItemsToCsv = ({ items = [], classes = [] }) => {
  const headers = ['学籍辅号', '姓名', '性别', '入学年份', '当前年级', '当前班级', '状态'];
  const rows = (items || [])
    .filter(item => item.type !== 'error' && item.type !== 'unchanged')
    .map(item => {
      const data = item.data || {};
      const studentClass = resolveClass({ classId: data.class_id, classes });
      return {
        学籍辅号: data.student_code,
        姓名: data.name,
        性别: Number(data.gender) === 0 ? '女' : '男',
        入学年份: data.enrollment_year,
        当前年级: studentClass?.id ? `${Math.floor(Number(studentClass.id) / 100)}年级` : '',
        当前班级: studentClass?.id || data.class_id || '',
        状态: data.status || '在读',
      };
    });

  return [
    headers.map(csvValue).join(','),
    ...rows.map(row => headers.map(header => csvValue(row[header])).join(','))
  ].join('\n');
};
