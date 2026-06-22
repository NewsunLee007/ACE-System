export const STUDENT_STATUS_OPTIONS = ['在籍', '在读', '借读', '休学', '转学', '退学', '请长假', '毕业', '待核验'];

export const REGISTRY_STATUS_OPTIONS = [
  '正常在籍',
  '借读在籍',
  '休学保留学籍',
  '转出待办',
  '退学注销',
  '毕业离校',
  '状态待核验',
];

const STATUS_ALIASES = {
  正常: '在籍',
  正常在籍: '在籍',
  在校: '在籍',
  就读: '在读',
  停学: '休学',
  转出: '转学',
  离校: '毕业',
};

const STATUS_TO_REGISTRY = {
  在籍: '正常在籍',
  在读: '正常在籍',
  借读: '借读在籍',
  休学: '休学保留学籍',
  转学: '转出待办',
  退学: '退学注销',
  请长假: '正常在籍',
  毕业: '毕业离校',
  待核验: '状态待核验',
};

const normalizeText = (value) => String(value ?? '').trim();

export const normalizeStudentStatus = (value, fallback = '在籍') => {
  const rawStatus = normalizeText(value);
  if (!rawStatus) {
    return { status: fallback, rawStatus: '', isAnomaly: false };
  }

  const aliased = STATUS_ALIASES[rawStatus] || rawStatus;
  if (STUDENT_STATUS_OPTIONS.includes(aliased)) {
    return { status: aliased, rawStatus, isAnomaly: false };
  }

  return { status: '待核验', rawStatus, isAnomaly: true };
};

export const getRegistryStatusFromStudent = (student = {}) => {
  const normalized = normalizeStudentStatus(student.status);
  if (student.registry_status && REGISTRY_STATUS_OPTIONS.includes(student.registry_status)) {
    return student.registry_status;
  }
  return STATUS_TO_REGISTRY[normalized.status] || '状态待核验';
};

export const normalizeStudentRecordForRegistry = (student = {}) => {
  const normalized = normalizeStudentStatus(student.status);
  return {
    ...student,
    status: normalized.status,
    raw_status: student.raw_status || (normalized.isAnomaly ? normalized.rawStatus : ''),
    registry_status: student.registry_status || STATUS_TO_REGISTRY[normalized.status] || '状态待核验',
    enrollment_type: student.enrollment_type || '正常入学',
    status_changed_at: student.status_changed_at || '',
    status_reason: student.status_reason || '',
    source_school: student.source_school || '',
  };
};

export const getStudentStatusDisplay = (student = {}) => (
  student.status === '待核验' && student.raw_status
    ? `待核验：${student.raw_status}`
    : student.status || '在籍'
);

export const getStudentStatusColor = (status) => {
  switch (status) {
    case '在籍':
    case '在读':
      return 'bg-green-100 text-green-700';
    case '借读':
      return 'bg-yellow-100 text-yellow-700';
    case '休学':
    case '请长假':
      return 'bg-orange-100 text-orange-700';
    case '转学':
      return 'bg-blue-100 text-blue-700';
    case '退学':
      return 'bg-red-100 text-red-700';
    case '毕业':
      return 'bg-slate-100 text-slate-700';
    case '待核验':
      return 'bg-purple-100 text-purple-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export const getStudentGradeLabel = (student = {}, classes = []) => {
  const classId = Number(student.class_id);
  const cls = (classes || []).find(item => Number(item.id) === classId);
  const grade = Number.isFinite(classId) ? Math.floor(classId / 100) : null;
  if (grade >= 7 && grade <= 9) return `${grade}年级`;
  if (student.current_grade) return student.current_grade;
  if (cls?.grade_level) return cls.grade_level;
  return '-';
};

export const buildStudentRegistryTimeline = (student = {}, classes = [], formatClassName) => {
  const classId = Number(student.class_id);
  const cls = (classes || []).find(item => Number(item.id) === classId);
  const className = cls ? (formatClassName?.(cls.id) || cls.name || `${cls.id}班`) : '未分班';
  const currentStatus = getStudentStatusDisplay(student);
  const statusDate = student.status_changed_at || student.updated_at || student.created_at || '';

  return [
    {
      label: '入学建档',
      date: student.created_at || `${student.enrollment_year || '-'}-09-01`,
      detail: `${student.enrollment_year || '-'}级 · ${student.enrollment_type || '正常入学'}`,
    },
    {
      label: '当前班级',
      date: cls?.created_at || '',
      detail: `${className} · ${getStudentGradeLabel(student, classes)}`,
    },
    {
      label: '学籍状态',
      date: statusDate,
      detail: `${currentStatus} · ${getRegistryStatusFromStudent(student)}${student.status_reason ? ` · ${student.status_reason}` : ''}`,
    },
  ];
};

export const buildStudentRegistryStats = (students = [], classes = []) => {
  const normalizedStudents = (students || []).map(normalizeStudentRecordForRegistry);
  const statusCounts = normalizedStudents.reduce((result, student) => {
    result[student.status] = (result[student.status] || 0) + 1;
    return result;
  }, {});
  const activeCount = normalizedStudents.filter(student => ['在籍', '在读', '借读', '请长假'].includes(student.status)).length;
  const movementCount = normalizedStudents.filter(student => ['休学', '转学', '退学', '毕业'].includes(student.status)).length;
  const anomalyCount = normalizedStudents.filter(student => student.status === '待核验').length;
  const unassignedCount = normalizedStudents.filter(student => !classes.some(cls => Number(cls.id) === Number(student.class_id))).length;

  return {
    total: normalizedStudents.length,
    activeCount,
    movementCount,
    anomalyCount,
    unassignedCount,
    activeRate: normalizedStudents.length ? (activeCount / normalizedStudents.length) * 100 : 0,
    statusCounts,
  };
};
