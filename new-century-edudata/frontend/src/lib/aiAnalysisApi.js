import { apiRequest } from './api';

const toNullableNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const subjectPayload = (item) => ({
  subject: item.subject,
  score: toNullableNumber(item.score),
  full_score: toNullableNumber(item.fullScore),
  grade_mean: toNullableNumber(item.gradeMean),
  gap_to_grade_mean: toNullableNumber(item.gapToGradeMean),
  score_delta: toNullableNumber(item.scoreDelta),
  remedy: item.remedy || '',
});

export const buildStudentScoreAiPayload = ({ profile, currentExam, dynamicDiagnosis }) => ({
  student_name: profile?.name || '学生',
  class_name: profile?.class_name || '',
  latest_exam_name: currentExam?.exam_name || '',
  trend_summary: dynamicDiagnosis?.summary || '',
  weak_subjects: (dynamicDiagnosis?.weakSubjects || []).map(subjectPayload),
  advantage_subjects: (dynamicDiagnosis?.advantageSubjects || []).map(subjectPayload),
  history: (dynamicDiagnosis?.chronological || []).slice(-10).map(exam => ({
    exam_name: exam.exam_name,
    exam_date: exam.exam_date || '',
    total_score: toNullableNumber(exam.total?.score),
    grade_rank: exam.total?.grade_rank || null,
    grade_percentile: toNullableNumber(exam.total?.grade_percentile),
    z_value: toNullableNumber(exam.z_value),
  })),
});

export const analyzeStudentScoreWithAI = (payload) => (
  apiRequest('/ai/student-score-analysis', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
);

export const analyzeClassScoreWithAI = (payload) => (
  apiRequest('/ai/class-score-analysis', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
);

export const analyzeScopeScoreWithAI = (payload) => (
  apiRequest('/ai/scope-score-analysis', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
);
