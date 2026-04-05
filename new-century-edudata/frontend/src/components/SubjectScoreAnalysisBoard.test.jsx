import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import SubjectScoreAnalysisBoard from './SubjectScoreAnalysisBoard';

describe('SubjectScoreAnalysisBoard', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders title and subject tabs', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <SubjectScoreAnalysisBoard
          examData={{ exam_name: '2025-1 7年级期末统考', subjects: ['语文', '数学'] }}
          classLayers={[
            { class_id: 701, class_name: '701班', layer_code: 'A' },
            { class_id: 702, class_name: '702班', layer_code: 'B' }
          ]}
          allExamScores={[
            { class_id: 701, total_score: 480, scores: { 语文: 90, 数学: 95 } },
            { class_id: 701, total_score: 440, scores: { 语文: 80, 数学: 88 } },
            { class_id: 702, total_score: 410, scores: { 语文: 76, 数学: 82 } },
            { class_id: 702, total_score: 0, scores: { 语文: 0, 数学: 0 } }
          ]}
        />
      );
    });

    expect(container.textContent).toContain('学科成绩分析');
    expect(container.textContent).toContain('语文');
    expect(container.textContent).toContain('数学');
    expect(container.textContent).toContain('总分（统计维度）');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
