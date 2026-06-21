import { ApiRequestError } from './api';
import {
  authenticateParentStudent,
  fetchParentStudentExams,
  fetchParentStudentReport,
} from './parentPortalApi';
import schoolData from '../data/schoolData';

const mockResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

describe('parent portal API helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
    schoolData.classes = [{ id: 701, class_no: '01', name: '2025级01班', enrollment_year: 2025 }];
    schoolData.students = [];
    schoolData.exams = [];
    schoolData.examScores = [];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('authenticates a parent-scoped student lookup and trims credentials', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({
      success: true,
      token: 'parent-token',
      student_id: 42,
      message: '验证通过',
    }));

    const result = await authenticateParentStudent({
      studentName: ' 张三 ',
      className: ' 701 ',
      authCode: ' S001 ',
    });

    expect(result).toEqual({
      token: 'parent-token',
      studentId: 42,
      message: '验证通过',
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/parents/auth', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        student_name: '张三',
        class_name: '701',
        auth_code: 'S001',
      }),
    }));
  });

  it('rejects failed parent authentication responses', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({
      success: false,
      message: '学生信息或鉴权码不匹配',
    }));

    await expect(authenticateParentStudent({
      studentName: '张三',
      className: '701',
      authCode: 'bad',
    })).rejects.toThrow(ApiRequestError);
  });

  it('uses the parent token for scoped report and exam requests', async () => {
    localStorage.setItem('token', 'staff-token');
    global.fetch
      .mockResolvedValueOnce(mockResponse({ student_id: 42 }))
      .mockResolvedValueOnce(mockResponse({ exams: [] }));

    await fetchParentStudentReport(42, 'parent-token');
    await fetchParentStudentExams(42, 'parent-token', 5);

    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/v1/parents/student/42/report', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer parent-token',
      }),
    }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/v1/parents/student/42/exams?limit=5', expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer parent-token',
      }),
    }));
  });

  it('falls back to local single-student verification when the backend is unavailable', async () => {
    schoolData.students = [{ id: 7, student_code: '0381251045013', name: '白钧赫', class_id: 701 }];
    schoolData.exams = [{ id: 1001, exam_name: '期末考试', exam_date: '2026-02-25', subjects: ['语文'] }];
    schoolData.examScores = [{
      id: '1001_7',
      exam_id: 1001,
      student_id: 7,
      student_code: '0381251045013',
      student_name: '白钧赫',
      class_id: 701,
      scores: { 语文: 88 },
      total_score: 88,
      class_rank: 3,
      rank: 12,
      is_valid: true,
    }];
    global.fetch.mockResolvedValueOnce(mockResponse({ detail: 'not found' }, false, 404));

    const session = await authenticateParentStudent({
      studentName: '白钧赫',
      className: '701',
      authCode: '045013',
    });
    const report = await fetchParentStudentReport(session.studentId, session.token);
    const exams = await fetchParentStudentExams(session.studentId, session.token);

    expect(session.studentId).toBe(7);
    expect(report.student_name).toBe('白钧赫');
    expect(report.latest_exam.exam_name).toBe('期末考试');
    expect(exams.exams[0].subjects).toEqual({ 语文: 88 });
  });
});
