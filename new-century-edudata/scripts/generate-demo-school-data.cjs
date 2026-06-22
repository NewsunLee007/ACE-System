const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_IMPORT_DIR = path.resolve(ROOT, '..', '数据导入');
const OUTPUT_FILE = path.resolve(ROOT, 'frontend/src/data/demoSchoolData.js');
const CURRENT_ACADEMIC_YEAR = 2025;
const TODAY = '2026-02-25';
const GENERATED_AT = '2026-06-19T00:00:00.000Z';
const SCORE_SUBJECTS = ['语文', '数学', '英语', '科学', '社会'];

const readFixture = (filename) => fs.readFileSync(path.join(DATA_IMPORT_DIR, filename), 'utf8');

const normalizeText = (value) => String(value ?? '').replace(/^\uFEFF/, '').trim();

const normalizeClassNo = (value) => {
  const text = normalizeText(value).replace(/班$/, '');
  const match = text.match(/\d+/);
  if (!match) return text;
  const number = Number(match[0]);
  if (!Number.isFinite(number)) return text;
  const sequence = number >= 100 ? number % 100 : number;
  return String(sequence).padStart(2, '0');
};

const calculateGrade = (enrollmentYear) => 7 + (CURRENT_ACADEMIC_YEAR - Number(enrollmentYear));

const splitCsvLine = (line, delimiter = ',') => {
  if (delimiter !== ',') return line.split(delimiter);

  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
};

const parseCsv = (text, { skipComments = true } = {}) => {
  const lines = normalizeText(text)
    .replace(/\r/g, '')
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (skipComments && trimmed.startsWith('#')) return false;
      return true;
    });

  if (!lines.length) return { headers: [], rows: [] };

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeText);
  const rows = lines.slice(1).map(line => {
    const cells = splitCsvLine(line, delimiter);
    return headers.reduce((result, header, index) => {
      result[header] = normalizeText(cells[index]);
      return result;
    }, {});
  }).filter(row => Object.values(row).some(value => normalizeText(value)));

  return { headers, rows };
};

const splitList = (value) => normalizeText(value)
  .split(/[，,、;；\s]+/)
  .map(normalizeText)
  .filter(Boolean)
  .filter(item => !['#N/A', 'N/A', 'NA', '无', '暂无', '-', '--'].includes(item.toUpperCase()));

