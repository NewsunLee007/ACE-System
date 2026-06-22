import schoolData from '../data/schoolData';
import { apiRequest } from './api';

const STUDENT_CODE_FIELDS = ['学籍辅号', '学号', '考号', '学生编号', 'student_code', 'code'];
const STUDENT_NAME_FIELDS = ['姓名', '学生姓名', 'name', 'student_name'];
const CLASS_FIELDS = ['班级', '班级编号', '班级ID', 'class_id', 'class'];
const TOTAL_FIELDS = ['总分', 'total_score', 'total'];
const VALID_FIELDS = ['参与统计', '是否参与统计', '有效', '是否有效', 'is_valid'];
const KNOWN_FIELDS = new Set([
  ...STUDENT_CODE_FIELDS,
  ...STUDENT_NAME_FIELDS,
  ...CLASS_FIELDS,
  ...TOTAL_FIELDS,
  ...VALID_FIELDS,
  '额外统计班级',
]);

const normalizeText = (value) => String(value ?? '').trim();

const toNumber = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

const splitCsvLine = (line, delimiter) => {
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

const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export const scoreImportRowsToCsv = ({ headers = [], rows = [] }) => {
  if (!headers.length) return '';
  return [
    headers.map(csvValue).join(','),
    ...rows.map(row => headers.map(header => csvValue(row[header])).join(','))
  ].join('\n');
};

export const parseScoreImportText = (text) => {
  const lines = normalizeText(text)
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .filter(line => line.trim());

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  if (lines.length < 2) {
    throw new Error('数据格式不正确，至少需要表头和一行数据');
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = splitCsvLine(lines[0], delimiter).map(header => normalizeText(header).replace(/^\uFEFF/, ''));
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter);
    return headers.reduce((result, header, index) => {
      result[header] = normalizeText(cells[index]);
      return result;
    }, {});
  }).filter(row => Object.values(row).some(value => normalizeText(value)));

  return { headers, rows, delimiter };
};

const findValue = (row, fields) => {
  const field = fields.find((name) => normalizeText(row[name]));
  return field ? normalizeText(row[field]) : '';
};

const getGradeNumber = (gradeLevel) => {
  const match = normalizeText(gradeLevel).match(/\d+/);
  return match ? Number(match[0]) : null;
};

const resolveClassId = ({ classText, student, classes, examData }) => {
  const value = normalizeText(classText);

  if (value) {
    const exactClass = (classes || []).find(cls => (
      normalizeText(cls.id) === value ||
      normalizeText(cls.class_no) === value ||
      normalizeText(cls.name) === value ||
      `${normalizeText(cls.class_no)}班` === value
    ));
    if (exactClass) return Number(exactClass.id);

    const idMatch = value.match(/\d{3,4}/);
    if (idMatch) return Number(idMatch[0]);

    const classNoMatch = value.match(/\d{1,2}/);
    const grade = getGradeNumber(examData?.grade_level);
    if (classNoMatch && grade) {
      return grade * 100 + Number(classNoMatch[0]);
    }
  }

  return student?.class_id ? Number(student.class_id) : null;
};

const findStudent = ({ row, students, classId }) => {
  const studentCode = findValue(row, STUDENT_CODE_FIELDS);
  const studentName = findValue(row, STUDENT_NAME_FIELDS);

  return (students || []).find(student => (
    studentCode && normalizeText(student.student_code || student.code) === studentCode
  )) || (students || []).find(student => (
    studentName &&
    normalizeText(student.name || student.student_name) === studentName &&
    (!classId || Number(student.class_id) === Number(classId))
  )) || null;
};

const getSubjectsForImport = (headers, examData) => {
  const configured = Array.isArray(examData?.subjects) ? examData.subjects : [];
  const fromHeaders = headers.filter(header => !KNOWN_FIELDS.has(header));
  return configured.length
    ? configured.filter(subject => headers.includes(subject))
    : fromHeaders;
};

const isValidStatFlag = (value) => {
  const text = normalizeText(value).toLowerCase();
  return !['否', '不是', '不参与', '缺考', '无效', '0', 'false', 'no'].includes(text);
};

const resolveAdditionalClasses = ({ value, classes }) => {
  if (!normalizeText(value)) return [];

  return normalizeText(value)
    .split(/[，,、;；\s]+/)
    .map(item => normalizeText(item))
    .filter(Boolean)
    .map(item => {
      const matchedClass = (classes || []).find(cls => (
        normalizeText(cls.id) === item ||
        normalizeText(cls.class_no) === item ||
        normalizeText(cls.name) === item ||
        `${normalizeText(cls.class_no)}班` === item
      ));

      return matchedClass
        ? { class_id: matchedClass.id, class_name: matchedClass.name || `${matchedClass.id}班` }
        : null;
    })
    .filter(Boolean);
};

export const recalculateScoreRanks = (scores) => {
  const nextScores = scores.map(score => ({ ...score }));
  const validScores = nextScores
    .filter(score => score.is_valid !== false && toNumber(score.total_score) !== null)
    .sort((a, b) => Number(b.total_score) - Number(a.total_score));

  validScores.forEach((score, index) => {
    score.rank = index + 1;
  });

  const classGroups = validScores.reduce((groups, score) => {
    const classKey = normalizeText(score.class_id);
    if (!groups[classKey]) groups[classKey] = [];
    groups[classKey].push(score);
    return groups;
  }, {});

  Object.values(classGroups).forEach(classScores => {
    classScores
      .sort((a, b) => Number(b.total_score) - Number(a.total_score))
      .forEach((score, index) => {
        score.class_rank = index + 1;
      });
  });

  return nextScores;
};

