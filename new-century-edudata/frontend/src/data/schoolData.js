import { DEFAULT_ROLE_SETTINGS, mergeRoleSettings } from '../lib/roleImport';
import DEMO_SCHOOL_DATA, { DEMO_DATA_VERSION } from './demoSchoolData';

// 学校数据中心 - 所有模块共享的数据
// 班级是核心，教师、学生、家长都围绕班级建立关联
// 数据自动持久化到localStorage

const STORAGE_KEY = 'new_century_school_data';

const cloneValue = (value, fallback) => {
  const source = value === undefined ? fallback : value;
  return JSON.parse(JSON.stringify(source));
};

const seededArray = (key, fallback = []) => cloneValue(DEMO_SCHOOL_DATA?.[key], fallback);

const getSeedKey = (key, item) => {
  if (!item) return '';
  if (key === 'examScores') return String(item.id || `${item.exam_id}_${item.student_id}`);
  if (key === 'students') return String(item.id || item.student_code || '');
  if (key === 'teachers') return String(item.id || item.code || item.name || '');
  if (key === 'classLayers') return String(item.id || `${item.grade_level}_${item.class_id}`);
  return String(item.id || '');
};

const mergeSeedArray = (key, existing = []) => {
  const seed = seededArray(key);
  if (!Array.isArray(existing) || existing.length === 0) return seed;

  const seedKeys = new Set(seed.map(item => getSeedKey(key, item)).filter(Boolean));
  const retained = existing.filter(item => !seedKeys.has(getSeedKey(key, item)));
  return [...seed, ...retained];
};

const hasCurrentSeedPayload = (data) => {
  if (!data || data.baseDataVersion === DEMO_DATA_VERSION) return true;

  const seedExams = DEMO_SCHOOL_DATA.exams || [];
  const seedExamIds = seedExams.map(exam => Number(exam.id)).filter(Number.isFinite);
  const storedExamIds = new Set((data.exams || []).map(exam => Number(exam.id)));
  const hasSeedExams = seedExamIds.every(id => storedExamIds.has(id));

  const seedScoreCounts = seedExamIds.map(id => ({
    id,
    count: (DEMO_SCHOOL_DATA.examScores || []).filter(score => Number(score.exam_id) === id).length,
  }));
  const hasSeedScores = seedScoreCounts.every(({ id, count }) => (
    (data.examScores || []).filter(score => Number(score.exam_id) === id).length >= count
  ));

  const seedLayerCount = (DEMO_SCHOOL_DATA.classLayers || []).length;
  const hasSeedLayers = (data.classLayers || []).length >= seedLayerCount;

  return hasSeedExams && hasSeedScores && hasSeedLayers;
};

// 默认数据
const defaultData = {
  // 系统配置
  config: {
    currentAcademicYear: 2025,
    currentSemester: 2,
    establishedYear: 2010,
    gradeConfig: {
      minGrade: 7,
      maxGrade: 9,
      gradeNames: {
        7: '七年级',
        8: '八年级',
        9: '九年级'
      }
    }
  },

  // 班级数据
  classes: seededArray('classes'),

  // 教师数据
  teachers: seededArray('teachers'),

  // 学生数据
  students: seededArray('students'),

  // 家长数据
  parents: seededArray('parents'),

  // 学科列表
  subjects: seededArray('subjects', ['语文', '数学', '英语', '科学', '社会']),

  // 教师角色定义
  teacherRoles: DEFAULT_ROLE_SETTINGS,

  // 考试数据
  exams: seededArray('exams'),

  // 班级层次数据
  classLayers: seededArray('classLayers'),

  // 自定义中间管理层职务
  customMiddleRoles: [],

  // 提前招生学校列表
  earlyAdmissionSchools: ['温中', '瑞中', '新纪元'],

  // 提前招生学生记录
  earlyAdmissions: [],

  // 考试成绩数据
  // 结构: { id, exam_id, student_id, scores: { 语文: 85, 数学: 90, ... }, total_score, rank, class_rank, is_valid, additional_classes, created_at, updated_at }
  // is_valid: 是否参与考试统计
  // additional_classes: 额外统计班级 [{class_id, class_name}]
  examScores: seededArray('examScores'),

  // 种子数据版本
  baseDataVersion: DEMO_DATA_VERSION
};

