import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ScoreAnalysisComprehensiveKeyMetrics, { buildRankCurveData } from './ScoreAnalysisComprehensiveKeyMetrics';

const findButton = (container, label, { enabledOnly = false } = {}) => Array.from(container.querySelectorAll('button'))
  .find(button => button.textContent.includes(label) && (!enabledOnly || !button.disabled));

const baseProps = {
  data: {
    exam_name: '期中考试',
    grade_level: '7年级',
    created_at: '2026-06-18T08:00:00Z',
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
      standard_score: 500,
      top20_rank: 1,
      top20_score: 98,
      top40_score: 91,
      top80_score: 70,
      z_score: 0.35,
      max: 98,
      mean: 82.35,
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
      total: [
        { rank: 1, score: 98 },
        { rank: 2, score: 92 },
      ],
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
};

describe('ScoreAnalysisComprehensiveKeyMetrics', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('samples rank curve data while keeping the final rank', () => {
    const scores = Array.from({ length: 205 }, (_, index) => 300 - index);
    const rows = buildRankCurveData(scores);

    expect(rows[0]).toEqual({ rank: 1, score: 300 });
    expect(rows[rows.length - 1]).toEqual({ rank: 205, score: 96 });
  });

  it('renders summary metrics and switches to the rank band panel', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ScoreAnalysisComprehensiveKeyMetrics {...baseProps} />);
    });

    expect(container.textContent).toContain('期中考试 - 综合分析报告');
    expect(container.textContent).toContain('核心指标结果台');
    expect(container.textContent).toContain('核心指标结果控件');
    expect(container.textContent).toContain('当前：报告摘要');
    expect(container.textContent).toContain('年级平均分');
    expect(container.textContent).toContain('82.3');
    expect(container.textContent).not.toContain('最高分');
    expect(container.textContent).not.toContain('总分名次-分数曲线');
    expect(findButton(container, '4 个指标板块').disabled).toBe(true);

    const thresholdButton = findButton(container, '阈值定位', { enabledOnly: true });
    act(() => {
      thresholdButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：阈值定位');
    expect(container.textContent).toContain('标准分');
    expect(findButton(container, '4 个指标板块').disabled).toBe(true);

    const subjectButton = findButton(container, '学科数值表', { enabledOnly: true });
    act(() => {
      subjectButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：学科数值表');
    expect(container.textContent).toContain('最高分');
    expect(container.textContent).toContain('优秀分（前20%分数线）');
    expect(findButton(container, '4 个指标板块').disabled).toBe(true);

    const rankButton = findButton(container, '总分名次分数段', { enabledOnly: true });
    act(() => {
      rankButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：总分名次分数段');
    expect(container.textContent).toContain('名次工具结果控件');
    expect(container.textContent).toContain('当前：名次定位');
    expect(container.textContent).toContain('对应总分');
    expect(container.textContent).not.toContain('总分名次-分数曲线');
    expect(container.textContent).not.toContain('总分排名分数段');
    expect(findButton(container, '4 个指标板块').disabled).toBe(false);
    expect(findButton(container, '定位、曲线和表格同屏').disabled).toBe(true);

    const curveButton = findButton(container, '曲线图', { enabledOnly: true });
    act(() => {
      curveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：曲线图');
    expect(container.textContent).toContain('总分名次-分数曲线');
    expect(container.textContent).not.toContain('总分排名分数段');
    expect(findButton(container, '定位、曲线和表格同屏').disabled).toBe(true);

    const bandButton = findButton(container, '分数段表', { enabledOnly: true });
    act(() => {
      bandButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：分数段表');
    expect(container.textContent).not.toContain('总分名次-分数曲线');
    expect(container.textContent).toContain('总分排名分数段');
    expect(findButton(container, '定位、曲线和表格同屏').disabled).toBe(false);

    const innerAllButton = findButton(container, '定位、曲线和表格同屏', { enabledOnly: true });
    act(() => {
      innerAllButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('对应总分');
    expect(container.textContent).toContain('总分名次-分数曲线');
    expect(container.textContent).toContain('总分排名分数段');

    const allButton = findButton(container, '4 个指标板块', { enabledOnly: true });
    act(() => {
      allButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('年级平均分');
    expect(container.textContent).toContain('标准分');
    expect(container.textContent).toContain('最高分');
    expect(container.textContent).toContain('总分名次-分数曲线');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