export const buildScoreImport = ({
  parsedRows,
  headers,
  examData,
  students = schoolData.students || [],
  classes = schoolData.classes || [],
  existingExamScores = [],
}) => {
  if (!examData?.id) {
    throw new Error('请先选择考试，再导入成绩');
  }

  const subjects = getSubjectsForImport(headers, examData);
  if (subjects.length === 0) {
    throw new Error('未识别到学科成绩列，请检查表头是否与考试科目一致');
  }

  const importedScores = [];
  const errors = [];

  parsedRows.forEach((row, index) => {
    const lineNumber = index + 2;
    const studentCode = findValue(row, STUDENT_CODE_FIELDS);
    const studentName = findValue(row, STUDENT_NAME_FIELDS);
    const rowClassId = resolveClassId({
      classText: findValue(row, CLASS_FIELDS),
      classes,
      examData,
    });
    const student = findStudent({ row, students, classId: rowClassId });
    const classId = resolveClassId({
      classText: findValue(row, CLASS_FIELDS),
      student,
      classes,
      examData,
    });

    if (!studentCode && !studentName) {
      errors.push(`第${lineNumber}行：缺少学籍辅号或姓名`);
      return;
    }

    if (!classId) {
      errors.push(`第${lineNumber}行：无法识别班级，请填写班级编号或先维护学生档案`);
      return;
    }

    const validValue = findValue(row, VALID_FIELDS);
    const isValid = validValue ? isValidStatFlag(validValue) : true;
    const scores = subjects.reduce((result, subject) => {
      const score = toNumber(row[subject]);
      if (score !== null && score >= 0) result[subject] = score;
      return result;
    }, {});

    if (Object.keys(scores).length === 0 && isValid) {
      errors.push(`第${lineNumber}行：没有可导入的有效成绩`);
      return;
    }

    const totalScore = toNumber(findValue(row, TOTAL_FIELDS)) ??
      Object.values(scores).reduce((sum, score) => sum + score, 0);
    const studentId = student?.id || studentCode || `${classId}_${studentName || index + 1}`;

    importedScores.push({
      id: `${examData.id}_${studentId}`,
      exam_id: examData.id,
      student_id: studentId,
      student_code: studentCode || student?.student_code || student?.code || '',
      student_name: studentName || student?.name || student?.student_name || '未命名学生',
      class_id: classId,
      scores,
      total_score: totalScore,
      is_valid: isValid,
      additional_classes: resolveAdditionalClasses({ value: row['额外统计班级'], classes }),
      rank: 0,
      class_rank: 0,
      created_at: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString().split('T')[0],
    });
  });

  const mergedByStudent = new Map();
  existingExamScores.forEach(score => {
    const key = normalizeText(score.student_id || score.student_code);
    if (key) mergedByStudent.set(key, { ...score });
  });

  let insertedCount = 0;
  let updatedCount = 0;
  importedScores.forEach(score => {
    const key = normalizeText(score.student_id || score.student_code);
    if (mergedByStudent.has(key)) {
      const previous = mergedByStudent.get(key);
      mergedByStudent.set(key, {
        ...previous,
        ...score,
        id: previous.id || score.id,
        created_at: previous.created_at || score.created_at,
        updated_at: new Date().toISOString().split('T')[0],
      });
      updatedCount += 1;
    } else {
      mergedByStudent.set(key, score);
      insertedCount += 1;
    }
  });

  const mergedScores = recalculateScoreRanks(Array.from(mergedByStudent.values()));
  const validScores = mergedScores.filter(score => score.is_valid !== false && Number(score.total_score) > 0);
  const avgScore = validScores.length
    ? validScores.reduce((sum, score) => sum + Number(score.total_score), 0) / validScores.length
    : 0;

  return {
    importedScores,
    mergedScores,
    errors,
    insertedCount,
    updatedCount,
    validCount: validScores.length,
    avgScore,
    topScore: validScores.length ? Math.max(...validScores.map(score => Number(score.total_score))) : 0,
  };
};

export const commitScoreImport = ({ examData, importResult }) => {
  const otherScores = (schoolData.examScores || []).filter(score => Number(score.exam_id) !== Number(examData.id));
  schoolData.examScores = [...otherScores, ...importResult.mergedScores];
  schoolData.exams = (schoolData.exams || []).map(exam => (
    Number(exam.id) === Number(examData.id)
      ? {
          ...exam,
          status: importResult.validCount > 0 ? '已完成' : exam.status,
          total_students: importResult.mergedScores.length,
          valid_students: importResult.validCount,
          avg_score: Number(importResult.avgScore.toFixed(1)),
          top_score: Number(importResult.topScore.toFixed(1)),
        }
      : exam
  ));
};

export const uploadScoreImportFile = ({ examId, file, filename, skipInvalid = true }) => {
  if (!examId) {
    throw new Error('请先选择考试，再导入成绩');
  }
  if (!file) {
    throw new Error('请选择要导入的成绩文件');
  }

  const formData = new FormData();
  formData.append('file', file, filename || file.name || 'scores.csv');

  return apiRequest(`/data/import/scores/${examId}?skip_invalid=${skipInvalid}`, {
    method: 'POST',
    body: formData,
  });
};
