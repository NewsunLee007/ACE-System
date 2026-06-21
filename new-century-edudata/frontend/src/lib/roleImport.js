export const ROLE_PERMISSION_OPTIONS = [
  { id: 'all_permissions', label: '所有权限' },
  { id: 'system_config', label: '系统配置' },
  { id: 'view_own_class', label: '查看任教班级' },
  { id: 'view_own_students', label: '查看任教学生' },
  { id: 'input_scores', label: '成绩录入' },
  { id: 'manage_class_students', label: '管理班级学生' },
  { id: 'view_class_reports', label: '查看班级报告' },
  { id: 'view_subject_classes', label: '查看学科班级' },
  { id: 'view_subject_scores', label: '查看学科成绩' },
  { id: 'manage_subject_materials', label: '管理学科资料' },
  { id: 'view_grade_subject', label: '查看年级学科' },
  { id: 'manage_subject_teachers', label: '管理学科教师' },
  { id: 'approve_subject_activities', label: '审批学科活动' },
  { id: 'view_grade_all', label: '查看年级全部' },
  { id: 'manage_grade_teachers', label: '管理年级教师' },
  { id: 'approve_grade_activities', label: '审批年级活动' },
  { id: 'view_grade_reports', label: '查看年级报告' },
  { id: 'view_dept_all', label: '查看科室全部' },
  { id: 'manage_dept_staff', label: '管理科室人员' },
  { id: 'approve_dept_activities', label: '审批科室活动' },
  { id: 'view_school_all', label: '查看全校数据' },
  { id: 'manage_departments', label: '管理各部门' },
  { id: 'approve_school_activities', label: '审批学校活动' },
  { id: 'manage_exams', label: '管理考试' },
  { id: 'manage_students', label: '管理学生' },
  { id: 'import_scores', label: '导入成绩' },
  { id: 'analysis_execute', label: '执行分析' },
];

export const DEFAULT_ROLE_SETTINGS = [
  {
    id: 'admin',
    permission_code: 'sys_admin',
    name: '系统管理员',
    color: 'slate',
    level: 9,
    permissions: ['all_permissions', 'system_config'],
    is_system: true,
  },
  {
    id: 'edu_admin',
    permission_code: 'edu_admin',
    name: '教务处主任/校领导',
    color: 'blue',
    level: 8,
    permissions: ['view_school_all', 'manage_departments', 'analysis_execute', 'system_config'],
    is_system: true,
  },
  {
    id: 'principal',
    name: '校长',
    color: 'red',
    level: 8,
    permissions: ['all_permissions'],
    is_system: true,
  },
  {
    id: 'vice_principal',
    name: '副校长',
    color: 'red',
    level: 7,
    permissions: ['view_school_all', 'manage_departments', 'approve_school_activities'],
    is_system: true,
  },
  {
    id: 'exam_admin',
    permission_code: 'exam_admin',
    name: '考务与学籍管理员',
    color: 'indigo',
    level: 6,
    permissions: ['manage_exams', 'manage_students', 'import_scores'],
    is_system: true,
  },
  {
    id: 'dept_director',
    name: '科室主任',
    color: 'indigo',
    level: 6,
    permissions: ['view_dept_all', 'manage_dept_staff', 'approve_dept_activities'],
    is_system: true,
  },
  {
    id: 'dept_deputy',
    name: '科室副主任',
    color: 'pink',
    level: 6,
    permissions: ['view_dept_all', 'manage_dept_staff'],
    is_system: true,
  },
  {
    id: 'grade_leader',
    permission_code: 'grade_leader',
    name: '年段长',
    color: 'orange',
    level: 5,
    permissions: ['view_grade_all', 'manage_grade_teachers', 'approve_grade_activities', 'view_grade_reports'],
    is_system: true,
  },
  {
    id: 'grade_deputy',
    name: '副段长',
    color: 'yellow',
    level: 5,
    permissions: ['view_grade_all', 'manage_grade_teachers', 'view_grade_reports'],
    is_system: true,
  },
  {
    id: 'research_leader',
    permission_code: 'subject_leader',
    name: '教研组长',
    color: 'purple',
    level: 4,
    permissions: ['view_grade_subject', 'manage_subject_teachers', 'approve_subject_activities'],
    is_system: true,
  },
  {
    id: 'lesson_leader',
    name: '备课组长',
    color: 'blue',
    level: 3,
    permissions: ['view_subject_classes', 'view_subject_scores', 'manage_subject_materials'],
    is_system: true,
  },
  {
    id: 'head_teacher',
    permission_code: 'headmaster',
    name: '班主任',
    color: 'green',
    level: 2,
    permissions: ['view_own_class', 'view_own_students', 'input_scores', 'manage_class_students', 'view_class_reports'],
    is_system: true,
  },
  {
    id: 'subject_teacher',
    permission_code: 'teacher',
    name: '科任教师',
    color: 'cyan',
    level: 1,
    permissions: ['view_own_class', 'view_own_students', 'input_scores'],
    is_system: true,
  },
];

