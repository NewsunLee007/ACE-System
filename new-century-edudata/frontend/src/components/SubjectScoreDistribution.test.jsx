import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import SubjectScoreDistribution from './SubjectScoreDistribution';

const getHeaders = (container) => Array.from(container.querySelectorAll('th')).map(th => th.textContent.trim());
const findButton = (container, label) => Array.from(container.querySelectorAll('button'))
  .find(button => button.textContent.includes(label));

describe('SubjectScoreDistribution', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders a compact overview before the full score-band table is opened', async () => {
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
        <SubjectScoreDistribution
          examData={{ exam_name: '期末考试' }}
          examScores={examScores}
          subjects={['语文', '数学']}
        />
      );
    });

    expect(container.textContent).toContain('各学科分数段统计');
    expect(container.textContent).toContain('分数段结果控件');
    expect(container.textContent).toContain('当前：分布概览');
    expect(container.textContent).toContain('高频分数段');
    expect(container.textContent).toContain('统计口径');
    expect(container.textContent).not.toContain('完整分数段明细');
    expect(getHeaders(container)).toEqual([]);
    expect(findButton(container, '概览与分段表同屏复核').disabled).toBe(false);

    const settingsButton = findButton(container, '间隔设置');
    expect(settingsButton).toBeTruthy();
    await act(async () => {
      settingsButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('分数段间隔设置');
    expect(container.textContent).toContain('设置控件');
    expect(container.textContent).toContain('当前：智能口径');
    expect(container.textContent).toContain('当前口径');
    expect(container.textContent).not.toContain('单科间隔设置');
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(0);
    expect(findButton(container, '口径与输入同屏复核').disabled).toBe(false);

    const enterSubjectIntervals = findButton(container, '进入单科间隔');
    expect(enterSubjectIntervals).toBeTruthy();
    await act(async () => {
      enterSubjectIntervals.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：单科间隔');
    expect(container.textContent).toContain('单科间隔设置');
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(3);
    expect(findButton(container, '口径与输入同屏复核').disabled).toBe(false);

    const settingsAllButton = findButton(container, '口径与输入同屏复核');
    expect(settingsAllButton).toBeTruthy();
    await act(async () => {
      settingsAllButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('逐项复核各统计维度的间隔');

    await act(async () => {
      settingsButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const detailButton = findButton(container, '查看完整明细');
    expect(detailButton).toBeTruthy();
    await act(async () => {
      detailButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：完整明细');
    expect(container.textContent).toContain('完整分数段明细');
    expect(getHeaders(container)).toEqual(['分数段', '人数', '占比', '可视化']);
    expect(findButton(container, '概览与分段表同屏复核').disabled).toBe(false);

    const overviewButton = findButton(container, '返回分布概览');
    await act(async () => {
      overviewButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：分布概览');
    expect(getHeaders(container)).toEqual([]);

    const allButton = findButton(container, '全面铺开');
    expect(allButton).toBeTruthy();
    await act(async () => {
      allButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('高频分数段');
    expect(container.textContent).toContain('完整分数段明细');
    expect(getHeaders(container)).toEqual(['分数段', '人数', '占比', '可视化']);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
