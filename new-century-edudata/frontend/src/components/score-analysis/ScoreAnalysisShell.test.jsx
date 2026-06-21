import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ScoreAnalysisHeaderTabs, {
  getScoreAnalysisNoticeClass,
  isScoreAnalysisAdminUser,
  ScoreAnalysisNotice,
} from './ScoreAnalysisShell';

describe('ScoreAnalysisShell', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('styles notice tones and closes notices', () => {
    expect(getScoreAnalysisNoticeClass('success')).toContain('emerald');
    expect(getScoreAnalysisNoticeClass('error')).toContain('red');
    expect(getScoreAnalysisNoticeClass('warning')).toContain('amber');
    expect(getScoreAnalysisNoticeClass('info')).toContain('blue');

    const onClose = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ScoreAnalysisNotice notice={{ message: '导入完成', type: 'success' }} onClose={onClose} />);
    });

    expect(container.textContent).toContain('导入完成');
    act(() => {
      container.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('treats edu admin users as score analysis admins', () => {
    expect(isScoreAnalysisAdminUser({ permission_code: 'edu_admin', role_name: '教务处主任' })).toBe(true);
    expect(isScoreAnalysisAdminUser({ permission_code: 'sys_admin', role_name: '系统管理员' })).toBe(true);
    expect(isScoreAnalysisAdminUser({ permission_code: 'teacher', role_name: '教师' })).toBe(false);
  });

  it('switches top tabs and loads logs for score analysis admins', () => {
    const setActiveTab = jest.fn();
    const onOpenLogs = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisHeaderTabs
          activeTab="analysis"
          setActiveTab={setActiveTab}
          currentUser={{ permission_code: 'edu_admin', role_name: '教务处主任' }}
          onOpenLogs={onOpenLogs}
        />
      );
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    act(() => {
      buttons.find(button => button.textContent.includes('层次配置'))
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      buttons.find(button => button.textContent.includes('操作日志'))
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(setActiveTab).toHaveBeenCalledWith('layers');
    expect(setActiveTab).toHaveBeenCalledWith('logs');
    expect(onOpenLogs).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