export const ROLE_COLOR_CLASSES = {
  red: { dot: 'bg-red-500', badge: 'bg-red-100 text-red-800' },
  orange: { dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-800' },
  yellow: { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800' },
  green: { dot: 'bg-green-500', badge: 'bg-green-100 text-green-800' },
  cyan: { dot: 'bg-cyan-500', badge: 'bg-cyan-100 text-cyan-800' },
  blue: { dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800' },
  indigo: { dot: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-800' },
  purple: { dot: 'bg-purple-500', badge: 'bg-purple-100 text-purple-800' },
  pink: { dot: 'bg-pink-500', badge: 'bg-pink-100 text-pink-800' },
  gray: { dot: 'bg-gray-500', badge: 'bg-gray-100 text-gray-800' },
  slate: { dot: 'bg-slate-500', badge: 'bg-slate-100 text-slate-800' },
};

const ROLE_ID_FIELDS = ['角色ID', '角色标识', '权限标识', 'id', 'role_id', 'permission_code'];
const ROLE_NAME_FIELDS = ['角色名称', '名称', 'name', 'role_name'];
const ROLE_LEVEL_FIELDS = ['级别', '角色级别', 'level'];
const ROLE_COLOR_FIELDS = ['标识颜色', '颜色', 'color'];
const ROLE_PERMISSION_FIELDS = ['权限标识(英文逗号分隔)', '权限标识', '权限', 'permissions'];
const ROLE_TYPE_FIELDS = ['类型', '是否系统预设', 'is_system'];
const ROLE_DESCRIPTION_FIELDS = ['说明', '描述', 'description'];

const normalizeText = (value) => String(value ?? '').trim();

const permissionLabelToId = ROLE_PERMISSION_OPTIONS.reduce((result, permission) => {
  result[permission.id] = permission.id;
  result[permission.label] = permission.id;
  return result;
}, {});

const defaultRoleIdSet = new Set(DEFAULT_ROLE_SETTINGS.map(role => role.id));

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
  .filter(Boolean);

const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const decodeHtml = (value) => {
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  return String(value ?? '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
};

const stripHtml = (value) => decodeHtml(String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ''))
  .trim();

const parseHtmlTableRows = (text) => {
  const rows = [];
  const rowMatches = String(text || '').match(/<tr[\s\S]*?<\/tr>/gi) || [];

  rowMatches.forEach(rowHtml => {
    const cells = [];
    const cellMatches = rowHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
    cellMatches.forEach(cellHtml => {
      cells.push(stripHtml(cellHtml));
    });
    if (cells.some(Boolean)) rows.push(cells);
  });

  return rows;
};

export const parseRoleImportText = (text) => {
  const rawText = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r/g, '');
  let tableRows = [];

  if (/<table[\s\S]*?>/i.test(rawText)) {
    tableRows = parseHtmlTableRows(rawText);
  } else {
    const lines = rawText
      .split('\n')
      .filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#');
      });

    if (lines.length > 0) {
      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      tableRows = lines.map(line => splitDelimitedLine(line, delimiter));
    }
  }

  if (tableRows.length < 2) {
    throw new Error('文件格式错误：缺少表头或角色数据');
  }

  const headers = tableRows[0].map(header => normalizeText(header).replace(/^\uFEFF/, ''));
  const rows = tableRows.slice(1).map(cells => headers.reduce((result, header, index) => {
    result[header] = normalizeText(cells[index]);
    return result;
  }, {}));

  return { headers, rows };
};

export const normalizeRoleSettingForImport = (role = {}) => {
  const id = normalizeText(role.id || role.permission_code).replace(/\s+/g, '_');
  const defaultRole = DEFAULT_ROLE_SETTINGS.find(item => item.id === id) || {};
  const rawPermissions = Array.isArray(role.permissions) ? role.permissions : splitList(role.permissions);
  const permissions = rawPermissions
    .map(permission => permissionLabelToId[permission] || normalizeText(permission))
    .filter(Boolean);

  return {
    ...defaultRole,
    ...role,
    id,
    name: normalizeText(role.name || role.role_name || defaultRole.name),
    permission_code: normalizeText(role.permission_code || defaultRole.permission_code || id),
    level: Number.isFinite(Number(role.level)) ? Number(role.level) : Number(defaultRole.level || 1),
    color: normalizeText(role.color || defaultRole.color || 'gray'),
    permissions: permissions.length > 0 ? permissions : (defaultRole.permissions || ['view_own_class']),
    description: normalizeText(role.description || defaultRole.description),
    is_system: Boolean(role.is_system) || defaultRoleIdSet.has(id),
  };
};

export const buildRoleImport = ({ parsedRows = [], existingRoles = [] }) => {
  const existingById = new Map((existingRoles || []).map(role => [normalizeText(role.id), role]));
  const importedById = new Map();
  const errors = [];

  parsedRows.forEach((row, index) => {
    const lineNumber = index + 2;
    const id = findValue(row, ROLE_ID_FIELDS);
    const name = findValue(row, ROLE_NAME_FIELDS);
    const levelText = findValue(row, ROLE_LEVEL_FIELDS);
    const color = findValue(row, ROLE_COLOR_FIELDS);
    const permissions = splitList(findValue(row, ROLE_PERMISSION_FIELDS));
    const type = findValue(row, ROLE_TYPE_FIELDS);
    const description = findValue(row, ROLE_DESCRIPTION_FIELDS);
    const rowErrors = [];

    if (!id) rowErrors.push('角色ID不能为空');
    if (!name) rowErrors.push('角色名称不能为空');

    const level = Number(levelText || 1);
    if (!Number.isFinite(level) || level < 0 || level > 10) {
      rowErrors.push('级别必须是0-10之间的数字');
    }

    const normalizedPermissions = permissions
      .map(permission => permissionLabelToId[permission] || permission)
      .filter(Boolean);
    const unknownPermissions = normalizedPermissions.filter(permission => (
      !ROLE_PERMISSION_OPTIONS.some(option => option.id === permission)
    ));
    if (unknownPermissions.length > 0) {
      rowErrors.push(`权限标识不存在：${unknownPermissions.join('、')}`);
    }

    if (rowErrors.length > 0) {
      errors.push(`第${lineNumber}行：${rowErrors.join('；')}`);
      return;
    }

    const existingRole = existingById.get(id) || {};
    importedById.set(id, normalizeRoleSettingForImport({
      ...existingRole,
      id,
      name,
      level,
      color,
      permissions: normalizedPermissions,
      description,
      is_system: ['系统预设', '是', 'true', '1'].includes(type) || existingRole.is_system,
    }));
  });

  return {
    roles: Array.from(importedById.values()),
    errors,
  };
};

export const sortRoleSettings = (roles = []) => [...roles].sort((a, b) => {
  const levelDiff = Number(b.level || 0) - Number(a.level || 0);
  if (levelDiff !== 0) return levelDiff;
  return String(a.name || a.id).localeCompare(String(b.name || b.id), 'zh-Hans-CN');
});

export const mergeRoleSettings = ({
  existingRoles = [],
  importedRoles = [],
  includeDefaults = true,
} = {}) => {
  const roleMap = new Map();
  const addRole = (role) => {
    const normalized = normalizeRoleSettingForImport(role);
    if (!normalized.id) return;
    roleMap.set(normalized.id, {
      ...(roleMap.get(normalized.id) || {}),
      ...normalized,
    });
  };

  if (includeDefaults) DEFAULT_ROLE_SETTINGS.forEach(addRole);
  existingRoles.forEach(addRole);
  importedRoles.forEach(addRole);

  return sortRoleSettings(Array.from(roleMap.values()));
};

export const roleSettingsToTemplateRows = (roles = DEFAULT_ROLE_SETTINGS) => roles.map(role => {
  const normalized = normalizeRoleSettingForImport(role);
  return [
    normalized.id,
    normalized.name,
    normalized.level,
    normalized.color,
    normalized.permissions.join(','),
    normalized.is_system ? '系统预设' : '自定义',
    normalized.description || '',
  ];
});

export const buildRoleImportTemplateHtml = (roles = DEFAULT_ROLE_SETTINGS) => {
  const headers = ['角色ID', '角色名称', '级别', '标识颜色', '权限标识(英文逗号分隔)', '类型', '说明'];
  const rows = roleSettingsToTemplateRows(roles);
  const tableRows = [headers, ...rows].map(row => (
    `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
  )).join('');

  return `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
<table border="1">
${tableRows}
</table>
</body>
</html>`;
};

export const buildRoleImportTemplateCsv = (roles = DEFAULT_ROLE_SETTINGS) => {
  const headers = ['角色ID', '角色名称', '级别', '标识颜色', '权限标识(英文逗号分隔)', '类型', '说明'];
  const rows = roleSettingsToTemplateRows(roles);
  return [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\n');
};

export const downloadRoleImportTemplate = (roles = DEFAULT_ROLE_SETTINGS) => {
  const html = buildRoleImportTemplateHtml(roles);
  const blob = new Blob([`\uFEFF${html}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = '角色权限导入模板.xls';
  link.click();
  URL.revokeObjectURL(link.href);
};
