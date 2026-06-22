import {
  buildTeacherImport,
  commitTeacherImport,
  parseTeacherImportText,
} from './teacherImport';

const classes = [
  { id: 701, class_no: '01', name: '2025级01班', enrollment_year: 2025 },
  { id: 702, class_no: '02', name: '2025级02班', enrollment_year: 2025 },
  { id: 801, class_no: '01', name: '2024级01班', enrollment_year: 2024 },
];

const formatClassName = (classId) => classes.find(cls => cls.id === classId)?.name || '';

describe('teacher import helpers', () => {
  it('parses tab-delimited teacher rows copied from Excel', () => {
    const parsed = parseTeacherImportText('工号\t姓名\t电话\t邮箱\t初始密码\t任教科目\t任教班级\nT001\t林老师\t13800138001\t\tsecret123\t语文\t701');

    expect(parsed.headers).toEqual(['工号', '姓名', '电话', '邮箱', '初始密码', '任教科目', '任教班级']);
    expect(parsed.rows[0]).toMatchObject({
      工号: 'T001',
      姓名: '林老师',
      初始密码: 'secret123',
      任教班级: '701',
    });
  });

  it('merges repeated teacher rows and resolves full class ids and class sequence numbers', () => {
    const parsed = parseTeacherImportText([
      '工号,姓名,电话,邮箱,初始密码,任教科目,任教班级',
      'T001,林老师,13800138001,,secret123,语文,701',
      'T001,林老师,13800138001,,,语文,02',
    ].join('\n'));

    const result = buildTeacherImport({
      parsedRows: parsed.rows,
      teachers: [],
      classes,
      formatClassName,
    });

    expect(result.insertedCount).toBe(1);
    expect(result.items[0]).toMatchObject({
      type: 'new',
      data: {
        code: 'T001',
        initial_password: 'secret123',
        subjects: ['语文'],
        teaching_classes: [
          { class_id: 701, subject: '语文' },
          { class_id: 702, subject: '语文' },
        ],
      },
    });
  });

  it('previews existing teacher codes as updates instead of duplicate inserts', () => {
    const parsed = parseTeacherImportText([
      '工号,姓名,电话,邮箱,任教科目,任教班级',
      'T001,林老师,13800138001,,数学,2025级01班',
    ].join('\n'));
    const teachers = [{
      id: 7,
      code: 'T001',
      name: '林老师',
      phone: '13800138001',
      email: '',
      subjects: ['语文'],
      roles: ['subject_teacher'],
      status: 'active',
      teaching_classes: [{ class_id: 701, subject: '语文' }],
      custom_permissions: [],
    }];

    const result = buildTeacherImport({
      parsedRows: parsed.rows,
      teachers,
      classes,
      formatClassName,
    });

    expect(result.updatedCount).toBe(1);
    expect(result.items[0]).toMatchObject({
      type: 'update',
      changes: ['subjects', 'teaching_classes'],
      data: {
        subjects: ['数学'],
        teaching_classes: [{ class_id: 701, subject: '数学' }],
      },
    });
  });

  it('generates a stable code when assignment summary rows omit teacher codes', () => {
    const parsed = parseTeacherImportText([
      '教师姓名,任教学科,任教班级',
      '林老师,语文,"701, 702"',
    ].join('\n'));

    const result = buildTeacherImport({
      parsedRows: parsed.rows,
      teachers: [],
      classes,
      formatClassName,
    });

    expect(result.insertedCount).toBe(1);
    expect(result.items[0].data.code).toMatch(/^AUTO\d{6}$/);
    expect(result.items[0].data.teaching_classes).toEqual([
      { class_id: 701, subject: '语文' },
      { class_id: 702, subject: '语文' },
    ]);
  });

  it('matches code-less assignment summary rows to existing teachers by name', () => {
    const parsed = parseTeacherImportText([
      '教师姓名,任教学科,任教班级',
      '林老师,数学,702',
    ].join('\n'));
    const teachers = [{
      id: 7,
      code: 'T001',
      name: '林老师',
      phone: '',
      email: '',
      subjects: ['语文'],
      roles: ['subject_teacher'],
      status: 'active',
      teaching_classes: [{ class_id: 701, subject: '语文' }],
      custom_permissions: [],
    }];

    const result = buildTeacherImport({ parsedRows: parsed.rows, teachers, classes, formatClassName });
    const committed = commitTeacherImport({ teachers, importResult: result });

    expect(result.updatedCount).toBe(1);
    expect(committed).toHaveLength(1);
    expect(committed[0]).toMatchObject({
      id: 7,
      code: 'T001',
      subjects: ['数学'],
      teaching_classes: [{ class_id: 702, subject: '数学' }],
    });
  });

  it('marks unknown classes as error rows and skips them on commit', () => {
    const parsed = parseTeacherImportText([
      '工号,姓名,电话,邮箱,任教科目,任教班级',
      'T002,王老师,13900139001,,英语,999',
    ].join('\n'));
    const result = buildTeacherImport({
      parsedRows: parsed.rows,
      teachers: [],
      classes,
      formatClassName,
    });

    expect(result.errorCount).toBe(1);
    expect(result.items[0].type).toBe('error');
    expect(result.items[0].error).toContain('班级 "999" 不存在');
    expect(commitTeacherImport({ teachers: [], importResult: result })).toEqual([]);
  });

  it('commits inserts and updates without mutating the source teacher array', () => {
    const parsed = parseTeacherImportText([
      '工号,姓名,电话,邮箱,任教科目,任教班级',
      'T001,林老师,13800138001,,数学,701',
      'T002,王老师,13900139001,,英语,702',
    ].join('\n'));
    const teachers = [{
      id: 7,
      code: 'T001',
      name: '林老师',
      phone: '13800138001',
      email: '',
      subjects: ['语文'],
      roles: ['lesson_leader'],
      status: 'active',
      teaching_classes: [{ class_id: 701, subject: '语文' }],
      custom_permissions: ['view_subject_scores'],
    }];
    const result = buildTeacherImport({ parsedRows: parsed.rows, teachers, classes, formatClassName });
    const committed = commitTeacherImport({ teachers, importResult: result });

    expect(teachers[0].subjects).toEqual(['语文']);
    expect(committed).toHaveLength(2);
    expect(committed.find(teacher => teacher.code === 'T001')).toMatchObject({
      id: 7,
      roles: ['lesson_leader'],
      custom_permissions: ['view_subject_scores'],
      subjects: ['数学'],
      teaching_classes: [{ class_id: 701, subject: '数学' }],
    });
    expect(committed.find(teacher => teacher.code === 'T002')).toMatchObject({
      id: 8,
      roles: ['subject_teacher'],
      subjects: ['英语'],
    });
  });
});
