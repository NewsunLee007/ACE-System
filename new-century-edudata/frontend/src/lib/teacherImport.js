import { normalizeClassNo } from './classImport';

const CODE_FIELDS = ['工号', '教师工号', 'code', 'teacher_code'];
const NAME_FIELDS = ['姓名', '教师姓名', 'name', 'teacher_name'];
const PHONE_FIELDS = ['电话', '联系电话', '手机号', 'phone', 'mobile'];
const EMAIL_FIELDS = ['邮箱', 'email'];
const PASSWORD_FIELDS = ['初始密码', '密码', 'password', 'initial_password'];
const SUBJECT_FIELDS = ['任教科目', '任教学科', '学科', 'subject', 'subjects'];
const CLASS_FIELDS = ['任教班级', '班级', '班级编号', 'class', 'class_id', 'teaching_classes'];
const STATUS_FIELDS = ['状态', 'status'];
const EMPTY_CELL_VALUES = new Set(['#N/A', 'N/A', 'NA', '无', '暂无', '-', '--']);

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

const splitList = (value) => normalizeText(value)
  .split(/[，,、;；\s]+/)
  .map(item => normalizeText(item))
  .filter(item => item && !EMPTY_CELL_VALUES.has(item.toUpperCase()) && !EMPTY_CELL_VALUES.has(item));

const buildGeneratedTeacherCode = (name) => {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return '';

  let hash = 0;
  for (let index = 0; index < normalizedName.length; index += 1) {
    hash = (hash * 31 + normalizedName.charCodeAt(index)) % 1000000;
  }
  return `AUTO${String(hash).padStart(6, '0')}`;
};

const normalizeStatus = (value) => {
  const text = normalizeText(value);
  return ['暂停', '停用', 'suspended', 'inactive', '0'].includes(text) ? 'suspended' : 'active';
};

