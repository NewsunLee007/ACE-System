const CLASS_NO_FIELDS = ['班级序号', '班级编号', '班级', 'class_no', 'class_id', 'class'];
const ENROLLMENT_YEAR_FIELDS = ['入学年份', '入学年度', 'enrollment_year', 'year'];
const CLASSROOM_FIELDS = ['教室位置', '教室', 'classroom_location', 'classroom'];
const STATUS_FIELDS = ['状态', 'status'];

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
  const number = Number(normalizeText(value));
  return Number.isFinite(number) ? number : null;
};

export const normalizeClassNo = (value) => {
  const text = normalizeText(value);
  if (!text) return '';

  const match = text.match(/\d+/);
  if (!match) return text;

  const number = Number(match[0]);
  if (!Number.isFinite(number)) return text;

  const sequence = number >= 100 ? number % 100 : number;
  return String(sequence).padStart(2, '0');
};

const normalizeStatus = (value) => {
  const text = normalizeText(value).toLowerCase();
  return ['已毕业', '毕业', 'inactive', 'disabled', '0', '否'].includes(text) ? 'inactive' : 'active';
};

const getGradeInfo = ({ enrollmentYear, currentAcademicYear, calculateGradeLevel }) => {
  if (typeof calculateGradeLevel === 'function') {
    return calculateGradeLevel(enrollmentYear);
  }

  const grade = 7 + (Number(currentAcademicYear) - Number(enrollmentYear));
  return { grade, isGraduated: grade > 9 };
};

export const getClassBaseId = ({
  classNo,
  enrollmentYear,
  currentAcademicYear,
  calculateGradeLevel,
}) => {
  const normalizedClassNo = normalizeClassNo(classNo);
  const classNumber = Number(normalizedClassNo);
  if (!Number.isFinite(classNumber) || classNumber <= 0) return null;

  const gradeInfo = getGradeInfo({ enrollmentYear, currentAcademicYear, calculateGradeLevel });
  const grade = Number(gradeInfo?.grade);
  if (!Number.isFinite(grade)) return null;

  return grade * 100 + classNumber;
};

export const allocateClassId = ({
  classNo,
  enrollmentYear,
  classes = [],
  usedIds,
  currentAcademicYear,
  calculateGradeLevel,
}) => {
  const ids = usedIds || new Set((classes || []).map(cls => Number(cls.id)).filter(Number.isFinite));
  const baseId = getClassBaseId({ classNo, enrollmentYear, currentAcademicYear, calculateGradeLevel });

  if (!baseId) {
    throw new Error('无法生成班级编号，请检查入学年份和班级序号');
  }

  if (!ids.has(baseId)) {
    ids.add(baseId);
    return baseId;
  }

  for (let counter = 1; counter < 1000; counter += 1) {
    const candidateId = baseId * 10 + counter;
    if (!ids.has(candidateId)) {
      ids.add(candidateId);
      return candidateId;
    }
  }

  throw new Error('可用班级编号已用尽，请检查重复班级数据');
};

export const findExistingClass = ({
  classes = [],
  classNo,
  enrollmentYear,
  currentAcademicYear,
  calculateGradeLevel,
}) => {
  const normalizedClassNo = normalizeClassNo(classNo);
  const year = Number(enrollmentYear);
  const baseId = getClassBaseId({ classNo, enrollmentYear, currentAcademicYear, calculateGradeLevel });

  return (classes || []).find(cls => (
    Number(cls.enrollment_year) === year &&
    normalizeClassNo(cls.class_no || cls.id) === normalizedClassNo
  )) || (classes || []).find(cls => (
    baseId !== null && Number(cls.id) === Number(baseId)
  )) || null;
};

export const parseClassImportText = (text) => {
  const lines = normalizeText(text)
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#');
    });

  if (lines.length === 0) {
    return { headers: [], rows: [], delimiter: ',' };
  }

  if (lines.length < 2) {
    throw new Error('文件格式错误：缺少表头或数据行');
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitDelimitedLine(lines[0], delimiter).map(header => normalizeText(header).replace(/^\uFEFF/, ''));
  const rows = lines.slice(1).map(line => {
    const cells = splitDelimitedLine(line, delimiter);
    return headers.reduce((result, header, index) => {
      result[header] = normalizeText(cells[index]);
      return result;
    }, {});
  });

  return { headers, rows, delimiter };
};

