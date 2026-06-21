import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ACriticalStudents, { buildACriticalStudents } from './ACriticalStudents';

const renderComponent = (props) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ACriticalStudents {...props} />);
  });

  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const findButton = (container, label) => {
  const button = Array.from(container.querySelectorAll('button'))
    .find(item => item.textContent.includes(label));
  expect(button).toBeTruthy();
  return button;
};

const clickButton = (container, label) => {
  const button = findButton(container, label);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return button;
};

describe('buildACriticalStudents', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    window.localStorage?.removeItem('scoreAnalysis.aCritical.targetCount');
  });

  it('uses the A layer quota to set the cutoff and selects the next ranked students below it', () => {
    const result = buildACriticalStudents({
      targetCount: 2,
      classLayers: [
        { class_id: 701, class_name: '701班', layer_code: 'A' },
        { class_id: 702, class_name: '702班', layer_code: 'B' },
        { class_id: 703, class_name: '703班', layer_code: 'C' }
      ],
      examScores: [
        { student_id: 'S1', student_name: '甲', class_id: 701, total_score: 520, scores: { 语文: 100 } },
        { student_id: 'S2', student_name: '乙', class_id: 701, total_score: 500, scores: { 语文: 96 } },
        { student_id: 'S3', student_name: '丙', class_id: 702, total_score: 492, scores: { 语文: 94 } },
        { student_id: 'S4', student_name: '丁', class_id: 703, total_score: 486, scores: { 语文: 92 } },
        { student_id: 'S5', student_name: '戊', class_id: 702, total_score: 480, scores: { 语文: 90 } }
      ]
    });

    expect(result.aLayerCount).toBe(2);
    expect(result.aCutoffRank).toBe(2);
    expect(result.aCutoffScore).toBe(500);
    expect(result.selectedStudents.map(student => student.student_id)).toEqual(['S3', 'S4']);
    expect(result.selectedStudents.map(student => student.gapToACutoff)).toEqual([8, 14]);
    expect(result.lowerBoundary).toBe(486);
  });

  it('excludes invalid scores and students tied exactly on the A layer cutoff', () => {
    const result = buildACriticalStudents({
      targetCount: 3,
      classLayers: [
        { class_id: 701, class_name: '701班', layer_code: 'A' },
        { class_id: 702, class_name: '702班', layer_code: 'B' }
      ],
      examScores: [
        { student_id: 'S1', class_id: 701, total_score: 500 },
        { student_id: 'S2', class_id: 702, total_score: 500 },
        { student_id: 'S3', class_id: 702, total_score: 499 },
        { student_id: 'S4', class_id: 702, total_score: 498, is_valid: false },
        { student_id: 'S5', class_id: 702, total_score: 497 }
      ]
    });

    expect(result.aCutoffScore).toBe(500);
    expect(result.selectedStudents.map(student => student.student_id)).toEqual(['S3', 'S5']);
  });

  it('honors the manually requested count instead of using a fixed score gap', () => {
    const result = buildACriticalStudents({
      targetCount: 1,
      classLayers: [
        { class_id: 701, class_name: '701班', layer_code: 'A' },
        { class_id: 702, class_name: '702班', layer_code: 'B' }
      ],
      examScores: [
        { student_id: 'S1', class_id: 701, total_score: 530 },
        { student_id: 'S2', class_id: 701, total_score: 510 },
        { student_id: 'S3', class_id: 702, total_score: 509 },
        { student_id: 'S4', class_id: 702, total_score: 450 },
        { student_id: 'S5', class_id: 702, total_score: 420 }
      ]
    });

    expect(result.aCutoffScore).toBe(510);
    expect(result.availableCandidateCount).toBe(3);
    expect(result.selectedStudents.map(student => student.student_id)).toEqual(['S3']);
    expect(result.lowerBoundary).toBe(509);
  });

  it('matches class layers by class name when imported scores do not carry class_id', () => {
    const result = buildACriticalStudents({
      targetCount: 2,
      classLayers: [
        { class_name: '701班', layer_code: 'A' },
        { class_name: '702班', layer_code: 'B' }
      ],
      examScores: [
        { student_id: 'S1', class_name: '701班', total_score: 520 },
        { student_id: 'S2', class_name: '701班', total_score: 500 },
        { student_id: 'S3', class_name: '702班', total_score: 498 },
        { student_id: 'S4', class_name: '702班', total_score: 496 }
      ]
    });

    expect(result.aLayerCount).toBe(2);
    expect(result.selectedStudents.map(student => student.student_id)).toEqual(['S3', 'S4']);
    expect(result.selectedStudents.every(student => student.layerCode === 'B')).toBe(true);
  });

  it('keeps tied total scores on the same grade rank while still taking the requested number of rows', () => {
    const result = buildACriticalStudents({
      targetCount: 2,
      classLayers: [
        { class_id: 701, layer_code: 'A' },
        { class_id: 702, layer_code: 'B' }
      ],
      examScores: [
        { student_id: 'S1', class_id: 701, total_score: 530 },
        { student_id: 'S2', class_id: 701, total_score: 520 },
        { student_id: 'S3', class_id: 702, total_score: 510 },
        { student_id: 'S4', class_id: 702, total_score: 510 },
        { student_id: 'S5', class_id: 702, total_score: 500 }
      ]
    });

    expect(result.selectedStudents.map(student => student.student_id)).toEqual(['S3', 'S4']);
    expect(result.selectedStudents.map(student => student.gradeRank)).toEqual([3, 3]);
  });

  it('shows A critical results directly and switches result views with simple controls', () => {
    const { container, cleanup } = renderComponent({
      targetCount: 30,
      classLayers: [
        { class_id: 701, class_name: '701班', layer_code: 'A' },
        { class_id: 702, class_name: '702班', layer_code: 'B' },
        { class_id: 703, class_name: '703班', layer_code: 'C' }
      ],
      examScores: [
        { student_id: 'S1', student_name: '甲', class_id: 701, total_score: 520, scores: { 语文: 100 } },
        { student_id: 'S2', student_name: '乙', class_id: 701, total_score: 500, scores: { 语文: 96 } },
        { student_id: 'S3', student_name: '丙', class_id: 702, total_score: 492, scores: { 语文: 94 } },
        { student_id: 'S4', student_name: '丁', class_id: 703, total_score: 486, scores: { 语文: 92 } },
        { student_id: 'S5', student_name: '戊', class_id: 702, total_score: 480, scores: { 语文: 90 } }
      ]
    });

    expect(container.textContent).toContain('A层临界生结果');
    expect(container.textContent).toContain('生成口径');
    expect(container.textContent).toContain('当前：名单结果');
    expect(container.textContent).toContain('名单结果');
    expect(container.textContent).toContain('班级分布');
    expect(container.textContent).toContain('全面铺开');
    expect(container.textContent).toContain('最接近A层线学生');
    expect(container.textContent).toContain('班级集中 Top5');
    expect(container.textContent).toContain('年级名次');
    expect(container.textContent).toContain('距A层线');
    expect(container.textContent).not.toContain('下一步');
    expect(container.textContent).not.toContain('完成上一步后开放');
    expect(container.textContent).not.toContain('操作流程');

    clickButton(container, '班级分布');

    expect(container.textContent).toContain('当前：班级分布');
    expect(container.textContent).toContain('班级人数分布');
    expect(container.textContent).toContain('班级明细表');
    expect(container.textContent).toContain('分数区间');
    expect(container.textContent).not.toContain('最接近A层线学生');

    clickButton(container, '全面铺开');

    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('最接近A层线学生');
    expect(container.textContent).toContain('年级名次');
    expect(container.textContent).toContain('班级人数分布');
    expect(container.textContent).toContain('班级明细表');

    cleanup();
  });
});