// 从localStorage加载数据
const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('加载数据失败:', error);
  }
  return null;
};

// 保存到localStorage
const saveToStorage = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('schoolData:changed', { detail: { key: STORAGE_KEY } }));
    }
  } catch (error) {
    console.error('保存数据失败:', error);
  }
};

// 初始化数据
const initData = () => {
  const normalizeStoredClassNo = (value) => {
    const text = String(value ?? '').trim();
    const match = text.match(/\d+/);
    if (!match) return text;

    const number = Number(match[0]);
    if (!Number.isFinite(number)) return text;

    const sequence = number >= 100 ? number % 100 : number;
    return String(sequence).padStart(2, '0');
  };

  const stored = loadFromStorage();
  if (stored) {
    // 合并存储的数据和默认数据（确保新字段存在）
    const merged = { ...defaultData, ...stored };
    const hasStoredStudents = Array.isArray(stored.students) && stored.students.length > 0;
    const hasStoredScores = Array.isArray(stored.examScores) && stored.examScores.length > 0;
    const hasLegacyClassShell = Array.isArray(stored.classes) && stored.classes.length > 0 && stored.classes.length <= 13;
    const shouldSeedRealBaseData = (!hasStoredStudents && !hasStoredScores) || (hasLegacyClassShell && !hasStoredStudents);

    if (shouldSeedRealBaseData) {
      ['classes', 'teachers', 'students', 'parents', 'classLayers', 'exams', 'examScores'].forEach(key => {
        merged[key] = seededArray(key);
      });
      merged.baseDataVersion = DEMO_DATA_VERSION;
    } else {
      ['classes', 'teachers', 'students', 'parents', 'classLayers', 'exams', 'examScores'].forEach(key => {
        if (!Array.isArray(merged[key]) || merged[key].length === 0) {
          merged[key] = seededArray(key);
          merged.baseDataVersion = DEMO_DATA_VERSION;
        }
      });
    }

    if (!hasCurrentSeedPayload(merged)) {
      ['classes', 'teachers', 'students', 'parents', 'classLayers', 'exams', 'examScores'].forEach(key => {
        merged[key] = mergeSeedArray(key, merged[key]);
      });
      merged.baseDataVersion = DEMO_DATA_VERSION;
    } else if (merged.baseDataVersion !== DEMO_DATA_VERSION) {
      merged.baseDataVersion = DEMO_DATA_VERSION;
    }

    if (!Array.isArray(merged.subjects) || merged.subjects.length === 0) {
      merged.subjects = seededArray('subjects', defaultData.subjects);
    }
    
    // 数据迁移：修复班级数据的class_no字段
    if (merged.classes && merged.classes.length > 0) {
      merged.classes = merged.classes.map(cls => {
        const classNo = normalizeStoredClassNo(cls.class_no || cls.id);
        const next = { ...cls, class_no: classNo };
        if (!next.name || /\d{3,4}班$/.test(next.name)) {
          next.name = `${next.enrollment_year}级${classNo}班`;
        }
        return next;
      });
    }
    
    merged.teacherRoles = mergeRoleSettings({
      existingRoles: Array.isArray(merged.teacherRoles) ? merged.teacherRoles : [],
      includeDefaults: true,
    });

    return merged;
  }
  return {
    ...defaultData,
    classes: seededArray('classes'),
    teachers: seededArray('teachers'),
    students: seededArray('students'),
    parents: seededArray('parents'),
    subjects: seededArray('subjects', defaultData.subjects),
    classLayers: seededArray('classLayers'),
    exams: seededArray('exams'),
    examScores: seededArray('examScores'),
    teacherRoles: mergeRoleSettings({
      existingRoles: defaultData.teacherRoles,
      includeDefaults: true,
    }),
  };
};

