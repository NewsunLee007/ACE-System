import {
  buildLocalExamScoresCsv,
  buildScoreTemplateCsv,
  calculateClassStats,
  calculateExamOverview,
  filterAndSortScores,
  filterExams,
  getExamValidStudentCount,
  getGradeClassesForExam,
  getNextExamId,
  getStatusColor,
  normalizeExamNameWithTerm,
} from './examManagementUtils';

describe('examManagementUtils', () => {
  const exams = [
    { id: 3, exam_name: '2025-1 期中考试', grade_level: '7年级', term: '2025-1', exam_date: '2026-06-01', valid_students: 2, status: '已完成' },
    { id: 8, exam_name: '期末考试', grade_level: '8年级', term: '2025-1', exam_date: '2026-05-15', valid_students: 0, status: '未开始' },
    { id: 9, exam_name: '月考', grade_level: '7年级', term: '2024-2', exam_date: '2026-06-18', valid_students: 0, status: '未开始' },
  ];

  const scores = [
    { id: 1, exam_id: 3, student_code: 'S001', student_name: '张三', class_id: 701, class_name: '701班', exam_number: '001', scores: { 语文: 88, 数学: 90 }, total_score: 178, rank: 2, class_rank: 1, is_valid: true },
    { id: 2, exam_id: 3, student_code: 'S002', student_name: '李四', class_id: 702, class_name: '702班', exam_number: '002', scores: { 语文: 92, 数学: 95 }, total_score: 187, rank: 1, class_rank: 1, is_valid: true },
    { id: 3, exam_id: 9, student_code: 'S003', student_name: '王五', class_id: 701, class_name: '701班', exam_number: '003', scores: { 语文: 70, 数学: 72 }, total_score: 142, rank: 3, class_rank: 2, is_valid: false },
  ];

  it('normalizes exam names and finds the next local id', () => {
    expect(normalizeExamNameWithTerm('2024-2 期中考试', '2025-1')).toBe('2025-1 期中考试');
    expect(normalizeExamNameWithTerm('期末考试', '')).toBe('期末考试');
    expect(getNextExamId(exams)).toBe(10);
    expect(getStatusColor('已完成')).toContain('green');
  });

  it('filters exams by search, grade, and term', () => {
    expect(filterExams({ exams, searchTerm: '期', filterGrade: '7年级', filterTerm: '2025-1' }).map(exam => exam.id)).toEqual([3]);
    expect(filterExams({ exams, searchTerm: '月考' }).map(exam => exam.id)).toEqual([9]);
  });

  it('filters and sorts score rows without mutating input rows', () => {
    const rows = filterAndSortScores({
      scores,
      searchTerm: 's00',
      filterClass: '701',
      sortField: '语文',
      sortOrder: 'asc',
    });

    expect(rows.map(row => row.id)).toEqual([3, 1]);
    expect(scores.map(row => row.id)).toEqual([1, 2, 3]);
  });

  it('builds score import and local export csv content', () => {
    const exam = { exam_name: '期中考试', subjects: ['语文', '数学'] };

    expect(buildScoreTemplateCsv(exam)).toContain('学籍辅号,姓名,班级,语文,数学,参与统计,额外统计班级');

    const csv = buildLocalExamScoresCsv({ exam, scores: [scores[0]] });
    expect(csv).toContain('"学籍辅号","姓名","班级","考号","语文","数学","总分","参与统计","备注"');
    expect(csv).toContain('"S001","张三","701班","001","88","90","178","是",""');
  });

  it('calculates overview and per-exam valid count from backend or local rows', () => {
    const overview = calculateExamOverview({
      exams,
      examScores: scores,
      now: new Date('2026-06-19T00:00:00'),
    });

    expect(overview).toEqual({
      totalExams: 3,
      completedExams: 1,
      validStudents: 2,
      thisMonthExams: 2,
    });
    expect(getExamValidStudentCount({ exam: exams[0], scores })).toBe(2);
    expect(getExamValidStudentCount({ exam: exams[2], scores })).toBe(0);
  });

  it('calculates grade class list and class stats', () => {
    const classes = [{ id: 701 }, { id: 702 }, { id: 801 }];
    const selectedExam = { id: 3, grade_level: '7年级' };

    expect(getGradeClassesForExam({ exam: selectedExam, classes }).map(item => item.id)).toEqual([701, 702]);

    const stats = calculateClassStats({
      selectedExam,
      examScores: scores,
      classes,
    });

    expect(stats).toHaveLength(2);
    expect(stats[0]).toMatchObject({
      class_no: 2,
      student_count: 1,
      avg_score: '187.0',
      rank: 1,
      top20_rate: 100,
    });
    expect(stats[1]).toMatchObject({
      class_no: 1,
      avg_score: '178.0',
      rank: 2,
    });
  });
});
