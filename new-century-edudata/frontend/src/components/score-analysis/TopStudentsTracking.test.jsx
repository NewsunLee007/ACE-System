import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import TopStudentsTracking, {
  buildTopStudentsSummaryModel,
  buildTopStudentsTrackingModel,
} from './TopStudentsTracking';

describe('TopStudentsTracking', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { configurable: true, value: 360 });
  });

  it('builds a summary-first model for top student tracking', () => {
    const examScores = [
      { student_id: '001', student_name: '学生甲', class_id: 701, total_score: 520, is_valid: true },
      { student_id: '002', student_name: '学生乙', class_id: 702, total_score: 510, is_valid: true },
      { student_id: '003', student_name: '学生丙', class_id: 701, total_score: 500, is_valid: true },
    ];
    const classLayers = [
      { class_id: 701, class_name: '701班' },
      { class_id: 702, class_name: '702班' },
    ];

    const trackingModel = buildTopStudentsTrackingModel({ examScores, classLayers });
    const summaryModel = buildTopStudentsSummaryModel(trackingModel);

    expect(trackingModel.topStudents.map(student => student.rank)).toEqual([1, 2, 3]);
    expect(summaryModel.top50Total).toBe(3);
    expect(summaryModel.top100Total).toBe(3);
    expect(summaryModel.classCount).toBe(2);
    expect(summaryModel.topStudent).toMatchObject({ student_name: '学生甲', rank: 1, className: '701班' });
    expect(summaryModel.leadingClasses[0]).toMatchObject({ className: '701班', top50: 2 });
  });

  it('renders summary, distribution and student list as separate modules', () => {
    const examScores = [
      { student_id: '001', student_name: '学生甲', class_id: 701, total_score: 520, is_valid: true },
      { student_id: '002', student_name: '学生乙', class_id: 702, total_score: 510, is_valid: true },
      { student_id: '003', student_name: '学生丙', class_id: 701, total_score: 500, is_valid: true },
    ];
    const classLayers = [
      { class_id: 701, class_name: '701班' },
      { class_id: 702, class_name: '702班' },
    ];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TopStudentsTracking examScores={examScores} classLayers={classLayers} />);
    });

    expect(container.textContent).toContain('尖子生追踪结果台');
    expect(container.textContent).toContain('尖子生结果控件');
    expect(container.textContent).toContain('当前：追踪摘要');
    expect(container.textContent).toContain('前50名覆盖');
    expect(container.textContent).toContain('头部学生 Top5');
    expect(container.textContent).toContain('追踪动作');
    expect(container.textContent).toContain('重点班级摘要');
    expect(container.textContent).not.toContain('分布结果控件');
    expect(container.textContent).not.toContain('尖子生名单复核');
    expect(Array.from(container.querySelectorAll('th')).map(th => th.textContent.trim())).toEqual([]);

    const distributionButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('查看分布图'));
    act(() => {
      distributionButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：分布概览');
    expect(container.textContent).toContain('分布结果控件');
    expect(container.textContent).toContain('当前：图表概览');

    const classDetailButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('查看班级明细'));
    act(() => {
      classDetailButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：班级明细');
    expect(container.textContent).toContain('高分段班级明细');
    expect(Array.from(container.querySelectorAll('th')).map(th => th.textContent.trim())).toEqual([
      '班级',
      '前50名',
      '前100名',
      '前200名',
    ]);

    const overviewButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('返回图表概览'));
    act(() => {
      overviewButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：图表概览');
    expect(Array.from(container.querySelectorAll('th')).map(th => th.textContent.trim())).toEqual([]);

    const listButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('名单复核') || button.textContent.includes('复核名单'));
    act(() => {
      listButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：名单复核');
    expect(container.textContent).toContain('尖子生名单复核');
    expect(Array.from(container.querySelectorAll('th')).map(th => th.textContent.trim())).toEqual([
      '年级排名',
      '考号',
      '姓名',
      '班级',
      '总分',
    ]);

    const allButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('全面铺开'));
    act(() => {
      allButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('高分段班级明细');
    expect(container.textContent).toContain('尖子生名单复核');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
