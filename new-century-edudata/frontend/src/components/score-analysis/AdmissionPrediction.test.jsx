import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AdmissionPrediction from './AdmissionPrediction';

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

describe('AdmissionPrediction', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { configurable: true, value: 420 });
  });

  it('requires line setup before rendering class and subject review modules', () => {
    const examScores = [
      { class_id: 701, total_score: 520, is_valid: true, scores: { 语文: 90, 数学: 95 } },
      { class_id: 701, total_score: 480, is_valid: true, scores: { 语文: 80, 数学: 85 } },
      { class_id: 702, total_score: 430, is_valid: true, scores: { 语文: 70, 数学: 75 } },
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
        <AdmissionPrediction
          examScores={examScores}
          subjects={['语文', '数学']}
          classLayers={classLayers}
        />
      );
    });

    expect(container.textContent).toContain('模拟进线结果台');
    expect(container.textContent).toContain('模拟进线结果控件');
    expect(container.textContent).toContain('当前：配置分数线');
    expect(container.querySelectorAll('th')).toHaveLength(0);

    const classStatsButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('班级统计'));
    expect(classStatsButton.disabled).toBe(true);

    const lineInput = container.querySelector('#key-high-line');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(lineInput, '500');
      lineInput.dispatchEvent(new Event('input', { bubbles: true }));
      lineInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).not.toContain('完成上一步后开放');
    clickButton(container, '学科贡献');
    expect(container.textContent).toContain('当前：学科贡献');
    clickButton(container, '配置分数线');

    clickButton(container, '查看班级统计', { enabledOnly: true });

    expect(container.textContent).toContain('当前：班级统计');
    expect(container.textContent).toContain('班级统计结果控件');
    expect(container.textContent).toContain('当前：班级摘要');
    expect(container.textContent).toContain('进线班级概览');
    expect(container.textContent).toContain('进线贡献 Top5');
    expect(container.querySelectorAll('th')).toHaveLength(0);

    const fullClassTableButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('查看完整班级表'));
    act(() => {
      fullClassTableButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：完整班级表');
    expect(Array.from(container.querySelectorAll('th')).map(th => th.textContent.trim())).toEqual([
      '班级',
      '参考人数',
      '进线人数',
      '上线率',
    ]);

    const classAllButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('班级全览'));
    act(() => {
      classAllButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：班级全览');
    expect(container.textContent).toContain('进线班级概览');
    expect(container.textContent).toContain('全年级汇总');

    const allButton = getButton(container, '全面铺开');
    expect(allButton.disabled).toBe(false);

    clickButton(container, '查看学科贡献', { enabledOnly: true });

    expect(container.textContent).toContain('当前：学科贡献');
    expect(container.textContent).toContain('学科贡献度分析');
    expect(container.querySelectorAll('th')).toHaveLength(0);

    expect(getButton(container, '全面铺开').disabled).toBe(false);

    clickButton(container, '查看历史对比', { enabledOnly: true });

    expect(container.textContent).toContain('当前：历史对比');
    expect(container.textContent).toContain('历史上线率对比工作台');

    clickButton(container, '四个板块同屏显示', { enabledOnly: true });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('重高模拟分数线');
    expect(container.textContent).toContain('进线班级概览');
    expect(container.textContent).toContain('全年级汇总');
    expect(container.textContent).toContain('学科贡献度分析');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
