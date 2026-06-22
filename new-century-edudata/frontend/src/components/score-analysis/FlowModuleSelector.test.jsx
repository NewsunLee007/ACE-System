import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Gauge, Maximize2 } from 'lucide-react';
import FlowModuleSelector from './FlowModuleSelector';

describe('FlowModuleSelector', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('changes modules and scrolls the active content into view when requested', () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    const scrollIntoView = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const target = document.createElement('div');
    target.id = 'active-content';
    target.scrollIntoView = scrollIntoView;
    document.body.appendChild(target);
    const root = createRoot(container);

    act(() => {
      root.render(
        <FlowModuleSelector
          title="结果入口"
          hint="点击查看"
          activeValue="summary"
          onChange={onChange}
          scrollTargetId="active-content"
          modules={[
            { value: 'summary', label: '摘要', desc: '核心结果', icon: Gauge },
            { value: 'all', label: '全面铺开', desc: '全部同屏', icon: Maximize2 },
          ]}
        />
      );
    });

    const allButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('全面铺开'));

    act(() => {
      allButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      jest.runOnlyPendingTimers();
    });

    expect(onChange).toHaveBeenCalledWith('all');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    act(() => {
      root.unmount();
    });
    container.remove();
    target.remove();
    jest.useRealTimers();
  });
});
