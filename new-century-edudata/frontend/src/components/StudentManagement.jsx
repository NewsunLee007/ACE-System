import React, { useCallback, useState, useEffect } from 'react';
import {
  Plus,
  Search,
  GraduationCap,
  Users,
  User,
  UserCheck,
  Edit,
  Eye,
  Trash2,
  X,
  Download,
  Upload,
  Square,
  CheckSquare,
  School,
  FileText
} from 'lucide-react';
import schoolData from '../data/schoolData';
import { notify } from '../lib/notify';
import { useConfirm } from './ui/confirm';
import SmartImportModal from './SmartImportModal';
import {
  buildStudentImport,
  commitStudentImport,
  parseStudentImportText,
} from '../lib/studentImport';
import {
  createStudentRecord,
  fetchStudentList,
  studentImportItemsToCsv,
  updateStudentRecord,
  uploadStudentImportFile,
} from '../lib/studentApi';
import { hasBackendAuthToken } from '../lib/sessionToken';
import {
  REGISTRY_STATUS_OPTIONS,
  STUDENT_STATUS_OPTIONS,
  buildStudentRegistryStats,
  buildStudentRegistryTimeline,
  getRegistryStatusFromStudent,
  getStudentGradeLabel,
  getStudentStatusColor,
  getStudentStatusDisplay,
  normalizeStudentRecordForRegistry,
} from '../lib/studentRegistry';

const hasBackendSession = hasBackendAuthToken;

const isExcelFile = (file) => /\.(xls|xlsx)$/i.test(file?.name || '');

const normalizeStudentListForRegistry = (items = []) => items.map(normalizeStudentRecordForRegistry);

