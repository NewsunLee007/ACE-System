import {
  findTeacherForUser,
  getGradeLevelsFromClassIds,
  getHeadTeacherAccessState,
  getHeadTeacherClassIds,
  getManagedGradeLevelsForUser,
  getResearchAccessState,
  getTeacherAccessState,
  getTeacherClassIds,
  getTeacherSubjects,
  teacherMatchesUser,
} from './teacherAccess';

const teachers = [
  {
    id: 1,
    code: 'T001',
    name: '王老师',
    phone: '13800138001',
    subjects: ['数学'],
    teaching_classes: [{ class_id: 701, subject: '数学' }],
    role_details: [{ role_type: 'head_teacher', class_id: 701 }],
  },
  {
    id: 2,
    code: 'T002',
    name: '空班级老师',
    subjects: ['语文'],
    teaching_classes: [],
  },
];

const classes = [
  { id: 701, status: 'active', head_teacher_id: 1 },
  { id: 702, status: 'active', head_teacher_id: null },
  { id: 801, status: 'active', head_teacher_id: null },
  { id: 703, status: 'inactive', head_teacher_id: 1 },
];

describe('teacher access helpers', () => {
  it('matches teacher accounts by code, name, or phone', () => {
    expect(teacherMatchesUser(teachers[0], { username: 'T001' })).toBe(true);
    expect(teacherMatchesUser(teachers[0], { real_name: '王老师' })).toBe(true);
    expect(teacherMatchesUser(teachers[0], { phone: '13800138001' })).toBe(true);
    expect(teacherMatchesUser(teachers[0], { username: 'T999' })).toBe(false);
  });

  it('does not fall back to an arbitrary teacher when the current user has no teacher profile', () => {
    expect(findTeacherForUser(teachers, { username: 'T999', real_name: '陌生老师' })).toBeNull();
    expect(getTeacherAccessState({ teachers, user: { username: 'T999' } })).toMatchObject({
      status: 'no-teacher',
      classIds: [],
      subjects: [],
    });
  });

  it('extracts only explicitly assigned teaching classes and subjects', () => {
    expect(getTeacherClassIds(teachers[0])).toEqual([701]);
    expect(getTeacherSubjects({
      subjects: ['数学'],
      teaching_classes: [{ class_id: 701, subject: '科学' }],
    })).toEqual(['数学', '科学']);
  });

  it('treats a matched teacher without classes as an empty scope', () => {
    expect(getTeacherAccessState({ teachers, user: { username: 'T002' } })).toMatchObject({
      status: 'no-classes',
      classIds: [],
      subjects: ['语文'],
    });
  });

  it('keeps admin research dashboards on full access without needing a teacher profile', () => {
    expect(getResearchAccessState({ teachers: [], user: { role_name: '教务处主任' } })).toMatchObject({
      status: 'ready',
      fullAccess: true,
      classIds: [],
      subjects: [],
    });
  });

  it('lets school leaders see research dashboards with full school scope', () => {
    expect(getResearchAccessState({ teachers: [], user: { role_name: '校长' } })).toMatchObject({
      status: 'ready',
      fullAccess: true,
    });
    expect(getResearchAccessState({ teachers: [], user: { permission_code: 'vice_principal' } })).toMatchObject({
      status: 'ready',
      fullAccess: true,
    });
  });

  it('limits grade leaders to their configured grade level', () => {
    expect(getManagedGradeLevelsForUser({
      teachers,
      user: { role_name: '年段长', grade_level: '8年级' },
    })).toEqual(['8年级']);
    expect(getResearchAccessState({
      teachers,
      classes,
      user: { role_name: '段长', grade_level: '8年级' },
    })).toMatchObject({
      status: 'ready',
      fullAccess: false,
      allSubjects: true,
      classIds: [801],
      gradeLevels: ['8年级'],
    });
  });

  it('requires research and lesson leaders to have an explicit teacher scope', () => {
    expect(getResearchAccessState({
      teachers,
      user: { username: 'T999', role_name: '教研组长' },
    })).toMatchObject({
      status: 'no-teacher',
      fullAccess: false,
      classIds: [],
    });
  });

  it('derives research scope grades from assigned teaching classes', () => {
    expect(getGradeLevelsFromClassIds([701, 702, 801])).toEqual(['7年级', '8年级']);
    expect(getResearchAccessState({
      teachers,
      user: { username: 'T001', role_name: '备课组长' },
    })).toMatchObject({
      status: 'ready',
      fullAccess: false,
      classIds: [701],
      subjects: ['数学'],
      gradeLevels: ['7年级'],
    });
  });

  it('resolves head teacher classes from class assignment and role details', () => {
    expect(getHeadTeacherClassIds({ classes, teacher: teachers[0] })).toEqual([701, 703]);
    expect(getHeadTeacherAccessState({
      teachers,
      classes,
      user: { username: 'T001', role_name: '班主任' },
    })).toMatchObject({
      status: 'ready',
      fullAccess: false,
      classIds: [701],
    });
  });

  it('does not let unmatched head teacher accounts fall back to arbitrary classes', () => {
    expect(getHeadTeacherAccessState({
      teachers,
      classes,
      user: { username: 'T999', role_name: '班主任' },
    })).toMatchObject({
      status: 'no-teacher',
      fullAccess: false,
      classIds: [],
    });
  });

  it('keeps admin head teacher dashboards on full active-class access', () => {
    expect(getHeadTeacherAccessState({
      teachers: [],
      classes,
      user: { role_name: '教务处主任' },
    })).toMatchObject({
      status: 'ready',
      fullAccess: true,
      classIds: [701, 702, 801],
    });
  });
});
