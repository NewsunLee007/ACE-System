import fs from 'fs';
import path from 'path';
import {
  buildClassImport,
  commitClassImport,
  parseClassImportText,
} from './classImport';
import {
  buildStudentImport,
  commitStudentImport,
  parseStudentImportText,
} from './studentImport';
import {
  buildTeacherImport,
  commitTeacherImport,
  parseTeacherImportText,
} from './teacherImport';
import {
  buildScoreImport,
  parseScoreImportText,
} from './scoreImport';

const DATA_IMPORT_DIR = path.resolve(process.cwd(), '..', '..', '数据导入');
const CURRENT_ACADEMIC_YEAR = 2025;

const readFixture = (filename) => fs.readFileSync(path.join(DATA_IMPORT_DIR, filename), 'utf8');

const calculateGradeLevel = (enrollmentYear) => {
  const grade = 7 + (CURRENT_ACADEMIC_YEAR - Number(enrollmentYear));
  return { grade, name: `${grade}年级`, isActive: grade >= 7 && grade <= 9, isGraduated: grade > 9 };
};

const formatClassName = (classes, classId) => {
  const cls = classes.find(item => Number(item.id) === Number(classId));
  return cls?.name || '';
};

const buildFixtureClasses = () => {
  const parsed = parseClassImportText(readFixture('班级导入模板444.csv'));
  const result = buildClassImport({
    parsedRows: parsed.rows,
    classes: [],
    currentAcademicYear: CURRENT_ACADEMIC_YEAR,
    calculateGradeLevel,
  });

  return {
    result,
    classes: commitClassImport({
      classes: [],
      importResult: result,
      currentAcademicYear: CURRENT_ACADEMIC_YEAR,
      calculateGradeLevel,
    }),
  };
};

const buildFixtureStudents = (classes) => {
  let students = [];
  const summaries = [];

  [
    '学生导入模板（7年级）.csv',
    '学生导入模板（8年级）.csv',
    '学生导入模板（9年级）.csv',
  ].forEach(filename => {
    const parsed = parseStudentImportText(readFixture(filename));
    const result = buildStudentImport({
      parsedRows: parsed.rows,
      students,
      classes,
      currentAcademicYear: CURRENT_ACADEMIC_YEAR,
      formatClassName: (classId) => formatClassName(classes, classId),
    });
    summaries.push({ filename, result });
    students = commitStudentImport({ students, importResult: result });
  });

  return { summaries, students };
};

describe('real data import fixtures', () => {
  it('builds the class base data from 数据导入/班级导入模板444.csv', () => {
    const { result, classes } = buildFixtureClasses();

    expect(result.errors).toEqual([]);
    expect(result.insertedCount).toBe(52);
    expect(classes).toHaveLength(52);
    expect(classes.map(cls => cls.id)).toEqual(expect.arrayContaining([701, 718, 801, 818, 901, 916]));
  });

  it('builds student base data for grades 7-9 from the real CSV files', () => {
    const { classes } = buildFixtureClasses();
    const { summaries, students } = buildFixtureStudents(classes);

    summaries.forEach(({ filename, result }) => {
      expect(result.errorCount).toBe(0);
      expect({ filename, insertedCount: result.insertedCount }).toEqual({
        filename,
        insertedCount: expect.any(Number),
      });
      expect(result.insertedCount).toBeGreaterThan(600);
    });
    expect(students).toHaveLength(2253);
    expect(students.some(student => Number(student.class_id) === 701)).toBe(true);
    expect(students.some(student => Number(student.class_id) === 916)).toBe(true);
  });

  it('builds teacher assignments from the full teacher file and assignment summaries', () => {
    const { classes } = buildFixtureClasses();
    let teachers = [];

    [
      '教师导入模板555.csv',
      '教师任教班级汇总表.csv',
      '202602211743.csv',
    ].forEach(filename => {
      const parsed = parseTeacherImportText(readFixture(filename));
      const result = buildTeacherImport({
        parsedRows: parsed.rows,
        teachers,
        classes,
        formatClassName: (classId) => formatClassName(classes, classId),
      });

      expect({ filename, errorCount: result.errorCount }).toEqual({ filename, errorCount: 0 });
      expect(result.items.length).toBeGreaterThan(0);
      teachers = commitTeacherImport({ teachers, importResult: result });
    });

    expect(teachers.length).toBeGreaterThanOrEqual(137);
    expect(teachers.find(teacher => teacher.name === '林听听')).toMatchObject({
      subjects: expect.arrayContaining(['语文']),
    });
    expect(teachers.some(teacher => teacher.teaching_classes?.some(tc => Number(tc.class_id) === 916))).toBe(true);
  });

  it('parses the real 7th-grade score files against the imported students and classes', () => {
    const { classes } = buildFixtureClasses();
    const { students } = buildFixtureStudents(classes);
    const exams = [
      {
        filename: '2025-1 7年级教学调研_成绩导入模板.csv',
        id: 1001,
        exam_name: '2025-1 7年级教学调研',
      },
      {
        filename: '2025-1 7年级期末考试_成绩导入模板.csv',
        id: 1002,
        exam_name: '2025-1 7年级期末考试',
      },
    ];

    exams.forEach(exam => {
      const parsed = parseScoreImportText(readFixture(exam.filename));
      const result = buildScoreImport({
        parsedRows: parsed.rows,
        headers: parsed.headers,
        examData: {
          id: exam.id,
          exam_name: exam.exam_name,
          grade_level: '7年级',
          subjects: ['语文', '数学', '英语', '科学', '社会'],
        },
        students,
        classes,
        existingExamScores: [],
      });

      expect({ filename: exam.filename, errors: result.errors.length }).toEqual({
        filename: exam.filename,
        errors: expect.any(Number),
      });
      expect(result.importedScores.length).toBeGreaterThan(820);
      expect(result.errors.length).toBeLessThanOrEqual(3);
      expect(result.validCount).toBeGreaterThan(810);
      expect(result.validCount).toBeLessThan(result.importedScores.length);
      expect(result.topScore).toBeGreaterThan(400);
    });
  });
});
