import React, { useCallback, useState, useEffect } from 'react';
import {
  Users, Search, Plus, Edit2, Trash2, BookOpen,
  X, Award, CheckCircle,
  Download, Upload, FileSpreadsheet, Square, CheckSquare,
  Shield, Key
} from 'lucide-react';
import schoolData from '../data/schoolData';
import { notify } from '../lib/notify';
import { useConfirm } from './ui/confirm';
import SmartImportModal from './SmartImportModal';
import {
  buildTeacherImport,
  commitTeacherImport,
  parseTeacherImportText,
} from '../lib/teacherImport';
import {
  createTeacherUser,
  fetchAuthRoles,
  fetchTeacherListWithAssignments,
  syncTeacherAssignments,
  toggleTeacherStatus,
} from '../lib/teacherApi';
import { hasBackendAuthToken } from '../lib/sessionToken';

const hasBackendSession = hasBackendAuthToken;

const getCurrentTerm = () => {
  if (typeof schoolData.getCurrentSemesterDisplay === 'function') {
    return schoolData.getCurrentSemesterDisplay();
  }
  return `${schoolData.config.currentAcademicYear}-${schoolData.config.currentSemester}`;
};

const TeacherManagement = () => {
  const { confirm: confirmAction } = useConfirm();
  const [teachers, setTeachers] = useState([]);
  const [teacherSyncSource, setTeacherSyncSource] = useState('local');
  const [teacherListLoading, setTeacherListLoading] = useState(false);
  const [teacherListError, setTeacherListError] = useState('');
  const [teacherSaving, setTeacherSaving] = useState(false);
  const [teacherImporting, setTeacherImporting] = useState(false);
  const [backendRoles, setBackendRoles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    phone: '',
    email: '',
    initial_password: '',
    subjects: [],
    roles: ['subject_teacher'],
    status: 'active',
    teaching_classes: [],
    custom_permissions: []
  });
  
  const [importFile, setImportFile] = useState(null);
  const fileInputRef = React.useRef(null);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // 智能导入相关状态
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState([]);
  const skipInitialTeacherSync = React.useRef(true);
  const localTeacherCacheRef = React.useRef([]);

  const subjects = schoolData.subjects;
  const teacherRoles = schoolData.teacherRoles;
  const backendSessionActive = hasBackendSession();
  const resetTeacherForm = () => {
    setFormData({
      name: '',
      code: '',
      phone: '',
      email: '',
      initial_password: '',
      subjects: [],
      roles: ['subject_teacher'],
      status: 'active',
      teaching_classes: [],
      custom_permissions: []
    });
  };

  useEffect(() => {
    const localTeachers = schoolData.teachers || [];
    localTeacherCacheRef.current = localTeachers;
    setTeachers(localTeachers);
  }, []);

  const refreshTeachers = useCallback(async () => {
    if (!hasBackendSession()) {
      setTeacherSyncSource('local');
      return null;
    }

    setTeacherListLoading(true);
    try {
      const [roles, payload] = await Promise.all([
        fetchAuthRoles(),
        fetchTeacherListWithAssignments({
          pageSize: 100,
          term: getCurrentTerm(),
        }, schoolData.classes || []),
      ]);
      setBackendRoles(roles);
      const remoteTeachers = payload.teachers || [];
      if (remoteTeachers.length === 0 && localTeacherCacheRef.current.length > 0) {
        setTeachers(localTeacherCacheRef.current);
        setTeacherSyncSource('local');
        setTeacherListError('后端教师库暂无教师记录，当前显示本地真实导入数据。');
        return {
          ...payload,
          teachers: localTeacherCacheRef.current,
          source: 'local-fallback',
        };
      }

      setTeachers(remoteTeachers);
      if (remoteTeachers.length > 0) {
        localTeacherCacheRef.current = remoteTeachers;
      }
      setTeacherSyncSource('backend');
      setTeacherListError('');
      return payload;
    } catch (error) {
      setTeacherSyncSource('local');
      setTeacherListError(`后端教师库暂不可用，当前显示本地缓存：${error.message || '连接失败'}`);
      return null;
    } finally {
      setTeacherListLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshTeachers();
  }, [refreshTeachers]);

  useEffect(() => {
    if (skipInitialTeacherSync.current) {
      skipInitialTeacherSync.current = false;
      return;
    }
    schoolData.teachers = teachers;
    if (teachers.length > 0) {
      localTeacherCacheRef.current = teachers;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('schoolData:changed'));
    }
  }, [teachers]);

  // 获取教师的主角色
  const getTeacherPrimaryRole = (teacher) => {
    const roles = teacher.roles || ['subject_teacher'];
    return [...teacherRoles]
      .filter(role => roles.includes(role.id))
      .sort((a, b) => b.level - a.level)[0] || teacherRoles[0];
  };

  // 下载导入模板 - 支持两种方式：单行多班级 或 多行单班级
  const downloadTemplate = () => {
    const headers = ['工号', '姓名', '电话', '邮箱', '初始密码', '任教科目', '任教班级'];
    
    const comments = [
      '# 教师导入模板说明：',
      '#',
      '# 【方式一】单行多班级（推荐）- 一个教师一行，多个班级用分号隔开',
      '#   示例：T001,张老师,13800138001,zhang@school.com,ChangeMe123,语文,701;702;703',
      '#',
      '# 【方式二】多行单班级 - 一个教师多行，每行一个班级',
      '#   示例：',
      '#   T001,张老师,13800138001,zhang@school.com,ChangeMe123,语文,701',
      '#   T001,张老师,13800138001,zhang@school.com,,语文,702',
      '#',
      '# 注意：',
      '# - 相同工号的教师信息会自动合并',
      '# - 登录后导入后端教师库时，新增教师必须填写初始密码',
      '# - 任教班级可以是班级编号（如701）或班级序号（如01）',
      '# - 多个班级用分号(;)或逗号(,)分隔',
      '#',
    ];
    
    const sampleData = [
      ['T001', '林昕昕', '15957762377', '', 'ChangeMe123', '语文', '701'],
      ['T002', '王江鹏', '18272194348', '', 'ChangeMe123', '语文', '703'],
      ['T003', '周慧敏', '13616601785', '', 'ChangeMe123', '语文', '705;707'],
      ['T004', '吴国平', '18257589139', '', 'ChangeMe123', '语文', '702;704;706'],
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
        t.code || '',
        t.name || '',
        t.phone || '',
        t.email || '',
        (t.subjects || []).join(';'),
        (t.teaching_classes || [])
          .map(tc => schoolData.getClassById(tc.class_id)
            ? schoolData.formatClassName(tc.class_id)
            : tc.class_name || tc.class_id || '')
          .filter(Boolean)
          .join(';'),
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
      notify('请先选择要导入的文件');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseTeacherImportText(e.target.result || '');
        const result = buildTeacherImport({
          parsedRows: parsed.rows,
          teachers,
          classes: schoolData.classes || [],
          formatClassName: schoolData.formatClassName.bind(schoolData),
        });

        if (result.items.length === 0) {
          notify('没有可导入的教师数据');
          return;
        }

        setImportPreviewData(result.items);
        setShowSmartImport(true);
        setShowImportModal(false);
      } catch (error) {
        notify(error.message || '解析教师导入文件失败');
      }
    };
    
    reader.readAsText(importFile);
  };

  // 确认智能导入
  const handleConfirmImport = async (selectedData) => {
    const addedCount = selectedData.filter(item => item.type === 'new').length;
    const updatedCount = selectedData.filter(item => item.type === 'update').length;

    if (addedCount === 0 && updatedCount === 0) {
      notify('没有选择需要写入的教师变更');
      return;
    }

    if (hasBackendSession()) {
      const missingPasswordItems = selectedData.filter(item => (
        item.type === 'new' && String(item.data?.initial_password || '').trim().length < 6
      ));
      if (missingPasswordItems.length > 0) {
        notify(`有 ${missingPasswordItems.length} 位新增教师缺少至少 6 位初始密码，请补充后再导入。`, 'warning');
        return;
      }

      setTeacherImporting(true);
      try {
        const roles = backendRoles.length > 0 ? backendRoles : await fetchAuthRoles();
        setBackendRoles(roles);

        for (const item of selectedData) {
          const data = item.data || {};
          let targetTeacher = teachers.find(teacher => teacher.code === data.code);

          if (item.type === 'new') {
            const created = await createTeacherUser({
              ...data,
              roles: data.roles || ['subject_teacher'],
            }, roles);
            if (created?.success === false) {
              throw new Error(created.message || `${data.name || data.code} 创建失败`);
            }
            if (!created.teacher_id && data.teaching_classes?.length > 0) {
              throw new Error(`${data.name || data.code} 已创建，但暂时无法定位教师ID来同步任课安排`);
            }
            targetTeacher = {
              id: created.teacher_id,
              code: data.code,
              name: data.name,
              teaching_classes: [],
            };
          }

          if (targetTeacher?.id && data.teaching_classes?.length > 0) {
            await syncTeacherAssignments({
              teacher: targetTeacher,
              form: data,
              classes: schoolData.classes || [],
              term: getCurrentTerm(),
            });
          }
        }

        await refreshTeachers();
        setShowSmartImport(false);
        setImportFile(null);
        notify(`导入完成：新增 ${addedCount} 位教师，更新 ${updatedCount} 位教师`, 'success');
        return;
      } catch (error) {
        notify('教师导入失败：' + (error.message || '请稍后重试'), 'error');
        return;
      } finally {
        setTeacherImporting(false);
      }
    }

    const importResult = { items: selectedData };
    const updatedTeachers = commitTeacherImport({
      teachers,
      importResult,
    });
    
    setTeachers(updatedTeachers);
    setShowSmartImport(false);
    setImportFile(null);
    
    let message = '导入完成：';
    if (addedCount > 0) message += `新增 ${addedCount} 位教师`;
    if (updatedCount > 0) message += `${addedCount > 0 ? '，' : ''}更新 ${updatedCount} 位教师`;
    notify(message, 'success');
  };

  const filteredTeachers = teachers.filter(teacher => {
    const keyword = searchTerm.toLowerCase();
    const matchesSearch = String(teacher.name || '').toLowerCase().includes(keyword) ||
                         String(teacher.code || '').toLowerCase().includes(keyword);
    const matchesSubject = filterSubject === 'all' || (teacher.subjects || []).includes(filterSubject);
    const matchesRole = filterRole === 'all' || (teacher.roles && teacher.roles.includes(filterRole));
    return matchesSearch && matchesSubject && matchesRole;
  });

  const stats = {
    total: teachers.length,
    active: teachers.filter(t => t.status === 'active').length,
    suspended: teachers.filter(t => t.status === 'suspended').length,
    withClasses: teachers.filter(t => t.teaching_classes && t.teaching_classes.length > 0).length
  };

  const handleAddTeacher = async () => {
    if (!formData.code.trim() || !formData.name.trim() || !formData.phone.trim()) {
      notify('请填写工号、姓名和联系电话');
      return;
    }
    if (teachers.some(teacher => teacher.code === formData.code.trim())) {
      notify('该教师工号已存在，请直接编辑原教师');
      return;
    }

    if (hasBackendSession()) {
      if (formData.initial_password.trim().length < 6) {
        notify('后端创建教师账号时，初始密码至少需要 6 位。', 'warning');
        return;
      }

      setTeacherSaving(true);
      try {
        const result = await createTeacherUser(formData, backendRoles);
        if (result?.success === false) {
          notify(result.message || '教师账号创建失败', 'warning');
          return;
        }
        await refreshTeachers();
        setShowAddModal(false);
        resetTeacherForm();
        notify(result?.message || '教师账号创建成功！', 'success');
      } catch (error) {
        notify('教师账号创建失败：' + (error.message || '请稍后重试'), 'error');
      } finally {
        setTeacherSaving(false);
      }
      return;
    }

    const newTeacher = {
      id: Math.max(0, ...teachers.map(teacher => Number(teacher.id)).filter(Number.isFinite)) + 1,
      ...formData,
      code: formData.code.trim(),
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      teaching_classes: []
    };
    const updatedTeachers = [...teachers, newTeacher];
    setTeachers(updatedTeachers);
    setShowAddModal(false);
    resetTeacherForm();
  };

  const handleEditTeacher = (teacher) => {
    setSelectedTeacher(teacher);
    setFormData({
      name: teacher.name,
      code: teacher.code,
      phone: teacher.phone,
      email: teacher.email || '',
      initial_password: '',
      subjects: teacher.subjects || [],
      roles: teacher.roles || ['subject_teacher'],
      status: teacher.status,
      teaching_classes: teacher.teaching_classes || [],
      custom_permissions: teacher.custom_permissions || []
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (selectedTeacher) {
      if (!formData.name.trim() || !formData.phone.trim()) {
        notify('请填写姓名和联系电话');
        return;
      }
      if ((formData.teaching_classes || []).length > 0 && !(formData.subjects || [])[0]) {
        notify('请选择任教科目后再保存任课班级');
        return;
      }

      if (hasBackendSession()) {
        setTeacherSaving(true);
        try {
          const result = await syncTeacherAssignments({
            teacher: selectedTeacher,
            form: formData,
            classes: schoolData.classes || [],
            term: getCurrentTerm(),
          });
          await refreshTeachers();
          setShowEditModal(false);
          notify(`任课安排已同步：新增 ${result.createdCount} 条，移除 ${result.removedCount} 条。账号资料请在账号管理中维护。`, 'success');
        } catch (error) {
          notify('任课安排同步失败：' + (error.message || '请稍后重试'), 'error');
        } finally {
          setTeacherSaving(false);
        }
        return;
      }

      const updatedTeachers = teachers.map(t =>
        t.id === selectedTeacher.id
          ? {
              ...t,
              ...formData,
              name: formData.name.trim(),
              phone: formData.phone.trim(),
              email: formData.email.trim(),
            }
          : t
      );
      setTeachers(updatedTeachers);
      setShowEditModal(false);
      notify('教师信息更新成功！');
    }
  };

  const handleDeleteTeacher = async (teacherOrId) => {
    const teacher = typeof teacherOrId === 'object'
      ? teacherOrId
      : teachers.find(item => item.id === teacherOrId);
    if (!teacher) return;

    const confirmed = await confirmAction({
      title: hasBackendSession() ? '禁用教师账号' : '删除教师',
      message: hasBackendSession()
        ? `确定要禁用 ${teacher.name || teacher.code} 的后端账号吗？历史任课和成绩记录会保留。`
        : '确定要删除这位教师吗？',
      confirmText: hasBackendSession() ? '禁用账号' : '删除'
    });
    if (!confirmed) return;

    if (hasBackendSession()) {
      if (teacher.status === 'suspended') {
        notify('该教师账号已处于禁用状态。', 'warning');
        return;
      }

      try {
        const result = await toggleTeacherStatus(teacher.id);
        if (result?.success === false) {
          notify(result.message || '教师账号禁用失败', 'warning');
          return;
        }
        await refreshTeachers();
        notify(result?.message || '教师账号已禁用', 'success');
      } catch (error) {
        notify('教师账号禁用失败：' + (error.message || '请稍后重试'), 'error');
      }
      return;
    }

    const updatedTeachers = teachers.filter(t => t.id !== teacher.id);
    setTeachers(updatedTeachers);
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
      if (hasBackendSession()) {
        setShowRoleModal(false);
        notify('后端角色来自系统账号角色，请在账号管理中调整。', 'warning');
        return;
      }

      const updatedTeachers = teachers.map(t =>
        t.id === selectedTeacher.id
          ? { ...t, roles: formData.roles }
          : t
      );
      setTeachers(updatedTeachers);
      setShowRoleModal(false);
      notify('角色设置已保存！');
    }
  };

  const handleSavePermissions = () => {
    if (selectedTeacher) {
      if (hasBackendSession()) {
        setShowPermissionModal(false);
        notify('后端权限由系统角色统一控制，请在角色管理中维护权限码。', 'warning');
        return;
      }

      const updatedTeachers = teachers.map(t =>
        t.id === selectedTeacher.id
          ? { ...t, custom_permissions: formData.custom_permissions }
          : t
      );
      setTeachers(updatedTeachers);
      setShowPermissionModal(false);
      notify('自定义权限已保存！');
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

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      notify('请先选择要删除的教师');
      return;
    }
    const confirmed = await confirmAction({
      title: hasBackendSession() ? '批量禁用教师账号' : '批量删除教师',
      message: hasBackendSession()
        ? `确定要禁用选中的 ${selectedIds.length} 位教师账号吗？历史数据会保留。`
        : `确定要删除选中的 ${selectedIds.length} 位教师吗？`,
      confirmText: hasBackendSession() ? '批量禁用' : '批量删除'
    });
    if (!confirmed) return;

    if (hasBackendSession()) {
      const targets = teachers.filter(t => selectedIds.includes(t.id) && t.status !== 'suspended');
      try {
        for (const teacher of targets) {
          await toggleTeacherStatus(teacher.id);
        }
        await refreshTeachers();
        setSelectedIds([]);
        notify(`已禁用 ${targets.length} 位教师账号。`, 'success');
      } catch (error) {
        notify('批量禁用失败：' + (error.message || '请稍后重试'), 'error');
      }
      return;
    }

    const updatedTeachers = teachers.filter(t => !selectedIds.includes(t.id));
    setTeachers(updatedTeachers);
    setSelectedIds([]);
    notify('批量删除成功！');
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
            {schoolData.getClassById(tc.class_id)
              ? schoolData.formatClassName(tc.class_id)
              : tc.class_name || tc.class_id || '未知班级'}
            {tc.subject ? ` · ${tc.subject}` : ''}
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

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">教师管理</h1>
        <p className="text-gray-500 mt-1">管理教师信息、任教班级和角色权限</p>
      </div>

      {(teacherListLoading || teacherListError || teacherSyncSource === 'backend') && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
          teacherListError
            ? 'border-amber-100 bg-amber-50 text-amber-700'
            : 'border-emerald-100 bg-emerald-50 text-emerald-700'
        }`}>
          {teacherListError ? <X className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          <span>
            {teacherListLoading
              ? '正在同步后端教师库...'
              : teacherListError || '已连接后端教师库，教师账号和任课安排来自数据库。'}
          </span>
        </div>
      )}

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
                {backendSessionActive ? '批量禁用' : '批量删除'} ({selectedIds.length})
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
                          handleDeleteTeacher(teacher);
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
              {backendSessionActive && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">初始密码 *</label>
                  <input
                    type="password"
                    value={formData.initial_password}
                    onChange={(e) => setFormData({...formData, initial_password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">用于创建教师登录账号，至少 6 位。</p>
                </div>
              )}
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
                  disabled={teacherSaving}
                  className={`px-4 py-2 rounded-lg ${
                    teacherSaving
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {teacherSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 编辑教师弹窗 */}
      {showEditModal && selectedTeacher && (
        <EditTeacherModal
          formData={formData}
          setFormData={setFormData}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveEdit}
          backendMode={backendSessionActive}
          saving={teacherSaving}
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
                {[...teacherRoles].sort((a, b) => b.level - a.level).map(role => (
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
                <p className="text-xs text-gray-400 mt-1">支持 CSV、TSV 文本格式</p>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".csv,.tsv,.txt"
                  className="hidden" 
                  onChange={(e) => setImportFile(e.target.files[0])}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => {setShowImportModal(false); setImportFile(null);}} className="px-4 py-2 border border-gray-300 rounded-lg">取消</button>
                <button 
                  onClick={handleImportPreview}
                  disabled={teacherImporting}
                  className={`px-4 py-2 rounded-lg ${
                    teacherImporting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {teacherImporting ? '处理中...' : '预览导入'}
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
          {
            key: 'initial_password',
            label: '初始密码',
            render: value => value ? '已填写' : (backendSessionActive ? '缺少' : '-')
          },
          { key: 'subjects', label: '任教科目', render: value => (value || []).join('、') || '-' },
          {
            key: 'teaching_classes',
            label: '任教班级',
            render: value => (value || [])
              .map(item => schoolData.getClassById(item.class_id)
                ? schoolData.formatClassName(item.class_id)
                : item.class_name || item.class_id || '')
              .filter(Boolean)
              .join('、') || '-'
          }
        ]}
      />
    </div>
  );
};

// 编辑教师弹窗组件 - 包含年级班级两步选择和任教科目下拉选择
const EditTeacherModal = ({ formData, setFormData, onClose, onSave, backendMode = false, saving = false }) => {
  const [selectedGrade, setSelectedGrade] = useState('');
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedClassIds, setSelectedClassIds] = useState(
    (formData.teaching_classes || [])
      .map(tc => Number(tc.class_id))
      .filter(Number.isFinite)
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
      const subject = formData.subjects?.[0] || '';
      
      // 更新 formData 中的 teaching_classes
      const newTeachingClasses = newIds.map(id => {
        const existing = (formData.teaching_classes || []).find(tc => Number(tc.class_id) === Number(id));
        return {
          ...existing,
          class_id: id,
          subject: subject || existing?.subject || ''
        };
      });
      setFormData({ ...formData, teaching_classes: newTeachingClasses });
      
      return newIds;
    });
  };

  // 处理科目选择（单选改为下拉菜单）
  const handleSubjectChange = (e) => {
    const subject = e.target.value;
    setFormData({
      ...formData,
      subjects: subject ? [subject] : [],
      teaching_classes: (formData.teaching_classes || []).map(tc => ({ ...tc, subject }))
    });
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
        {backendMode && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            当前连接后端教师库。本页同步任课科目和班级；姓名、电话、邮箱和账号状态请在账号管理中维护。
          </div>
        )}
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
              disabled={backendMode}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg outline-none ${
                backendMode ? 'bg-gray-100 text-gray-500' : 'focus:ring-2 focus:ring-blue-500'
              }`}
            />
          </div>

          {/* 联系电话 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
            <input
              type="tel"
              value={formData.phone}
              disabled={backendMode}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg outline-none ${
                backendMode ? 'bg-gray-100 text-gray-500' : 'focus:ring-2 focus:ring-blue-500'
              }`}
            />
          </div>

          {/* 邮箱 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱 <span className="text-gray-400">(选填)</span></label>
            <input
              type="email"
              placeholder="选填"
              value={formData.email}
              disabled={backendMode}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg outline-none ${
                backendMode ? 'bg-gray-100 text-gray-500' : 'focus:ring-2 focus:ring-blue-500'
              }`}
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
              disabled={backendMode}
              onChange={(e) => setFormData({...formData, status: e.target.value})}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg outline-none ${
                backendMode ? 'bg-gray-100 text-gray-500' : 'bg-white focus:ring-2 focus:ring-blue-500'
              }`}
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
              disabled={saving}
              className={`px-4 py-2 rounded-lg ${
                saving
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherManagement;
