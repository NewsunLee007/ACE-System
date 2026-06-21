import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ScoreAnalysisTeachingScore, { buildTeachingScoreSummaryModel } from './ScoreAnalysisTeachingScore';

const findButton = (container, label, { enabledOnly = false } = {}) => Array.from(container.querySelectorAll('button'))
  .find(button => button.textContent.includes(label) && (!enabledOnly || !button.disabled));
const getHeaders = (container) => Array.from(container.querySelectorAll('th')).map(th => th.textContent.trim());

describe('ScoreAnalysisTeachingScore', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('renders the empty state when teaching score data is unavailable', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ScoreAnalysisTeachingScore teachingScore={null} />);
    });

    expect(container.textContent).toContain('暂无可计算的教学积分数据');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('builds a teaching score model for summary-first reading', () => {
    const teachingScore = {
      subjects: ['语文'],
      summary: {
        ranked_count: 3,
        average_score: 54.125,
        top_class: { class_name: '701班', comprehensive_score: 61.235 },
      },
      class_rows: [
        { class_id: 701, class_name: '701班', rank: 1, comprehensive_score: 61.235 },
        { class_id: 702, class_name: '702班', rank: 2, comprehensive_score: 58.2 },
        { class_id: 703, class_name: '703班', rank: 3, comprehensive_score: 50.1 },
      ],
    };

    const model = buildTeachingScoreSummaryModel(teachingScore);

    expect(model.rankedCount).toBe(3);
    expect(model.subjectCount).toBe(1);
    expect(model.topClass).toMatchObject({ class_name: '701班', comprehensive_score: 61.235 });
    expect(model.topGap).toBeCloseTo(3.035);
    expect(model.spread).toBeCloseTo(11.135);
    expect(model.attentionRows.map(row => row.class_name)).toEqual(['703班', '702班', '701班']);
  });

  it('renders one teaching-score module at a time', () => {
    const teachingScore = {
      subjects: ['语文'],
      full_scores: { 语文: 100 },
      thresholds: { 语文: { excellent: 90, good: 80, pass: 60 } },
      benchmarks: { 语文: { max_converted_mean: 88.2, max_excellent_rate: 42.5, max_good_rate: 70.1, max_pass_rate: 93.6 } },
      summary: {
        ranked_count: 2,
        average_score: 54.125,
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
              mean: 88.2,
              excellent_rate: 42.5,
              good_rate: 70.1,
              pass_rate: 93.6,
              total_points: 61.235,
            },
          },
        },
      ],
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ScoreAnalysisTeachingScore teachingScore={teachingScore} />);
    });

    expect(container.textContent).toContain('参与班级');
    expect(container.textContent).toContain('最高综合积分');
    expect(container.textContent).toContain('61.23');
    expect(container.textContent).toContain('教学积分结果控件');
    expect(container.textContent).toContain('当前：积分摘要');
    expect(container.textContent).toContain('教务研判路径');
    expect(container.textContent).toContain('第一梯队 Top5');
    expect(container.textContent).not.toContain('教学积分综合排名');
    expect(container.textContent).not.toContain('积分排名阅读流程');
    expect(container.textContent).not.toContain('单科积分明细');
    expect(container.textContent).not.toContain('年级最高班基准');
    expect(getHeaders(container)).toEqual([]);
    expect(findButton(container, '4 个积分板块').disabled).toBe(false);

    const rankingButton = findButton(container, '进入排名概览', { enabledOnly: true });
    act(() => {
      rankingButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：排名概览');
    expect(container.textContent).toContain('积分排名结果控件');
    expect(container.textContent).toContain('当前：前列概览');
    expect(container.textContent).toContain('教学积分综合排名');
    expect(container.textContent).toContain('第一梯队');
    expect(findButton(container, '概览和排名同时查看').disabled).toBe(false);

    const fullRankingButton = findButton(container, '查看完整排名', { enabledOnly: true });
    act(() => {
      fullRankingButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：完整排名');
    expect(container.textContent).toContain('完整班级排名');
    expect(getHeaders(container)).toEqual([
      '排名',
      '班级',
      '层次',
      '综合积分',
      '有效科目',
    ]);
    expect(findButton(container, '概览和排名同时查看').disabled).toBe(false);

    const detailButton = findButton(container, '单科明细', { enabledOnly: true });
    act(() => {
      detailButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('单科积分明细');
    expect(container.textContent).toContain('满分100.0 / A≥90.0 / B≥80.0 / C≥60.0');
    expect(findButton(container, '4 个积分板块').disabled).toBe(false);

    const benchmarkButton = findButton(container, '基准口径', { enabledOnly: true });
    act(() => {
      benchmarkButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('年级最高班基准');
    expect(container.textContent).not.toContain('单科积分明细');
    expect(findButton(container, '4 个积分板块').disabled).toBe(false);

    const allButton = findButton(container, '全面铺开', { enabledOnly: true });
    act(() => {
      allButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('教学积分综合排名');
    expect(container.textContent).toContain('完整班级排名');
    expect(container.textContent).toContain('单科积分明细');
    expect(container.textContent).toContain('年级最高班基准');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
