import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  GraduationCap,
  Users,
  User,
  UserCheck,
  UserX,
  Edit,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  Upload,
  FileSpreadsheet,
  Square,
  CheckSquare,
  AlertCircle,
  RefreshCw,
  School,
  FileText
} from 'lucide-react';
import schoolData from '../data/schoolData';
import SmartImportModal from './SmartImportModal';

const StudentManagement = () => {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
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
    setStudents(schoolData.students || []);
    const loadedClasses = schoolData.classes || [];
    setClasses(loadedClasses);
    setEarlyAdmissions(schoolData.earlyAdmissions || []);
  }, []);

  // 同步students到schoolData
  useEffect(() => {
    if (students.length > 0) {
      schoolData.students = students;
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

  // 验证身份证号
  const validateIdCard = (idCard) => {
    if (!idCard || idCard.trim() === '') {
      return { valid: true }; // 身份证号可选
    }
    const idCardStr = idCard.trim();
    // 18位身份证验证
    if (!/^\d{17}[\dXx]$/.test(idCardStr)) {
      return { valid: false, message: '身份证号格式不正确，应为18位' };
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
      status: '在读',
      enrollment_year: 2024
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
      // 提前招生信息
      early_admission_school: schoolValue,
      early_admission_type: typeValue,
      early_admission_date: admission ? admission.admission_date : '',
      early_admission_notes: admission ? admission.notes : ''
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleSaveStudent = (e) => {
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
        enrollment_year: parseInt(formData.enrollment_year)
      };

      let studentId;

      if (selectedStudent) {
        // 更新现有学生
        const updatedStudents = students.map(s =>
          s.id === selectedStudent.id
            ? { ...s, ...studentData }
            : s
        );
        setStudents(updatedStudents);
        schoolData.students = updatedStudents;
        studentId = selectedStudent.id;
        alert('学生信息更新成功！');
        setShowEditModal(false);
      } else {
        // 创建新学生
        const newStudent = {
          id: Date.now(),
          ...studentData
        };
        studentId = newStudent.id;
        const updatedStudents = [...students, newStudent];
        setStudents(updatedStudents);
        schoolData.students = updatedStudents;
        alert('学生添加成功！');
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
        early_admission_school: '',
        early_admission_type: '',
        early_admission_date: '',
        early_admission_notes: ''
      });
      setFormErrors({});
    } catch (error) {
      console.error('保存学生信息失败:', error);
      alert('保存失败：' + error.message);
    }
  };

  const handleDeleteStudent = (id) => {
    if (window.confirm('确定要删除这名学生吗？')) {
      try {
        const updatedStudents = students.filter(s => s.id !== id);
        setStudents(updatedStudents);
        schoolData.students = updatedStudents;
        alert('删除成功！');
      } catch (error) {
        console.error('删除学生失败:', error);
        alert('删除失败：' + error.message);
      }
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
    return (schoolData.scores || []).filter(score => score.student_id === studentId);
  };

  // 下载导入模板
  const downloadTemplate = () => {
    // 获取现有班级编号作为示例
    const classNos = classes.slice(0, 2).map(c => c.class_no || c.name);
    const sampleClass1 = classNos[0] || '701';
    const sampleClass2 = classNos[1] || '702';
    
    // 移除身份证列，保护学生隐私
    const headers = ['学籍辅号', '姓名', '性别(男/女)', '班级编号', '状态(在读/休学/转学/退学)', '入学年份'];
    const sampleData = [
      ['20240701001', '张小明', '男', sampleClass1, '在读', '2024'],
      ['20240701002', '李小红', '女', sampleClass2, '在读', '2024'],
    ];
    
    // 添加格式说明
    const notes = [
      '',
      '【填写说明】',
      '1. 班级编号格式：可以使用 "701" 或 "701班" 格式',
      '2. 学籍辅号格式：如 20240701001（2024年入学+7年级+01班+001号）',
      '3. 性别：男 或 女',
      '4. 状态：在读、休学、转学、退学',
      '5. 入学年份：如 2024',
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

  // 导出学生数据
  const exportData = () => {
    // 根据是否有提前招生筛选，决定导出字段
    const hasEarlyAdmissionFilter = !!filterEarlyAdmission;
    const headers = hasEarlyAdmissionFilter 
      ? ['学籍辅号', '姓名', '性别', '班级', '班主任', '状态', '入学年份', '提前招生学校', '录取类型', '录取日期']
      : ['学籍辅号', '姓名', '性别', '班级', '班主任', '状态', '入学年份'];
    
    const data = filteredStudents.map(s => {
      const cls = schoolData.getClassById(s.class_id);
      const headTeacher = cls ? schoolData.getHeadTeacherByClassId(cls.id) : null;
      const admission = earlyAdmissions.find(a => a.student_id === s.id);
      
      const baseData = [
        s.student_code, 
        s.name, 
        s.gender === 1 ? '男' : '女', 
        cls ? schoolData.formatClassName(cls.id) : '未分配',
        headTeacher ? headTeacher.name : '未设置',
        s.status, 
        s.enrollment_year
      ];
      
      if (hasEarlyAdmissionFilter) {
        baseData.push(
          admission ? admission.school_name : '',
          admission ? admission.admission_type : '',
          admission ? admission.admission_date : ''
        );
      }
      
      return baseData;
    });
    
    const csvContent = [headers.join(','), ...data.map(row => row.join(','))].join('\n');
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
    }
    
    link.download = `${fileName}_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  // 智能导入 - 解析文件并显示预览
  const handleImportPreview = () => {
    if (!importFile) {
      alert('请先选择要导入的文件');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const lines = content.split('\n').filter(line => line.trim());
        
        console.log('当前班级数据:', classes);
        console.log('班级数量:', classes.length);
        
        if (lines.length < 2) {
          alert('文件格式错误：缺少表头或数据行');
          return;
        }
        
        const previewData = [];
        
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          // 只要求至少有4列：学籍辅号、姓名、性别、班级
          if (cols.length >= 4) {
            const studentCode = cols[0]?.trim() || '';
            const name = cols[1]?.trim() || '';
            
            // 跳过空行
            if (!studentCode && !name) continue;
            
            // 性别识别 - 支持多种格式：1/2, 男/女, M/F
            const genderRaw = cols[2]?.trim() || '';
            let gender = 1; // 默认为男
            if (genderRaw === '0' || genderRaw === '2' || genderRaw === '女' || genderRaw.toLowerCase() === 'f') {
              gender = 0; // 女
            } else if (genderRaw === '1' || genderRaw === '男' || genderRaw.toLowerCase() === 'm') {
              gender = 1; // 男
            }
            
            const classNo = cols[3]?.trim() || '';
            
            // 状态识别 - 支持自定义状态（第5列，可选）
            const statusRaw = cols[4]?.trim();
            let status = statusRaw || '在读'; // 如果为空则默认为"在读"
            
            // 入学年份（第6列，可选）
            const enrollmentYear = parseInt(cols[5]?.trim()) || 2024;
            
            // 根据班级编号查找班级ID（匹配class_no字段）
            // 支持多种格式：701、701班、2025级01班
            console.log('查找班级编号:', classNo);
            console.log('可用班级:', classes.map(c => ({ id: c.id, class_no: c.class_no, name: c.name })));
            
            // 标准化班级编号（去掉"班"字）
            const normalizedClassNo = classNo.replace(/班$/, '');
            
            const classObj = classes.find(c => {
              const matchClassNo = c.class_no === classNo || c.class_no === normalizedClassNo;
              const matchName = c.name === classNo || c.name === normalizedClassNo;
              // 还支持从班级名称中提取编号匹配，如 "2025级01班" 匹配 "701"
              const nameMatchClassNo = c.name && c.name.match(/(\d+)班$/)?.[1] === normalizedClassNo;
              console.log(`  班级 ${c.class_no}/${c.name}: class_no匹配=${matchClassNo}, name匹配=${matchName}, name提取匹配=${nameMatchClassNo}`);
              return matchClassNo || matchName || nameMatchClassNo;
            });
            const classId = classObj ? classObj.id : null;
            console.log('匹配结果:', classObj ? `找到班级ID=${classId}` : '未找到');
            
            // 验证学籍辅号
            const codeValidation = validateStudentCode(studentCode);
            
            // 验证班级
            let classError = null;
            if (!classNo) {
              classError = '班级不能为空';
            } else if (!classObj) {
              classError = `班级编号"${classNo}"不存在，请检查班级编号`;
            }
            
            // 验证姓名
            let nameError = null;
            if (!name) {
              nameError = '姓名不能为空';
            }
            
            // 合并错误信息
            let error = null;
            if (!codeValidation.valid) {
              error = codeValidation.message;
            } else if (classError) {
              error = classError;
            } else if (nameError) {
              error = nameError;
            }
            
            // 查找是否已存在
            const existingStudent = students.find(s => s.student_code === studentCode);
            
            if (existingStudent) {
              // 检查是否有变化
              const changes = [];
              if (name !== existingStudent.name) changes.push('name');
              if (gender !== existingStudent.gender) changes.push('gender');
              if (classId !== existingStudent.class_id) changes.push('class_id');
              if (status !== existingStudent.status) changes.push('status');
              if (enrollmentYear !== existingStudent.enrollment_year) changes.push('enrollment_year');
              
              previewData.push({
                type: changes.length > 0 ? 'update' : 'unchanged',
                data: { student_code: studentCode, name, gender, class_id: classId, status, enrollment_year: enrollmentYear, id_card: '' },
                existingData: existingStudent,
                changes,
                error: error
              });
            } else {
              previewData.push({
                type: 'new',
                data: { student_code: studentCode, name, gender, class_id: classId, status, enrollment_year: enrollmentYear, id_card: '' },
                error: error
              });
            }
          }
        }
        
        setImportPreviewData(previewData);
        setShowSmartImport(true);
        setShowImportModal(false);
      } catch (error) {
        console.error('解析导入文件失败:', error);
        alert('解析文件失败：' + error.message);
      }
    };
    
    reader.onerror = () => {
      alert('文件读取失败');
    };
    
    reader.readAsText(importFile);
  };

  // 确认智能导入
  const handleConfirmImport = (selectedData) => {
    try {
      let addedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      let errorDetails = [];
      
      selectedData.forEach(item => {
        if (item.error) {
          errorCount++;
          // 收集前5个错误详情
          if (errorDetails.length < 5) {
            errorDetails.push(`${item.data.name || item.data.student_code}: ${item.error}`);
          }
          return;
        }
        
        if (item.type === 'new') {
          // 创建新学生
          const newStudent = {
            id: Date.now() + Math.random(),
            student_code: item.data.student_code,
            name: item.data.name,
            gender: item.data.gender,
            class_id: item.data.class_id,
            status: item.data.status,
            enrollment_year: item.data.enrollment_year
          };
          schoolData.students.push(newStudent);
          addedCount++;
        } else if (item.type === 'update') {
          // 更新现有学生
          const existing = item.existingData;
          existing.name = item.data.name;
          existing.gender = item.data.gender;
          existing.class_id = item.data.class_id;
          existing.status = item.data.status;
          existing.enrollment_year = item.data.enrollment_year;
          updatedCount++;
        }
      });
      
      setStudents([...schoolData.students]);
      setShowSmartImport(false);
      setImportFile(null);
      
      let message = `导入完成：新增 ${addedCount} 人，更新 ${updatedCount} 人`;
      if (errorCount > 0) {
        message += `，${errorCount} 条数据有误`;
        message += '\n\n错误详情（前5条）：\n' + errorDetails.join('\n');
      }
      alert(message);
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败：' + error.message);
    }
  };

  const getGenderText = (gender) => gender === 1 ? '男' : '女';

  // 根据班级ID计算入学年份
  // 2025学年第二学期：
  // 七年级（2025年9月入学）-> 2025级
  // 八年级（2024年9月入学）-> 2024级
  // 九年级（2023年9月入学）-> 2023级
  const getEnrollmentYearByClassId = (classId) => {
    const grade = Math.floor(classId / 100);
    // 直接根据年级返回对应的入学年份
    // 701-713: 2025级, 801-818: 2024级, 901-916: 2023级
    if (grade === 7) return 2025;
    if (grade === 8) return 2024;
    if (grade === 9) return 2023;
    return 2025;
  };

  // 格式化班级名称
  const formatClassDisplayName = (cls) => {
    if (!cls) return '未分配';
    const grade = Math.floor(cls.id / 100);
    const classNo = cls.id % 100;
    const enrollmentYear = getEnrollmentYearByClassId(cls.id);
    return `${enrollmentYear}级${classNo.toString().padStart(2, '0')}班`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case '在读': return 'bg-green-100 text-green-700';
      case '休学': return 'bg-yellow-100 text-yellow-700';
      case '转学': return 'bg-blue-100 text-blue-700';
      case '退学': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // 准备导出预览数据
  const prepareExportPreview = () => {
    const hasEarlyAdmissionFilter = !!filterEarlyAdmission;
    const headers = hasEarlyAdmissionFilter
      ? ['学籍辅号', '姓名', '性别', '班级', '班主任', '状态', '提前招生学校', '录取类型', '录取日期', '入学年份']
      : ['学籍辅号', '姓名', '性别', '班级', '班主任', '状态', '入学年份'];

    const data = filteredStudents.map(s => {
      const cls = schoolData.getClassById(s.class_id);
      const headTeacher = cls ? schoolData.getHeadTeacherByClassId(cls.id) : null;
      const admission = earlyAdmissions.find(a => a.student_id === s.id);

      const baseData = {
        '学籍辅号': s.student_code,
        '姓名': s.name,
        '性别': s.gender === 1 ? '男' : '女',
        '班级': cls ? schoolData.formatClassName(cls.id) : '未分配',
        '班主任': headTeacher ? headTeacher.name : '未设置',
        '状态': s.status,
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
    const { headers, data } = exportPreviewData;
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
      alert('没有可导入的数据');
      return;
    }

    const validRecords = earlyAdmissionImportPreview.preview.filter(r => r.valid);
    if (validRecords.length === 0) {
      alert('没有有效的数据可导入');
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

    alert(`导入完成！新增 ${successCount} 条记录，更新 ${updateCount} 条记录`);
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

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) {
      alert('请先选择要删除的学生');
      return;
    }
    if (window.confirm(`确定要删除选中的 ${selectedIds.length} 名学生吗？`)) {
      try {
        const updatedStudents = students.filter(s => !selectedIds.includes(s.id));
        setStudents(updatedStudents);
        schoolData.students = updatedStudents;
        setSelectedIds([]);
        alert('批量删除成功！');
      } catch (error) {
        console.error('批量删除失败:', error);
        alert('批量删除失败：' + error.message);
      }
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
        <h1 className="text-2xl font-bold text-gray-800">学生管理</h1>
        <p className="text-gray-500 mt-1">管理学生学籍信息，支持批量导入导出</p>
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
        const actualStatuses = [...new Set(targetStudents.map(s => s.status).filter(Boolean))].sort();
        
        // 状态颜色映射（预定义一些常用状态的颜色，未知状态使用默认灰色）
        const statusColors = {
          '在籍': { bg: 'bg-green-100', text: 'text-green-600', num: 'text-green-600' },
          '在读': { bg: 'bg-green-100', text: 'text-green-600', num: 'text-green-600' },
          '林川': { bg: 'bg-blue-100', text: 'text-blue-600', num: 'text-blue-600' },
          '借读': { bg: 'bg-yellow-100', text: 'text-yellow-600', num: 'text-yellow-600' },
          '休学': { bg: 'bg-orange-100', text: 'text-orange-600', num: 'text-orange-600' },
          '退学': { bg: 'bg-red-100', text: 'text-red-600', num: 'text-red-600' },
          '请长假': { bg: 'bg-purple-100', text: 'text-purple-600', num: 'text-purple-600' },
          '转学': { bg: 'bg-gray-100', text: 'text-gray-600', num: 'text-gray-600' },
        };
        
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
                const color = statusColors[status] || { bg: 'bg-gray-100', text: 'text-gray-600', num: 'text-gray-600' };
                return (
                  <div key={status} className="bg-white rounded-lg shadow-sm p-3">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-full ${color.bg} ${color.text} mr-3`}>
                        <UserCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{status}</p>
                        <p className={`text-xl font-bold ${color.num}`}>{count}</p>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">班级</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">班主任</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
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
                  <td className="px-6 py-4 text-sm text-gray-500">{classInfo.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{headTeacher}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(student.status)}`}>
                      {student.status}
                    </span>
                  </td>
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
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="在籍">在籍</option>
                    <option value="林川">林川</option>
                    <option value="借读">借读</option>
                    <option value="休学">休学</option>
                    <option value="退学">退学</option>
                    <option value="请长假">请长假</option>
                  </select>
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
                  <li>• 支持CSV格式文件</li>
                  <li>• 请使用模板格式导入</li>
                </ul>
              </div>
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
                  accept=".csv"
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
                    disabled={!importFile}
                    className={`px-4 py-2 rounded-lg ${importFile ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                  >
                    预览导入
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
          { key: 'gender', label: '性别' },
          { key: 'status', label: '状态' }
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
                          {student.status}
                        </span>
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
                            {scores.slice(0, 10).map((score, index) => (
                              <tr key={index} className="bg-white">
                                <td className="px-4 py-2 text-sm text-gray-900">{score.exam_name || '-'}</td>
                                <td className="px-4 py-2 text-sm text-gray-900">{score.subject_name || '-'}</td>
                                <td className="px-4 py-2 text-sm font-medium text-gray-900">{score.score}</td>
                                <td className="px-4 py-2 text-sm text-gray-500">{score.rank || '-'}</td>
                              </tr>
                            ))}
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
              const statusOrder = ['在籍', '林川', '借读', '休学', '退学', '请长假'];
              
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