// 创建响应式数据对象
const createReactiveData = () => {
  const data = initData();

  // 创建Proxy来监听数据变化
  const reactiveHandler = {
    set(target, property, value) {
      target[property] = value;
      // 数据变化时自动保存
      saveToStorage(data);
      return true;
    }
  };

  // 对数组方法进行包装，确保修改后保存
  const wrapArrayMethods = (arr, parentData) => {
    const methods = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];
    methods.forEach(method => {
      const original = arr[method];
      arr[method] = function(...args) {
        const result = original.apply(this, args);
        saveToStorage(parentData);
        return result;
      };
    });
    return arr;
  };

  // 包装所有数组
  wrapArrayMethods(data.classes, data);
  wrapArrayMethods(data.teachers, data);
  wrapArrayMethods(data.students, data);
  wrapArrayMethods(data.parents, data);
  wrapArrayMethods(data.subjects, data);
  wrapArrayMethods(data.teacherRoles, data);
  wrapArrayMethods(data.exams, data);
  wrapArrayMethods(data.classLayers, data);
  wrapArrayMethods(data.examScores, data);
  wrapArrayMethods(data.earlyAdmissions, data);
  wrapArrayMethods(data.customMiddleRoles, data);

  return new Proxy(data, reactiveHandler);
};

// 导出数据对象
export const schoolData = createReactiveData();

// 导出辅助方法
export const schoolDataHelpers = {
  // 强制保存当前数据
  save() {
    saveToStorage(schoolData);
  },

  // 重置为默认数据
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  },

  // 导出所有数据
  exportAll() {
    return JSON.stringify(schoolData, null, 2);
  },

  // 导入数据
  importAll(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      Object.assign(schoolData, data);
      saveToStorage(schoolData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// 将方法绑定到schoolData对象
schoolData.getCurrentAcademicYearDisplay = function() {
  const year = this.config.currentAcademicYear;
  return `${year}-${year + 1}`;
};

schoolData.getCurrentSemesterDisplay = function() {
  return `${this.config.currentAcademicYear}-${this.config.currentSemester}`;
};

schoolData.calculateGradeLevel = function(enrollmentYear) {
  const currentYear = this.config.currentAcademicYear;
  const gradeOffset = currentYear - enrollmentYear;
  const grade = this.config.gradeConfig.minGrade + gradeOffset;
  
  if (grade < this.config.gradeConfig.minGrade) {
    return { grade: this.config.gradeConfig.minGrade, name: this.config.gradeConfig.gradeNames[this.config.gradeConfig.minGrade], isFuture: true };
  }
  if (grade > this.config.gradeConfig.maxGrade) {
    return { grade: grade, name: `已毕业(${grade}年级入学)`, isGraduated: true };
  }
  return { grade: grade, name: this.config.gradeConfig.gradeNames[grade], isActive: true };
};

schoolData.getClassGradeInfo = function(classId) {
  const cls = this.classes.find(c => c.id === classId);
  if (!cls) return null;
  return this.calculateGradeLevel(cls.enrollment_year);
};

schoolData.getClassById = function(classId) {
  return this.classes.find(c => c.id === classId);
};

schoolData.getTeachersByClassId = function(classId) {
  return this.teachers.filter(t => 
    t.teaching_classes && t.teaching_classes.some(tc => tc.class_id === classId)
  );
};

schoolData.getStudentsByClassId = function(classId) {
  return this.students.filter(s => s.class_id === classId);
};

schoolData.getHeadTeacherByClassId = function(classId) {
  const cls = this.getClassById(classId);
  if (!cls || !cls.head_teacher_id) return null;
  return this.teachers.find(t => t.id === cls.head_teacher_id);
};

schoolData.formatClassName = function(classId) {
  const cls = this.getClassById(classId);
  if (!cls) return '未知班级';
  const classNoText = String(cls.class_no || cls.id).trim();
  const classNoMatch = classNoText.match(/\d+/);
  const classNoNumber = classNoMatch ? Number(classNoMatch[0]) : null;
  const classNo = Number.isFinite(classNoNumber)
    ? String(classNoNumber >= 100 ? classNoNumber % 100 : classNoNumber).padStart(2, '0')
    : classNoText;
  return `${cls.enrollment_year}级${classNo}班`;
};

schoolData.getStudentById = function(studentId) {
  return this.students.find(s => s.id === studentId);
};

schoolData.getParentsByStudentId = function(studentId) {
  return this.parents.filter(p => p.student_ids && p.student_ids.includes(studentId));
};

// 默认导出
export default schoolData;
