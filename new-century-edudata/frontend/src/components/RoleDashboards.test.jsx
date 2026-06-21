import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import schoolData from '../data/schoolData';
import { ROLE_PREVIEW_STORAGE_KEY } from '../lib/rolePreview';
import { ParentDashboard, ResearchDashboard } from './RoleDashboards';

describe('ResearchDashboard access boundary', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('shows an empty scope state for research leaders without a matched teacher profile', () => {
    localStorage.setItem('user', JSON.stringify({
      username: 'T999',
      real_name: '陌生老师',
      role_name: '教研组长',
    }));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ResearchDashboard />);
    });

    expect(container.textContent).toContain('教研范围未配置');
    expect(container.textContent).toContain('未匹配到教研/备课组教师档案');
    expect(container.textContent).not.toContain('教研组成绩分析投送');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps the parent dashboard as a secure query entry instead of rendering local sample scores', () => {
    localStorage.setItem('user', JSON.stringify({
      username: '13800138001',
      real_name: '王女士',
      role_name: '家长',
    }));
    schoolData.parents = [{ id: 1, name: '王女士', phone: '13800138001', student_ids: [101] }];
    schoolData.students = [{ id: 101, name: '本地样例学生', class_id: 701, student_code: 'S101' }];
    schoolData.examScores = [{ exam_id: 1, student_id: 101, total_score: 599, is_valid: true }];

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ParentDashboard />);
    });

    expect(container.textContent).toContain('单学生安全查询');
    expect(container.textContent).toContain('打开家长查询');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/parent-portal');
    expect(container.textContent).not.toContain('本地样例学生');
    expect(container.textContent).not.toContain('599');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows a permission-limited parent view sample only during admin preview', () => {
    localStorage.setItem('user', JSON.stringify({
      username: 'dean',
      real_name: '李主任',
      role_name: '教务处主任',
      permission_code: 'edu_admin',
    }));
    localStorage.setItem(ROLE_PREVIEW_STORAGE_KEY, 'parent');
    schoolData.classes = [{ id: 701, class_no: '01', name: '2025级01班', status: 'active' }];
    schoolData.students = [{ id: 101, name: '本地样例学生', class_id: 701, student_code: 'S101' }];
    schoolData.exams = [{ id: 1, exam_name: '期末考试' }];
    schoolData.examScores = [{
      exam_id: 1,
      student_id: 101,
      class_id: 701,
      total_score: 599,
      scores: { 语文: 100, 数学: 99 },
      rank: 1,
      class_rank: 1,
      is_valid: true,
    }];

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ParentDashboard />);
    });

    expect(container.textContent).toContain('管理员预览 · 家长视图');
    expect(container.textContent).toContain('本地样例学生');
    expect(container.textContent).toContain('总分 599');
    expect(container.textContent).toContain('年级排名');
    expect(container.textContent).toContain('未开放');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
