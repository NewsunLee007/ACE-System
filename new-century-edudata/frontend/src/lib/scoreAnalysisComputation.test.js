import {
  calcBasicStats,
  computeComprehensive,
  getSubjectFullScore,
  scopeKeyFromValue,
} from './scoreAnalysisComputation';

const exam = {
  id: 1,
  exam_name: '期中考试',
  grade_level: '7年级',
  subjects: ['语文', '科学'],
  subject_scores: {
    语文: 100,
    科学: 120,
  },
  full_score: 220,
};

const layers = [
  { class_id: 701, class_name: '701班', layer_code: 'A' },
  { class_id: 702, class_name: '702班', layer_code: 'B' },
  { class_id: 703, class_name: '703班', layer_code: 'C' },
];

const scores = [
  { exam_id: 1, student_id: 'S1', class_id: 701, total_score: 210, scores: { 语文: 95, 科学: 115 } },
  { exam_id: 1, student_id: 'S2', class_id: 701, total_score: 190, scores: { 语文: 85, 科学: 105 } },
  { exam_id: 1, student_id: 'S3', class_id: 702, total_score: 176, scores: { 语文: 80, 科学: 96 } },
  { exam_id: 1, student_id: 'S4', class_id: 703, total_score: 130, scores: { 语文: 55, 科学: 75 } },
  { exam_id: 1, student_id: 'S5', class_id: 703, total_score: 200, scores: { 语文: 92, 科学: 108 }, is_valid: false },
];

describe('scoreAnalysisComputation', () => {
  it('normalizes scope keys and calculates basic statistics', () => {
    expect(scopeKeyFromValue('all')).toBe('all');
    expect(scopeKeyFromValue('layer_b')).toBe('B');
    expect(scopeKeyFromValue('unknown')).toBe('all');

    const stats = calcBasicStats([1, 2, 3, 4]);
    expect(stats).toMatchObject({
      count: 4,
      mean: 2.5,
      median: 2.5,
      min: 1,
      max: 4,
    });
    expect(stats.std).toBeCloseTo(1.118, 3);
  });

  it('uses configured and observed subject full scores', () => {
    expect(getSubjectFullScore(exam, '科学', scores)).toBe(120);
    expect(getSubjectFullScore({}, '科学', scores)).toBe(120);
    expect(getSubjectFullScore({}, '物理', [{ scores: { 物理: 135 } }])).toBe(160);
    expect(getSubjectFullScore({}, '英语', [])).toBe(100);
  });

  it('computes comprehensive score scopes with full-score proportional grade lines', () => {
    const result = computeComprehensive({
      exam,
      gradeLevel: '7年级',
      allScores: scores,
      layersForGrade: layers,
      formatClassName: classId => `七${String(classId).slice(-2)}班`,
    });

    expect(result.analysis_type).toBe('comprehensive');
    expect(result.scopes.all.summary.total_students).toBe(5);
    expect(result.scopes.all.summary.participated).toBe(4);
    expect(result.scopes.all.overall.distribution).toEqual({
      excellent: 1,
      good: 2,
      pass: 0,
      fail: 1,
    });
    expect(result.scopes.all.overall.chart_data.score_distribution[0].range).toBe('A等 198-220');
    expect(result.scopes.all.key_metrics.subjects.科学.full_score).toBe(120);
    expect(result.scopes.all.subject_analysis.subject_statistics.科学.pass_rate).toBe(100);
    expect(result.scopes.all.subject_analysis.subject_statistics.科学.excellent_rate).toBe(25);
    expect(result.scopes.A.subject_analysis.subject_statistics.语文.range_mean).toBe(78.75);
    expect(result.scopes.A.subject_analysis.subject_statistics.语文.range_diff).toBeCloseTo(11.25);

    expect(result.scopes.A.summary.participated).toBe(2);
    expect(result.scopes.B.summary.grade_mean).toBe(176);
    expect(result.scopes.C.summary.total_students).toBe(2);
    expect(result.scopes.C.summary.participated).toBe(1);
    expect(result._tagged_scores.find(score => score.student_id === 'S3')._layer).toBe('B');
  });

  it('includes teaching score rows without changing ranking grain', () => {
    const result = computeComprehensive({
      exam,
      gradeLevel: '7年级',
      allScores: scores,
      layersForGrade: layers,
      formatClassName: classId => `七${String(classId).slice(-2)}班`,
    });
    const teachingScore = result.scopes.all.teaching_score;

    expect(teachingScore.subjects).toEqual(['语文', '科学']);
    expect(teachingScore.full_scores).toEqual({ 语文: 100, 科学: 120 });
    expect(teachingScore.class_rows).toHaveLength(3);
    expect(teachingScore.class_rows[0]).toMatchObject({
      class_id: 701,
      class_name: '701班',
      layer_code: 'A',
      rank: 1,
      valid_subject_count: 2,
    });
    expect(teachingScore.class_rows[0].range_mean_diff).toBeCloseTo(23.5);
    expect(teachingScore.class_rows[0].same_layer_diff).toBe(0);
    expect(teachingScore.class_rows[0].subject_metrics.科学.reference_count).toBe(2);
    expect(teachingScore.summary.ranked_count).toBe(3);
  });
});