const StudentManagement = () => {
  const { confirm: confirmAction } = useConfirm();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [studentSyncSource, setStudentSyncSource] = useState('local');
  const [studentListLoading, setStudentListLoading] = useState(false);
  const [studentListError, setStudentListError] = useState('');
  const [studentImporting, setStudentImporting] = useState(false);
  const [studentImportBackendResult, setStudentImportBackendResult] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [importFile, setImportFile] = useState(null);
  const fileInputRef = React.useRef(null);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // 智能导入相关状态
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState([]);
  const skipInitialStudentSync = React.useRef(true);
  const localStudentCacheRef = React.useRef([]);
  
  // 选中的学生（用于查看详情）
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState(null);
  
  // 全校概况表弹窗
  const [showOverviewModal, setShowOverviewModal] = useState(false);

  // 提前招生数据
  const [earlyAdmissions, setEarlyAdmissions] = useState([]);
  const [filterEarlyAdmission, setFilterEarlyAdmission] = useState('');

  // 导出预览弹窗
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportPreviewData, setExportPreviewData] = useState([]);

  // 提前招生导入弹窗
  const [showEarlyAdmissionImportModal, setShowEarlyAdmissionImportModal] = useState(false);
  const [earlyAdmissionImportFile, setEarlyAdmissionImportFile] = useState(null);
  const [earlyAdmissionImportPreview, setEarlyAdmissionImportPreview] = useState([]);

  // 表单状态
  const [formData, setFormData] = useState({
    student_code: '',
    name: '',
    gender: '1',
    class_id: '',
    status: '在籍',
    enrollment_year: 2024,
    registry_status: '正常在籍',
    enrollment_type: '正常入学',
    source_school: '',
    status_changed_at: '',
    status_reason: '',
    // 提前招生信息
    early_admission_school: '',
    early_admission_type: '',
    early_admission_date: '',
    early_admission_notes: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [selectedStudent, setSelectedStudent] = useState(null);

  // 从数据中心加载数据
  useEffect(() => {
    const normalizedStudents = normalizeStudentListForRegistry(schoolData.students || []);
    localStudentCacheRef.current = normalizedStudents;
    setStudents(normalizedStudents);
    schoolData.students = normalizedStudents;
    const loadedClasses = schoolData.classes || [];
    setClasses(loadedClasses);
    setEarlyAdmissions(schoolData.earlyAdmissions || []);
  }, []);

  const refreshStudents = useCallback(async () => {
    if (!hasBackendSession()) {
      setStudentSyncSource('local');
      return null;
    }

    setStudentListLoading(true);
    try {
      const payload = await fetchStudentList({ status: '', pageSize: 100 }, classes);
      const remoteStudents = normalizeStudentListForRegistry(payload.students || []);
      if (remoteStudents.length === 0 && localStudentCacheRef.current.length > 0) {
        setStudents(localStudentCacheRef.current);
        setStudentSyncSource('local');
        setStudentListError('后端学生库暂无学生记录，当前显示本地真实导入数据。');
        return {
          ...payload,
          students: localStudentCacheRef.current,
          source: 'local-fallback',
        };
      }

      setStudents(remoteStudents);
      if (remoteStudents.length > 0) {
        localStudentCacheRef.current = remoteStudents;
      }
      setStudentSyncSource('backend');
      setStudentListError('');
      return payload;
    } catch (error) {
      setStudentSyncSource('local');
      setStudentListError(`后端学生库暂不可用，当前显示本地缓存：${error.message || '连接失败'}`);
      return null;
    } finally {
      setStudentListLoading(false);
    }
  }, [classes]);

  useEffect(() => {
    if (classes.length > 0) {
      refreshStudents();
    }
  }, [classes.length, refreshStudents]);

  // 同步students到schoolData
  useEffect(() => {
    if (skipInitialStudentSync.current) {
      skipInitialStudentSync.current = false;
      return;
    }
    schoolData.students = students;
    if (students.length > 0) {
      localStudentCacheRef.current = students;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('schoolData:changed'));
    }
  }, [students]);

  // 同步earlyAdmissions到schoolData
  useEffect(() => {
    schoolData.earlyAdmissions = earlyAdmissions;
  }, [earlyAdmissions]);

  // 获取所有唯一的年级（从学生数据中）
  const uniqueGrades = React.useMemo(() => {
    const gradeSet = new Set();
    students.forEach(student => {
      const cls = classes.find(c => c.id === student.class_id);
      if (cls) {
        // 从班级ID提取年级：701->7, 802->8, 913->9
        const grade = Math.floor(cls.id / 100);
        if (grade >= 7 && grade <= 9) {
          gradeSet.add(String(grade));
        }
      }
    });
    return Array.from(gradeSet).sort();
  }, [students, classes]);

  // 获取所有唯一的班级（从班级数据中，根据选中的年级过滤）
  const uniqueClasses = React.useMemo(() => {
    return classes.filter(cls => {
      if (filterGrade) {
        const classGrade = String(Math.floor(cls.id / 100));
        return classGrade === filterGrade;
      }
      return true;
    }).sort((a, b) => a.id - b.id);
  }, [classes, filterGrade]);

  // 获取所有唯一的状态（从学生数据中）
  const uniqueStatuses = React.useMemo(() => {
    const statusSet = new Set();
    students.forEach(student => {
      if (student.status) {
        statusSet.add(student.status);
      }
    });
    return Array.from(statusSet).sort();
  }, [students]);

  // 验证学籍辅号 - 支持10-13位数字（包括0开头）
  const validateStudentCode = (code) => {
    if (!code || code.trim() === '') {
      return { valid: false, message: '学籍辅号不能为空' };
    }
    const codeStr = code.trim();
    // 支持10-13位数字（包括0开头）
    if (!/^\d{10,13}$/.test(codeStr)) {
      return { valid: false, message: '学籍辅号必须是10-13位数字' };
    }
    // 检查是否已存在
    const existing = students.find(s => s.student_code === codeStr);
    if (existing && (!selectedStudent || existing.id !== selectedStudent.id)) {
      return { valid: false, message: '该学籍辅号已存在' };
    }
    return { valid: true };
  };

  // 验证表单
  const validateForm = () => {
    const errors = {};
    
    // 验证学籍辅号
    const codeValidation = validateStudentCode(formData.student_code);
    if (!codeValidation.valid) {
      errors.student_code = codeValidation.message;
    }
    
    // 验证姓名
    if (!formData.name || formData.name.trim() === '') {
      errors.name = '姓名不能为空';
    }
    
    // 验证班级
    if (!formData.class_id) {
      errors.class_id = '请选择所属班级';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateStudent = () => {
    setFormData({
      student_code: '',
      name: '',
      gender: '1',
      class_id: '',
      status: '在籍',
      enrollment_year: 2024,
      registry_status: '正常在籍',
      enrollment_type: '正常入学',
      source_school: '',
      status_changed_at: '',
      status_reason: ''
    });
    setFormErrors({});
    setSelectedStudent(null);
    setShowCreateModal(true);
  };

  const handleEditStudent = (student) => {
    setSelectedStudent(student);
    // 查找该学生的提前招生信息
    const admission = earlyAdmissions.find(a => a.student_id === student.id);

    // 检查学校/类型是否在预设列表中，如果不在则添加 custom_ 前缀
    const schools = schoolData.earlyAdmissionSchools || ['温中', '瑞中', '新纪元'];
    const types = ['保送', '特招', '签约', '自主招生', '其他'];

    let schoolValue = admission ? admission.school_name : '';
    let typeValue = admission ? admission.admission_type : '';

    if (schoolValue && !schools.includes(schoolValue)) {
      schoolValue = 'custom_' + schoolValue;
    }
    if (typeValue && !types.includes(typeValue)) {
      typeValue = 'custom_' + typeValue;
    }

    setFormData({
      student_code: student.student_code || '',
      name: student.name || '',
      gender: student.gender === 0 ? '0' : '1',
      class_id: student.class_id || '',
      status: student.status || '在籍',
      enrollment_year: student.enrollment_year || 2024,
      registry_status: student.registry_status || getRegistryStatusFromStudent(student),
      enrollment_type: student.enrollment_type || '正常入学',
      source_school: student.source_school || '',
      status_changed_at: student.status_changed_at || '',
      status_reason: student.status_reason || '',
      // 提前招生信息
      early_admission_school: schoolValue,
      early_admission_type: typeValue,
      early_admission_date: admission ? admission.admission_date : '',
      early_admission_notes: admission ? admission.notes : ''
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleSaveStudent = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const studentData = {
        student_code: formData.student_code.trim(),
        name: formData.name.trim(),
        gender: parseInt(formData.gender),
        class_id: parseInt(formData.class_id),
        status: formData.status,
        enrollment_year: parseInt(formData.enrollment_year),
        registry_status: formData.registry_status || getRegistryStatusFromStudent(formData),
        enrollment_type: formData.enrollment_type || '正常入学',
        source_school: formData.source_school || '',
        status_changed_at: formData.status_changed_at || '',
        status_reason: formData.status_reason || ''
      };

      let studentId;

      if (hasBackendSession()) {
        if (selectedStudent) {
          const result = await updateStudentRecord(selectedStudent.id, formData, classes);
          if (result?.success === false) {
            notify(result.message || '学生信息更新失败', 'warning');
            return;
          }
          await refreshStudents();
          notify(result?.message || '学生信息更新成功！', 'success');
          setShowEditModal(false);
          studentId = selectedStudent.id;
        } else {
          const result = await createStudentRecord(formData, classes);
          if (result?.success === false) {
            notify(result.message || '学生添加失败', 'warning');
            return;
          }
          studentId = result?.student_id;
          if (formData.status && formData.status !== '在读' && studentId) {
            await updateStudentRecord(studentId, formData, classes);
          }
          const reloaded = await refreshStudents();
          if (!reloaded) {
            const newStudent = {
              id: studentId || Date.now(),
              ...studentData
            };
            setStudents(prev => [...prev, newStudent]);
          }
          notify(result?.message || '学生添加成功！', 'success');
          setShowCreateModal(false);
        }
      } else if (selectedStudent) {
        // 更新现有学生
        const updatedStudents = students.map(s =>
          s.id === selectedStudent.id
            ? normalizeStudentRecordForRegistry({ ...s, ...studentData })
            : s
        );
        setStudents(updatedStudents);
        schoolData.students = updatedStudents;
        studentId = selectedStudent.id;
        notify('学生信息更新成功！', 'success');
        setShowEditModal(false);
      } else {
        // 创建新学生
        const newStudent = {
          id: Date.now(),
          ...studentData
        };
        studentId = newStudent.id;
        const updatedStudents = [...students, normalizeStudentRecordForRegistry(newStudent)];
        setStudents(updatedStudents);
        schoolData.students = updatedStudents;
        notify('学生添加成功！', 'success');
        setShowCreateModal(false);
      }

      // 保存提前招生信息
      if (formData.early_admission_school) {
        const existingAdmissionIndex = earlyAdmissions.findIndex(a => a.student_id === studentId);
        // 处理自定义值，去掉 custom_ 前缀
        const schoolName = formData.early_admission_school.startsWith('custom_')
          ? formData.early_admission_school.replace('custom_', '')
          : formData.early_admission_school;
        const admissionType = formData.early_admission_type.startsWith('custom_')
          ? formData.early_admission_type.replace('custom_', '')
          : formData.early_admission_type || '保送';

        const admissionData = {
          student_id: studentId,
          school_name: schoolName,
          admission_type: admissionType,
          admission_date: formData.early_admission_date || new Date().toISOString().split('T')[0],
          notes: formData.early_admission_notes || ''
        };

        let updatedAdmissions;
        if (existingAdmissionIndex >= 0) {
          // 更新现有提前招生记录
          updatedAdmissions = [...earlyAdmissions];
          updatedAdmissions[existingAdmissionIndex] = {
            ...updatedAdmissions[existingAdmissionIndex],
            ...admissionData
          };
        } else {
          // 创建新提前招生记录
          updatedAdmissions = [...earlyAdmissions, {
            id: Date.now(),
            ...admissionData,
            created_at: new Date().toISOString().split('T')[0]
          }];
        }
        setEarlyAdmissions(updatedAdmissions);
        schoolData.earlyAdmissions = updatedAdmissions;
      } else {
        // 如果清除了提前招生信息，删除现有记录
        const updatedAdmissions = earlyAdmissions.filter(a => a.student_id !== studentId);
        setEarlyAdmissions(updatedAdmissions);
        schoolData.earlyAdmissions = updatedAdmissions;
      }

      // 重置表单
      setFormData({
        student_code: '',
        name: '',
        gender: '1',
        class_id: '',
        status: '在籍',
        enrollment_year: 2024,
        registry_status: '正常在籍',
        enrollment_type: '正常入学',
        source_school: '',
        status_changed_at: '',
        status_reason: '',
        early_admission_school: '',
        early_admission_type: '',
        early_admission_date: '',
        early_admission_notes: ''
      });
      setFormErrors({});
    } catch (error) {
      console.error('保存学生信息失败:', error);
      notify('保存失败：' + error.message, 'error');
    }
  };

  const handleDeleteStudent = async (id) => {
    const confirmed = await confirmAction({
      title: '删除学生',
      message: '确定要删除这名学生吗？',
      confirmText: '删除'
    });
    if (!confirmed) return;

    if (hasBackendSession()) {
      notify('后端学生库不支持物理删除；请将学生状态调整为转学、退学或休学以保留历史成绩。', 'warning');
      return;
    }

    try {
      const updatedStudents = students.filter(s => s.id !== id);
      setStudents(updatedStudents);
      schoolData.students = updatedStudents;
      notify('删除成功！');
    } catch (error) {
      console.error('删除学生失败:', error);
      notify('删除失败：' + error.message);
    }
  };

  // 查看学生详情
  const handleViewDetail = (student) => {
    setSelectedStudentForDetail(student);
    setShowDetailModal(true);
  };

  // 获取学生的家长信息
  const getStudentParents = (studentId) => {
    return (schoolData.parents || []).filter(parent => 
      parent.student_ids && parent.student_ids.includes(studentId)
    );
  };

  // 获取学生的成绩信息
  const getStudentScores = (studentId) => {
    return (schoolData.examScores || schoolData.scores || []).filter(score => score.student_id === studentId);
  };

  // 下载导入模板
  const downloadTemplate = () => {
    const sampleClass1 = classes[0] || { id: 701, enrollment_year: schoolData.config.currentAcademicYear };
    const sampleClass2 = classes[1] || { id: 702, enrollment_year: schoolData.config.currentAcademicYear };
    
    // 移除身份证列，保护学生隐私
    const headers = ['学籍辅号', '姓名', '性别(男/女)', '班级编号', '状态(在籍/借读/休学/转学/退学/请长假)', '入学年份'];
    const sampleData = [
      ['20250701001', '张小明', '男', sampleClass1.id, '在籍', sampleClass1.enrollment_year],
      ['20250701002', '李小红', '女', sampleClass2.id, '在籍', sampleClass2.enrollment_year],
    ];
    
    // 添加格式说明
    const notes = [
      '',
      '# 填写说明',
      '# 1. 班级编号可以填 701、701班、01 或 2025级01班',
      '# 2. 学籍辅号格式：10-13位数字，如 20250701001',
      '# 3. 性别：男 或 女',
      '# 4. 状态：在籍、借读、休学、转学、退学、请长假；其他值会进入待核验',
      '# 5. 入学年份可留空，系统会优先按班级入学年份识别',
    ];
    
    const csvContent = [
      headers.join(','), 
      ...sampleData.map(row => row.join(',')),
      ...notes
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '学生导入模板.csv';
    link.click();
  };

  // 智能导入 - 解析文件并显示预览
  const handleImportPreview = async () => {
    if (!importFile) {
      notify('请先选择要导入的文件');
      return;
    }

    setStudentImportBackendResult(null);

    if (isExcelFile(importFile)) {
      if (!hasBackendSession()) {
        notify('Excel 文件需要登录后写入后端学生库；当前会话未检测到登录 token。', 'error');
        return;
      }

      setStudentImporting(true);
      try {
        const result = await uploadStudentImportFile({
          file: importFile,
          filename: importFile.name,
        });
        if (result?.success === false) {
          notify(result.message || '学生导入失败', 'warning');
          return;
        }
        setStudentImportBackendResult(result);
        await refreshStudents();
        setShowImportModal(false);
        setImportFile(null);
        notify(result?.message || '学生导入完成，学生库已刷新。', 'success');
      } catch (error) {
        notify('导入失败：' + (error.message || '请稍后重试'), 'error');
      } finally {
        setStudentImporting(false);
      }
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseStudentImportText(e.target.result || '');
        const result = buildStudentImport({
          parsedRows: parsed.rows,
          students,
          classes,
          currentAcademicYear: schoolData.config.currentAcademicYear,
          formatClassName: schoolData.formatClassName.bind(schoolData),
        });

        if (result.items.length === 0) {
          notify('没有可导入的学生数据');
          return;
        }

        setImportPreviewData(result.items);
        setShowSmartImport(true);
        setShowImportModal(false);
      } catch (error) {
        console.error('解析导入文件失败:', error);
        notify('解析文件失败：' + error.message);
      }
    };
    
    reader.onerror = () => {
      notify('文件读取失败');
    };
    
    reader.readAsText(importFile);
  };

  // 确认智能导入
  const handleConfirmImport = async (selectedData) => {
    try {
      const importResult = { items: selectedData };
      const addedCount = selectedData.filter(item => item.type === 'new').length;
      const updatedCount = selectedData.filter(item => item.type === 'update').length;

      if (addedCount === 0 && updatedCount === 0) {
        notify('没有选择需要写入的学生变更');
        return;
      }

      if (hasBackendSession()) {
        setStudentImporting(true);
        const csv = studentImportItemsToCsv({ items: selectedData, classes });
        const backendResult = await uploadStudentImportFile({
          file: new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }),
          filename: 'students_selected_import.csv',
        });
        if (backendResult?.success === false) {
          notify(backendResult.message || '后端导入失败', 'warning');
          return;
        }
        setStudentImportBackendResult(backendResult);
        await refreshStudents();
        setShowSmartImport(false);
        setImportFile(null);
        notify(backendResult?.message || `导入完成：新增 ${addedCount} 人，更新 ${updatedCount} 人`, 'success');
        return;
      }

      const updatedStudents = commitStudentImport({
        students,
        importResult,
      });

      setStudents(updatedStudents);
      schoolData.students = updatedStudents;
      setShowSmartImport(false);
      setImportFile(null);
      
      notify(`导入完成：新增 ${addedCount} 人，更新 ${updatedCount} 人`, 'success');
    } catch (error) {
      console.error('导入失败:', error);
      notify('导入失败：' + error.message, 'error');
    } finally {
      setStudentImporting(false);
    }
  };

  const getGenderText = (gender) => gender === 1 ? '男' : '女';

  // 格式化班级名称
  const formatClassDisplayName = (cls) => {
    if (!cls) return '未分配';
    return schoolData.formatClassName(cls.id);
  };

  const getStatusColor = (status) => {
    return getStudentStatusColor(status);
  };

  // 准备导出预览数据
  const prepareExportPreview = () => {
    const hasEarlyAdmissionFilter = !!filterEarlyAdmission;
    const headers = hasEarlyAdmissionFilter
      ? ['学籍辅号', '姓名', '性别', '当前年级', '班级', '班主任', '状态', '学籍状态', '提前招生学校', '录取类型', '录取日期', '入学年份']
      : ['学籍辅号', '姓名', '性别', '当前年级', '班级', '班主任', '状态', '学籍状态', '入学年份'];

    const data = filteredStudents.map(s => {
      const cls = schoolData.getClassById(s.class_id);
      const headTeacher = cls ? schoolData.getHeadTeacherByClassId(cls.id) : null;
      const admission = earlyAdmissions.find(a => a.student_id === s.id);

      const baseData = {
        '学籍辅号': s.student_code,
        '姓名': s.name,
        '性别': s.gender === 1 ? '男' : '女',
        '当前年级': getStudentGradeLabel(s, classes),
        '班级': cls ? schoolData.formatClassName(cls.id) : '未分配',
        '班主任': headTeacher ? headTeacher.name : '未设置',
        '状态': getStudentStatusDisplay(s),
        '学籍状态': getRegistryStatusFromStudent(s),
        '入学年份': s.enrollment_year
      };

      if (hasEarlyAdmissionFilter) {
        baseData['提前招生学校'] = admission ? admission.school_name : '';
        baseData['录取类型'] = admission ? admission.admission_type : '';
        baseData['录取日期'] = admission ? admission.admission_date : '';
      }

      return baseData;
    });

    setExportPreviewData({ headers, data });
    setShowExportPreview(true);
  };

  // 确认导出
  const confirmExport = () => {
    const { data } = exportPreviewData;
    const headerRow = Object.keys(data[0] || {});
    const rows = data.map(row => headerRow.map(key => row[key]));

    const csvContent = [headerRow.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);

    // 根据筛选条件生成文件名
    let fileName = '学生名单';
    if (filterEarlyAdmission === 'all') {
      fileName = '提前招生学生名单';
    } else if (filterEarlyAdmission) {
      fileName = `${filterEarlyAdmission}提前招生名单`;
    } else if (filterClass) {
      const cls = schoolData.getClassById(parseInt(filterClass));
      fileName = cls ? `${schoolData.formatClassName(cls.id)}学生名单` : '班级学生名单';
    } else if (filterGrade) {
      fileName = `${filterGrade === '7' ? '七' : filterGrade === '8' ? '八' : '九'}年级学生名单`;
    }

    link.download = `${fileName}_${new Date().toLocaleDateString()}.csv`;
    link.click();
    setShowExportPreview(false);
  };

  // 提前招生导入相关函数
  const handleEarlyAdmissionFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEarlyAdmissionImportFile(file);
      // 读取文件预览
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        const lines = content.split('\n').filter(line => line.trim());
        const preview = [];
        const errors = [];

        for (let i = 1; i < Math.min(lines.length, 11); i++) { // 预览前10条
          const cols = lines[i].split(',');
          if (cols.length >= 3) {
            const studentCode = cols[0]?.trim();
            const schoolName = cols[1]?.trim();
            const admissionType = cols[2]?.trim();
            const admissionDate = cols[3]?.trim();
            const notes = cols[4]?.trim();

            // 查找学生
            const student = students.find(s => s.student_code === studentCode);

            preview.push({
              row: i + 1,
              studentCode,
              studentName: student ? student.name : '未找到',
              schoolName,
              admissionType: admissionType || '保送',
              admissionDate: admissionDate || new Date().toISOString().split('T')[0],
              notes: notes || '',
              valid: !!student,
              studentId: student ? student.id : null
            });

            if (!student) {
              errors.push(`第${i + 1}行：学籍辅号 "${studentCode}" 不存在`);
            }
          }
        }

        setEarlyAdmissionImportPreview({ preview, errors, total: lines.length - 1 });
      };
      reader.readAsText(file);
    }
  };

  const downloadEarlyAdmissionTemplate = () => {
    const headers = ['学籍辅号', '录取学校', '录取类型', '录取日期', '备注'];
    const sampleData = [
      ['20240701001', '温中', '保送', '2025-03-15', ''],
      ['20240701002', '瑞中', '特招', '2025-03-16', ''],
    ];

    const csvContent = [headers.join(','), ...sampleData.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `提前招生导入模板_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  const confirmEarlyAdmissionImport = () => {
    if (!earlyAdmissionImportPreview.preview || earlyAdmissionImportPreview.preview.length === 0) {
      notify('没有可导入的数据');
      return;
    }

    const validRecords = earlyAdmissionImportPreview.preview.filter(r => r.valid);
    if (validRecords.length === 0) {
      notify('没有有效的数据可导入');
      return;
    }

    // 导入数据
    let successCount = 0;
    let updateCount = 0;

    validRecords.forEach(record => {
      const existingIndex = earlyAdmissions.findIndex(a => a.student_id === record.studentId);

      if (existingIndex >= 0) {
        // 更新现有记录
        const updatedAdmissions = [...earlyAdmissions];
        updatedAdmissions[existingIndex] = {
          ...updatedAdmissions[existingIndex],
          school_name: record.schoolName,
          admission_type: record.admissionType,
          admission_date: record.admissionDate,
          notes: record.notes
        };
        setEarlyAdmissions(updatedAdmissions);
        schoolData.earlyAdmissions = updatedAdmissions;
        updateCount++;
      } else {
        // 创建新记录
        const newAdmission = {
          id: Date.now() + Math.random(),
          student_id: record.studentId,
          school_name: record.schoolName,
          admission_type: record.admissionType,
          admission_date: record.admissionDate,
          notes: record.notes,
          created_at: new Date().toISOString().split('T')[0]
        };
        const updatedAdmissions = [...earlyAdmissions, newAdmission];
        setEarlyAdmissions(updatedAdmissions);
        schoolData.earlyAdmissions = updatedAdmissions;
        successCount++;
      }
    });

    notify(`导入完成！新增 ${successCount} 条记录，更新 ${updateCount} 条记录`);
    setShowEarlyAdmissionImportModal(false);
    setEarlyAdmissionImportFile(null);
    setEarlyAdmissionImportPreview([]);
  };

  // 批量选择相关函数
  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map(s => s.id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      notify('请先选择要删除的学生');
      return;
    }
    const confirmed = await confirmAction({
      title: '批量删除学生',
      message: `确定要删除选中的 ${selectedIds.length} 名学生吗？`,
      confirmText: '批量删除'
    });
    if (!confirmed) return;

    if (hasBackendSession()) {
      notify('后端学生库不支持批量物理删除；请批量维护学生状态，避免丢失历史成绩。', 'warning');
      return;
    }

    try {
      const updatedStudents = students.filter(s => !selectedIds.includes(s.id));
      setStudents(updatedStudents);
      schoolData.students = updatedStudents;
      setSelectedIds([]);
      notify('批量删除成功！');
    } catch (error) {
      console.error('批量删除失败:', error);
      notify('批量删除失败：' + error.message);
    }
  };

  // 获取学生班级信息
  const getStudentClassInfo = (student) => {
    const cls = schoolData.getClassById(student.class_id);
    if (cls) {
      return {
        name: schoolData.formatClassName(cls.id),
        grade: cls.grade_level
      };
    }
    return { name: '未分配', grade: '-' };
  };

  // 获取学生班主任
  const getStudentHeadTeacher = (student) => {
    const headTeacher = schoolData.getHeadTeacherByClassId(student.class_id);
    return headTeacher ? headTeacher.name : '未设置';
  };

  const filteredStudents = students.filter(s => {
    const matchSearch = s.name.includes(searchTerm) || s.student_code.includes(searchTerm);
    const cls = schoolData.getClassById(s.class_id);
    // 从班级ID提取年级：701->7, 802->8
    const studentGrade = cls ? String(Math.floor(cls.id / 100)) : '';
    const matchGrade = !filterGrade || studentGrade === filterGrade;
    const matchClass = !filterClass || s.class_id === parseInt(filterClass);
    const matchStatus = !filterStatus || s.status === filterStatus;
    
    // 提前招生筛选
    let matchEarlyAdmission = true;
    if (filterEarlyAdmission) {
      const studentAdmission = earlyAdmissions.find(a => a.student_id === s.id);
      if (filterEarlyAdmission === 'all') {
        matchEarlyAdmission = !!studentAdmission;
      } else {
        matchEarlyAdmission = studentAdmission && studentAdmission.school_name === filterEarlyAdmission;
      }
    }
    
    return matchSearch && matchGrade && matchClass && matchStatus && matchEarlyAdmission;
  });

  const registryStats = React.useMemo(() => (
    buildStudentRegistryStats(students, classes)
  ), [students, classes]);

  // 表单输入处理
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除该字段的错误
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">学生学籍管理</h1>
        <p className="text-gray-500 mt-1">统一维护学生建档、分班、在籍状态、学籍异动和家校关联信息</p>
      </div>

      {(studentListLoading || studentListError || studentSyncSource === 'backend') && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
          studentListError
            ? 'border-amber-100 bg-amber-50 text-amber-700'
            : 'border-emerald-100 bg-emerald-50 text-emerald-700'
        }`}>
          {studentListError ? <X className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          <span>
            {studentListLoading
              ? '正在同步后端学生库...'
              : studentListError || '已连接后端学生库，学生名单来自数据库。'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 mb-6 md:grid-cols-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs text-gray-500">在籍比例</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{registryStats.activeRate.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-gray-500">在籍/在读/借读/请长假 {registryStats.activeCount} 人</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs text-gray-500">学籍异动</p>
          <p className="mt-1 text-2xl font-bold text-orange-600">{registryStats.movementCount}</p>
          <p className="mt-1 text-xs text-gray-500">休学、转学、退学、毕业</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs text-gray-500">待核验状态</p>
          <p className="mt-1 text-2xl font-bold text-purple-600">{registryStats.anomalyCount}</p>
          <p className="mt-1 text-xs text-gray-500">来自导入源的非标准状态</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-xs text-gray-500">未匹配班级</p>
          <p className="mt-1 text-2xl font-bold text-slate-600">{registryStats.unassignedCount}</p>
          <p className="mt-1 text-xs text-gray-500">需补充分班或班级档案</p>
        </div>
      </div>

      {/* 统计卡片 - 根据筛选条件动态计算 */}
      {(() => {
        // 根据当前筛选条件计算统计数据的范围
        const targetStudents = filterClass 
          ? students.filter(s => s.class_id === parseInt(filterClass))
          : filterGrade
            ? students.filter(s => {
                const cls = classes.find(c => c.id === s.class_id);
                return cls && String(Math.floor(cls.id / 100)) === filterGrade;
              })
            : students;
        
        // 计算班级数
        const classCount = filterClass 
          ? 1 
          : filterGrade
            ? new Set(targetStudents.map(s => s.class_id)).size
            : uniqueClasses.length;
        
        // 动态获取所有实际存在的状态（从当前筛选后的学生中）
        const actualStatuses = [...new Set(targetStudents.map(s => s.status).filter(Boolean))]
          .sort((a, b) => {
            const indexA = STUDENT_STATUS_OPTIONS.indexOf(a);
            const indexB = STUDENT_STATUS_OPTIONS.indexOf(b);
            return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
          });
        
        // 状态颜色映射（预定义一些常用状态的颜色，未知状态使用默认灰色）
        return (
          <div className="space-y-3 mb-6">
            {/* 第一行：基础统计 */}
            <div className="grid grid-cols-4 gap-3">
              {/* 班级数 */}
              <div className="bg-white rounded-lg shadow-sm p-3">
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-blue-100 text-blue-600 mr-3">
                    <School className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">班级数</p>
                    <p className="text-xl font-bold text-blue-600">{classCount}</p>
                  </div>
                </div>
              </div>
              
              {/* 学生总数 */}
              <div className="bg-white rounded-lg shadow-sm p-3">
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-indigo-100 text-indigo-600 mr-3">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">学生总数</p>
                    <p className="text-xl font-bold text-indigo-600">{targetStudents.length}</p>
                  </div>
                </div>
              </div>
              
              {/* 男生 */}
              <div className="bg-white rounded-lg shadow-sm p-3">
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-cyan-100 text-cyan-600 mr-3">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">男生</p>
                    <p className="text-xl font-bold text-cyan-600">{targetStudents.filter(s => s.gender === 1).length}</p>
                  </div>
                </div>
              </div>
              
              {/* 女生 */}
              <div className="bg-white rounded-lg shadow-sm p-3">
                <div className="flex items-center">
                  <div className="p-2 rounded-full bg-pink-100 text-pink-600 mr-3">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">女生</p>
                    <p className="text-xl font-bold text-pink-600">{targetStudents.filter(s => s.gender === 0).length}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 第二行：状态统计 - 动态显示实际存在的状态 */}
            <div className={`grid gap-3 ${actualStatuses.length <= 6 ? 'grid-cols-6' : actualStatuses.length <= 8 ? 'grid-cols-4' : 'grid-cols-6'}`}>
              {actualStatuses.map(status => {
                const count = targetStudents.filter(s => s.status === status).length;
                const [bgClass, textClass] = getStudentStatusColor(status).split(' ');
                return (
                  <div key={status} className="bg-white rounded-lg shadow-sm p-3">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-full ${bgClass} ${textClass} mr-3`}>
                        <UserCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{status}</p>
                        <p className={`text-xl font-bold ${textClass}`}>{count}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 操作栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col gap-4">
          {/* 第一行：主要筛选条件 */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="搜索学生姓名或学籍号..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-64"
                />
              </div>
              <select
                value={filterGrade}
                onChange={(e) => {
                  setFilterGrade(e.target.value);
                  // 切换年级时清空班级选择，避免班级不在当前年级中
                  setFilterClass('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">所有年级</option>
                {uniqueGrades.map(grade => (
                  <option key={grade} value={grade}>
                    {grade === '7' ? '七年级' : grade === '8' ? '八年级' : grade === '9' ? '九年级' : `${grade}年级`}
                  </option>
                ))}
              </select>
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">所有班级</option>
                {uniqueClasses.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {formatClassDisplayName(cls)}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">所有状态</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleBatchDelete();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                  批量删除 ({selectedIds.length})
                </button>
              )}
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Upload className="w-4 h-4" />
                导入学生
              </button>
              <button
                onClick={() => setShowEarlyAdmissionImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50"
              >
                <GraduationCap className="w-4 h-4" />
                导入提前招生
              </button>
              <button
                onClick={prepareExportPreview}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                导出
              </button>
              <button
                onClick={() => setShowOverviewModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <FileText className="w-4 h-4" />
                全校概况表
              </button>
              <button
                onClick={handleCreateStudent}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                添加学生
              </button>
            </div>
          </div>

          {/* 第二行：高级筛选条件 */}
          <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
            <span className="text-sm text-gray-500">高级筛选：</span>
            <select
              value={filterEarlyAdmission}
              onChange={(e) => setFilterEarlyAdmission(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">提前招生</option>
              <option value="all">全部提前招生</option>
              {(schoolData.earlyAdmissionSchools || ['温中', '瑞中', '新纪元']).map(school => (
                <option key={school} value={school}>{school}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 学生列表 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <button 
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 hover:text-blue-600"
                >
                  {selectedIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  全选
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">学籍辅号</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">性别</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">当前年级</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">班级</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">班主任</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">学籍状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">提前招生</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">入学年份</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredStudents.map((student) => {
              const classInfo = getStudentClassInfo(student);
              const headTeacher = getStudentHeadTeacher(student);
              const admission = earlyAdmissions.find(a => a.student_id === student.id);
              return (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleSelect(student.id)}
                      className="text-gray-400 hover:text-blue-600"
                    >
                      {selectedIds.includes(student.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">{student.student_code}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{student.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{getGenderText(student.gender)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{getStudentGradeLabel(student, classes)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{classInfo.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{headTeacher}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(student.status)}`}>
                      {getStudentStatusDisplay(student)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{getRegistryStatusFromStudent(student)}</td>
                  <td className="px-6 py-4">
                    {admission ? (
                      <div className="flex flex-col">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          {admission.school_name}
                        </span>
                        <span className="text-xs text-gray-500 mt-1">{admission.admission_type}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{student.enrollment_year}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetail(student);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditStudent(student);
                        }}
                        className="text-gray-600 hover:text-gray-900"
                        title="编辑"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteStudent(student.id);
                        }}
                        className="text-red-600 hover:text-red-900"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 创建/编辑学生弹窗 */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">{selectedStudent ? '编辑学生' : '添加学生'}</h2>
              <button onClick={() => selectedStudent ? setShowEditModal(false) : setShowCreateModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    学籍辅号 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.student_code}
                    onChange={(e) => handleInputChange('student_code', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${formErrors.student_code ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="请输入学籍辅号"
                  />
                  {formErrors.student_code && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.student_code}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    姓名 <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${formErrors.name ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="学生姓名"
                  />
                  {formErrors.name && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">性别</label>
                  <select 
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="1">男</option>
                    <option value="0">女</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">入学年份</label>
                  <input 
                    type="number" 
                    value={formData.enrollment_year}
                    onChange={(e) => handleInputChange('enrollment_year', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    min="2000"
                    max="2100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    所属班级 <span className="text-red-500">*</span>
                  </label>
                  <select 
                    value={formData.class_id}
                    onChange={(e) => handleInputChange('class_id', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${formErrors.class_id ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <option value="">请选择班级</option>
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id}>{schoolData.formatClassName(cls.id)}</option>
                    ))}
                  </select>
                  {formErrors.class_id && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.class_id}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                  <select
                    value={formData.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        status: nextStatus,
                        registry_status: getRegistryStatusFromStudent({ status: nextStatus }),
                      }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {STUDENT_STATUS_OPTIONS.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  学籍状态
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">学籍状态</label>
                    <select
                      value={formData.registry_status}
                      onChange={(e) => handleInputChange('registry_status', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {REGISTRY_STATUS_OPTIONS.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">入学方式</label>
                    <select
                      value={formData.enrollment_type}
                      onChange={(e) => handleInputChange('enrollment_type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      {['正常入学', '转入', '借读', '复学', '其他'].map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">来源学校</label>
                    <input
                      type="text"
                      value={formData.source_school}
                      onChange={(e) => handleInputChange('source_school', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="转入或借读学生可填写"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">异动日期</label>
                    <input
                      type="date"
                      value={formData.status_changed_at}
                      onChange={(e) => handleInputChange('status_changed_at', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">异动原因</label>
                  <input
                    type="text"
                    value={formData.status_reason}
                    onChange={(e) => handleInputChange('status_reason', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="如休学、转学、借读原因，可留空"
                  />
                </div>
              </div>

              {/* 提前招生信息 */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-green-600" />
                  提前招生信息（可选）
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">录取学校</label>
                    <select
                      value={formData.early_admission_school.startsWith('custom_') ? 'custom' : formData.early_admission_school}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'custom') {
                          handleInputChange('early_admission_school', 'custom_');
                        } else {
                          handleInputChange('early_admission_school', value);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">无</option>
                      {(schoolData.earlyAdmissionSchools || ['温中', '瑞中', '新纪元']).map(school => (
                        <option key={school} value={school}>{school}</option>
                      ))}
                      <option value="custom">自定义</option>
                    </select>
                    {formData.early_admission_school.startsWith('custom_') && (
                      <input
                        type="text"
                        value={formData.early_admission_school.replace('custom_', '')}
                        onChange={(e) => handleInputChange('early_admission_school', 'custom_' + e.target.value)}
                        placeholder="请输入学校名称"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mt-2"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">录取类型</label>
                    <select
                      value={formData.early_admission_type.startsWith('custom_') ? 'custom' : formData.early_admission_type}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'custom') {
                          handleInputChange('early_admission_type', 'custom_');
                        } else {
                          handleInputChange('early_admission_type', value);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">请选择</option>
                      <option value="保送">保送</option>
                      <option value="特招">特招</option>
                      <option value="签约">签约</option>
                      <option value="自主招生">自主招生</option>
                      <option value="其他">其他</option>
                      <option value="custom">自定义</option>
                    </select>
                    {formData.early_admission_type.startsWith('custom_') && (
                      <input
                        type="text"
                        value={formData.early_admission_type.replace('custom_', '')}
                        onChange={(e) => handleInputChange('early_admission_type', 'custom_' + e.target.value)}
                        placeholder="请输入录取类型"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mt-2"
                      />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">录取日期</label>
                    <input
                      type="date"
                      value={formData.early_admission_date}
                      onChange={(e) => handleInputChange('early_admission_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                    <input
                      type="text"
                      value={formData.early_admission_notes}
                      onChange={(e) => handleInputChange('early_admission_notes', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="可选填"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => selectedStudent ? setShowEditModal(false) : setShowCreateModal(false)} 
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 导入弹窗 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">导入学生</h2>
              <button onClick={() => {setShowImportModal(false); setImportFile(null);}}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">导入说明</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 支持 CSV/TSV 预览导入，Excel 文件登录后直接写入后端学生库</li>
                  <li>• 请使用模板格式导入，系统会识别班级编号、状态和入学年份</li>
                </ul>
              </div>
              {studentImportBackendResult && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                  {studentImportBackendResult.message || '后端学生库导入完成。'}
                </div>
              )}
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {importFile ? importFile.name : '点击选择文件或拖拽到此处'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt,.xls,.xlsx"
                  className="hidden"
                  onClick={(e) => { e.target.value = null; }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setImportFile(file);
                    }
                  }}
                />
              </div>
              <div className="flex justify-between items-center">
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                >
                  <Download className="w-4 h-4" />
                  下载模板
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => {setShowImportModal(false); setImportFile(null);}}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleImportPreview}
                    disabled={studentImporting}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {studentImporting ? '写入中...' : (importFile && isExcelFile(importFile) ? '写入后端' : '预览导入')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 智能导入预览弹窗 */}
      <SmartImportModal
        isOpen={showSmartImport}
        onClose={() => setShowSmartImport(false)}
        onConfirm={handleConfirmImport}
        previewData={importPreviewData}
        title="学生导入预览"
        columns={[
          { key: 'student_code', label: '学籍辅号' },
          { key: 'name', label: '姓名' },
          { key: 'gender', label: '性别', render: value => getGenderText(value) },
          {
            key: 'class_id',
            label: '班级',
            render: value => {
              const cls = classes.find(item => Number(item.id) === Number(value));
              return cls ? schoolData.formatClassName(cls.id) : '未匹配';
            }
          },
          { key: 'status', label: '状态', render: (_value, row) => getStudentStatusDisplay(row?.data || row) }
        ]}
      />

      {/* 学生详情弹窗 */}
      {showDetailModal && selectedStudentForDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">学生详情</h2>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {(() => {
              const student = selectedStudentForDetail;
              const classInfo = getStudentClassInfo(student);
              const headTeacher = getStudentHeadTeacher(student);
              const parents = getStudentParents(student.id);
              const scores = getStudentScores(student.id);
              const registryTimeline = buildStudentRegistryTimeline(
                student,
                classes,
                schoolData.formatClassName.bind(schoolData)
              );
              
              return (
                <div className="space-y-6">
                  {/* 基本信息 */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                      <GraduationCap className="w-5 h-5" />
                      学籍信息
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">学籍辅号</p>
                        <p className="font-medium text-gray-900">{student.student_code}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">姓名</p>
                        <p className="font-medium text-gray-900">{student.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">性别</p>
                        <p className="font-medium text-gray-900">{getGenderText(student.gender)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">状态</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(student.status)}`}>
                          {getStudentStatusDisplay(student)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">当前年级</p>
                        <p className="font-medium text-gray-900">{getStudentGradeLabel(student, classes)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">班级</p>
                        <p className="font-medium text-gray-900">{classInfo.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">班主任</p>
                        <p className="font-medium text-gray-900">{headTeacher}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">入学年份</p>
                        <p className="font-medium text-gray-900">{student.enrollment_year}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">学籍状态</p>
                        <p className="font-medium text-gray-900">{getRegistryStatusFromStudent(student)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">入学方式</p>
                        <p className="font-medium text-gray-900">{student.enrollment_type || '正常入学'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">来源学校</p>
                        <p className="font-medium text-gray-900">{student.source_school || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">异动日期</p>
                        <p className="font-medium text-gray-900">{student.status_changed_at || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">异动原因</p>
                        <p className="font-medium text-gray-900">{student.status_reason || '-'}</p>
                      </div>
                    </div>
                    {student.status === '待核验' && student.raw_status && (
                      <div className="mt-4 rounded-lg border border-purple-100 bg-white p-3 text-sm text-purple-700">
                        导入源状态为“{student.raw_status}”，当前已进入待核验，请在学籍状态中确认后保存。
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-gray-100 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      学籍轨迹
                    </h3>
                    <div className="grid gap-3 md:grid-cols-3">
                      {registryTimeline.map((item) => (
                        <div key={item.label} className="rounded-lg border border-gray-100 p-3">
                          <p className="text-xs text-gray-500">{item.date || '-'}</p>
                          <p className="mt-1 font-medium text-gray-900">{item.label}</p>
                          <p className="mt-1 text-sm text-gray-600">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 家庭信息 */}
                  <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      家庭信息
                    </h3>
                    {parents.length > 0 ? (
                      <div className="space-y-3">
                        {parents.map((parent, index) => (
                          <div key={parent.id} className="bg-white rounded p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <span className="font-medium text-gray-900">{parent.name}</span>
                                <span className="text-sm text-gray-500">{parent.relation}</span>
                                <span className="text-sm text-gray-600">{parent.phone}</span>
                              </div>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                parent.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {parent.status === 'active' ? '正常' : '停用'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">暂无家长信息</p>
                    )}
                  </div>

                  {/* 成绩概况 */}
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center gap-2">
                      <GraduationCap className="w-5 h-5" />
                      成绩概况
                    </h3>
                    {scores.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-white">
                            <tr>
                              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">考试</th>
                              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">学科</th>
                              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">分数</th>
                              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">排名</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {scores.slice(0, 10).map((score, index) => {
                              const exam = (schoolData.exams || []).find(item => item.id === score.exam_id);
                              const subjectNames = score.subject_name || (score.scores ? Object.keys(score.scores).join('、') : '总分');
                              return (
                                <tr key={index} className="bg-white">
                                  <td className="px-4 py-2 text-sm text-gray-900">{score.exam_name || exam?.name || score.exam_id || '-'}</td>
                                  <td className="px-4 py-2 text-sm text-gray-900">{subjectNames}</td>
                                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{score.score ?? score.total_score ?? '-'}</td>
                                  <td className="px-4 py-2 text-sm text-gray-500">{score.rank || '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {scores.length > 10 && (
                          <p className="text-sm text-gray-500 text-center py-2">还有 {scores.length - 10} 条成绩记录</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">暂无成绩记录</p>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        handleEditStudent(student);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Edit className="w-4 h-4" />
                      编辑学生
                    </button>
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      关闭
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 导出预览弹窗 */}
      {showExportPreview && exportPreviewData.data && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-6xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">导出预览</h2>
              <button
                onClick={() => setShowExportPreview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-gray-600">共 {exportPreviewData.data.length} 条记录</p>
            </div>

            <div className="overflow-x-auto mb-6">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    {Object.keys(exportPreviewData.data[0] || {}).map((header, index) => (
                      <th key={index} className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exportPreviewData.data.slice(0, 100).map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50">
                      {Object.values(row).map((value, colIndex) => (
                        <td key={colIndex} className="border border-gray-300 px-4 py-2 text-sm text-gray-900">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {exportPreviewData.data.length > 100 && (
                <p className="text-center text-gray-500 mt-4">
                  还有 {exportPreviewData.data.length - 100} 条记录未显示...
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setShowExportPreview(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={confirmExport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                确认导出
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 提前招生导入弹窗 */}
      {showEarlyAdmissionImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">导入提前招生信息</h2>
              <button onClick={() => { setShowEarlyAdmissionImportModal(false); setEarlyAdmissionImportFile(null); setEarlyAdmissionImportPreview([]); }}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-medium text-green-900 mb-2">导入说明</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• 支持CSV格式文件</li>
                  <li>• 第一行为表头：学籍辅号,录取学校,录取类型,录取日期,备注</li>
                  <li>• 学籍辅号必须存在于系统中</li>
                  <li>• 如学生已有提前招生记录，将更新原有记录</li>
                </ul>
              </div>

              {!earlyAdmissionImportFile ? (
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors"
                  onClick={() => document.getElementById('early-admission-file-input').click()}
                >
                  <GraduationCap className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">点击选择文件或拖拽到此处</p>
                  <input
                    id="early-admission-file-input"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleEarlyAdmissionFileSelect}
                  />
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600">已选择文件：{earlyAdmissionImportFile.name}</p>
                    <button
                      onClick={() => { setEarlyAdmissionImportFile(null); setEarlyAdmissionImportPreview([]); }}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      重新选择
                    </button>
                  </div>

                  {earlyAdmissionImportPreview.errors?.length > 0 && (
                    <div className="bg-red-50 p-3 rounded-lg mb-4">
                      <h4 className="font-medium text-red-900 mb-2">错误信息：</h4>
                      <ul className="text-sm text-red-700 space-y-1">
                        {earlyAdmissionImportPreview.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {earlyAdmissionImportPreview.preview?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">数据预览（前10条）：</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs">行号</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs">学籍辅号</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs">学生姓名</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs">录取学校</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs">录取类型</th>
                              <th className="border border-gray-300 px-3 py-2 text-left text-xs">状态</th>
                            </tr>
                          </thead>
                          <tbody>
                            {earlyAdmissionImportPreview.preview.map((row, index) => (
                              <tr key={index} className={row.valid ? 'bg-white' : 'bg-red-50'}>
                                <td className="border border-gray-300 px-3 py-2 text-sm">{row.row}</td>
                                <td className="border border-gray-300 px-3 py-2 text-sm">{row.studentCode}</td>
                                <td className="border border-gray-300 px-3 py-2 text-sm">{row.studentName}</td>
                                <td className="border border-gray-300 px-3 py-2 text-sm">{row.schoolName}</td>
                                <td className="border border-gray-300 px-3 py-2 text-sm">{row.admissionType}</td>
                                <td className="border border-gray-300 px-3 py-2 text-sm">
                                  {row.valid ? (
                                    <span className="text-green-600">✓ 有效</span>
                                  ) : (
                                    <span className="text-red-600">✗ 无效</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        共 {earlyAdmissionImportPreview.total} 条记录，
                        有效 {earlyAdmissionImportPreview.preview.filter(r => r.valid).length} 条
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <button
                  onClick={downloadEarlyAdmissionTemplate}
                  className="flex items-center gap-2 text-green-600 hover:text-green-800 text-sm"
                >
                  <Download className="w-4 h-4" />
                  下载模板
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowEarlyAdmissionImportModal(false); setEarlyAdmissionImportFile(null); setEarlyAdmissionImportPreview([]); }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={confirmEarlyAdmissionImport}
                    disabled={!earlyAdmissionImportFile || earlyAdmissionImportPreview.preview?.filter(r => r.valid).length === 0}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    确认导入
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 全校概况表弹窗 */}
      {showOverviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-6xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">全校学生概况表</h2>
              <button 
                onClick={() => setShowOverviewModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {(() => {
              // 按年级和班级统计
              const gradeStats = {};
              const statusOrder = STUDENT_STATUS_OPTIONS;
              
              uniqueGrades.forEach(grade => {
                gradeStats[grade] = {
                  classes: {},
                  total: 0,
                  male: 0,
                  female: 0,
                  statusCounts: {}
                };
                statusOrder.forEach(status => {
                  gradeStats[grade].statusCounts[status] = 0;
                });
              });

              students.forEach(student => {
                const cls = classes.find(c => c.id === student.class_id);
                if (cls) {
                  const grade = String(Math.floor(cls.id / 100));
                  const classId = cls.id;
                  
                  if (!gradeStats[grade]) {
                    gradeStats[grade] = {
                      classes: {},
                      total: 0,
                      male: 0,
                      female: 0,
                      statusCounts: {}
                    };
                    statusOrder.forEach(status => {
                      gradeStats[grade].statusCounts[status] = 0;
                    });
                  }
                  
                  if (!gradeStats[grade].classes[classId]) {
                    gradeStats[grade].classes[classId] = {
                      name: cls.name || `${cls.class_no}班`,
                      total: 0,
                      male: 0,
                      female: 0,
                      statusCounts: {}
                    };
                    statusOrder.forEach(status => {
                      gradeStats[grade].classes[classId].statusCounts[status] = 0;
                    });
                  }
                  
                  // 年级统计
                  gradeStats[grade].total++;
                  if (student.gender === 1) gradeStats[grade].male++;
                  else gradeStats[grade].female++;
                  if (student.status) {
                    gradeStats[grade].statusCounts[student.status] = (gradeStats[grade].statusCounts[student.status] || 0) + 1;
                  }
                  
                  // 班级统计
                  gradeStats[grade].classes[classId].total++;
                  if (student.gender === 1) gradeStats[grade].classes[classId].male++;
                  else gradeStats[grade].classes[classId].female++;
                  if (student.status) {
                    gradeStats[grade].classes[classId].statusCounts[student.status] = (gradeStats[grade].classes[classId].statusCounts[student.status] || 0) + 1;
                  }
                }
              });

              // 导出CSV
              const exportOverviewCSV = () => {
                const headers = ['年级', '班级', '学生总数', '男生', '女生', ...statusOrder];
                const rows = [];
                
                Object.keys(gradeStats).sort().forEach(grade => {
                  const gradeName = grade === '7' ? '七年级' : grade === '8' ? '八年级' : grade === '9' ? '九年级' : `${grade}年级`;
                  const gradeData = gradeStats[grade];
                  
                  // 年级合计行
                  rows.push([
                    gradeName,
                    '合计',
                    gradeData.total,
                    gradeData.male,
                    gradeData.female,
                    ...statusOrder.map(s => gradeData.statusCounts[s] || 0)
                  ]);
                  
                  // 各班明细
                  Object.keys(gradeData.classes).sort().forEach(classId => {
                    const classData = gradeData.classes[classId];
                    rows.push([
                      '',
                      classData.name,
                      classData.total,
                      classData.male,
                      classData.female,
                      ...statusOrder.map(s => classData.statusCounts[s] || 0)
                    ]);
                  });
                });
                
                const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
                const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `全校学生概况表_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
              };

              // 导出PDF（简化版，使用打印功能）
              const exportOverviewPDF = () => {
                window.print();
              };

              return (
                <div className="space-y-6">
                  {/* 导出按钮 */}
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={exportOverviewCSV}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Download className="w-4 h-4" />
                      导出CSV
                    </button>
                    <button
                      onClick={exportOverviewPDF}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <FileText className="w-4 h-4" />
                      导出PDF
                    </button>
                  </div>

                  {/* 概况表 */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-4 py-2 text-left">年级</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">班级</th>
                          <th className="border border-gray-300 px-4 py-2 text-center">学生总数</th>
                          <th className="border border-gray-300 px-4 py-2 text-center">男生</th>
                          <th className="border border-gray-300 px-4 py-2 text-center">女生</th>
                          {statusOrder.map(status => (
                            <th key={status} className="border border-gray-300 px-4 py-2 text-center">{status}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(gradeStats).sort().map(grade => {
                          const gradeName = grade === '7' ? '七年级' : grade === '8' ? '八年级' : grade === '9' ? '九年级' : `${grade}年级`;
                          const gradeData = gradeStats[grade];
                          const classIds = Object.keys(gradeData.classes).sort();
                          
                          return (
                            <React.Fragment key={grade}>
                              {/* 年级合计行 */}
                              <tr className="bg-blue-50 font-semibold">
                                <td className="border border-gray-300 px-4 py-2">{gradeName}</td>
                                <td className="border border-gray-300 px-4 py-2">合计</td>
                                <td className="border border-gray-300 px-4 py-2 text-center">{gradeData.total}</td>
                                <td className="border border-gray-300 px-4 py-2 text-center">{gradeData.male}</td>
                                <td className="border border-gray-300 px-4 py-2 text-center">{gradeData.female}</td>
                                {statusOrder.map(status => (
                                  <td key={status} className="border border-gray-300 px-4 py-2 text-center">
                                    {gradeData.statusCounts[status] || 0}
                                  </td>
                                ))}
                              </tr>
                              {/* 各班明细 */}
                              {classIds.map(classId => {
                                const classData = gradeData.classes[classId];
                                return (
                                  <tr key={classId} className="hover:bg-gray-50">
                                    <td className="border border-gray-300 px-4 py-2"></td>
                                    <td className="border border-gray-300 px-4 py-2">{classData.name}</td>
                                    <td className="border border-gray-300 px-4 py-2 text-center">{classData.total}</td>
                                    <td className="border border-gray-300 px-4 py-2 text-center">{classData.male}</td>
                                    <td className="border border-gray-300 px-4 py-2 text-center">{classData.female}</td>
                                    {statusOrder.map(status => (
                                      <td key={status} className="border border-gray-300 px-4 py-2 text-center">
                                        {classData.statusCounts[status] || 0}
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                        {/* 全校合计 */}
                        <tr className="bg-gray-200 font-bold">
                          <td className="border border-gray-300 px-4 py-2" colSpan="2">全校合计</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">{students.length}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">{students.filter(s => s.gender === 1).length}</td>
                          <td className="border border-gray-300 px-4 py-2 text-center">{students.filter(s => s.gender === 0).length}</td>
                          {statusOrder.map(status => (
                            <td key={status} className="border border-gray-300 px-4 py-2 text-center">
                              {students.filter(s => s.status === status).length}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 关闭按钮 */}
                  <div className="flex justify-end pt-4 border-t">
                    <button
                      onClick={() => setShowOverviewModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      关闭
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagement;