const toNumber = (value) => {
  const text = normalizeText(value).replace(/,/g, '');
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

const genderToCode = (value) => {
  const text = normalizeText(value).toLowerCase();
  return ['女', '0', '2', 'f', 'female'].includes(text) ? 0 : 1;
};

const uniqueBy = (items, keyFn) => {
  const seen = new Set();
  return items.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const teacherCodeFromName = (name) => {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return '';
  let hash = 0;
  for (let index = 0; index < normalizedName.length; index += 1) {
    hash = (hash * 31 + normalizedName.charCodeAt(index)) % 1000000;
  }
  return `AUTO${String(hash).padStart(6, '0')}`;
};

const buildClasses = () => {
  const { rows } = parseCsv(readFixture('班级导入模板444.csv'));
  return rows.map(row => {
    const classNo = normalizeClassNo(row['班级序号']);
    const enrollmentYear = Number(row['入学年份']);
    const grade = calculateGrade(enrollmentYear);
    const id = grade * 100 + Number(classNo);
    return {
      id,
      class_no: classNo,
      name: `${enrollmentYear}级${classNo}班`,
      enrollment_year: enrollmentYear,
      head_teacher_id: null,
      classroom_location: row['教室位置'] || '',
      status: row['状态'] === '已毕业' ? 'inactive' : 'active',
      created_at: TODAY,
    };
  }).sort((a, b) => Number(a.id) - Number(b.id));
};

const buildStudents = (classes) => {
  const classIds = new Set(classes.map(item => Number(item.id)));
  const students = [];
  const byCode = new Map();
  let nextId = 1;

  [
    '学生导入模板（7年级）.csv',
    '学生导入模板（8年级）.csv',
    '学生导入模板（9年级）.csv',
  ].forEach(filename => {
    const { rows } = parseCsv(readFixture(filename));
    rows.forEach(row => {
      const studentCode = normalizeText(row['学籍辅号']);
      const name = normalizeText(row['姓名']);
      const classId = Number(row['班级编号'] || row['班级']);
      const enrollmentYear = Number(row['入学年份']);
      if (!studentCode || !name || !classIds.has(classId)) return;

      const existing = byCode.get(studentCode);
      const next = {
        id: existing?.id || nextId++,
        student_code: studentCode,
        name,
        gender: genderToCode(row['性别(男/女)'] || row['性别']),
        class_id: classId,
        status: row['状态(在读/休学/转学/退学)'] || row['状态'] || row['分类'] || '在籍',
        enrollment_year: Number.isFinite(enrollmentYear) ? enrollmentYear : classes.find(cls => Number(cls.id) === classId)?.enrollment_year,
        created_at: existing?.created_at || TODAY,
      };
      if (existing) next.updated_at = TODAY;
      byCode.set(studentCode, next);
    });
  });

  byCode.forEach(student => students.push(student));
  return students.sort((a, b) => Number(a.class_id) - Number(b.class_id) || Number(a.id) - Number(b.id));
};

const buildTeachers = (classes) => {
  const classIds = new Set(classes.map(item => Number(item.id)));
  const teachers = [];
  const byKey = new Map();
  let nextId = 1;

  const upsertTeacher = ({ code, name, phone = '', email = '', subjects = [], classIds: teacherClassIds = [] }) => {
    if (!name) return;
    const teacherCode = code || teacherCodeFromName(name);
    const existingKey = byKey.has(teacherCode)
      ? teacherCode
      : Array.from(byKey.keys()).find(key => byKey.get(key).name === name);
    const key = existingKey || teacherCode;
    const previous = byKey.get(key) || {
      id: nextId++,
      code: teacherCode,
      name,
      phone,
      email,
      initial_password: '',
      subjects: [],
      roles: ['subject_teacher'],
      status: 'active',
      teaching_classes: [],
      custom_permissions: [],
      created_at: TODAY,
    };

    previous.code = previous.code || teacherCode;
    previous.name = previous.name || name;
    previous.phone = previous.phone || phone;
    previous.email = previous.email || email;
    previous.subjects = uniqueBy([...previous.subjects, ...subjects], item => item);
    teacherClassIds
      .filter(classId => classIds.has(Number(classId)))
      .forEach(classId => {
        subjects.forEach(subject => {
          previous.teaching_classes.push({ class_id: Number(classId), subject });
        });
      });
    previous.teaching_classes = uniqueBy(previous.teaching_classes, item => `${item.class_id}:${item.subject}`);
    byKey.set(key, previous);
  };

  [
    '教师导入模板555.csv',
    '教师任教班级汇总表.csv',
    '202602211743.csv',
  ].forEach(filename => {
    const { rows } = parseCsv(readFixture(filename));
    rows.forEach(row => {
      const name = normalizeText(row['姓名'] || row['教师姓名']);
      const summaryName = normalizeText(row['教师姓名']);
      const teacherName = name || summaryName;
      const subjects = splitList(row['任教科目'] || row['任教学科']);
      const teacherClassIds = splitList(row['任教班级'])
        .map(item => {
          const match = String(item).match(/\d{3,4}/);
          return match ? Number(match[0]) : null;
        })
        .filter(Number.isFinite);

      upsertTeacher({
        code: normalizeText(row['工号']) || '',
        name: teacherName,
        phone: normalizeText(row['电话']),
        email: normalizeText(row['邮箱']),
        subjects,
        classIds: teacherClassIds,
      });
    });
  });

  byKey.forEach(teacher => teachers.push(teacher));
  return teachers.sort((a, b) => Number(a.id) - Number(b.id));
};

const buildClassLayers = (classes) => {
  const classesById = new Map(classes.map(cls => [Number(cls.id), cls]));
  const { rows } = parseCsv(readFixture('班级层次导入模板.csv'));

  return rows.map((row, index) => {
    const match = normalizeText(row['班级名称']).match(/\d{3,4}/);
    const classId = match ? Number(match[0]) : null;
    const cls = classesById.get(classId);
    if (!cls) return null;
    const layerCode = normalizeText(row['层次代码']).toUpperCase() || 'C';
    const gradeLevel = `${Math.floor(classId / 100)}年级`;
    return {
      id: `seed_layer_${index + 1}`,
      grade_level: gradeLevel,
      class_id: classId,
      class_name: `${classId}班`,
      layer_code: layerCode,
      layer_name: `${layerCode}层`,
      created_at: TODAY,
    };
  }).filter(Boolean);
};

const findStudentForScore = ({ row, students, classId }) => {
  const code = normalizeText(row['学籍辅号']);
  const name = normalizeText(row['姓名']);
  return students.find(student => code && student.student_code === code) ||
    students.find(student => name && student.name === name && Number(student.class_id) === Number(classId)) ||
    null;
};

const buildScoresForExam = ({ exam, filename, students, classes }) => {
  const classIds = new Set(classes.map(item => Number(item.id)));
  const { rows } = parseCsv(readFixture(filename), { skipComments: false });
  const imported = [];

  rows.forEach((row, index) => {
    const rowClassId = toNumber(row['班级']) || null;
    const student = findStudentForScore({ row, students, classId: rowClassId });
    const classId = rowClassId || Number(student?.class_id);
    if (!classId || !classIds.has(Number(classId)) || !student) return;

    const validFlag = normalizeText(row['参与统计']);
    const isValid = !['否', '不是', '不参与', '缺考', '无效', '0', 'false', 'no'].includes(validFlag.toLowerCase());
    const scores = {};
    SCORE_SUBJECTS.forEach(subject => {
      const score = toNumber(row[subject]);
      if (score !== null && score >= 0) scores[subject] = score;
    });
    if (Object.keys(scores).length === 0 && isValid) return;

    const totalScore = toNumber(row['总分']) ?? Object.values(scores).reduce((sum, score) => sum + score, 0);
    imported.push({
      id: `${exam.id}_${student.id}`,
      exam_id: exam.id,
      student_id: student.id,
      student_code: student.student_code,
      student_name: normalizeText(row['姓名']) || student.name,
      class_id: classId,
      scores,
      total_score: totalScore,
      is_valid: isValid,
      additional_classes: [],
      rank: 0,
      class_rank: 0,
      created_at: TODAY,
      updated_at: TODAY,
    });
  });

  const validScores = imported
    .filter(score => score.is_valid !== false && Number(score.total_score) > 0)
    .sort((a, b) => Number(b.total_score) - Number(a.total_score));
  validScores.forEach((score, index) => {
    score.rank = index + 1;
  });

  const byClass = new Map();
  validScores.forEach(score => {
    const key = Number(score.class_id);
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key).push(score);
  });
  byClass.forEach(classScores => {
    classScores
      .sort((a, b) => Number(b.total_score) - Number(a.total_score))
      .forEach((score, index) => {
        score.class_rank = index + 1;
      });
  });

  return imported.sort((a, b) => Number(a.student_id) - Number(b.student_id));
};

const buildExamSet = ({ students, classes }) => {
  const exams = [
    {
      id: 1001,
      exam_name: '2025-1 7年级教学调研',
      name: '2025-1 7年级教学调研',
      grade_level: '7年级',
      term: '2025-1',
      exam_date: '2026-02-21',
      subjects: SCORE_SUBJECTS,
      subject_scores: SCORE_SUBJECTS.reduce((result, subject) => ({ ...result, [subject]: 100 }), {}),
      full_score: 500,
      status: '已完成',
      created_at: TODAY,
    },
    {
      id: 1002,
      exam_name: '2025-1 7年级期末考试',
      name: '2025-1 7年级期末考试',
      grade_level: '7年级',
      term: '2025-1',
      exam_date: '2026-02-25',
      subjects: SCORE_SUBJECTS,
      subject_scores: SCORE_SUBJECTS.reduce((result, subject) => ({ ...result, [subject]: 100 }), {}),
      full_score: 500,
      status: '已完成',
      created_at: TODAY,
    },
  ];

  const examScores = [
    ...buildScoresForExam({ exam: exams[0], filename: '2025-1 7年级教学调研_成绩导入模板.csv', students, classes }),
    ...buildScoresForExam({ exam: exams[1], filename: '2025-1 7年级期末考试_成绩导入模板.csv', students, classes }),
  ];

  exams.forEach(exam => {
    const rows = examScores.filter(score => Number(score.exam_id) === Number(exam.id));
    const validRows = rows.filter(score => score.is_valid !== false && Number(score.total_score) > 0);
    exam.total_students = rows.length;
    exam.valid_students = validRows.length;
    exam.avg_score = validRows.length
      ? Number((validRows.reduce((sum, row) => sum + Number(row.total_score), 0) / validRows.length).toFixed(1))
      : 0;
    exam.top_score = validRows.length ? Math.max(...validRows.map(row => Number(row.total_score))) : 0;
  });

  return { exams, examScores };
};

const buildParents = (students) => students.slice(0, 20).flatMap((student, index) => ([
  {
    id: index * 2 + 1,
    name: `${student.name}家长A`,
    relation: '父亲',
    phone: `138${String(index + 1).padStart(8, '0')}`,
    email: '',
    student_ids: [student.id],
    student_codes: [student.student_code],
    status: 'normal',
    created_at: TODAY,
  },
  {
    id: index * 2 + 2,
    name: `${student.name}家长B`,
    relation: '母亲',
    phone: `139${String(index + 1).padStart(8, '0')}`,
    email: '',
    student_ids: [student.id],
    student_codes: [student.student_code],
    status: 'normal',
    created_at: TODAY,
  },
]));

const classes = buildClasses();
const students = buildStudents(classes);
const teachers = buildTeachers(classes);
const classLayers = buildClassLayers(classes);
const { exams, examScores } = buildExamSet({ students, classes });
const parents = buildParents(students);

const payload = {
  version: '2026-06-19.real-import-seed',
  generated_at: GENERATED_AT,
  source: '数据导入 CSV files',
  subjects: SCORE_SUBJECTS,
  classes,
  students,
  teachers,
  parents,
  classLayers,
  exams,
  examScores,
};

const output = `// Auto-generated by scripts/generate-demo-school-data.cjs.
// Do not edit this file by hand; update files under 数据导入 and rerun the generator.

export const DEMO_DATA_VERSION = ${JSON.stringify(payload.version)};

export const DEMO_SCHOOL_DATA = ${JSON.stringify(payload, null, 2)};

export default DEMO_SCHOOL_DATA;
`;

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, output);

console.log(`Wrote ${path.relative(ROOT, OUTPUT_FILE)}`);
console.log(JSON.stringify({
  classes: classes.length,
  students: students.length,
  teachers: teachers.length,
  parents: parents.length,
  classLayers: classLayers.length,
  exams: exams.length,
  examScores: examScores.length,
}, null, 2));
