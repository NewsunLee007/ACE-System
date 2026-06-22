import { normalizeClassNo } from './classImport';
import { normalizeStudentStatus } from './studentRegistry';

const STUDENT_CODE_FIELDS = ['学籍辅号', '学生编号', '学号', 'student_code', 'code'];
const NAME_FIELDS = ['姓名', '学生姓名', 'name', 'student_name'];
const GENDER_FIELDS = ['性别(男/女)', '性别', 'gender'];
const CLASS_FIELDS = ['班级编号', '班级', '班级ID', 'class_id', 'class'];
const STATUS_FIELDS = ['状态(在读/休学/转学/退学)', '状态', 'status'];
const ENROLLMENT_YEAR_FIELDS = ['入学年份', '入学年度', 'enrollment_year', 'year'];

const normalizeText = (value) => String(value ?? '').trim();

const splitDelimitedLine = (line, delimiter) => {
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

const findValue = (row, fields) => {
  const field = fields.find(name => normalizeText(row[name]));
  return field ? normalizeText(row[field]) : '';
};

const toNumber = (value) => {
  const text = normalizeText(value);
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

const normalizeGender = (value) => {
  const text = normalizeText(value).toLowerCase();
  if (['女', '0', '2', 'f', 'female'].includes(text)) return 0;
  return 1;
};

const normalizeStatus = (value) => normalizeStudentStatus(value, '在籍');

const isInstructionLine = (line) => {
  const trimmed = line.trim();
  return trimmed.startsWith('#') || trimmed.startsWith('【') || /^\d+\.\s/.test(trimmed);
};

export const parseStudentImportText = (text) => {
  const lines = normalizeText(text)
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .filter(line => line.trim() && !isInstructionLine(line));

  if (lines.length === 0) {
    return { headers: [], rows: [], delimiter: ',' };
  }

  if (lines.length < 2) {
    throw new Error('文件格式错误：缺少表头或数据行');
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitDelimitedLine(lines[0], delimiter).map(header => normalizeText(header).replace(/^\uFEFF/, ''));
  const rows = lines.slice(1).map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    return headers.reduce((result, header, index) => {
      result[header] = normalizeText(cells[index]);
      return result;
    }, {});
  });

  return { headers, rows, delimiter };
};

const resolveClass = ({
  classText,
  classes = [],
  enrollmentYear,
  formatClassName,
}) => {
  const value = normalizeText(classText).replace(/班$/, '');
  if (!value) return null;

  const idMatch = value.match(/\d{3,4}/);
  if (idMatch) {
    const matchedById = classes.find(cls => Number(cls.id) === Number(idMatch[0]));
    if (matchedById) return matchedById;
  }

  return classes.find(cls => {
    const formattedName = formatClassName ? formatClassName(cls.id) : '';
    const classNo = normalizeClassNo(cls.class_no || cls.id);
    const targetNo = normalizeClassNo(value);
    const sameYear = !enrollmentYear || Number(cls.enrollment_year) === Number(enrollmentYear);

    return (
      normalizeText(cls.id) === value ||
      normalizeText(cls.class_no) === value ||
      normalizeText(cls.name) === normalizeText(classText) ||
      normalizeText(formattedName) === normalizeText(classText) ||
      (classNo === targetNo && sameYear)
    );
  }) || null;
};

const validateStudentCode = (code) => {
  if (!code) return '学籍辅号不能为空';
  if (!/^\d{10,13}$/.test(code)) return '学籍辅号必须是10-13位数字';
  return '';
};

export const buildStudentImport = ({
  parsedRows,
  students = [],
  classes = [],
  currentAcademicYear,
  formatClassName,
}) => {
  const items = [];
  const seenCodes = new Set();

  (parsedRows || []).forEach((row, index) => {
    const lineNumber = index + 2;
    const studentCode = findValue(row, STUDENT_CODE_FIELDS);
    const name = findValue(row, NAME_FIELDS);
    const gender = normalizeGender(findValue(row, GENDER_FIELDS));
    const classText = findValue(row, CLASS_FIELDS);
    const explicitEnrollmentYear = toNumber(findValue(row, ENROLLMENT_YEAR_FIELDS));
    const classObj = resolveClass({ classText, classes, enrollmentYear: explicitEnrollmentYear, formatClassName });
    const enrollmentYear = explicitEnrollmentYear || Number(classObj?.enrollment_year) || Number(currentAcademicYear);
    const normalizedStatus = normalizeStatus(findValue(row, STATUS_FIELDS));
    const existingStudent = (students || []).find(student => normalizeText(student.student_code) === studentCode);

    const data = {
      student_code: studentCode,
      name,
      gender,
      class_id: classObj ? Number(classObj.id) : null,
      status: normalizedStatus.status,
      raw_status: normalizedStatus.isAnomaly ? normalizedStatus.rawStatus : '',
      enrollment_year: enrollmentYear,
    };

    const errors = [];
    const codeError = validateStudentCode(studentCode);
    if (codeError) errors.push(codeError);
    if (studentCode && seenCodes.has(studentCode)) errors.push(`学籍辅号 "${studentCode}" 在导入文件中重复`);
    if (!name) errors.push('姓名不能为空');
    if (!classText) errors.push('班级不能为空');
    if (classText && !classObj) errors.push(`班级编号 "${classText}" 不存在，请先维护班级`);
    if (!Number.isFinite(enrollmentYear)) errors.push('入学年份不正确');
    if (studentCode) seenCodes.add(studentCode);

    if (errors.length > 0) {
      items.push({
        type: 'error',
        data,
        existingData: existingStudent || null,
        error: `第${lineNumber}行：${errors.join('；')}`,
        lineNumber,
      });
      return;
    }

    if (existingStudent) {
      const changes = [];
      if (name !== existingStudent.name) changes.push('name');
      if (gender !== Number(existingStudent.gender)) changes.push('gender');
      if (Number(classObj.id) !== Number(existingStudent.class_id)) changes.push('class_id');
      if (normalizedStatus.status !== existingStudent.status) changes.push('status');
      if (Number(enrollmentYear) !== Number(existingStudent.enrollment_year)) changes.push('enrollment_year');

      items.push({
        type: changes.length > 0 ? 'update' : 'unchanged',
        data,
        existingData: existingStudent,
        changes,
        lineNumber,
      });
      return;
    }

    items.push({
      type: 'new',
      data,
      lineNumber,
    });
  });

  return {
    items,
    insertedCount: items.filter(item => item.type === 'new').length,
    updatedCount: items.filter(item => item.type === 'update').length,
    unchangedCount: items.filter(item => item.type === 'unchanged').length,
    errorCount: items.filter(item => item.type === 'error').length,
    total: items.length,
  };
};

export const commitStudentImport = ({ students = [], importResult }) => {
  const nextStudents = (students || []).map(student => ({ ...student }));
  const byCode = new Map(nextStudents.map(student => [normalizeText(student.student_code), student]));
  const maxId = Math.max(0, ...nextStudents.map(student => Number(student.id)).filter(Number.isFinite));
  let nextId = Math.ceil(maxId) + 1;

  (importResult?.items || []).forEach(item => {
    if (item.type === 'error' || item.type === 'unchanged') return;

    const existing = byCode.get(normalizeText(item.data.student_code)) ||
      nextStudents.find(student => Number(student.id) === Number(item.existingData?.id));
    if (existing) {
      Object.assign(existing, {
        student_code: item.data.student_code,
        name: item.data.name,
        gender: item.data.gender,
        class_id: item.data.class_id,
        status: item.data.status,
        raw_status: item.data.raw_status || '',
        enrollment_year: item.data.enrollment_year,
        updated_at: new Date().toISOString().split('T')[0],
      });
      byCode.set(normalizeText(existing.student_code), existing);
      return;
    }

    const newStudent = {
      id: nextId++,
      student_code: item.data.student_code,
      name: item.data.name,
      gender: item.data.gender,
      class_id: item.data.class_id,
      status: item.data.status,
      raw_status: item.data.raw_status || '',
      enrollment_year: item.data.enrollment_year,
      created_at: new Date().toISOString().split('T')[0],
    };
    nextStudents.push(newStudent);
    byCode.set(normalizeText(newStudent.student_code), newStudent);
  });

  return nextStudents;
};
