import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import SubjectThresholdAnalysis from './SubjectThresholdAnalysis';

const getHeaders = (container) => Array.from(container.querySelectorAll('th')).map(th => th.textContent.trim());
const findButton = (container, label) => Array.from(container.querySelectorAll('button'))
  .find(button => button.textContent.includes(label));

describe('SubjectThresholdAnalysis', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('shows target-line overview before formula details are opened', async () => {
    const examScores = [
      { student_id: '001', total_score: 260, scores: { 语文: 88, 数学: 92 } },
      { student_id: '002', total_score: 245, scores: { 语文: 84, 数学: 86 } },
      { student_id: '003', total_score: 228, scores: { 语文: 79, 数学: 75 } },
      { student_id: '004', total_score: 211, scores: { 语文: 72, 数学: 70 } },
      { student_id: '005', total_score: 198, scores: { 语文: 65, 数学: 64 } },
    ];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SubjectThresholdAnalysis
          examData={{ exam_name: '期末考试' }}
          examScores={examScores}
          subjects={['语文', '数学']}
        />
      );
    });

    expect(container.textContent).toContain('各学科临界分');
    expect(container.textContent).toContain('临界分结果控件');
    expect(container.textContent).toContain('当前：目标线概览');
    expect(container.textContent).toContain('目标线速览');
    expect(container.textContent).toContain('计算口径');
    expect(container.textContent).not.toContain('完整公式明细');
    expect(getHeaders(container)).toEqual([]);
    expect(findButton(container, '目标线与公式同屏复核').disabled).toBe(false);

    const settingsButton = findButton(container, '比例设置');
    expect(settingsButton).toBeTruthy();
    await act(async () => {
      settingsButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('百分比比例设置');
    expect(container.textContent).toContain('设置控件');
    expect(container.textContent).toContain('当前：比例口径');
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(0);
    expect(findButton(container, '口径与输入同屏复核').disabled).toBe(false);

    const inputButton = findButton(container, '进入比例调整');
    expect(inputButton).toBeTruthy();
    await act(async () => {
      inputButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：比例调整');
    expect(container.textContent).toContain('比例调整');
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(4);
    expect(findButton(container, '口径与输入同屏复核').disabled).toBe(false);

    const settingsAllButton = findButton(container, '口径与输入同屏复核');
    expect(settingsAllButton).toBeTruthy();
    await act(async () => {
      settingsAllButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('比例口径');
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(4);

    await act(async () => {
      settingsButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).not.toContain('百分比比例设置');
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(0);

    const detailButton = findButton(container, '查看公式明细');
    expect(detailButton).toBeTruthy();
    await act(async () => {
      detailButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：公式明细');
    expect(container.textContent).toContain('完整公式明细');
    expect(getHeaders(container)).toEqual([
      '比例',
      '实考人数',
      '比例人数',
      '近似分',
      '大于等于人数',
      '大于人数',
      '分界分数线',
    ]);
    expect(findButton(container, '目标线与公式同屏复核').disabled).toBe(false);

    const overviewButton = findButton(container, '返回目标线概览');
    await act(async () => {
      overviewButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：目标线概览');
    expect(getHeaders(container)).toEqual([]);

    const allButton = findButton(container, '全面铺开');
    expect(allButton).toBeTruthy();
    await act(async () => {
      allButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('目标线速览');
    expect(container.textContent).toContain('完整公式明细');
    expect(getHeaders(container)).toEqual([
      '比例',
      '实考人数',
      '比例人数',
      '近似分',
      '大于等于人数',
      '大于人数',
      '分界分数线',
    ]);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
