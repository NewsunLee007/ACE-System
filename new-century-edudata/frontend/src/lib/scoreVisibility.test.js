import {
  getDefaultScoreVisibilitySettings,
  maskRankValue,
  normalizeScoreRole,
  resolveScoreVisibility,
} from './scoreVisibility';

describe('scoreVisibility', () => {
  it('maps legacy and Chinese roles to backend permission codes', () => {
    expect(normalizeScoreRole('dean')).toBe('edu_admin');
    expect(normalizeScoreRole('校长')).toBe('edu_admin');
    expect(normalizeScoreRole('副校长')).toBe('edu_admin');
    expect(normalizeScoreRole('段长')).toBe('grade_leader');
    expect(normalizeScoreRole('班主任')).toBe('headmaster');
    expect(normalizeScoreRole({ role_name: '科任教师' })).toBe('teacher');
  });

  it('uses role-controlled ranking defaults', () => {
    const settings = getDefaultScoreVisibilitySettings();

    expect(resolveScoreVisibility({ permission_code: 'edu_admin' }, settings).show_grade_rank).toBe(true);
    expect(resolveScoreVisibility({ permission_code: 'headmaster' }, settings).show_class_rank).toBe(true);
    expect(resolveScoreVisibility({ permission_code: 'headmaster' }, settings).show_grade_rank).toBe(false);
    expect(resolveScoreVisibility('parent', settings).show_grade_rank).toBe(false);
  });

  it('masks hidden rank values with a stable label', () => {
    expect(maskRankValue(12, true)).toBe(12);
    expect(maskRankValue(12, false)).toBe('暂未开放');
  });
});
