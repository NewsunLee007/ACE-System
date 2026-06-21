import {
  buildDashboardPreviewUser,
  DASHBOARD_PREVIEW_OPTIONS,
  isDashboardPreviewController,
} from './rolePreview';

describe('dashboard role preview rules', () => {
  it('treats missing users as non-preview controllers', () => {
    expect(isDashboardPreviewController(null)).toBe(false);
    expect(isDashboardPreviewController(undefined)).toBe(false);
  });

  it('allows dean and admin accounts to preview role dashboards', () => {
    expect(isDashboardPreviewController({ permission_code: 'edu_admin' })).toBe(true);
    expect(isDashboardPreviewController({ role_name: '管理员' })).toBe(true);
    expect(isDashboardPreviewController({ permissions: ['all_permissions'] })).toBe(true);
  });

  it('includes school leader and grade leader dashboard preview targets', () => {
    expect(DASHBOARD_PREVIEW_OPTIONS.map(option => option.id)).toEqual(
      expect.arrayContaining(['principal', 'vice_principal', 'grade_leader'])
    );
  });

  it('builds a grade-limited preview user for grade leaders', () => {
    const user = buildDashboardPreviewUser('grade_leader', {
      classes: [
        { id: 701, status: 'active' },
        { id: 702, status: 'active' },
        { id: 801, status: 'active' },
      ],
      teachers: [],
    });

    expect(user).toMatchObject({
      permission_code: 'grade_leader',
      preview_grade_levels: ['7年级'],
      preview_class_ids: [701, 702],
    });
  });
});
