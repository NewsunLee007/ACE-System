import {
  buildExamPayload,
  exportExamScores,
  fetchExamScoreRows,
  fetchExamListWithStatistics,
  normalizeExamRecord,
  normalizeExamScoreRow,
  normalizeExamSubjects,
} from './examApi';

const originalFetch = global.fetch;

const mockResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

const mockBlobResponse = (blob, ok = true, status = 200) => ({
  ok,
  status,
  blob: async () => blob,
  json: async () => ({ detail: '导出失败' }),
});

describe('examApi', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes subject lists from backend and legacy strings', () => {
    expect(normalizeExamSubjects('["语文","数学"]')).toEqual(['语文', '数学']);
    expect(normalizeExamSubjects('语文、数学,英语')).toEqual(['语文', '数学', '英语']);
  });

  it('builds backend exam payloads from the management form', () => {
    const payload = buildExamPayload({
      exam_name: '  2026-1 7年级期中  ',
      term: '2026-1',
      exam_type: '期中',
      grade_level: '7年级',
      exam_date: '2026-04-20',
      subjects: ['语文', '数学', '英语'],
      subject_scores: { 语文: 120, 数学: 120, 英语: 100 },
    });

    expect(payload).toEqual({
      exam_name: '2026-1 7年级期中',
      term: '2026-1',
      exam_type: '期中',
      grade_level: '7年级',
      exam_date: '2026-04-20',
      subjects: ['语文', '数学', '英语'],
      full_score: 340,
      description: undefined,
    });
  });

  it('normalizes backend records with exam statistics', () => {
    const exam = normalizeExamRecord({
      id: 12,
      exam_name: '7年级期末',
      subjects: ['语文', '数学'],
      full_score: 220,
    }, {
      overview: {
        total_students: 430,
        valid_students: 421,
        class_count: 10,
        avg_score: 178.26,
        max_score: 215,
      },
    });

    expect(exam).toMatchObject({
      id: 12,
      full_score: 220,
      total_students: 430,
      valid_students: 421,
      class_count: 10,
      avg_score: 178.26,
      top_score: 215,
      status: '已完成',
      subject_scores: { 语文: 110, 数学: 110 },
    });
  });

  it('fetches exam list and merges per-exam statistics using the auth token', async () => {
    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn()
      .mockResolvedValueOnce(mockResponse({
        total: 1,
        page: 1,
        page_size: 100,
        exams: [{
          id: 12,
          exam_name: '7年级期末',
          term: '2026-1',
          exam_type: '期末',
          grade_level: '7年级',
          exam_date: '2026-06-20',
          subjects: ['语文', '数学'],
          full_score: 220,
          created_at: '2026-06-18T00:00:00',
        }],
      }))
      .mockResolvedValueOnce(mockResponse({
        success: true,
        exam_id: 12,
        overview: {
          total_students: 430,
          valid_students: 421,
          class_count: 10,
          avg_score: 178.26,
          max_score: 215,
        },
      }));

    const result = await fetchExamListWithStatistics({ pageSize: 100 });

    expect(result.exams[0]).toMatchObject({
      id: 12,
      total_students: 430,
      valid_students: 421,
      class_count: 10,
      avg_score: 178.26,
      top_score: 215,
    });
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/v1/exams/list?page=1&page_size=100', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer staff-token' }),
    }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/v1/exams/12/statistics', expect.any(Object));
  });

  it('normalizes and fetches backend score rows for score analysis', async () => {
    expect(normalizeExamScoreRow({
      id: 88,
      exam_id: '12',
      student_id: 3,
      student_name: '林同学',
      class_name: '701',
      scores: { 语文: '98', 数学: null, 英语: '102' },
      total_score: '200',
      is_included: true,
    })).toMatchObject({
      id: 88,
      exam_id: 12,
      student_id: 3,
      student_name: '林同学',
      class_id: 701,
      scores: { 语文: 98, 英语: 102 },
      total_score: 200,
      is_valid: true,
    });

    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn().mockResolvedValueOnce(mockResponse({
      success: true,
      scores: [{
        id: 88,
        exam_id: 12,
        student_id: 3,
        student_name: '林同学',
        class_name: '701',
        scores: { 语文: 98 },
        total_score: 98,
      }],
    }));

    const payload = await fetchExamScoreRows(12);

    expect(payload.scores[0]).toMatchObject({ class_id: 701, scores: { 语文: 98 } });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/score-analysis/exams/12/scores?include_invalid=true',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer staff-token' }),
      })
    );
  });

  it('exports exam score files through the backend with auth headers', async () => {
    const blob = new Blob(['xlsx-bytes'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn().mockResolvedValueOnce(mockBlobResponse(blob));

    const result = await exportExamScores(12);

    expect(result).toBe(blob);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/data/export/scores/12',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer staff-token' }),
      })
    );
  });
});
