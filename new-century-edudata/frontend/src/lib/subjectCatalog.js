import schoolData from '../data/schoolData';
import { ApiRequestError, apiRequest } from './api';

export const DEFAULT_SUBJECTS = ['语文', '数学', '英语', '科学', '社会'];

const normalizeName = (value) => String(value || '').trim();

const normalizeCode = (name, code) => {
  const explicitCode = String(code || '').trim();
  if (explicitCode) return explicitCode;
  return normalizeName(name).slice(0, 2).toUpperCase();
};

export const normalizeSubject = (subject, index = 0) => {
  const name = normalizeName(typeof subject === 'string' ? subject : subject?.name);
  return {
    id: Number(subject?.id) || index + 1,
    name,
    code: normalizeCode(name, subject?.code),
    description: String(subject?.description || '').trim(),
    sort_order: Number(subject?.sort_order) || index + 1
  };
};

export const subjectNamesToRows = (names = []) => (
  names
    .map((name, index) => normalizeSubject({ name }, index))
    .filter(subject => subject.name)
);

export const getLocalSubjectRows = () => {
  const names = Array.isArray(schoolData.subjects) && schoolData.subjects.length > 0
    ? schoolData.subjects
    : DEFAULT_SUBJECTS;
  return subjectNamesToRows(names);
};

export const syncSubjectRowsToSchoolData = (subjects = []) => {
  schoolData.subjects = subjects
    .map(subject => normalizeName(subject.name))
    .filter(Boolean);
};

export const normalizeSubjectList = (subjects = []) => (
  subjects
    .map((subject, index) => normalizeSubject(subject, index))
    .filter(subject => subject.name)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id || a.name.localeCompare(b.name, 'zh-Hans-CN'))
);

export const shouldUseLocalSubjectFallback = (error) => {
  if (!(error instanceof ApiRequestError)) return true;
  return !error.status || error.status === 404 || error.status >= 500;
};

export const loadSubjectCatalog = async () => {
  try {
    const payload = await apiRequest('/subjects');
    const subjects = normalizeSubjectList(payload?.subjects || []);
    const localSubjects = getLocalSubjectRows();
    if (subjects.length === 0 && localSubjects.length > 0) {
      return {
        subjects: localSubjects,
        source: 'local',
        error: new Error('后端学科库暂无学科记录')
      };
    }
    syncSubjectRowsToSchoolData(subjects);
    return { subjects, source: 'api' };
  } catch (error) {
    if (!shouldUseLocalSubjectFallback(error)) throw error;
    return {
      subjects: getLocalSubjectRows(),
      source: 'local',
      error
    };
  }
};

export const createSubject = (subject) => apiRequest('/subjects', {
  method: 'POST',
  body: JSON.stringify(subject)
});

export const updateSubject = (id, subject) => apiRequest(`/subjects/${id}`, {
  method: 'PUT',
  body: JSON.stringify(subject)
});

export const deleteSubject = (id) => apiRequest(`/subjects/${id}`, {
  method: 'DELETE'
});

export const deleteSubjects = (ids = []) => apiRequest('/subjects/bulk-delete', {
  method: 'POST',
  body: JSON.stringify({ ids })
});

export const addLocalSubject = (subjects = [], subject) => {
  const normalized = normalizeSubject(subject, subjects.length);
  if (!normalized.name) return subjects;
  if (subjects.some(item => item.name === normalized.name)) return subjects;
  const nextSubjects = normalizeSubjectList([
    ...subjects,
    { ...normalized, id: Math.max(0, ...subjects.map(item => Number(item.id) || 0)) + 1 }
  ]);
  syncSubjectRowsToSchoolData(nextSubjects);
  return nextSubjects;
};

export const updateLocalSubject = (subjects = [], id, subject) => {
  const nextSubjects = normalizeSubjectList(subjects.map(item => (
    Number(item.id) === Number(id)
      ? { ...item, ...subject, id: item.id, name: normalizeName(subject.name) || item.name }
      : item
  )));
  syncSubjectRowsToSchoolData(nextSubjects);
  return nextSubjects;
};

export const deleteLocalSubjects = (subjects = [], ids = []) => {
  const idSet = new Set(ids.map(id => Number(id)));
  const nextSubjects = subjects.filter(subject => !idSet.has(Number(subject.id)));
  syncSubjectRowsToSchoolData(nextSubjects);
  return nextSubjects;
};
