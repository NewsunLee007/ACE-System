import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import schoolData from '../../data/schoolData';
import ScoreAnalysisHistoryTrend, { buildHistoryTrendModel } from './ScoreAnalysisHistoryTrend';

const exams = [
  { id: 1, grade_level: '7年级', exam_name: '第一次月考', subjects: ['语文', '数学'] },
  { id: 2, grade_level: '7年级', exam_name: '期中考试', subjects: ['语文', '数学'] },
  { id: 3, grade_level: '8年级', exam_name: '八年级期中', subjects: ['语文'] },
];

const makeResult = ({ exam }) => ({
  scopes: {
    all: {
      summary: {
        participated: 10,
        grade_mean: exam.id === 1 ? 82 : 88,
        grade_std: 8,
        pass_rate: exam.id === 1 ? 80 : 90,
      },
      overall: {
        distribution: {
          excellent: exam.id === 1 ? 2 : 4,
          good: 3,
          pass: 4,
          fail: exam.id === 1 ? 1 : 0,
        },
      },
      key_metrics: {
        total: { z_score: exam.id === 1 ? 0.1 : 0.4 },
        subjects: {
          语文: { mean: exam.id === 1 ? 80 : 86 },
          数学: { mean: exam.id === 1 ? 84 : 90 },
        },
      },
    },
  },
});

const baseProps = {
  exams,
  selectedGrade: '7年级',
  normalizeClassLayers: (layers) => layers,
  computeComprehensive: makeResult,
  getExamOptionLabel: (exam) => exam.exam_name,
  scopeKeyFromValue: () => 'all',
};

const clickButton = (container, label) => {
  const button = Array.from(container.querySelectorAll('button')).find(item => item.textContent.includes(label));
  expect(button).toBeTruthy();
  act(() => {
    button.click();
  });
  return button;
};

describe('ScoreAnalysisHistoryTrend', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    schoolData.examScores = [{ exam_id: 1 }, { exam_id: 2 }];
    schoolData.classLayers = [];
  });

  it('builds trend rows and subject matrix with the existing comparison rules', () => {
    const model = buildHistoryTrendModel({
      ...baseProps,
      historyCompare: { scope: 'all', subject: '语文', examIds: [1, 2] },
      sourceExamScores: schoolData.examScores,
      sourceClassLayers: schoolData.classLayers,
    });

    expect(model.gradeExams).toHaveLength(2);
    expect(model.selectedIds).toEqual([1, 2]);
    expect(model.trendRows).toEqual([
      expect.objectContaining({ label: '第一次月考', mean: 82, passRate: 80, dRate: 10 }),
      expect.objectContaining({ label: '期中考试', mean: 88, passRate: 90, dRate: 0 }),
    ]);
    expect(model.subjectMatrix).toEqual([
      { subject: '语文', baseline: 80, latest: 86, delta: 6 },
    ]);
  });

  it('renders the trend workflow and forwards exam checkbox changes from setup', () => {
    const setHistoryCompare = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisHistoryTrend
          {...baseProps}
          historyCompare={{ scope: 'all', subject: 'all', examIds: [2] }}
          setHistoryCompare={setHistoryCompare}
        />
      );
    });

    expect(container.textContent).toContain('历史趋势工作台');
    expect(container.textContent).toContain('历史趋势结果控件');
    expect(container.textContent).toContain('当前：趋势概览');
    expect(container.textContent).toContain('考试次数');
    expect(container.textContent).not.toContain('学科均分变化矩阵');

    clickButton(container, '筛选设置');
    expect(container.textContent).toContain('当前：筛选设置');

    const firstCheckbox = container.querySelector('input[type="checkbox"]');
    expect(firstCheckbox).toBeTruthy();
    act(() => {
      firstCheckbox.click();
    });

    expect(setHistoryCompare).toHaveBeenCalledTimes(1);
    const updater = setHistoryCompare.mock.calls[0][0];
    const nextState = updater({ scope: 'all', subject: 'all', examIds: [2] });
    expect(nextState).toEqual(expect.objectContaining({
      scope: 'all',
      subject: 'all',
      examIds: expect.any(Array),
    }));

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps charts and subject matrix behind their workflow modules', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisHistoryTrend
          {...baseProps}
          historyCompare={{ scope: 'all', subject: 'all', examIds: [1, 2] }}
          setHistoryCompare={jest.fn()}
        />
      );
    });

    expect(container.textContent).not.toContain('多考试核心指标趋势');
    expect(container.textContent).not.toContain('学科均分变化矩阵');

    clickButton(container, '图表分析');
    expect(container.textContent).toContain('当前：图表分析');
    expect(container.textContent).toContain('趋势图表结果控件');
    expect(container.textContent).toContain('多考试核心指标趋势');
    expect(container.textContent).not.toContain('等级结构变化A等B等C等D等');

    clickButton(container, '等级结构变化');
    expect(container.textContent).toContain('等级结构变化');
    expect(container.textContent).not.toContain('多考试核心指标趋势');

    clickButton(container, '学科矩阵');
    expect(container.textContent).toContain('当前：学科矩阵');
    expect(container.textContent).toContain('学科均分变化矩阵');
    expect(container.textContent).toContain('基准均分');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps chart modes staged until chart-level all view is selected', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisHistoryTrend
          {...baseProps}
          historyCompare={{ scope: 'all', subject: 'all', examIds: [1, 2] }}
          setHistoryCompare={jest.fn()}
        />
      );
    });

    clickButton(container, '图表分析');
    expect(container.textContent).toContain('趋势图表结果控件');
    expect(container.textContent).toContain('当前：核心指标趋势');
    expect(container.textContent).toContain('多考试核心指标趋势');
    expect(Array.from(container.querySelectorAll('h3')).map(node => node.textContent)).not.toContain('等级结构变化');

    clickButton(container, '两类趋势同屏复核');
    expect(container.textContent).toContain('当前：全面铺开');
    expect(Array.from(container.querySelectorAll('h4')).map(node => node.textContent)).toEqual(
      expect.arrayContaining(['核心指标趋势', '等级结构变化'])
    );
    expect(Array.from(container.querySelectorAll('h3')).map(node => node.textContent)).toEqual(
      expect.arrayContaining(['多考试核心指标趋势', '等级结构变化'])
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