export const buildClassImport = ({
  parsedRows,
  classes = [],
  currentAcademicYear,
  calculateGradeLevel,
}) => {
  const items = [];
  const errors = [];
  const seenKeys = new Set();

  (parsedRows || []).forEach((row, index) => {
    const lineNumber = index + 2;
    const rawClassNo = findValue(row, CLASS_NO_FIELDS);
    const classNo = normalizeClassNo(rawClassNo);
    const enrollmentYear = toNumber(findValue(row, ENROLLMENT_YEAR_FIELDS)) || Number(currentAcademicYear);
    const classroomLocation = findValue(row, CLASSROOM_FIELDS);
    const status = normalizeStatus(findValue(row, STATUS_FIELDS));

    if (!classNo) {
      errors.push(`第${lineNumber}行：班级序号不能为空`);
      return;
    }
    if (!Number.isFinite(enrollmentYear)) {
      errors.push(`第${lineNumber}行：入学年份不正确`);
      return;
    }

    const key = `${enrollmentYear}:${classNo}`;
    if (seenKeys.has(key)) {
      errors.push(`第${lineNumber}行：同一文件中重复出现 ${enrollmentYear}级${classNo}班`);
      return;
    }
    seenKeys.add(key);

    const existingClass = findExistingClass({
      classes,
      classNo,
      enrollmentYear,
      currentAcademicYear,
      calculateGradeLevel,
    });

    const data = {
      class_no: classNo,
      enrollment_year: enrollmentYear,
      classroom_location: classroomLocation,
      status,
    };

    if (existingClass) {
      const changes = [];
      if (classroomLocation && classroomLocation !== (existingClass.classroom_location || '')) {
        changes.push('classroom_location');
      }
      if (status !== existingClass.status) {
        changes.push('status');
      }
      if (normalizeText(existingClass.class_no || existingClass.id) !== classNo) {
        changes.push('class_no');
      }

      items.push({
        type: changes.length > 0 ? 'update' : 'unchanged',
        data,
        existingData: existingClass,
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
    errors,
    insertedCount: items.filter(item => item.type === 'new').length,
    updatedCount: items.filter(item => item.type === 'update').length,
    unchangedCount: items.filter(item => item.type === 'unchanged').length,
    total: items.length,
  };
};

export const commitClassImport = ({
  classes = [],
  importResult,
  currentAcademicYear,
  calculateGradeLevel,
}) => {
  const nextClasses = (classes || []).map(cls => ({
    ...cls,
    class_no: normalizeClassNo(cls.class_no || cls.id),
  }));
  const byId = new Map(nextClasses.map(cls => [Number(cls.id), cls]));
  const usedIds = new Set(nextClasses.map(cls => Number(cls.id)).filter(Number.isFinite));

  (importResult?.items || []).forEach(item => {
    if (item.type === 'unchanged') return;

    if (item.type === 'update') {
      const id = Number(item.existingData?.id);
      const previous = byId.get(id) || item.existingData || {};
      byId.set(id, {
        ...previous,
        class_no: normalizeClassNo(item.data.class_no || previous.class_no || previous.id),
        enrollment_year: item.data.enrollment_year || previous.enrollment_year,
        classroom_location: item.data.classroom_location || previous.classroom_location || '',
        status: item.data.status || previous.status || 'active',
        updated_at: new Date().toISOString().split('T')[0],
      });
      return;
    }

    const id = allocateClassId({
      classNo: item.data.class_no,
      enrollmentYear: item.data.enrollment_year,
      usedIds,
      currentAcademicYear,
      calculateGradeLevel,
    });
    const gradeInfo = getGradeInfo({
      enrollmentYear: item.data.enrollment_year,
      currentAcademicYear,
      calculateGradeLevel,
    });
    const isGraduated = Boolean(gradeInfo?.isGraduated) ||
      item.data.status === 'inactive' ||
      Number(item.data.enrollment_year) <= Number(currentAcademicYear) - 3;

    byId.set(id, {
      id,
      class_no: normalizeClassNo(item.data.class_no),
      name: `${item.data.enrollment_year}级${normalizeClassNo(item.data.class_no)}班`,
      enrollment_year: item.data.enrollment_year,
      head_teacher_id: null,
      classroom_location: item.data.classroom_location || '',
      status: isGraduated ? 'inactive' : 'active',
      created_at: new Date().toISOString().split('T')[0],
    });
  });

  return Array.from(byId.values());
};
