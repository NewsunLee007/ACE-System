import { ApiRequestError, apiRequest } from './api';
import schoolData from '../data/schoolData';

const parentAuthHeaders = (token) => ({
  Authorization: `Bearer ${token}`
});

const LOCAL_PARENT_TOKEN_PREFIX = 'local-parent-student:';

const normalizeText = (value) => String(value ?? '').trim();

const shouldUseLocalFallback = (error) => {
  if (error instanceof ApiRequestError) {
    return [404, 502, 503, 504].includes(error.status) || typeof error.payload === 'string';
  }
  return error instanceof TypeError || error instanceof Error;
};

const getClassLabel = (student) => {
  const classId = Number(student?.class_id);
  return schoolData.formatClassName?.(classId) || `${classId}班`;
};

const classMatches = (student, className) => {
  const target = normalizeText(className).replace(/班$/, '');
  const classId = Number(student?.class_id);
  const cls = schoolData.getClassById?.(classId);
  const options = [
    String(classId),
    `${classId}班`,
    normalizeText(cls?.class_no),
    `${normalizeText(cls?.class_no)}班`,
    normalizeText(cls?.name),
    getClassLabel(student),
  ].filter(Boolean).map(item => normalizeText(item).replace(/班$/, ''));
  return options.includes(target);
};

const localTokenForStudent = (studentId) => `${LOCAL_PARENT_TOKEN_PREFIX}${studentId}`;

const studentIdFromLocalToken = (token) => {
  const text = normalizeText(token);
  if (!text.startsWith(LOCAL_PARENT_TOKEN_PREFIX)) return null;
  const id = Number(text.slice(LOCAL_PARENT_TOKEN_PREFIX.length));
  return Number.isFinite(id) ? id : null;
};

const authenticateLocalParentStudent = ({ studentName, className, authCode }) => {
  const normalizedName = normalizeText(studentName);
  const normalizedCode = normalizeText(authCode);
  const student = (schoolData.students || []).find(item => (
    normalizeText(item.name) === normalizedName &&
    classMatches(item, className)
  ));

  if (!student) {
    throw new ApiRequestError('学生信息不匹配，请检查姓名和班级是否正确', 401, null);
  }

  const studentCode = normalizeText(student.student_code || student.code);
  const suffix = studentCode.slice(-6);
  if (normalizedCode !== studentCode && normalizedCode !== suffix) {
    throw new ApiRequestError('鉴权码错误，请输入学籍辅号或后6位', 401, null);
  }

  return {
    token: localTokenForStudent(student.id),
    studentId: student.id,
    message: '本地数据验证成功'
  };
};

const getLocalStudent = (studentId, token) => {
  const tokenStudentId = studentIdFromLocalToken(token);
  if (Number(tokenStudentId) !== Number(studentId)) {
    throw new ApiRequestError('无权查看该学生成绩', 403, null);
  }
  const student = (schoolData.students || []).find(item => Number(item.id) === Number(studentId));
  if (!student) {
    throw new ApiRequestError('学生不存在', 404, null);
  }
  return student;
};

const getLocalStudentScoreRows = (student) => (
  (schoolData.examScores || [])
    .filter(row => row.is_valid !== false && row.is_included !== false)
    .filter(row => (
      Number(row.student_id) === Number(student.id) ||
      normalizeText(row.student_code) === normalizeText(student.student_code)
    ))
    .map(row => {
      const exam = (schoolData.exams || []).find(item => Number(item.id) === Number(row.exam_id));
      return {
        row,
        exam,
        dateValue: Date.parse(exam?.exam_date || '') || Number(row.exam_id) || 0,
      };
    })
    .sort((a, b) => b.dateValue - a.dateValue)
);

