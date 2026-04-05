// 学校数据中心 - 所有模块共享的数据
// 班级是核心，教师、学生、家长都围绕班级建立关联
// 数据自动持久化到localStorage

const STORAGE_KEY = 'new_century_school_data';

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
  classes: [
    { id: 701, class_no: '701', name: '2025级01班', enrollment_year: 2025, head_teacher_id: null, classroom_location: '教学楼A-101', status: 'active', created_at: '2025-09-01' },
    { id: 702, class_no: '702', name: '2025级02班', enrollment_year: 2025, head_teacher_id: null, classroom_location: '教学楼A-102', status: 'active', created_at: '2025-09-01' },
    { id: 703, class_no: '703', name: '2025级03班', enrollment_year: 2025, head_teacher_id: null, classroom_location: '教学楼A-103', status: 'active', created_at: '2025-09-01' },
    { id: 704, class_no: '704', name: '2025级04班', enrollment_year: 2025, head_teacher_id: null, classroom_location: '教学楼A-104', status: 'active', created_at: '2025-09-01' },
    { id: 705, class_no: '705', name: '2025级05班', enrollment_year: 2025, head_teacher_id: null, classroom_location: '教学楼A-105', status: 'active', created_at: '2025-09-01' },
    { id: 706, class_no: '706', name: '2025级06班', enrollment_year: 2025, head_teacher_id: null, classroom_location: '教学楼A-106', status: 'active', created_at: '2025-09-01' },
    { id: 707, class_no: '707', name: '2025级07班', enrollment_year: 2025, head_teacher_id: null, classroom_location: '教学楼A-107', status: 'active', created_at: '2025-09-01' },
    { id: 708, class_no: '708', name: '2025级08班', enrollment_year: 2025, head_teacher_id: null, classroom_location: '教学楼A-108', status: 'active', created_at: '2025-09-01' },
    { id: 709, class_no: '709', name: '2025级09班', enrollment_year: 2025, head_teacher_id: null, classroom_location: '教学楼A-109', status: 'active', created_at: '2025-09-01' },
    { id: 710, class_no: '710', name: '2025级10班', enrollment_year: 2025, head_teacher_id: null, classroom_location: '教学楼A-110', status: 'active', created_at: '2025-09-01' },
    { id: 711, class_no: '711', name: '2025级11班', enrollment_year: 2025, head_teacher_id: null, classroom_location: '教学楼A-111', status: 'active', created_at: '2025-09-01' },
    { id: 712, class_no: '712', name: '2025级12班', enrollment_year: 2025, head_teacher_id: null, classroom_location: '教学楼A-112', status: 'active', created_at: '2025-09-01' },
    { id: 713, class_no: '713', name: '2025级13班', enrollment_year: 2025, head_teacher_id: null, classroom_location: '教学楼A-113', status: 'active', created_at: '2025-09-01' },
  ],

  // 教师数据
  teachers: [],

  // 学生数据
  students: [],

  // 家长数据
  parents: [],

  // 学科列表
  subjects: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '科学', '社会'],

  // 教师角色定义
  teacherRoles: [
    { id: 'subject_teacher', name: '科任教师', level: 1, permissions: ['view_own_class', 'view_own_students', 'input_scores'] },
    { id: 'head_teacher', name: '班主任', level: 2, permissions: ['view_own_class', 'view_own_students', 'input_scores', 'manage_class_students', 'view_class_reports'] },
    { id: 'lesson_leader', name: '备课组长', level: 3, permissions: ['view_subject_classes', 'view_subject_scores', 'manage_subject_materials'] },
    { id: 'research_leader', name: '教研组长', level: 4, permissions: ['view_grade_subject', 'manage_subject_teachers', 'approve_subject_activities'] },
    { id: 'grade_leader', name: '年段长', level: 5, permissions: ['view_grade_all', 'manage_grade_teachers', 'approve_grade_activities', 'view_grade_reports'] },
    { id: 'grade_deputy', name: '副段长', level: 5, permissions: ['view_grade_all', 'manage_grade_teachers', 'view_grade_reports'] },
    { id: 'dept_director', name: '科室主任', level: 6, permissions: ['view_dept_all', 'manage_dept_staff', 'approve_dept_activities'] },
    { id: 'dept_deputy', name: '科室副主任', level: 6, permissions: ['view_dept_all', 'manage_dept_staff'] },
    { id: 'vice_principal', name: '副校长', level: 7, permissions: ['view_school_all', 'manage_departments', 'approve_school_activities'] },
    { id: 'principal', name: '校长', level: 8, permissions: ['all_permissions'] },
    { id: 'admin', name: '系统管理员', level: 9, permissions: ['all_permissions', 'system_config'] }
  ],

  // 考试数据
  exams: [],

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
  examScores: []
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
  const stored = loadFromStorage();
  if (stored) {
    // 合并存储的数据和默认数据（确保新字段存在）
    const merged = { ...defaultData, ...stored };
    
    // 数据迁移：修复班级数据的class_no字段
    if (merged.classes && merged.classes.length > 0) {
      merged.classes = merged.classes.map(cls => {
        // 如果class_no是01-99这样的格式，改为701-799
        if (cls.class_no && /^\d{1,2}$/.test(cls.class_no)) {
          return { ...cls, class_no: String(cls.id) };
        }
        // 如果没有name字段，添加默认name
        if (!cls.name) {
          const classNum = String(cls.id).slice(-2);
          return { ...cls, name: `2025级${classNum}班` };
        }
        return cls;
      });
    }
    
    return merged;
  }
  return { ...defaultData };
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
  const gradeInfo = this.getClassGradeInfo(classId);
  return `${cls.enrollment_year}级${cls.class_no}班`;
};

schoolData.getStudentById = function(studentId) {
  return this.students.find(s => s.id === studentId);
};

schoolData.getParentsByStudentId = function(studentId) {
  return this.parents.filter(p => p.student_ids && p.student_ids.includes(studentId));
};

// 默认导出
export default schoolData;
