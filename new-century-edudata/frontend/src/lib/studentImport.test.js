import {
  buildStudentImport,
  commitStudentImport,
  parseStudentImportText,
} from './studentImport';

const classes = [
  { id: 701, class_no: '01', name: '2025级01班', enrollment_year: 2025 },
  { id: 702, class_no: '02', name: '2025级02班', enrollment_year: 2025 },
  { id: 801, class_no: '01', name: '2024级01班', enrollment_year: 2024 },
];

const formatClassName = (classId) => classes.find(cls => cls.id === classId)?.name || '';

describe('student import helpers', () => {
  it('parses student rows copied from Excel as tab-delimited text', () => {
    const parsed = parseStudentImportText('学籍辅号\t姓名\t性别\t班级编号\t状态\t入学年份\n20250701001\t张一\t男\t701\t在读\t2025');

    expect(parsed.headers).toEqual(['学籍辅号', '姓名', '性别', '班级编号', '状态', '入学年份']);
    expect(parsed.rows[0]).toMatchObject({
      学籍辅号: '20250701001',
      姓名: '张一',
      班级编号: '701',
    });
  });

  it('previews existing student codes as updates instead of duplicate errors', () => {
    const parsed = parseStudentImportText([
      '学籍辅号,姓名,性别,班级编号,状态,入学年份',
      '20250701001,张一,女,701,在读,2025',
      '20250701002,李二,男,02,在读,2025',
    ].join('\n'));
    const students = [
      { id: 1, student_code: '20250701001', name: '张一', gender: 1, class_id: 701, status: '在读', enrollment_year: 2025 },
    ];

    const result = buildStudentImport({
      parsedRows: parsed.rows,
      students,
      classes,
      currentAcademicYear: 2025,
      formatClassName,
    });

    expect(result.errorCount).toBe(0);
    expect(result.updatedCount).toBe(1);
    expect(result.insertedCount).toBe(1);
    expect(result.items[0]).toMatchObject({
      type: 'update',
      changes: ['gender'],
      data: { class_id: 701 },
    });
    expect(result.items[1]).toMatchObject({
      type: 'new',
      data: { class_id: 702 },
    });
  });

  it('marks invalid classes as error rows and skips them on commit', () => {
    const parsed = parseStudentImportText([
      '学籍辅号,姓名,性别,班级编号,状态,入学年份',
      '20250701003,王三,男,999,在读,2025',
    ].join('\n'));
    const result = buildStudentImport({
      parsedRows: parsed.rows,
      students: [],
      classes,
      currentAcademicYear: 2025,
      formatClassName,
    });

    expect(result.errorCount).toBe(1);
    expect(result.items[0]).toMatchObject({
      type: 'error',
      data: { class_id: null },
    });
    expect(result.items[0].error).toContain('班级编号 "999" 不存在');
    expect(commitStudentImport({ students: [], importResult: result })).toEqual([]);
  });

  it('commits updates and inserts without mutating the source student array', () => {
    const parsed = parseStudentImportText([
      '学籍辅号,姓名,性别,班级编号,状态,入学年份',
      '20250701001,张一,女,701,在读,2025',
      '20250701002,李二,男,2025级02班,在读,2025',
    ].join('\n'));
    const students = [
      { id: 10, student_code: '20250701001', name: '张一', gender: 1, class_id: 701, status: '在读', enrollment_year: 2025 },
    ];
    const result = buildStudentImport({
      parsedRows: parsed.rows,
      students,
      classes,
      currentAcademicYear: 2025,
      formatClassName,
    });

    const committed = commitStudentImport({ students, importResult: result });

    expect(students[0].gender).toBe(1);
    expect(committed).toHaveLength(2);
    expect(committed.find(student => student.student_code === '20250701001')).toMatchObject({
      id: 10,
      gender: 0,
    });
    expect(committed.find(student => student.student_code === '20250701002')).toMatchObject({
      id: 11,
      class_id: 702,
    });
  });
});
