import { API_BASE_URL, ApiRequestError, apiRequest, getAuthHeaders } from './api';

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const normalizeExamSubjects = (subjects) => {
  if (Array.isArray(subjects)) return subjects;
  if (typeof subjects !== 'string' || !subjects.trim()) return [];

  try {
    const parsed = JSON.parse(subjects);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Some legacy records store subjects as a display string.
  }

  return subjects
    .split(/[，,、]/)
    .map(subject => subject.trim())
    .filter(Boolean);
};

export const buildExamPayload = (form = {}) => {
  const subjects = normalizeExamSubjects(form.subjects);
  const calculatedFullScore = subjects.reduce((sum, subject) => (
    sum + toNumber(form.subject_scores?.[subject], 100)
  ), 0);
  const explicitFullScore = toNumber(form.full_score, 0);

  return {
    exam_name: String(form.exam_name || '').trim(),
    term: form.term,
    exam_type: form.exam_type,
    grade_level: form.grade_level,
    exam_date: form.exam_date,
    subjects,
    full_score: explicitFullScore > 0 ? explicitFullScore : calculatedFullScore,
    description: form.description || undefined,
  };
};

export const normalizeExamRecord = (exam = {}, stats = {}) => {
  const overview = stats.overview || stats;
  const hasStats = Boolean(stats.overview || Object.keys(stats).length);
  const subjects = normalizeExamSubjects(exam.subjects);
  const fullScore = toNumber(exam.full_score, subjects.length * 100);
  const subjectScore = subjects.length ? Number((fullScore / subjects.length).toFixed(1)) : 100;
  const validStudents = toNumber(
    hasStats ? overview.valid_students : exam.valid_students,
    toNumber(exam.valid_students, 0)
  );
  const totalStudents = toNumber(
    hasStats ? overview.total_students : exam.total_students,
    toNumber(exam.total_students, 0)
  );

  return {
    ...exam,
    id: toNumber(exam.id),
    exam_name: exam.exam_name || exam.name || '',
    term: exam.term || '',
    exam_type: exam.exam_type || '',
    grade_level: exam.grade_level || '',
    exam_date: exam.exam_date || '',
    subjects,
    subject_scores: exam.subject_scores || subjects.reduce((scores, subject) => ({
      ...scores,
      [subject]: subjectScore,
    }), {}),
    full_score: fullScore,
    description: exam.description || '',
    total_students: totalStudents,
    valid_students: validStudents,
    class_count: toNumber(hasStats ? overview.class_count : exam.class_count, toNumber(exam.class_count, 0)),
    avg_score: toNumber(hasStats ? overview.avg_score : exam.avg_score, toNumber(exam.avg_score, 0)),
    top_score: toNumber(
      hasStats ? (overview.top_score ?? overview.max_score) : (exam.top_score ?? exam.max_score),
      toNumber(exam.top_score ?? exam.max_score, 0)
    ),
    status: hasStats ? (validStudents > 0 ? '已完成' : (exam.status || '未开始')) : (exam.status || (validStudents > 0 ? '已完成' : '未开始')),
  };
};

const buildExamListQuery = ({ term, gradeLevel, examType, page = 1, pageSize = 100 } = {}) => {
  const params = new URLSearchParams();
  if (term) params.set('term', term);
  if (gradeLevel) params.set('grade_level', gradeLevel);
  if (examType) params.set('exam_type', examType);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  return params.toString();
};

export const fetchExamList = async (filters = {}) => {
  const query = buildExamListQuery(filters);
  const payload = await apiRequest(`/exams/list?${query}`);
  return {
    ...payload,
    exams: (payload?.exams || []).map(exam => normalizeExamRecord(exam)),
  };
};

export const fetchExamStatistics = (examId) => (
  apiRequest(`/exams/${examId}/statistics`)
);

export const fetchExamListWithStatistics = async (filters = {}) => {
  const payload = await fetchExamList(filters);
  const exams = await Promise.all((payload.exams || []).map(async (exam) => {
    try {
      const stats = await fetchExamStatistics(exam.id);
      return normalizeExamRecord(exam, stats);
    } catch {
      return exam;
    }
  }));

  return { ...payload, exams };
};

export const normalizeExamScoreRow = (row = {}) => {
  const classId = toNumber(row.class_id || row.class_name, null);
  const scores = Object.entries(row.scores || {}).reduce((result, [subject, value]) => {
    const score = toNumber(value, null);
    if (score !== null) result[subject] = score;
    return result;
  }, {});

  return {
    ...row,
    id: row.id ?? `${row.exam_id || ''}_${row.student_id || row.exam_number || ''}`,
    exam_id: toNumber(row.exam_id, null),
    student_id: row.student_id,
    student_code: row.student_code || '',
    student_name: row.student_name || row.name || '',
    exam_number: row.exam_number || '',
    class_id: classId,
    class_name: row.class_name || (classId ? `${classId}班` : ''),
    scores,
    total_score: toNumber(row.total_score, 0),
    is_valid: row.is_valid !== false && row.is_included !== false,
    is_included: row.is_included !== false && row.is_valid !== false,
    remarks: row.remarks || '',
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
  };
};

export const fetchExamScoreRows = async (examId, { includeInvalid = true } = {}) => {
  const params = new URLSearchParams();
  params.set('include_invalid', String(includeInvalid));
  const payload = await apiRequest(`/score-analysis/exams/${examId}/scores?${params.toString()}`);
  return {
    ...payload,
    scores: (payload?.scores || []).map(normalizeExamScoreRow),
  };
};

export const exportExamScores = async (examId, { layerId } = {}) => {
  if (!examId) {
    throw new Error('请先选择考试，再导出成绩');
  }

  const params = new URLSearchParams();
  if (layerId) params.set('layer_id', String(layerId));
  const query = params.toString();
  const response = await fetch(`${API_BASE_URL}/data/export/scores/${examId}${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: getAuthHeaders({}),
  });

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new ApiRequestError(payload?.detail || payload?.message || `导出失败(${response.status})`, response.status, payload);
  }

  return response.blob();
};

export const createExamRecord = (form) => (
  apiRequest('/exams/create', {
    method: 'POST',
    body: JSON.stringify(buildExamPayload(form)),
  })
);

export const updateExamRecord = (examId, form) => (
  apiRequest(`/exams/${examId}/update`, {
    method: 'PUT',
    body: JSON.stringify(buildExamPayload(form)),
  })
);

export const deleteExamRecord = (examId) => (
  apiRequest(`/exams/${examId}/delete`, {
    method: 'DELETE',
  })
);
