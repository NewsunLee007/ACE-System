import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import HistoricalDiffDrawer from './HistoricalDiffDrawer';

const renderComponent = () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <HistoricalDiffDrawer
        currentAdmissionData={[
          { className: '701班', rate: '52.00' },
          { className: '702班', rate: '38.00' },
        ]}
      />
    );
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

const clickButton = (container, label) => {
  const button = Array.from(container.querySelectorAll('button'))
    .find(item => item.textContent.includes(label));
  expect(button).toBeTruthy();
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return button;
};

describe('HistoricalDiffDrawer', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('keeps historical admission comparison staged behind summary and details views', () => {
    const { container, cleanup } = renderComponent();

    expect(container.textContent).toContain('历史上线率对比工作台');
    expect(container.textContent).toContain('历史上线率结果控件');
    expect(container.textContent).toContain('当前：录入历史率');
    expect(container.textContent).not.toContain('历史率(%)');
    expect(container.textContent).not.toContain('匹配班级');

    const textarea = container.querySelector('textarea');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, '701班\t45.5%\n702班\t42.0%');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    clickButton(container, '生成对比摘要');

    expect(container.textContent).toContain('当前：对比摘要');
    expect(container.textContent).toContain('匹配班级');
    expect(container.textContent).toContain('变化幅度 Top5');
    expect(container.textContent).not.toContain('历史率(%)');

    clickButton(container, '班级明细');

    expect(container.textContent).toContain('当前：班级明细');
    expect(container.textContent).toContain('历史率(%)');
    expect(container.textContent).toContain('最新率(%)');
    expect(container.textContent).toContain('701班');

    clickButton(container, '全面铺开');

    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('录入口径');
    expect(container.textContent).toContain('变化幅度 Top5');
    expect(container.textContent).toContain('历史率(%)');

    cleanup();
  });
});
