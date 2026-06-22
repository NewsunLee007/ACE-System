import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ScoreAnalysisLogs,
  ScoreAnalysisPublications,
  ScoreAnalysisPublishModal,
} from './ScoreAnalysisRecords';

const setInputValue = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value')?.set;
  setter.call(input, value);
};

const clickButton = (container, label) => {
  const button = Array.from(container.querySelectorAll('button'))
    .find(item => item.textContent.includes(label));
  expect(button).toBeTruthy();
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

const clickButtonAt = (container, label, index = 0) => {
  const buttons = Array.from(container.querySelectorAll('button'))
    .filter(item => item.textContent.includes(label));
  expect(buttons[index]).toBeTruthy();
  act(() => {
    buttons[index].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('ScoreAnalysisRecords panels', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders publication records and log rows', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <>
          <ScoreAnalysisPublications
            publications={[{
              publication_id: 'P1',
              published_at: '2026-06-18T08:00:00Z',
              title: '七年级分析发布',
              exam_name: '期中考试',
              published_by_name: '教务处',
              recipient_count: 5,
            }]}
          />
          <ScoreAnalysisLogs
            logs={[{
              id: 1,
              created_at: '2026-06-18T09:00:00Z',
              action_type: 'publish',
              action_by_name: '教务处',
              action_by_role: 'edu_admin',
              ip_address: '127.0.0.1',
            }]}
          />
        </>
      );
    });

    expect(container.textContent).toContain('当前：发布概览');
    expect(container.textContent).toContain('发布记录结果控件');
    expect(container.textContent).toContain('七年级分析发布');
    expect(container.textContent).not.toContain('期中考试');
    expect(container.textContent).toContain('当前：审计概览');
    expect(container.textContent).toContain('操作日志结果控件');
    expect(container.textContent).toContain('publish');
    expect(container.textContent).not.toContain('127.0.0.1');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps publication and log tables behind explicit detail toggles', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <>
          <ScoreAnalysisPublications
            publications={[{
              publication_id: 'P1',
              published_at: '2026-06-18T08:00:00Z',
              title: '七年级分析发布',
              exam_name: '期中考试',
              published_by_name: '教务处',
              recipient_count: 5,
            }]}
          />
          <ScoreAnalysisLogs
            logs={[{
              id: 1,
              created_at: '2026-06-18T09:00:00Z',
              action_type: 'publish',
              action_by_name: '教务处',
              action_by_role: 'edu_admin',
              ip_address: '127.0.0.1',
            }]}
          />
        </>
      );
    });

    expect(container.textContent).toContain('发布次数');
    expect(container.textContent).toContain('日志总数');
    expect(container.textContent).not.toContain('发布时间');
    expect(container.textContent).not.toContain('IP地址');

    clickButton(container, '最近发布');
    expect(container.textContent).toContain('当前：最近发布');
    expect(container.textContent).toContain('期中考试');

    clickButton(container, '完整发布清单');
    expect(container.textContent).toContain('当前：明细表');
    expect(container.textContent).toContain('发布时间');
    expect(container.textContent).toContain('接收人数');

    clickButton(container, '最近操作');
    expect(container.textContent).toContain('当前：最近操作');
    expect(container.textContent).toContain('127.0.0.1');

    clickButton(container, '完整操作清单');
    expect(container.textContent).toContain('IP地址');
    expect(container.textContent).toContain('操作类型');

    clickButtonAt(container, '全面铺开', 0);
    clickButtonAt(container, '全面铺开', 1);
    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('完整发布明细');
    expect(container.textContent).toContain('完整操作明细');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('scrolls publication and log content into view after workflow changes', () => {
    jest.useFakeTimers();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <>
          <ScoreAnalysisPublications
            publications={[{
              publication_id: 'P1',
              published_at: '2026-06-18T08:00:00Z',
              title: '七年级分析发布',
              exam_name: '期中考试',
              published_by_name: '教务处',
              recipient_count: 5,
            }]}
          />
          <ScoreAnalysisLogs
            logs={[{
              id: 1,
              created_at: '2026-06-18T09:00:00Z',
              action_type: 'publish',
              action_by_name: '教务处',
              action_by_role: 'edu_admin',
              ip_address: '127.0.0.1',
            }]}
          />
        </>
      );
    });

    expect(container.querySelector('#score-publications-content')).toBeTruthy();
    expect(container.querySelector('#score-logs-content')).toBeTruthy();

    clickButton(container, '最近发布');
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    clickButton(container, '最近操作');
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(scrollIntoView).toHaveBeenCalledTimes(2);

    act(() => {
      root.unmount();
    });
    container.remove();
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    jest.useRealTimers();
  });

  it('updates publish form fields and dispatches publish actions', () => {
    const setPublishForm = jest.fn();
    const onClose = jest.fn();
    const onPublish = jest.fn();
    const publishForm = {
      title: '',
      content_summary: '',
      recipient_types: [],
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisPublishModal
          publishForm={publishForm}
          setPublishForm={setPublishForm}
          recipientOptions={[{ value: 'grade_leader', label: '年段长' }]}
          onClose={onClose}
          onPublish={onPublish}
        />
      );
    });

    const titleInput = container.querySelector('input[type="text"]');
    const recipientInput = container.querySelector('input[type="checkbox"]');
    const publishButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('确认发布'));

    act(() => {
      setInputValue(titleInput, '发布标题');
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      recipientInput.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      publishButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(setPublishForm).toHaveBeenCalledWith(expect.objectContaining({ title: '发布标题' }));
    expect(setPublishForm).toHaveBeenCalledWith(expect.objectContaining({ recipient_types: ['grade_leader'] }));
    expect(onPublish).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
