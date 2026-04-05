import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Plus, Filter, Edit2, Trash2, BookOpen, 
  GraduationCap, Calendar, ChevronDown, X, Save, UserPlus,
  Building2, Award, BarChart3, CheckCircle, AlertCircle,
  Download, Upload, FileSpreadsheet, Square, CheckSquare,
  Shield, Key, RefreshCw
} from 'lucide-react';
import schoolData from '../data/schoolData';
import SmartImportModal from './SmartImportModal';

const TeacherManagement = () => {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    phone: '',
    email: '',
    subjects: [],
    roles: ['subject_teacher'],
    status: 'active',
    teaching_classes: [],
    custom_permissions: []
  });
  
  const [assignData, setAssignData] = useState({
    classId: '',
    subjectId: '',
    semester: schoolData.getCurrentSemesterDisplay(),
    isHeadTeacher: false
  });
  
  const [importFile, setImportFile] = useState(null);
  const fileInputRef = React.useRef(null);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // 智能导入相关状态
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState([]);

  const subjects = schoolData.subjects;
  const teacherRoles = schoolData.teacherRoles;

  useEffect(() => {
    setTimeout(() => {
      setTeachers(schoolData.teachers);
      setClasses(schoolData.classes);
      setLoading(false);
    }, 500);
  }, []);

  // 获取教师的主角色
  const getTeacherPrimaryRole = (teacher) => {
    return schoolData.getTeacherPrimaryRole(teacher.id);
  };

  // 获取教师的所有角色
  const getTeacherRoles = (teacher) => {
    return schoolData.getTeacherRoles(teacher.id);
  };

  // 下载导入模板 - 支持两种方式：单行多班级 或 多行单班级
  const downloadTemplate = () => {
    const headers = ['工号', '姓名', '电话', '邮箱', '任教科目', '任教班级'];
    
    const comments = [
      '# 教师导入模板说明：',
      '#',
      '# 【方式一】单行多班级（推荐）- 一个教师一行，多个班级用分号隔开',
      '#   示例：T001,张老师,13800138001,zhang@school.com,语文,701;702;703',
      '#',
      '# 【方式二】多行单班级 - 一个教师多行，每行一个班级',
      '#   示例：',
      '#   T001,张老师,13800138001,zhang@school.com,语文,701',
      '#   T001,张老师,13800138001,zhang@school.com,语文,702',
      '#',
      '# 注意：',
      '# - 相同工号的教师信息会自动合并',
      '# - 任教班级可以是班级编号（如701）或班级序号（如01）',
      '# - 多个班级用分号(;)或逗号(,)分隔',
      '#',
    ];
    
    const sampleData = [
      ['T001', '林昕昕', '15957762377', '', '语文', '701'],
      ['T002', '王江鹏', '18272194348', '', '语文', '703'],
      ['T003', '周慧敏', '13616601785', '', '语文', '705;707'],
      ['T004', '吴国平', '18257589139', '', '语文', '702;704;706'],
    ];
    
    const csvContent = [
      ...comments,
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '教师导入模板.csv';
    link.click();
  };

  // 导出教师数据
  const exportData = () => {
    const headers = ['工号', '姓名', '电话', '邮箱', '任教科目', '任教班级', '角色', '状态'];
    const data = filteredTeachers.map(t => {
      const primaryRole = getTeacherPrimaryRole(t);
      return [
        t.code, t.name, t.phone, t.email || '', t.subjects.join(';'), 
        t.teaching_classes.map(tc => schoolData.formatClassName(tc.class_id)).join(';'),
        primaryRole?.name || '科任教师',
        t.status === 'active' ? '在职' : '暂停'
      ];
    });
    
    const csvContent = [headers.join(','), ...data.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `教师名单_${new Date().toLocaleDateString()}.csv`;
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
      const content = e.target.result;
      const lines = content.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#');
      });
      
      if (lines.length < 2) {
        alert('文件格式错误：缺少表头或数据行');
        return;
      }
      
      const previewData = [];
      const teacherMap = new Map(); // 用于合并同一教师的多行数据
      
      // 第一遍：收集所有数据，合并同一教师的多班级
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length >= 3) {
          const code = cols[0]?.trim() || '';
          const name = cols[1]?.trim() || '';
          const phone = cols[2]?.trim() || '';
          const email = cols[3]?.trim() || '';
          const subject = cols[4]?.trim() || '';
          const classNoStr = cols[5]?.trim() || '';
          
          // 解析班级
          const classNos = classNoStr.split(/[;,]/).map(s => s.trim()).filter(Boolean);
          const classIds = [];
          classNos.forEach(classNo => {
            let cls = schoolData.classes.find(c => c.id === parseInt(classNo));
            if (!cls) {
              cls = schoolData.classes.find(c => c.class_no === classNo);
            }
            if (cls && !classIds.includes(cls.id)) {
              classIds.push(cls.id);
            }
          });
          
          if (teacherMap.has(code)) {
            // 合并同一教师的多个班级
            const existing = teacherMap.get(code);
            if (subject && !existing.subjects.includes(subject)) {
              existing.subjects.push(subject);
            }
            classIds.forEach(classId => {
              if (!existing.teaching_classes.some(tc => tc.class_id === classId)) {
                existing.teaching_classes.push({ class_id: classId, subject });
              }
            });
          } else {
            teacherMap.set(code, {
              code, name, phone, email, subjects: subject ? [subject] : [],
              teaching_classes: classIds.map(classId => ({ class_id: classId, subject }))
            });
          }
        }
      }
      
      // 第二遍：生成预览数据
      teacherMap.forEach((data, code) => {
        const existingTeacher = schoolData.teachers.find(t => t.code === code);
        
        if (existingTeacher) {
          // 检查变化
          const changes = [];
          if (data.name !== existingTeacher.name) changes.push('name');
          if (data.phone !== existingTeacher.phone) changes.push('phone');
          if (data.email !== existingTeacher.email) changes.push('email');
          
          // 检查科目变化
          const subjectsChanged = 
            data.subjects.length !== existingTeacher.subjects?.length ||
            !data.subjects.every(s => existingTeacher.subjects?.includes(s));
          if (subjectsChanged) changes.push('subjects');
          
          // 检查班级变化
          const classesChanged =
            data.teaching_classes.length !== existingTeacher.teaching_classes?.length ||
            !data.teaching_classes.every(tc => 
              existingTeacher.teaching_classes?.some(etc => etc.class_id === tc.class_id)
            );
          if (classesChanged) changes.push('teaching_classes');
          
          previewData.push({
            type: changes.length > 0 ? 'update' : 'unchanged',
            data: { ...data },
            existingData: existingTeacher,
            changes
          });
        } else {
          previewData.push({
            type: 'new',
            data: { ...data }
          });
        }
      });
      
      setImportPreviewData(previewData);
      setShowSmartImport(true);
      setShowImportModal(false);
    };
    
    reader.readAsText(importFile);
  };

  // 确认智能导入
  const handleConfirmImport = (selectedData) => {
    let addedCount = 0;
    let updatedCount = 0;
    
    selectedData.forEach(item => {
      if (item.type === 'new') {
        // 创建新教师
        schoolData.teachers.push({
          id: Date.now() + Math.random(),
          code: item.data.code,
          name: item.data.name,
          phone: item.data.phone,
          email: item.data.email,
          subjects: item.data.subjects,
          roles: ['subject_teacher'],
          status: 'active',
          teaching_classes: item.data.teaching_classes,
          custom_permissions: []
        });
        addedCount++;
      } else if (item.type === 'update') {
        // 更新现有教师
        const existing = item.existingData;
        existing.name = item.data.name;
        existing.phone = item.data.phone;
        existing.email = item.data.email;
        existing.subjects = item.data.subjects;
        existing.teaching_classes = item.data.teaching_classes;
        updatedCount++;
      }
    });
    
    setTeachers([...schoolData.teachers]);
    setShowSmartImport(false);
    setImportFile(null);
    
    let message = `导入完成：`;
    if (addedCount > 0) message += `新增 ${addedCount} 位教师`;
    if (updatedCount > 0) message += `${addedCount > 0 ? '，' : ''}更新 ${updatedCount} 位教师`;
    alert(message);
  };

  const filteredTeachers = teachers.filter(teacher => {
    const matchesSearch = teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         teacher.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = filterSubject === 'all' || teacher.subjects.includes(filterSubject);
    const matchesRole = filterRole === 'all' || (teacher.roles && teacher.roles.includes(filterRole));
    return matchesSearch && matchesSubject && matchesRole;
  });

  const stats = {
    total: teachers.length,
    active: teachers.filter(t => t.status === 'active').length,
    suspended: teachers.filter(t => t.status === 'suspended').length,
    withClasses: teachers.filter(t => t.teaching_classes && t.teaching_classes.length > 0).length
  };

  const handleAddTeacher = () => {
    const newTeacher = {
      id: teachers.length + 1,
      ...formData,
      teaching_classes: []
    };
    const updatedTeachers = [...teachers, newTeacher];
    setTeachers(updatedTeachers);
    schoolData.teachers = updatedTeachers;
    setShowAddModal(false);
    setFormData({ name: '', code: '', phone: '', email: '', subjects: [], roles: ['subject_teacher'], status: 'active', teaching_classes: [], custom_permissions: [] });
  };

  const handleEditTeacher = (teacher) => {
    setSelectedTeacher(teacher);
    setFormData({
      name: teacher.name,
      code: teacher.code,
      phone: teacher.phone,
      email: teacher.email || '',
      subjects: teacher.subjects || [],
      roles: teacher.roles || ['subject_teacher'],
      status: teacher.status,
      teaching_classes: teacher.teaching_classes || [],
      custom_permissions: teacher.custom_permissions || []
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (selectedTeacher) {
      const updatedTeachers = teachers.map(t =>
        t.id === selectedTeacher.id
          ? { ...t, ...formData }
          : t
      );
      setTeachers(updatedTeachers);
      schoolData.teachers = updatedTeachers;
      setShowEditModal(false);
      alert('教师信息更新成功！');
    }
  };

  const handleDeleteTeacher = (id) => {
    if (window.confirm('确定要删除这位教师吗？')) {
      const updatedTeachers = teachers.filter(t => t.id !== id);
      setTeachers(updatedTeachers);
      schoolData.teachers = updatedTeachers;
    }
  };

  const handleManageRoles = (teacher) => {
    setSelectedTeacher(teacher);
    setFormData({
      ...formData,
      roles: teacher.roles || ['subject_teacher']
    });
    setShowRoleModal(true);
  };

  const handleManagePermissions = (teacher) => {
    setSelectedTeacher(teacher);
    setFormData({
      ...formData,
      custom_permissions: teacher.custom_permissions || []
    });
    setShowPermissionModal(true);
  };

  const handleSaveRoles = () => {
    if (selectedTeacher) {
      const updatedTeachers = teachers.map(t =>
        t.id === selectedTeacher.id
          ? { ...t, roles: formData.roles }
          : t
      );
      setTeachers(updatedTeachers);
      schoolData.teachers = updatedTeachers;
      setShowRoleModal(false);
      alert('角色设置已保存！');
    }
  };

  const handleSavePermissions = () => {
    if (selectedTeacher) {
      const updatedTeachers = teachers.map(t =>
        t.id === selectedTeacher.id
          ? { ...t, custom_permissions: formData.custom_permissions }
          : t
      );
      setTeachers(updatedTeachers);
      schoolData.teachers = updatedTeachers;
      setShowPermissionModal(false);
      alert('自定义权限已保存！');
    }
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
    if (selectedIds.length === filteredTeachers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTeachers.map(t => t.id));
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) {
      alert('请先选择要删除的教师');
      return;
    }
    if (window.confirm(`确定要删除选中的 ${selectedIds.length} 位教师吗？`)) {
      const updatedTeachers = teachers.filter(t => !selectedIds.includes(t.id));
      setTeachers(updatedTeachers);
      schoolData.teachers = updatedTeachers;
      setSelectedIds([]);
      alert('批量删除成功！');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-red-100 text-red-800'
    };
    const labels = {
      active: '在职',
      suspended: '暂停'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  // 获取任教班级的显示 - 纯粹的班级信息，不显示班主任标记
  const getTeachingClassesDisplay = (teacher) => {
    if (!teacher.teaching_classes || teacher.teaching_classes.length === 0) {
      return <span className="text-gray-400">未分配</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {teacher.teaching_classes.map((tc, index) => (
          <span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            {schoolData.formatClassName(tc.class_id)}
          </span>
        ))}
      </div>
    );
  };

  // 所有可用权限
  const allPermissions = [
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
    { id: 'approve_school_activities', label: '审批学校活动' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">教师管理</h1>
        <p className="text-gray-500 mt-1">管理教师信息、任教班级和角色权限</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <Users className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">教师总数</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">在职教师</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-100 text-orange-600">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">已分配班级</p>
              <p className="text-2xl font-bold text-orange-600">{stats.withClasses}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <Shield className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">系统角色</p>
              <p className="text-2xl font-bold text-purple-600">{teacherRoles.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜索教师姓名或工号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-64"
              />
            </div>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">所有学科</option>
              {subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">所有角色</option>
              {teacherRoles.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
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
              导入
            </button>
            <button 
              onClick={exportData}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              导出
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              添加教师
            </button>
          </div>
        </div>
      </div>

      {/* 教师列表 - 支持横向滚动 */}
      <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <button 
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 hover:text-blue-600"
                >
                  {selectedIds.length === filteredTeachers.length && filteredTeachers.length > 0 ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  全选
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">工号</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">联系电话</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">任教科目</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">任教班级</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredTeachers.map((teacher) => {
              return (
                <tr key={teacher.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => toggleSelect(teacher.id)}
                      className="text-gray-400 hover:text-blue-600"
                    >
                      {selectedIds.includes(teacher.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{teacher.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{teacher.name}</div>
                    <div className="text-sm text-gray-500">{teacher.email || '未设置邮箱'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{teacher.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {teacher.subjects?.join(', ') || '未设置'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getTeachingClassesDisplay(teacher)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(teacher.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditTeacher(teacher)}
                        className="text-blue-600 hover:text-blue-900"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleManageRoles(teacher)}
                        className="text-purple-600 hover:text-purple-900"
                        title="管理角色"
                      >
                        <Award className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleManagePermissions(teacher)}
                        className="text-orange-600 hover:text-orange-900"
                        title="自定义权限"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteTeacher(teacher.id);
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

      {/* 添加教师弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">添加教师</h2>
              <button onClick={() => setShowAddModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">工号 *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系电话 *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱 <span className="text-gray-400">(选填)</span></label>
                <input
                  type="email"
                  placeholder="选填"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">任教科目</label>
                <select
                  multiple
                  value={formData.subjects}
                  onChange={(e) => {
                    const options = Array.from(e.target.selectedOptions, option => option.value);
                    setFormData({...formData, subjects: options});
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"
                >
                  {subjects.map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">按住Ctrl可多选</p>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleAddTeacher}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 编辑教师弹窗 */}
      {showEditModal && selectedTeacher && (
        <EditTeacherModal
          teacher={selectedTeacher}
          formData={formData}
          setFormData={setFormData}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveEdit}
        />
      )}

      {/* 角色管理弹窗 */}
      {showRoleModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">管理角色 - {selectedTeacher.name}</h2>
              <button onClick={() => setShowRoleModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">选择该教师的角色（可多选）</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {teacherRoles.sort((a, b) => b.level - a.level).map(role => (
                  <label key={role.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.roles.includes(role.id)}
                      onChange={(e) => {
                        const newRoles = e.target.checked
                          ? [...formData.roles, role.id]
                          : formData.roles.filter(r => r !== role.id);
                        setFormData({...formData, roles: newRoles});
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{role.name}</span>
                        <span className="text-xs text-gray-500">L{role.level}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        权限: {role.permissions.slice(0, 3).join(', ')}
                        {role.permissions.length > 3 && '...'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveRoles}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  保存角色
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 自定义权限弹窗 */}
      {showPermissionModal && selectedTeacher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">自定义权限 - {selectedTeacher.name}</h2>
              <button onClick={() => setShowPermissionModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>提示：</strong> 自定义权限将叠加在角色权限之上。如果教师已有某权限，再次勾选不会有额外效果。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {allPermissions.map(perm => (
                  <label key={perm.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.custom_permissions.includes(perm.id)}
                      onChange={(e) => {
                        const newPerms = e.target.checked
                          ? [...formData.custom_permissions, perm.id]
                          : formData.custom_permissions.filter(p => p !== perm.id);
                        setFormData({...formData, custom_permissions: newPerms});
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{perm.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowPermissionModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleSavePermissions}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  保存权限
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 导入弹窗 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">导入教师数据</h2>
              <button onClick={() => setShowImportModal(false)}><X className="w-6 h-6 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">下载导入模板</p>
                    <p className="text-xs text-blue-700 mt-1">支持一位教师任教多个班级，每行代表一条任教记录，相同工号会自动合并</p>
                    <button 
                      onClick={downloadTemplate}
                      className="mt-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      下载模板
                    </button>
                  </div>
                </div>
              </div>
              <div 
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {importFile ? importFile.name : '点击或拖拽文件到此处上传'}
                </p>
                <p className="text-xs text-gray-400 mt-1">支持 CSV、Excel 格式</p>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".csv,.xlsx,.xls" 
                  className="hidden" 
                  onChange={(e) => setImportFile(e.target.files[0])}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => {setShowImportModal(false); setImportFile(null);}} className="px-4 py-2 border border-gray-300 rounded-lg">取消</button>
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
      )}

      {/* 智能导入预览弹窗 */}
      <SmartImportModal
        isOpen={showSmartImport}
        onClose={() => setShowSmartImport(false)}
        onConfirm={handleConfirmImport}
        previewData={importPreviewData}
        title="教师导入预览"
        columns={[
          { key: 'code', label: '工号' },
          { key: 'name', label: '姓名' },
          { key: 'phone', label: '电话' },
          { key: 'subjects', label: '任教科目' }
        ]}
      />
    </div>
  );
};

// 编辑教师弹窗组件 - 包含年级班级两步选择和任教科目下拉选择
const EditTeacherModal = ({ teacher, formData, setFormData, onClose, onSave }) => {
  const [selectedGrade, setSelectedGrade] = useState('');
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedClassIds, setSelectedClassIds] = useState(
    formData.teaching_classes?.map(tc => tc.class_id) || []
  );

  // 年级选项
  const grades = [
    { value: '7', label: '七年级' },
    { value: '8', label: '八年级' },
    { value: '9', label: '九年级' }
  ];

  // 当选择年级时，加载对应班级
  useEffect(() => {
    if (selectedGrade) {
      const gradeNum = parseInt(selectedGrade);
      const filtered = schoolData.classes.filter(cls => {
        const gradeInfo = schoolData.getClassGradeInfo(cls.id);
        return gradeInfo?.grade === gradeNum;
      });
      setAvailableClasses(filtered);
    } else {
      setAvailableClasses([]);
    }
  }, [selectedGrade]);

  // 处理年级选择
  const handleGradeChange = (e) => {
    setSelectedGrade(e.target.value);
  };

  // 处理班级选择（多选）
  const handleClassToggle = (classId) => {
    setSelectedClassIds(prev => {
      const newIds = prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId];
      
      // 更新 formData 中的 teaching_classes
      const newTeachingClasses = newIds.map(id => ({
        class_id: id,
        subject: formData.subjects?.[0] || ''
      }));
      setFormData({ ...formData, teaching_classes: newTeachingClasses });
      
      return newIds;
    });
  };

  // 处理科目选择（单选改为下拉菜单）
  const handleSubjectChange = (e) => {
    const subject = e.target.value;
    setFormData({ ...formData, subjects: subject ? [subject] : [] });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">编辑教师</h2>
          <button onClick={onClose}>
            <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
          </button>
        </div>
        <div className="space-y-4">
          {/* 工号 - 只读 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">工号</label>
            <input
              type="text"
              value={formData.code}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
            />
          </div>

          {/* 姓名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* 联系电话 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* 邮箱 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱 <span className="text-gray-400">(选填)</span></label>
            <input
              type="email"
              placeholder="选填"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* 任教科目 - 下拉菜单 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">任教科目</label>
            <select
              value={formData.subjects?.[0] || ''}
              onChange={handleSubjectChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="">请选择科目</option>
              {schoolData.subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>

          {/* 任教班级 - 两步选择 */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-3">任教班级</label>
            
            {/* 第一步：选择年级 */}
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">第一步：选择年级</label>
              <select
                value={selectedGrade}
                onChange={handleGradeChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">请选择年级</option>
                {grades.map(grade => (
                  <option key={grade.value} value={grade.value}>{grade.label}</option>
                ))}
              </select>
            </div>

            {/* 第二步：选择班级 */}
            {selectedGrade && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">第二步：选择班级（可多选）</label>
                {availableClasses.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                    {availableClasses.map(cls => (
                      <label
                        key={cls.id}
                        className={`flex items-center justify-center px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedClassIds.includes(cls.id)
                            ? 'bg-blue-100 border-blue-500 text-blue-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedClassIds.includes(cls.id)}
                          onChange={() => handleClassToggle(cls.id)}
                          className="sr-only"
                        />
                        <span className="text-sm font-medium">
                          {schoolData.formatClassName(cls.id)}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 py-2">该年级暂无班级</p>
                )}
              </div>
            )}

            {/* 已选班级显示 */}
            {selectedClassIds.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <label className="block text-xs text-gray-500 mb-2">已选班级：</label>
                <div className="flex flex-wrap gap-2">
                  {selectedClassIds.map(classId => {
                    const cls = schoolData.getClassById(classId);
                    return (
                      <span
                        key={classId}
                        className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {cls ? schoolData.formatClassName(cls.id) : '未知班级'}
                        <button
                          onClick={() => handleClassToggle(classId)}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 状态 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="active">在职</option>
              <option value="suspended">暂停</option>
            </select>
          </div>

          {/* 按钮 */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 获取角色颜色
const getRoleColor = (roleId) => {
  const colorMap = {
    'subject_teacher': 'cyan',
    'head_teacher': 'green',
    'lesson_leader': 'blue',
    'research_leader': 'purple',
    'grade_leader': 'orange',
    'grade_deputy': 'yellow',
    'dept_director': 'indigo',
    'dept_deputy': 'pink',
    'vice_principal': 'red',
    'principal': 'red',
    'admin': 'slate'
  };
  return colorMap[roleId] || 'gray';
};

export default TeacherManagement;
