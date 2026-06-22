import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ScoreAnalysisHistory from './ScoreAnalysisHistory';
import ScoreAnalysisHelpModal from './ScoreAnalysisHelpModal';

const clickButton = (container, label) => {
  const button = Array.from(container.querySelectorAll('button'))
    .find(item => item.textContent.includes(label));
  expect(button).toBeTruthy();
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('ScoreAnalysis extracted utility panels', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders history rows and opens a selected analysis', () => {
    const onOpenAnalysis = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisHistory
          analysisTypes={[{ value: 'overall', label: '整体分析' }]}
          analysisHistory={[{
            analysis_id: 'A1',
            created_at: '2026-06-18T08:00:00Z',
            exam_name: '7年级期中',
            analysis_type: 'overall',
            created_by_name: '教务处',
            status: 'published',
          }]}
          onOpenAnalysis={onOpenAnalysis}
        />
      );
    });

    expect(container.textContent).toContain('7年级期中');
    expect(container.textContent).toContain('历史记录结果控件');
    expect(container.textContent).toContain('当前：历史概览');
    expect(container.textContent).toContain('历史总数');
    expect(container.textContent).not.toContain('分析时间');
    expect(container.textContent).not.toContain('整体分析');

    clickButton(container, '最近记录');
    expect(container.textContent).toContain('当前：最近记录');
    expect(container.textContent).toContain('整体分析');
    expect(container.textContent).toContain('已发布');

    const button = container.querySelector('[aria-label="打开7年级期中分析结果"]');
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onOpenAnalysis).toHaveBeenCalledWith(expect.objectContaining({ analysis_id: 'A1' }));

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('opens the full history table only after the detail action', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisHistory
          analysisTypes={[{ value: 'overall', label: '整体分析' }]}
          analysisHistory={[{
            analysis_id: 'A1',
            created_at: '2026-06-18T08:00:00Z',
            exam_name: '7年级期中',
            analysis_type: 'overall',
            created_by_name: '教务处',
            status: 'published',
          }]}
          onOpenAnalysis={jest.fn()}
        />
      );
    });

    expect(container.textContent).toContain('当前：历史概览');
    expect(container.textContent).not.toContain('分析时间');

    clickButton(container, '明细表');

    expect(container.textContent).toContain('当前：明细表');
    expect(container.textContent).toContain('分析时间');
    expect(container.textContent).toContain('分析人');

    clickButton(container, '全面铺开');
    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('历史概览');
    expect(container.textContent).toContain('最近记录');
    expect(container.textContent).toContain('完整历史明细');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('scrolls the history content into view after workflow changes', () => {
    jest.useFakeTimers();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisHistory
          analysisTypes={[{ value: 'overall', label: '整体分析' }]}
          analysisHistory={[{
            analysis_id: 'A1',
            created_at: '2026-06-18T08:00:00Z',
            exam_name: '7年级期中',
            analysis_type: 'overall',
            created_by_name: '教务处',
            status: 'published',
          }]}
          onOpenAnalysis={jest.fn()}
        />
      );
    });

    expect(container.querySelector('#score-history-content')).toBeTruthy();
    clickButton(container, '明细表');
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    act(() => {
      root.unmount();
    });
    container.remove();
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    jest.useRealTimers();
  });

  it('lets the analysis page collapse the history archive after opening it', () => {
    const onClose = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisHistory
          analysisTypes={[{ value: 'overall', label: '整体分析' }]}
          analysisHistory={[]}
          onOpenAnalysis={jest.fn()}
          onClose={onClose}
        />
      );
    });

    expect(container.textContent).toContain('分析历史');
    expect(container.textContent).toContain('收起归档');

    clickButton(container, '收起归档');

    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders help modal content and closes through the button', () => {
    const onClose = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ScoreAnalysisHelpModal onClose={onClose} />);
    });

    expect(container.textContent).toContain('成绩分析结果指引');
    expect(container.textContent).toContain('结果入口');
    expect(container.textContent).toContain('数据入口');
    expect(container.textContent).toContain('报告结果');
    expect(container.textContent).toContain('专项结果');
    expect(container.textContent).toContain('输出归档');
    expect(container.textContent).toContain('结果显示规则');
    expect(container.textContent).not.toContain('快速跳转');

    const closeButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('关闭'));
    act(() => {
      closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