const resolveClass = ({ classText, classes = [], formatClassName }) => {
  const value = normalizeText(classText).replace(/班$/, '');
  if (!value) return null;

  const idMatch = value.match(/\d{3,4}/);
  if (idMatch) {
    const matchedById = classes.find(cls => Number(cls.id) === Number(idMatch[0]));
    if (matchedById) return matchedById;
  }

  const targetNo = normalizeClassNo(value);
  return classes.find(cls => {
    const formattedName = formatClassName ? formatClassName(cls.id) : '';
    return (
      normalizeText(cls.id) === value ||
      normalizeText(cls.class_no) === value ||
      normalizeClassNo(cls.class_no || cls.id) === targetNo ||
      normalizeText(cls.name) === normalizeText(classText) ||
      normalizeText(formattedName) === normalizeText(classText)
    );
  }) || null;
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

const normalizeTeacherItem = (item) => ({
  ...item,
  subjects: uniqueBy(item.subjects || [], subject => subject),
  teaching_classes: uniqueBy(item.teaching_classes || [], tc => `${tc.class_id}:${tc.subject || ''}`),
});

export const parseTeacherImportText = (text) => {
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

export const buildTeacherImport = ({
  parsedRows,
  teachers = [],
  classes = [],
  formatClassName,
}) => {
  const byCode = new Map();
  const errorsByCode = new Map();

  (parsedRows || []).forEach((row, index) => {
    const lineNumber = index + 2;
    const name = findValue(row, NAME_FIELDS);
    const explicitCode = findValue(row, CODE_FIELDS);
    const code = explicitCode || buildGeneratedTeacherCode(name);
    const phone = findValue(row, PHONE_FIELDS);
    const email = findValue(row, EMAIL_FIELDS);
    const initialPassword = findValue(row, PASSWORD_FIELDS);
    const subjects = splitList(findValue(row, SUBJECT_FIELDS));
    const classTexts = splitList(findValue(row, CLASS_FIELDS));
    const status = normalizeStatus(findValue(row, STATUS_FIELDS));
    const rowErrors = [];

    if (!name) rowErrors.push('姓名不能为空');
    if (classTexts.length > 0 && subjects.length === 0) rowErrors.push('填写任教班级时必须填写任教科目');

    const resolvedClasses = classTexts.map(classText => {
      const cls = resolveClass({ classText, classes, formatClassName });
      if (!cls) rowErrors.push(`班级 "${classText}" 不存在，请先维护班级`);
      return { classText, cls };
    });

    const key = code || `__row_${lineNumber}`;
    const previous = byCode.get(key) || {
      code,
      code_generated: !explicitCode,
      name,
      phone,
      email,
      initial_password: initialPassword,
      subjects: [],
      status,
      teaching_classes: [],
      lineNumbers: [],
    };

    previous.code = previous.code || code;
    previous.name = previous.name || name;
    previous.phone = previous.phone || phone;
    previous.email = previous.email || email;
    previous.initial_password = previous.initial_password || initialPassword;
    previous.status = previous.status || status;
    previous.subjects.push(...subjects);
    previous.lineNumbers.push(lineNumber);
    resolvedClasses
      .filter(item => item.cls)
      .forEach(({ cls }) => {
        subjects.forEach(subject => {
          previous.teaching_classes.push({ class_id: Number(cls.id), subject });
        });
      });
    byCode.set(key, normalizeTeacherItem(previous));

    if (rowErrors.length > 0) {
      const previousErrors = errorsByCode.get(key) || [];
      errorsByCode.set(key, [...previousErrors, `第${lineNumber}行：${rowErrors.join('；')}`]);
    }
  });

  const items = [];

  byCode.forEach((data, code) => {
    const existingTeacher = (teachers || []).find(teacher => normalizeText(teacher.code) === normalizeText(data.code)) ||
      (teachers || []).find(teacher => normalizeText(teacher.name) === normalizeText(data.name));
    const errors = errorsByCode.get(code) || [];

    if (errors.length > 0) {
      items.push({
        type: 'error',
        data,
        existingData: existingTeacher || null,
        error: errors.join('；'),
        lineNumbers: data.lineNumbers,
      });
      return;
    }

    if (existingTeacher) {
      const changes = [];
      if (data.name !== existingTeacher.name) changes.push('name');
      if (data.phone !== (existingTeacher.phone || '')) changes.push('phone');
      if (data.email !== (existingTeacher.email || '')) changes.push('email');
      if (data.status !== (existingTeacher.status || 'active')) changes.push('status');

      const existingSubjects = existingTeacher.subjects || [];
      const subjectsChanged = data.subjects.length !== existingSubjects.length ||
        !data.subjects.every(subject => existingSubjects.includes(subject));
      if (subjectsChanged) changes.push('subjects');

      const existingClasses = existingTeacher.teaching_classes || [];
      const classesChanged = data.teaching_classes.length !== existingClasses.length ||
        !data.teaching_classes.every(tc => existingClasses.some(existing => (
          Number(existing.class_id) === Number(tc.class_id) && normalizeText(existing.subject) === normalizeText(tc.subject)
        )));
      if (classesChanged) changes.push('teaching_classes');

      items.push({
        type: changes.length > 0 ? 'update' : 'unchanged',
        data,
        existingData: existingTeacher,
        changes,
        lineNumbers: data.lineNumbers,
      });
      return;
    }

    items.push({
      type: 'new',
      data,
      lineNumbers: data.lineNumbers,
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

export const commitTeacherImport = ({ teachers = [], importResult }) => {
  const nextTeachers = (teachers || []).map(teacher => ({
    ...teacher,
    subjects: [...(teacher.subjects || [])],
    roles: [...(teacher.roles || ['subject_teacher'])],
    teaching_classes: (teacher.teaching_classes || []).map(tc => ({ ...tc })),
    custom_permissions: [...(teacher.custom_permissions || [])],
  }));
  const byCode = new Map(nextTeachers.map(teacher => [normalizeText(teacher.code), teacher]));
  const maxId = Math.max(0, ...nextTeachers.map(teacher => Number(teacher.id)).filter(Number.isFinite));
  let nextId = Math.ceil(maxId) + 1;

  (importResult?.items || []).forEach(item => {
    if (item.type === 'error' || item.type === 'unchanged') return;

    const existing = byCode.get(normalizeText(item.data.code)) ||
      byCode.get(normalizeText(item.existingData?.code)) ||
      nextTeachers.find(teacher => Number(teacher.id) === Number(item.existingData?.id)) ||
      nextTeachers.find(teacher => normalizeText(teacher.name) === normalizeText(item.data.name));
    if (existing) {
      Object.assign(existing, {
        name: item.data.name,
        phone: item.data.phone,
        email: item.data.email,
        initial_password: item.data.initial_password,
        subjects: [...(item.data.subjects || [])],
        status: item.data.status || existing.status || 'active',
        teaching_classes: (item.data.teaching_classes || []).map(tc => ({ ...tc })),
        updated_at: new Date().toISOString().split('T')[0],
      });
      return;
    }

    const teacher = {
      id: nextId++,
      code: item.data.code,
      name: item.data.name,
      phone: item.data.phone,
      email: item.data.email,
      initial_password: item.data.initial_password,
      subjects: [...(item.data.subjects || [])],
      roles: ['subject_teacher'],
      status: item.data.status || 'active',
      teaching_classes: (item.data.teaching_classes || []).map(tc => ({ ...tc })),
      custom_permissions: [],
      created_at: new Date().toISOString().split('T')[0],
    };
    nextTeachers.push(teacher);
    byCode.set(normalizeText(teacher.code), teacher);
  });

  return nextTeachers;
};
