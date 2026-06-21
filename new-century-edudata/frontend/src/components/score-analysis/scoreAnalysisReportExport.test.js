import {
  buildComprehensiveReportHtml,
  buildHistoryTrendReportHtml,
  escapeHtml,
  formatReportNumber,
} from './scoreAnalysisReportExport';

describe('scoreAnalysisReportExport', () => {
  it('formats numbers and escapes report text', () => {
    expect(formatReportNumber(82.345)).toBe('82.3');
    expect(formatReportNumber('82')).toBe('0.0');
    expect(escapeHtml('<期中&考试>"')).toBe('&lt;期中&amp;考试&gt;&quot;');
  });

  it('builds a comprehensive report with escaped exam and subject labels', () => {
    const html = buildComprehensiveReportHtml({
      analysisResult: {
        exam_name: '<期中&考试>',
        grade_level: '7年级',
        created_at: '2026-06-18T08:00:00Z',
        scopes: {
          all: {
            summary: {
              participated: 3,
              total_students: 4,
              grade_mean: 82.35,
              grade_std: 8.2,
            },
            key_metrics: {
              total: {
                standard_score: 500,
                top20_score: 96,
                top40_score: 88,
                top80_score: 60,
                z_score: 0.35,
                max: 98,
                mean: 82.35,
                full_score: 300,
              },
              subjects: {
                '<语文>': {
                  max: 98,
                  top20_score: 95,
                  mean: 84,
                  full_score: 100,
                },
              },
              rank_bands: {
                total: [
                  { rank: 1, score: 98 },
                  { rank: 2, score: 92 },
                ],
              },
            },
            subject_analysis: {
              subject_statistics: {
                '<语文>': { mean: 84, std: 5.2 },
              },
            },
            overall: {
              chart_data: {
                score_distribution: [
                  { range: 'A等 270-300', count: 1, percentage: 33.333 },
                ],
              },
            },
          },
        },
      },
      selectedExam: {
        subjects: ['<语文>'],
      },
      scopeKey: 'all',
      scopeLabel: '全段',
    });

    expect(html).toContain('&lt;期中&amp;考试&gt; · 成绩分析报告');
    expect(html).toContain('&lt;语文&gt;');
    expect(html).toContain('参与人数 3/4');
    expect(html).toContain('总分排名分数段');
  });

  it('builds a multi-exam history trend report', () => {
    const html = buildHistoryTrendReportHtml({
      selectedGrade: '7年级',
      scopeLabel: '全段',
      trendModel: {
        trendRows: [
          { label: '第一次月考', participated: 90, mean: 78, std: 8, zScore: 0.1, passRate: 88, aRate: 20, bRate: 30, cRate: 38, dRate: 12, dCount: 11 },
          { label: '期中考试', participated: 92, mean: 81, std: 7, zScore: 0.3, passRate: 90, aRate: 22, bRate: 32, cRate: 36, dRate: 10, dCount: 9 },
          { label: '第二次月考', participated: 91, mean: 84, std: 6, zScore: 0.5, passRate: 93, aRate: 25, bRate: 34, cRate: 34, dRate: 7, dCount: 6 },
        ],
        baseline: { mean: 78, dRate: 12, zScore: 0.1 },
        previous: { mean: 81 },
        latest: { label: '第二次月考', mean: 84, dRate: 7, zScore: 0.5, participated: 91 },
        subjectMatrix: [
          { subject: '语文', baseline: 79, latest: 83, delta: 4 },
          { subject: '数学', baseline: 76, latest: 85, delta: 9 },
        ],
      },
    });

    expect(html).toContain('历史趋势报告');
    expect(html).toContain('考试次数');
    expect(html).toContain('第一次月考');
    expect(html).toContain('期中考试');
    expect(html).toContain('第二次月考');
    expect(html).toContain('学科均分变化矩阵');
    expect(html).toContain('+9.0');
  });
});
