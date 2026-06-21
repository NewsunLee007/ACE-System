import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ThreeRatesStats from './ThreeRatesStats';

const findButton = (container, label, { enabledOnly = false } = {}) => Array.from(container.querySelectorAll('button'))
  .find(button => button.textContent.includes(label) && (!enabledOnly || !button.disabled));
const getHeaders = (container) => Array.from(container.querySelectorAll('th')).map(th => th.textContent.trim());

describe('ThreeRatesStats', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders one selected subject instead of a full-width all-subject table', () => {
    const examData = {
      subject_scores: { 语文: 100, 数学: 100 },
    };
    const examScores = [
      { class_id: 701, is_valid: true, scores: { 语文: 90, 数学: 95 } },
      { class_id: 701, is_valid: true, scores: { 语文: 80, 数学: 85 } },
      { class_id: 702, is_valid: true, scores: { 语文: 70, 数学: 60 } },
    ];
    const classLayers = [
      { class_id: 701, class_name: '701班' },
      { class_id: 702, class_name: '702班' },
    ];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ThreeRatesStats
          examData={examData}
          examScores={examScores}
          allScopeExamScores={examScores}
          subjects={['语文', '数学']}
          classLayers={classLayers}
        />
      );
    });

    expect(container.textContent).toContain('三率一分结果台');
    expect(container.textContent).toContain('三率一分结果控件');
    expect(container.textContent).toContain('当前：语文 · 结构摘要');
    expect(container.textContent).toContain('语文关键班级提示');
    expect(container.textContent).toContain('需关注班级');
    expect(getHeaders(container)).toEqual([]);
    expect(findButton(container, '当前学科摘要与明细同屏').disabled).toBe(false);

    const detailButton = findButton(container, '查看班级明细', { enabledOnly: true });
    act(() => {
      detailButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：语文 · 班级明细');
    expect(getHeaders(container)).toEqual([
      '班级',
      '平均分',
      'A等率',
      'B等率',
      '及格率',
      'D等率',
    ]);
    expect(findButton(container, '当前学科摘要与明细同屏').disabled).toBe(false);
    expect(Array.from(container.querySelectorAll('tbody tr:first-child td')).map(td => td.textContent.trim())).toEqual([
      '701班',
      '85.0',
      '50.0%',
      '100.0%',
      '100.0%',
      '0.0%',
    ]);

    const mathButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('数学'));
    act(() => {
      mathButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：数学 · 结构摘要');
    expect(container.textContent).toContain('数学关键班级提示');
    expect(getHeaders(container)).toEqual([]);
    expect(findButton(container, '当前学科摘要与明细同屏').disabled).toBe(false);

    const mathDetailButton = findButton(container, '查看班级明细', { enabledOnly: true });
    act(() => {
      mathDetailButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(findButton(container, '当前学科摘要与明细同屏').disabled).toBe(false);

    const allButton = findButton(container, '全面铺开', { enabledOnly: true });
    act(() => {
      allButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：数学 · 全面铺开');
    expect(container.textContent).toContain('结构摘要');
    expect(getHeaders(container)).toEqual([
      '班级',
      '平均分',
      'A等率',
      'B等率',
      '及格率',
      'D等率',
    ]);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
