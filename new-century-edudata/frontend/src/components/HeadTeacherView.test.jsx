import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import HeadTeacherView from './HeadTeacherView';

describe('HeadTeacherView access boundary', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('does not fall back to an arbitrary class when the head teacher account is unmatched', () => {
    localStorage.setItem('user', JSON.stringify({
      username: 'T999',
      real_name: '陌生班主任',
      role_name: '班主任',
    }));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<HeadTeacherView />);
    });

    expect(container.textContent).toContain('班主任范围未配置');
    expect(container.textContent).toContain('未匹配到班主任教师档案');
    expect(container.textContent).not.toContain('班级综合Z值');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
