import { apiRequest } from './api';

export const fetchStudentScoreHistory = ({
  studentId,
  mode = 'recent',
  term,
  academicYear,
  limit = 6,
}) => {
  const query = new URLSearchParams();
  query.set('mode', mode);
  query.set('limit', String(limit));
  if (term) query.set('term', term);
  if (academicYear) query.set('academic_year', academicYear);
  return apiRequest(`/score-analysis/history/students/${encodeURIComponent(studentId)}?${query}`);
};

export const fetchGradeScoreHistory = ({
  gradeLevel,
  mode = 'recent',
  term,
  academicYear,
  limit = 6,
}) => {
  const query = new URLSearchParams();
  query.set('mode', mode);
  query.set('limit', String(limit));
  if (term) query.set('term', term);
  if (academicYear) query.set('academic_year', academicYear);
  return apiRequest(`/score-analysis/history/grades/${encodeURIComponent(gradeLevel)}?${query}`);
};
