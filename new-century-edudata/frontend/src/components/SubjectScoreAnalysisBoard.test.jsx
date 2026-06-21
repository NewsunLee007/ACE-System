import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import SubjectScoreAnalysisBoard from './SubjectScoreAnalysisBoard';

const getHeaders = (container) => Array.from(container.querySelectorAll('th')).map(th => th.textContent.trim());
const getButton = (container, label, { enabledOnly = false } = {}) => (
  Array.from(container.querySelectorAll('button'))
    .find(button => button.textContent.includes(label) && (!enabledOnly || !button.disabled))
);

const clickButton = (container, label, options = {}) => {
  const button = getButton(container, label, options);
  expect(button).toBeTruthy();
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return button;
};

describe('SubjectScoreAnalysisBoard', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('starts with a compact overview and opens class details on demand', () => {
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
    expect(container.textContent).toContain('当前：分析概览');
    expect(container.textContent).toContain('分析结果控件');
    expect(container.textContent).toContain('点击查看概览、明细、口径或全面铺开');
    expect(container.textContent).toContain('分位线速览');
    expect(container.textContent).toContain('领先班级');
    expect(container.textContent).not.toContain('班级明细工作区');
    expect(container.textContent).not.toContain('完成上一步后开放');
    expect(getHeaders(container)).toEqual([]);

    clickButton(container, '计算口径');
    expect(container.textContent).toContain('当前：计算口径');
    clickButton(container, '分析概览');

    clickButton(container, '查看班级明细');

    expect(container.textContent).toContain('当前：班级明细');
    expect(container.textContent).toContain('班级明细工作区');
    expect(container.textContent).toContain('当前明细');
    expect(container.textContent).toContain('明细结果控件');
    expect(container.textContent).toContain('点击查看排行、分位或完整长表');
    expect(container.textContent).toContain('班级排行');
    expect(getHeaders(container)).toEqual([
      '班级',
      '层次',
      '均分',
      '均差',
      '标准分',
      'Z分',
      'Z序',
    ]);

    const detailAllButton = getButton(container, '全面铺开');
    expect(detailAllButton.disabled).toBe(false);

    clickButton(container, '查看分位结构', { enabledOnly: true });
    expect(container.textContent).toContain('按前20%、前40%、前60%、前80%和后20%复核班级结构');
    expect(getHeaders(container)).toEqual([
      '班级',
      '层次',
      '前20%',
      '前40%',
      '前60%',
      '前80%',
      '后20%',
    ]);

    clickButton(container, '查看完整长表', { enabledOnly: true });
    expect(container.textContent).toContain('用于导出前复核全部指标列');
    expect(getHeaders(container)).toEqual([
      '班级',
      '层次',
      '应考',
      '实考',
      '均分',
      '均差',
      '均序',
      '标准差',
      '标准分',
      '变差系数',
      '前20%',
      '前80%',
      '后20%',
      'Z分',
      'Z序',
    ]);

    clickButton(container, '明细全面铺开', { enabledOnly: true });
    expect(container.textContent).toContain('当前明细');
    expect(container.textContent).toContain('明细全部同屏');
    expect(container.textContent).toContain('分位结构');
    expect(container.textContent).toContain('完整长表');

    clickButton(container, '返回分析概览');
    expect(container.textContent).toContain('当前：分析概览');
    expect(getHeaders(container)).toEqual([]);

    const allButton = getButton(container, '全面铺开');
    expect(allButton.disabled).toBe(false);

    clickButton(container, '查看班级明细');
    clickButton(container, '查看计算口径', { enabledOnly: true });
    expect(container.textContent).toContain('当前：计算口径');
    expect(container.textContent).toContain('计算口径');

    clickButton(container, '全面铺开复核', { enabledOnly: true });
    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('计算口径');
    expect(container.textContent).toContain('完整长表');
    expect(getHeaders(container)).toContain('班级');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
