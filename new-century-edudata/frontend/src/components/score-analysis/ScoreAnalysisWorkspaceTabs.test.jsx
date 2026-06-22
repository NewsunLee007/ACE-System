import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ScoreAnalysisWorkspaceTabs from './ScoreAnalysisWorkspaceTabs';

describe('ScoreAnalysisWorkspaceTabs', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('keeps report workflow collapsed before analysis is generated', () => {
    const onValueChange = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisWorkspaceTabs
          value="z-value"
          onValueChange={onValueChange}
          selectedExam={{ id: 1, exam_name: '期中考试', subjects: ['语文', '数学'] }}
          onImportSuccess={jest.fn()}
          analysisResult={null}
          renderAnalysisResult={() => <div>暂无分析结果</div>}
          examScores={[]}
          allScopeExamScores={[]}
          taggedExamScores={[]}
          classLayers={[]}
          teachingScore={null}
          renderToolEmpty={jest.fn()}
          onTeachingScoreTab={jest.fn()}
        />
      );
    });

    expect(container.textContent).toContain('专项结果待生成');
    expect(container.textContent).toContain('进入原始数据核对');
    expect(container.textContent).not.toContain('专项工作流');
    expect(container.textContent).not.toContain('综合报告结果');
    expect(container.textContent).not.toContain('报告阅读流程');
    expect(container.textContent).not.toContain('暂无分析结果');

    const rawButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('进入原始数据核对'));
    act(() => {
      rawButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onValueChange).toHaveBeenCalledWith('raw-data');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('opens raw data workspace before analysis when requested', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisWorkspaceTabs
          value="raw-data"
          onValueChange={jest.fn()}
          selectedExam={{ id: 1, exam_name: '期中考试', subjects: ['语文', '数学'] }}
          onImportSuccess={jest.fn()}
          analysisResult={null}
          renderAnalysisResult={() => <div>暂无分析结果</div>}
          examScores={[]}
          allScopeExamScores={[]}
          taggedExamScores={[]}
          classLayers={[]}
          teachingScore={null}
          renderToolEmpty={jest.fn()}
          onTeachingScoreTab={jest.fn()}
        />
      );
    });

    expect(container.textContent).toContain('数据核对工作台');
    expect(container.textContent).toContain('当前：数据来源');
    expect(container.textContent).not.toContain('专项结果待生成');
    expect(container.textContent).not.toContain('专项工作流');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders workspace tabs and forwards teaching score tab clicks', () => {
    const onTeachingScoreTab = jest.fn();
    const renderToolEmpty = jest.fn((title) => <div>{title}</div>);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisWorkspaceTabs
          value="teaching-score"
          onValueChange={jest.fn()}
          selectedExam={{ id: 1, exam_name: '期中考试', subjects: ['语文', '数学'] }}
          onImportSuccess={jest.fn()}
          analysisResult={{ analysis_id: 'A1' }}
          renderAnalysisResult={() => <div>暂无分析</div>}
          examScores={[]}
          allScopeExamScores={[]}
          taggedExamScores={[]}
          classLayers={[]}
          teachingScore={null}
          renderToolEmpty={renderToolEmpty}
          onTeachingScoreTab={onTeachingScoreTab}
        />
      );
    });

    expect(container.textContent).toContain('专项结果');
    expect(container.textContent).toContain('当前显示：教学积分');
    expect(container.textContent).toContain('原始数据');
    expect(container.textContent).toContain('综合报告');
    expect(container.textContent).toContain('三率一分');
    expect(container.textContent).toContain('暂无可计算的教学积分数据');

    const teachingScoreTab = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('教学积分'));
    act(() => {
      teachingScoreTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onTeachingScoreTab).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('switches comprehensive report result modules with direct controls', () => {
    const renderToolEmpty = jest.fn((title) => <div>{title}</div>);
    const examScores = [
      {
        id: 1,
        student_id: 1,
        student_name: '学生甲',
        class_id: 701,
        class_name: '701班',
        total_score: 520,
        scores: { 语文: 100, 数学: 105 },
        is_valid: true,
      },
      {
        id: 2,
        student_id: 2,
        student_name: '学生乙',
        class_id: 702,
        class_name: '702班',
        total_score: 500,
        scores: { 语文: 96, 数学: 99 },
        is_valid: true,
      },
    ];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisWorkspaceTabs
          value="z-value"
          onValueChange={jest.fn()}
          selectedExam={{ id: 1, exam_name: '期中考试', subjects: ['语文', '数学'] }}
          onImportSuccess={jest.fn()}
          analysisResult={{ analysis_id: 'A1' }}
          renderAnalysisResult={() => <div>综合概览内容</div>}
          examScores={examScores}
          allScopeExamScores={examScores}
          taggedExamScores={examScores}
          classLayers={[
            { class_id: 701, class_name: '701班', layer_code: 'A' },
            { class_id: 702, class_name: '702班', layer_code: 'B' },
          ]}
          teachingScore={null}
          renderToolEmpty={renderToolEmpty}
          onTeachingScoreTab={jest.fn()}
        />
      );
    });

    expect(container.textContent).toContain('综合报告结果');
    expect(container.textContent).toContain('当前：综合概览');
    expect(container.textContent).toContain('综合概览内容');
    expect(container.textContent).toContain('全面铺开');
    expect(container.textContent).not.toContain('报告阅读流程');

    const thresholdButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('学科临界分'));
    act(() => {
      thresholdButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：学科临界分');
    expect(container.textContent).not.toContain('综合概览内容');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
