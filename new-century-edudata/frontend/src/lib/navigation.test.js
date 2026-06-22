import {
  getDefaultPathForRole,
  getFlatNavigationForRole,
  getNavigationForRole,
  getUserRole,
} from './navigation';

const labelsForRole = (role) => getFlatNavigationForRole(role).map((item) => item.label);
const pathsForRole = (role) => getFlatNavigationForRole(role).map((item) => item.path);

describe('navigation role rules', () => {
  it('sends each role to the first usable workbench instead of a hard-coded dashboard', () => {
    expect(getDefaultPathForRole('教务处主任')).toBe('/dashboard');
    expect(getDefaultPathForRole('校长')).toBe('/principal-dashboard');
    expect(getDefaultPathForRole('副校长')).toBe('/vice-principal-dashboard');
    expect(getDefaultPathForRole('年段长')).toBe('/grade-leader-dashboard');
    expect(getDefaultPathForRole('段长')).toBe('/grade-leader-dashboard');
    expect(getDefaultPathForRole('班主任')).toBe('/headteacher');
    expect(getDefaultPathForRole('科任教师')).toBe('/teacher-dashboard');
    expect(getDefaultPathForRole('教研组长')).toBe('/research-dashboard');
    expect(getDefaultPathForRole('家长')).toBe('/parent-dashboard');
  });

  it('normalizes backend role aliases before routing protected pages', () => {
    const deanRole = getUserRole({
      username: 'dean',
      role_name: '教务处主任/校领导',
      permission_code: 'edu_admin',
    });

    expect(deanRole).toBe('教务处主任');
    expect(getDefaultPathForRole(deanRole)).toBe('/dashboard');
    expect(labelsForRole(deanRole)).toEqual(expect.arrayContaining(['成绩分析', '教务处', '系统设置']));
    expect(getUserRole({ role_name: '教师', permission_code: 'teacher' })).toBe('科任教师');
  });

  it('keeps educational management out of non-admin quick navigation', () => {
    expect(labelsForRole('班主任')).toEqual(
      expect.arrayContaining(['班主任', '教师', '考务管理', '成绩分析'])
    );
    expect(labelsForRole('班主任')).not.toEqual(expect.arrayContaining(['学生管理', '教师管理', '系统设置']));
    expect(pathsForRole('家长')).toEqual(['/parent-dashboard']);
  });

  it('groups role dashboards under a compact data dashboard menu', () => {
    const eduAdminNavigation = getNavigationForRole('教务处主任');
    const analysisIndex = eduAdminNavigation.findIndex((item) => item.path === '/analysis');
    const dashboardGroupIndex = eduAdminNavigation.findIndex((item) => item.path === '/dashboards');
    const dashboardGroup = eduAdminNavigation[dashboardGroupIndex];

    expect(analysisIndex).toBeGreaterThanOrEqual(0);
    expect(dashboardGroupIndex).toBeGreaterThan(analysisIndex);
    expect(dashboardGroup.label).toBe('数据看板');
    expect(dashboardGroup.children.map((item) => item.label)).toEqual([
      '校长',
      '副校长',
      '教务处',
      '段长',
      '班主任',
      '教研',
      '教师',
      '家长',
    ]);
  });

  it('inherits parent role restrictions for nested educational pages', () => {
    const eduAdminNavigation = getNavigationForRole('教务处主任');
    const educationalGroup = eduAdminNavigation.find((item) => item.path === '/educational');

    expect(educationalGroup.children.map((item) => item.path)).toEqual(
      expect.arrayContaining([
        '/exams',
        '/educational/subjects',
        '/educational/classes',
        '/educational/students',
        '/educational/parents',
      ])
    );
    expect(getNavigationForRole('科任教师').some((item) => item.path === '/educational')).toBe(false);
    expect(getNavigationForRole('班主任').find((item) => item.path === '/educational')?.children.map(item => item.path)).toEqual(['/exams']);
  });
});