const buildLocalStudentReport = (studentId, token) => {
  const student = getLocalStudent(studentId, token);
  const scoreRows = getLocalStudentScoreRows(student);
  const latest = scoreRows[0];
  const latestSubjects = Object.entries(latest?.row?.scores || {}).map(([subject, score]) => ({
    subject,
    score: Number(score),
    class_avg: null,
    layer_avg: null,
    diff: null,
    rank_in_class: null,
  }));
  const weakSubjects = latestSubjects.filter(item => Number(item.score) < 75).map(item => item.subject);
  const advantageSubjects = latestSubjects.filter(item => Number(item.score) >= 90).map(item => item.subject);

  return {
    student_id: student.id,
    student_name: student.name,
    student_code: student.student_code,
    class_name: getClassLabel(student),
    current_term: schoolData.getCurrentSemesterDisplay?.() || '',
    latest_exam: latest ? {
      exam_id: latest.exam?.id || latest.row.exam_id,
      exam_name: latest.exam?.exam_name || latest.exam?.name || `考试${latest.row.exam_id}`,
      exam_date: latest.exam?.exam_date || '',
      term: latest.exam?.term || '',
      total_score: latest.row.total_score,
      class_rank: latest.row.class_rank || null,
      layer_rank: null,
      rank_change: null,
      subjects: latestSubjects,
      layer_status: latest.row.rank ? `年级排名 ${latest.row.rank}` : '',
    } : null,
    historical_trends: scoreRows.map(({ row, exam }) => ({
      exam_name: exam?.exam_name || exam?.name || `考试${row.exam_id}`,
      exam_date: exam?.exam_date || '',
      total_score: row.total_score,
      class_rank: row.class_rank || null,
      trend: '持平',
    })),
    weak_subjects: weakSubjects,
    advantage_subjects: advantageSubjects,
    diagnosis: weakSubjects.length
      ? `需要重点关注 ${weakSubjects.join('、')}，建议结合错题和课堂反馈进行针对性补救。`
      : '当前没有明显薄弱学科，建议保持稳定复习节奏。',
  };
};

const buildLocalStudentExams = (studentId, token, limit = 10) => {
  const student = getLocalStudent(studentId, token);
  const scoreRows = getLocalStudentScoreRows(student).slice(0, limit);
  return {
    total_records: scoreRows.length,
    exams: scoreRows.map(({ row, exam }) => ({
      exam_id: row.exam_id,
      exam_name: exam?.exam_name || exam?.name || `考试${row.exam_id}`,
      exam_date: exam?.exam_date || '',
      term: exam?.term || '',
      total_score: row.total_score,
      class_rank: row.class_rank || null,
      subjects: row.scores || {},
    })),
  };
};

const authenticateParentStudentRemote = async ({ studentName, className, authCode }) => {
  const payload = await apiRequest('/parents/auth', {
    method: 'POST',
    body: JSON.stringify({
      student_name: String(studentName || '').trim(),
      class_name: String(className || '').trim(),
      auth_code: String(authCode || '').trim()
    })
  });

  if (!payload?.success || !payload.token || !payload.student_id) {
    throw new ApiRequestError(payload?.message || '家长身份验证失败', 401, payload);
  }

  return {
    token: payload.token,
    studentId: payload.student_id,
    message: payload.message
  };
};

export const authenticateParentStudent = async ({ studentName, className, authCode }) => {
  try {
    return await authenticateParentStudentRemote({ studentName, className, authCode });
  } catch (error) {
    if (shouldUseLocalFallback(error)) {
      return authenticateLocalParentStudent({ studentName, className, authCode });
    }
    throw error;
  }
};

export const fetchParentStudentReport = async (studentId, token) => {
  if (studentIdFromLocalToken(token)) {
    return buildLocalStudentReport(studentId, token);
  }

  return apiRequest(`/parents/student/${studentId}/report`, {
    headers: parentAuthHeaders(token)
  });
};

export const fetchParentStudentExams = async (studentId, token, limit = 10) => {
  if (studentIdFromLocalToken(token)) {
    return buildLocalStudentExams(studentId, token, limit);
  }

  return apiRequest(`/parents/student/${studentId}/exams?limit=${limit}`, {
    headers: parentAuthHeaders(token)
  });
};
