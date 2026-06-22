import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ScoreAnalysisComprehensiveFocus, { getInitialComprehensiveFocus } from './ScoreAnalysisComprehensiveFocus';

const baseProps = {
  data: {
    analysis_id: 'A1',
    exam_name: '期末考试',
    grade_level: '7年级',
    created_at: '2026-06-18T08:00:00Z',
    scopes: {},
  },
  scopeKey: 'all',
  summary: {
    grade_mean: 82.35,
    grade_std: 8.2,
    participated: 5,
    total_students: 6,
  },
  keyMetrics: {
    total: {
      z_score: 0.35,
      standard_score: 500,
      top20_rank: 1,
      top20_score: 98,
      top40_score: 91,
      top80_score: 70,
      mean: 82.35,
      max: 98,
      full_score: 500,
    },
    subjects: {
      语文: {
        max: 98,
        top20_score: 95,
        mean: 84,
        full_score: 100,
      },
    },
    rank_bands: {
      total: [{ rank: 1, score: 98 }],
    },
  },
  examScores: [
    { total_score: 98 },
    { total_score: 92 },
    { total_score: 85 },
    { total_score: 76 },
    { total_score: 60 },
  ],
  selectedExam: {
    subjects: ['语文'],
  },
  layerComparison: {
    layer_statistics: {
      A: {},
    },
    chart_data: {
      class_comparison: [
        { class: '701班', mean: 85, layer: 'A' },
      ],
    },
  },
  subjectAnalysis: {
    subject_statistics: {
      语文: { mean: 84, std: 5, pass_rate: 95 },
    },
    chart_data: {
      subject_scores: [{ subject: '语文', mean: 84 }],
    },
  },
  overall: {
    distribution: {
      excellent: 1,
      good: 2,
      pass: 2,
      fail: 0,
    },
    chart_data: {
      score_distribution: [{ range: '80-90', count: 3 }],
    },
  },
  teachingScore: {
    subjects: ['语文'],
    full_scores: { 语文: 100 },
    thresholds: { 语文: { excellent: 90, good: 80, pass: 60 } },
    benchmarks: { 语文: { max_converted_mean: 88, max_excellent_rate: 40, max_good_rate: 70, max_pass_rate: 95 } },
    summary: {
      ranked_count: 1,
      average_score: 61.235,
      top_class: { class_name: '701班', comprehensive_score: 61.235 },
    },
    class_rows: [
      {
        class_id: 701,
        class_name: '701班',
        layer_code: 'A',
        rank: 1,
        comprehensive_score: 61.235,
        valid_subject_count: 1,
        subject_metrics: {
          语文: {
            mean: 88,
            excellent_rate: 40,
            good_rate: 70,
            pass_rate: 95,
            total_points: 61.235,
          },
        },
      },
    ],
  },
};

describe('ScoreAnalysisComprehensiveFocus', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('chooses an initial focus from the analysis type', () => {
    expect(getInitialComprehensiveFocus('overall')).toBe('metrics');
    expect(getInitialComprehensiveFocus('subject_analysis')).toBe('judgement');
    expect(getInitialComprehensiveFocus('teaching_score')).toBe('teaching');
  });

  it('shows one comprehensive focus at a time and switches on demand', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ScoreAnalysisComprehensiveFocus {...baseProps} analysisType="overall" />);
    });

    expect(container.textContent).toContain('综合概览焦点');
    expect(container.textContent).toContain('综合焦点结果控件');
    expect(container.textContent).toContain('当前：核心指标');
    expect(container.textContent).toContain('核心指标结果台');
    expect(container.textContent).not.toContain('综合研判结果显示');
    expect(container.textContent).not.toContain('教学积分结果台');

    const judgementButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('综合研判'));
    act(() => {
      judgementButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：综合研判');
    expect(container.textContent).toContain('综合研判结果显示');
    expect(container.textContent).not.toContain('核心指标结果台');

    const allButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('全面铺开'));
    act(() => {
      allButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('核心指标结果台');
    expect(container.textContent).toContain('综合研判结果显示');
    expect(container.textContent).toContain('教学积分结果台');

    act(() => {
      root.render(<ScoreAnalysisComprehensiveFocus {...baseProps} analysisType="teaching_score" />);
    });

    expect(container.textContent).toContain('当前：教学积分');
    expect(container.textContent).toContain('教学积分结果台');
    expect(container.textContent).not.toContain('综合研判结果显示');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
