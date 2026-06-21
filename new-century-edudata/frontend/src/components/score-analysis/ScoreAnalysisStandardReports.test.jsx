import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ScoreAnalysisStandardReport, {
  OverallAnalysisReport,
  StudentProgressReport,
} from './ScoreAnalysisStandardReports';

const clickButton = (container, label) => {
  const button = Array.from(container.querySelectorAll('button'))
    .find(item => item.textContent.includes(label));
  expect(button).toBeTruthy();
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('ScoreAnalysisStandardReports', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('renders overall analysis summary and chart labels', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <OverallAnalysisReport
          data={{
            basic_statistics: { mean: 83.25, median: 84, std: 9.5, count: 120 },
            score_distribution: { excellent: 20, good: 40, pass: 50, fail: 10 },
            class_analysis: {
              '701班': { mean: 86.1, median: 87 },
              '702班': { mean: 80.2, median: 81 },
            },
          }}
        />
      );
    });

    expect(container.textContent).toContain('整体分析结果台');
    expect(container.textContent).toContain('标准报告结果控件');
    expect(container.textContent).toContain('当前：概览指标');
    expect(container.textContent).toContain('平均分');
    expect(container.textContent).toContain('83.3');
    expect(container.textContent).not.toContain('班级平均分对比');

    clickButton(container, '成绩分布');
    expect(container.textContent).toContain('当前：成绩分布');
    expect(container.textContent).toContain('成绩分布');
    expect(container.textContent).not.toContain('班级平均分对比');

    clickButton(container, '班级对比');
    expect(container.textContent).toContain('当前：班级对比');
    expect(container.textContent).toContain('班级平均分对比');

    clickButton(container, '全面铺开');
    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('平均分');
    expect(container.textContent).toContain('成绩分布');
    expect(container.textContent).toContain('班级平均分对比');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders student progress rows and empty messages', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <StudentProgressReport
          data={{
            current_exam: '期中考试',
            previous_exam: '第一次月考',
            improved_count: 8,
            declined_count: 3,
            unchanged_count: 2,
            top_improved: [{
              student_id: 1,
              student_name: '学生甲',
              previous_score: 70,
              current_score: 85,
              score_change: 15,
            }],
            top_declined: [{
              student_id: 2,
              student_name: '学生乙',
              previous_score: 90,
              current_score: 82,
              score_change: -8,
            }],
          }}
        />
      );
    });

    expect(container.textContent).toContain('学生进退步结果台');
    expect(container.textContent).toContain('标准报告结果控件');
    expect(container.textContent).toContain('当前：变化概览');
    expect(container.textContent).toContain('期中考试');
    expect(container.textContent).not.toContain('学生甲');

    clickButton(container, '进步名单');
    expect(container.textContent).toContain('当前：进步名单');
    expect(container.textContent).toContain('进步最大');
    expect(container.textContent).toContain('学生甲');
    expect(container.textContent).not.toContain('学生乙');

    clickButton(container, '关注名单');
    expect(container.textContent).toContain('当前：关注名单');
    expect(container.textContent).toContain('需要关注');
    expect(container.textContent).toContain('学生乙');

    clickButton(container, '全面铺开');
    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('变化概览');
    expect(container.textContent).toContain('学生甲');
    expect(container.textContent).toContain('学生乙');

    act(() => {
      root.render(<StudentProgressReport data={{ message: '暂无对比考试' }} />);
    });
    expect(container.textContent).toContain('暂无对比考试');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('dispatches standard report types through one entry point', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisStandardReport
          analysisType="subject_analysis"
          data={{
            subject_statistics: {
              语文: { mean: 82.2, median: 83, std: 8, max: 98, min: 50 },
            },
          }}
        />
      );
    });

    expect(container.textContent).toContain('学科');
    expect(container.textContent).toContain('语文');
    expect(container.textContent).toContain('当前：学科概览');
    expect(container.textContent).not.toContain('学科平均分对比');

    clickButton(container, '均分图');
    expect(container.textContent).toContain('学科平均分对比');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
