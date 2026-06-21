const NAME_FIELDS = ['家长姓名', '姓名', 'parent_name', 'name'];
const RELATION_FIELDS = ['与学生关系(父亲/母亲/爷爷/奶奶/外公/外婆/其他)', '关系', '与学生关系', 'relation'];
const PHONE_FIELDS = ['联系电话', '手机号', '手机', 'phone', 'mobile'];
const EMAIL_FIELDS = ['邮箱(可选)', '邮箱', 'email'];
const PASSWORD_FIELDS = ['初始密码', '密码', 'password', 'initial_password'];
const STUDENT_CODE_FIELDS = ['学生学籍辅号', '学籍辅号', '学生编号', '学号', 'student_code', 'code'];
const STUDENT_NAME_FIELDS = ['学生姓名', '姓名校验', 'student_name'];
const STATUS_FIELDS = ['状态(正常/停用)', '状态', 'status'];

const normalizeText = (value) => String(value ?? '').trim();
const normalizePhone = (value) => normalizeText(value).replace(/\s+/g, '');

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

const normalizeStatus = (value) => {
  const text = normalizeText(value);
  return ['停用', 'inactive', 'disabled', '0', '否'].includes(text) ? 'inactive' : 'active';
};

const getExistingParent = (parents, phone) => (
  (parents || []).find(parent => normalizePhone(parent.phone || parent.mobile) === normalizePhone(phone)) || null
);

const mergeStudentIds = (existingIds = [], nextId) => {
  const ids = Array.isArray(existingIds) ? existingIds.map(Number).filter(Number.isFinite) : [];
  return ids.includes(Number(nextId)) ? ids : [...ids, Number(nextId)];
};

export const parseParentImportText = (text) => {
  const lines = normalizeText(text)
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .filter(line => line.trim() && !line.trim().startsWith('#'));

  if (lines.length === 0) {
    return { headers: [], rows: [], delimiter: ',' };
  }

  if (lines.length < 2) {
    throw new Error('数据格式不正确，至少需要表头和一行数据');
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

export const buildParentImport = ({
  parsedRows,
  parents = [],
  students = [],
}) => {
  const itemsByPhone = new Map();
  const errors = [];

  parsedRows.forEach((row, index) => {
    const lineNumber = index + 2;
    const name = findValue(row, NAME_FIELDS);
    const relation = findValue(row, RELATION_FIELDS) || '父亲';
    const phone = normalizePhone(findValue(row, PHONE_FIELDS));
    const email = findValue(row, EMAIL_FIELDS);
    const initialPassword = findValue(row, PASSWORD_FIELDS);
    const studentCode = findValue(row, STUDENT_CODE_FIELDS);
    const studentName = findValue(row, STUDENT_NAME_FIELDS);
    const status = normalizeStatus(findValue(row, STATUS_FIELDS));

    if (!name) {
      errors.push(`第${lineNumber}行：家长姓名不能为空`);
      return;
    }
    if (!phone) {
      errors.push(`第${lineNumber}行：联系电话不能为空`);
      return;
    }
    if (!studentCode) {
      errors.push(`第${lineNumber}行：学生学籍辅号不能为空`);
      return;
    }

    const student = students.find(item => normalizeText(item.student_code || item.code) === studentCode);
    if (!student) {
      errors.push(`第${lineNumber}行：学籍辅号 "${studentCode}" 不存在，请先维护学生档案`);
      return;
    }
    if (studentName && normalizeText(student.name || student.student_name) !== studentName) {
      errors.push(`第${lineNumber}行：学籍号 "${studentCode}" 对应学生为 "${student.name || student.student_name}"，请核对学生姓名`);
      return;
    }

    const existingParent = getExistingParent(parents, phone);
    const key = normalizePhone(phone);
    const previousItem = itemsByPhone.get(key);
    const base = previousItem?.data || existingParent || {};
    const studentIds = mergeStudentIds(base.student_ids || base.studentIds || [], student.id);
    const data = {
      ...base,
      name,
      relation,
      phone,
      email: email || base.email || '',
      initial_password: initialPassword || base.initial_password || '',
      status,
      student_ids: studentIds,
    };
    const changes = ['name', 'relation', 'phone', 'email', 'status', 'student_ids'].filter(field => (
      JSON.stringify(existingParent?.[field] ?? '') !== JSON.stringify(data[field] ?? '')
    ));

    itemsByPhone.set(key, {
      type: existingParent ? 'update' : 'new',
      data,
      existingData: existingParent || null,
      changes,
      student,
      lineNumber,
    });
  });

  const items = Array.from(itemsByPhone.values());

  return {
    items,
    errors,
    insertedCount: items.filter(item => item.type === 'new').length,
    updatedCount: items.filter(item => item.type === 'update').length,
    boundStudentCount: items.reduce((sum, item) => sum + (item.data.student_ids || []).length, 0),
  };
};

export const commitParentImport = ({ parents = [], importResult }) => {
  const maxId = Math.max(0, ...(parents || []).map(parent => Number(parent.id)).filter(Number.isFinite));
  let nextId = maxId + 1;
  const byParentId = new Map((parents || []).map(parent => [Number(parent.id), { ...parent }]));
  const byPhone = new Map((parents || []).map(parent => [normalizePhone(parent.phone || parent.mobile), Number(parent.id)]));

  (importResult?.items || []).forEach(item => {
    const existingId = item.existingData?.id || byPhone.get(normalizePhone(item.data.phone));
    const id = existingId || nextId++;
    const previous = byParentId.get(Number(id)) || {};
    const next = {
      ...previous,
      ...item.data,
      id,
      created_at: previous.created_at || new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString().split('T')[0],
    };
    byParentId.set(Number(id), next);
    byPhone.set(normalizePhone(next.phone), Number(id));
  });

  return Array.from(byParentId.values());
};
