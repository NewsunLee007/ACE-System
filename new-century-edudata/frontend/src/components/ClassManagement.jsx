import React, { useCallback, useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  School,
  X,
  CheckCircle,
  Download,
  Upload,
  FileSpreadsheet,
  Eye,
  Square,
  CheckSquare,
  Calendar,
  MapPin
} from 'lucide-react';
import schoolData from '../data/schoolData';
import { notify } from '../lib/notify';
import { useConfirm } from './ui/confirm';
import SmartImportModal from './SmartImportModal';
import {
  allocateClassId,
  buildClassImport,
  commitClassImport,
  findExistingClass,
  normalizeClassNo,
  parseClassImportText,
} from '../lib/classImport';
import {
  buildClassPayload,
  createClassRecord,
  deactivateClassRecord,
  fetchClassList,
  updateClassRecord,
} from '../lib/classApi';
import { hasBackendAuthToken } from '../lib/sessionToken';

const hasBackendSession = hasBackendAuthToken;

const shouldFallbackToLocalClassImport = (error) => {
  const status = Number(error?.status);
  if ([404, 502, 503, 504].includes(status)) return true;

  const message = String(error?.message || '');
  return error instanceof TypeError ||
    message.includes('Failed to fetch') ||
    message.includes('请求失败(404)');
};

const ClassManagement = () => {
  const { confirm: confirmAction } = useConfirm();
  const [classes, setClasses] = useState([]);
  const [classSyncSource, setClassSyncSource] = useState('local');
  const [classListLoading, setClassListLoading] = useState(false);
  const [classListError, setClassListError] = useState('');
  const [classSaving, setClassSaving] = useState(false);
  const [classImporting, setClassImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);

  // 表单数据 - 纯粹的班级信息
  const [formData, setFormData] = useState({
    class_no: '',
    enrollment_year: schoolData.config.currentAcademicYear,
    classroom_location: '',
    status: 'active'
  });
  const [importFile, setImportFile] = useState(null);
  const fileInputRef = React.useRef(null);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // 智能导入相关状态
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState([]);
  const skipInitialClassSync = React.useRef(true);
  const localClassCacheRef = React.useRef([]);
  const backendSessionActive = hasBackendSession();

  useEffect(() => {
    const localClasses = schoolData.classes || [];
    localClassCacheRef.current = localClasses;
    setClasses(localClasses);
  }, []);

  const refreshClasses = useCallback(async () => {
    if (!hasBackendSession()) {
      setClassSyncSource('local');
      return null;
    }

    setClassListLoading(true);
    try {
      const payload = await fetchClassList({ pageSize: 200 });
      const remoteClasses = payload.classes || [];
      if (remoteClasses.length === 0 && localClassCacheRef.current.length > 0) {
        setClasses(localClassCacheRef.current);
        setClassSyncSource('local');
        setClassListError('后端班级库暂无班级记录，当前显示本地真实导入数据。');
        return {
          ...payload,
          classes: localClassCacheRef.current,
          source: 'local-fallback',
        };
      }

      setClasses(remoteClasses);
      if (remoteClasses.length > 0) {
        localClassCacheRef.current = remoteClasses;
      }
      setClassSyncSource('backend');
      setClassListError('');
      return payload;
    } catch (error) {
      setClassSyncSource('local');
      setClassListError(`后端班级库暂不可用，当前显示本地缓存：${error.message || '连接失败'}`);
      return null;
    } finally {
      setClassListLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshClasses();
  }, [refreshClasses]);

  useEffect(() => {
    if (skipInitialClassSync.current) {
      skipInitialClassSync.current = false;
      return;
    }
    schoolData.classes = classes;
    if (classes.length > 0) {
      localClassCacheRef.current = classes;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('schoolData:changed'));
    }
  }, [classes]);

  // 获取当前学年显示
  const getCurrentAcademicYearDisplay = () => {
    return schoolData.getCurrentAcademicYearDisplay();
  };

  const getClassGradeInfo = (cls) => (
    schoolData.calculateGradeLevel(Number(cls.enrollment_year))
  );

  const formatClassDisplayName = (cls) => (
    cls.name || `${cls.enrollment_year}级${normalizeClassNo(cls.class_no || cls.id)}班`
  );

  // 下载导入模板 - 纯粹的班级信息
  const downloadTemplate = () => {
    // 表头不包含逗号，避免CSV解析问题
    const headers = ['班级序号', '入学年份', '教室位置', '状态'];
    const sampleData = [
      ['01', '2025', '教学楼A-101', '在读'],
      ['02', '2025', '教学楼A-102', '在读'],
    ];
    
    // 添加说明行
    const comments = [
      '# 班级导入模板说明：',
      '# 1. 班级序号: 如 01, 02, 03...',
      '# 2. 入学年份: 如 2025, 2024...',
      '# 3. 教室位置: 如 教学楼A-101（可选）',
      '# 4. 状态: 在读 或 已毕业',
      '#',
      '# 示例数据：',
    ];
    
    const csvContent = [
      ...comments,
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '班级导入模板.csv';
    link.click();
  };

  // 导出班级数据
  const exportData = () => {
    const headers = ['班级编号', '班级名称', '入学年份', '当前年级', '教室位置', '状态'];
    const data = filteredClasses.map(c => {
      const gradeInfo = getClassGradeInfo(c);
      return [
        c.id, formatClassDisplayName(c), c.enrollment_year, gradeInfo?.name || '未知',
        c.classroom_location || '', c.status === 'active' ? '在读' : '已毕业'
      ];
    });
    
    const csvContent = [headers.join(','), ...data.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `班级名单_${new Date().toLocaleDateString()}.csv`;
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
        const parsed = parseClassImportText(e.target.result || '');
        const result = buildClassImport({
          parsedRows: parsed.rows,
          classes,
          currentAcademicYear: schoolData.config.currentAcademicYear,
          calculateGradeLevel: schoolData.calculateGradeLevel.bind(schoolData),
        });

        if (result.items.length === 0) {
          notify(result.errors[0] || '没有可导入的班级数据');
          return;
        }

        setImportPreviewData(result.items);
        setShowSmartImport(true);
        setShowImportModal(false);

        if (result.errors.length > 0) {
          notify(`有 ${result.errors.length} 行未进入预览，请检查模板内容`, 'warning');
        }
      } catch (error) {
        notify(error.message || '文件格式错误，请检查导入模板');
      }
    };
    
    reader.readAsText(importFile);
  };

  // 确认智能导入
  const handleConfirmImport = async (selectedData) => {
    const addedCount = selectedData.filter(item => item.type === 'new').length;
    const updatedCount = selectedData.filter(item => item.type === 'update').length;

    if (addedCount === 0 && updatedCount === 0) {
      notify('没有选择需要写入的班级变更');
      return;
    }

    const commitSelectedImportLocally = (fallbackMessage = '') => {
      const importResult = { items: selectedData };
      const updatedClasses = commitClassImport({
        classes,
        importResult,
        currentAcademicYear: schoolData.config.currentAcademicYear,
        calculateGradeLevel: schoolData.calculateGradeLevel.bind(schoolData),
      });

      setClasses(updatedClasses);
      setShowSmartImport(false);
      setImportFile(null);

      let message = '导入完成：';
      if (addedCount > 0) message += `新增 ${addedCount} 个班级`;
      if (updatedCount > 0) message += `${addedCount > 0 ? '，' : ''}更新 ${updatedCount} 个班级`;
      notify(fallbackMessage ? `${fallbackMessage}${message}` : message, fallbackMessage ? 'warning' : 'success');
    };

    if (hasBackendSession() && classSyncSource === 'backend') {
      setClassImporting(true);
      try {
        for (const item of selectedData) {
          const payload = buildClassPayload({
            form: item.type === 'update'
              ? { ...item.existingData, ...item.data, id: item.existingData?.id }
              : item.data,
            classes,
            currentAcademicYear: schoolData.config.currentAcademicYear,
            calculateGradeLevel: schoolData.calculateGradeLevel.bind(schoolData),
          });
          const result = item.type === 'update' && !item.existingData?.derived_from_students
            ? await updateClassRecord(item.existingData.class_code || item.existingData.id, payload)
            : await createClassRecord(payload);
          if (result?.success === false) {
            throw new Error(result.message || `${payload.name} 写入失败`);
          }
        }
        await refreshClasses();
        setShowSmartImport(false);
        setImportFile(null);
        notify(`导入完成：新增 ${addedCount} 个班级，更新 ${updatedCount} 个班级`, 'success');
        return;
      } catch (error) {
        if (shouldFallbackToLocalClassImport(error)) {
          commitSelectedImportLocally('后端班级库暂不可用，已先写入本地缓存。');
          return;
        }
        notify('班级导入失败：' + (error.message || '请稍后重试'), 'error');
        return;
      } finally {
        setClassImporting(false);
      }
    }

    commitSelectedImportLocally();
  };

  const handleAddClass = () => {
    setFormData({
      class_no: '',
      enrollment_year: schoolData.config.currentAcademicYear,
      classroom_location: '',
      status: 'active'
    });
    setShowAddModal(true);
  };

  const handleEditClass = (cls) => {
    setSelectedClass(cls);
    setFormData({
      class_no: normalizeClassNo(cls.class_no || cls.id),
      enrollment_year: cls.enrollment_year,
      classroom_location: cls.classroom_location || '',
      status: cls.status
    });
    setShowEditModal(true);
  };

  const handleViewDetail = (cls) => {
    setSelectedClass(cls);
    setShowDetailModal(true);
  };

  const handleSaveAdd = (e) => {
    e.preventDefault();
    const normalizedClassNo = normalizeClassNo(formData.class_no);
    if (!normalizedClassNo) {
      notify('请填写班级序号');
      return;
    }

    const existingClass = findExistingClass({
      classes,
      classNo: normalizedClassNo,
      enrollmentYear: formData.enrollment_year,
      currentAcademicYear: schoolData.config.currentAcademicYear,
      calculateGradeLevel: schoolData.calculateGradeLevel.bind(schoolData),
    });
    if (existingClass) {
      notify(`${formData.enrollment_year}级${normalizedClassNo}班已存在，请直接编辑原班级`);
      return;
    }

    const gradeInfo = schoolData.calculateGradeLevel(formData.enrollment_year);
    const classId = allocateClassId({
      classNo: normalizedClassNo,
      enrollmentYear: formData.enrollment_year,
      classes,
      currentAcademicYear: schoolData.config.currentAcademicYear,
      calculateGradeLevel: schoolData.calculateGradeLevel.bind(schoolData),
    });

    const saveToBackend = async () => {
      setClassSaving(true);
      try {
        const payload = buildClassPayload({
          form: { ...formData, class_no: normalizedClassNo, id: classId },
          classes,
          currentAcademicYear: schoolData.config.currentAcademicYear,
          calculateGradeLevel: schoolData.calculateGradeLevel.bind(schoolData),
        });
        const result = await createClassRecord(payload);
        if (result?.success === false) {
          notify(result.message || '班级创建失败', 'warning');
          return;
        }
        await refreshClasses();
        setShowAddModal(false);
        notify(result?.message || '班级创建成功！', 'success');
      } catch (error) {
        notify('班级创建失败：' + (error.message || '请稍后重试'), 'error');
      } finally {
        setClassSaving(false);
      }
    };

    if (hasBackendSession()) {
      saveToBackend();
      return;
    }
    
    // 判断是否已毕业
    const isGraduated = gradeInfo.isGraduated || 
                       (formData.enrollment_year <= schoolData.config.currentAcademicYear - 3);
    
    const newClass = {
      id: classId,
      ...formData,
      class_no: normalizedClassNo,
      name: `${formData.enrollment_year}级${normalizedClassNo}班`,
      status: isGraduated ? 'inactive' : 'active',
      head_teacher_id: null,
      created_at: new Date().toISOString().split('T')[0]
    };
    const updatedClasses = [...classes, newClass];
    setClasses(updatedClasses);
    setShowAddModal(false);
    notify('班级添加成功！');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (selectedClass) {
      const normalizedClassNo = normalizeClassNo(formData.class_no || selectedClass.class_no || selectedClass.id);

      if (hasBackendSession()) {
        setClassSaving(true);
        try {
          const payload = buildClassPayload({
            form: {
              ...selectedClass,
              ...formData,
              class_no: normalizedClassNo,
              id: selectedClass.id,
              class_code: selectedClass.class_code || selectedClass.id,
            },
            classes,
            currentAcademicYear: schoolData.config.currentAcademicYear,
            calculateGradeLevel: schoolData.calculateGradeLevel.bind(schoolData),
          });
          const result = selectedClass.derived_from_students
            ? await createClassRecord(payload)
            : await updateClassRecord(selectedClass.class_code || selectedClass.id, payload);
          if (result?.success === false) {
            notify(result.message || '班级信息保存失败', 'warning');
            return;
          }
          await refreshClasses();
          setShowEditModal(false);
          notify(result?.message || '班级信息更新成功！', 'success');
        } catch (error) {
          notify('班级信息保存失败：' + (error.message || '请稍后重试'), 'error');
        } finally {
          setClassSaving(false);
        }
        return;
      }

      const updatedClasses = classes.map(c => 
        c.id === selectedClass.id 
          ? { ...c, ...formData, class_no: normalizedClassNo, name: `${formData.enrollment_year}级${normalizedClassNo}班` }
          : c
      );
      setClasses(updatedClasses);
      setShowEditModal(false);
      notify('班级信息更新成功！');
    }
  };

  const handleDeleteClass = async (classOrId) => {
    const targetClass = typeof classOrId === 'object'
      ? classOrId
      : classes.find(item => item.id === classOrId);
    if (!targetClass) return;

    const confirmed = await confirmAction({
      title: hasBackendSession() ? '标记班级为已毕业' : '删除班级',
      message: hasBackendSession()
        ? '确定要将这个班级标记为已毕业吗？历史学生、教师和成绩数据会保留。'
        : '确定要删除这个班级吗？',
      confirmText: hasBackendSession() ? '标记已毕业' : '删除'
    });
    if (!confirmed) return;

    if (hasBackendSession()) {
      if (targetClass.derived_from_students) {
        notify('该班级来自学生档案派生，请先编辑保存为正式班级，或先调整学生班级。', 'warning');
        return;
      }
      try {
        const result = await deactivateClassRecord(targetClass.class_code || targetClass.id);
        if (result?.success === false) {
          notify(result.message || '班级状态更新失败', 'warning');
          return;
        }
        await refreshClasses();
        notify(result?.message || '班级已标记为已毕业', 'success');
      } catch (error) {
        notify('班级状态更新失败：' + (error.message || '请稍后重试'), 'error');
      }
      return;
    }

    const updatedClasses = classes.filter(c => c.id !== targetClass.id);
    setClasses(updatedClasses);
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
    if (selectedIds.length === filteredClasses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredClasses.map(c => c.id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      notify('请先选择要删除的班级');
      return;
    }
    const confirmed = await confirmAction({
      title: hasBackendSession() ? '批量标记已毕业' : '批量删除班级',
      message: hasBackendSession()
        ? `确定要将选中的 ${selectedIds.length} 个班级标记为已毕业吗？历史数据会保留。`
        : `确定要删除选中的 ${selectedIds.length} 个班级吗？`,
      confirmText: hasBackendSession() ? '批量标记' : '批量删除'
    });
    if (!confirmed) return;

    if (hasBackendSession()) {
      const targets = classes.filter(c => selectedIds.includes(c.id) && !c.derived_from_students);
      try {
        for (const cls of targets) {
          await deactivateClassRecord(cls.class_code || cls.id);
        }
        await refreshClasses();
        setSelectedIds([]);
        notify(`已标记 ${targets.length} 个班级为已毕业。`, 'success');
      } catch (error) {
        notify('批量更新失败：' + (error.message || '请稍后重试'), 'error');
      }
      return;
    }

    const updatedClasses = classes.filter(c => !selectedIds.includes(c.id));
    setClasses(updatedClasses);
    setSelectedIds([]);
    notify('批量删除成功！');
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700'
    };
    const labels = {
      active: '在读',
      inactive: '已毕业'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const filteredClasses = classes.filter(cls => {
    const gradeInfo = getClassGradeInfo(cls);
    const classNo = normalizeClassNo(cls.class_no || cls.id);
    const matchSearch = classNo.includes(searchTerm) ||
                       formatClassDisplayName(cls).includes(searchTerm);
    const matchGrade = !filterGrade || gradeInfo?.grade === parseInt(filterGrade);
    return matchSearch && matchGrade;
  });

  const stats = {
    total: classes.length,
    active: classes.filter(c => c.status === 'active').length,
    currentYear: getCurrentAcademicYearDisplay()
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">班级管理</h1>
        <p className="text-gray-500 mt-1">
          管理学校班级基础信息（班级是教务系统的核心基础数据）
        </p>
      </div>

      {(classListLoading || classListError || classSyncSource === 'backend') && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
          classListError
            ? 'border-amber-100 bg-amber-50 text-amber-700'
            : 'border-emerald-100 bg-emerald-50 text-emerald-700'
        }`}>
          {classListError ? <X className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          <span>
            {classListLoading
              ? '正在同步后端班级库...'
              : classListError || '已连接后端班级库，班级基础数据来自数据库。'}
          </span>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <School className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">班级总数</p>
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
              <p className="text-sm text-gray-500">在读班级</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-cyan-100 text-cyan-600">
              <Calendar className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">当前学年</p>
              <p className="text-2xl font-bold text-cyan-600">{stats.currentYear}</p>
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
                placeholder="搜索班级名称..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-64"
              />
            </div>
            <select 
              value={filterGrade} 
              onChange={(e) => setFilterGrade(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">所有年级</option>
              <option value="7">七年级</option>
              <option value="8">八年级</option>
              <option value="9">九年级</option>
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
                {backendSessionActive ? '批量标记已毕业' : '批量删除'} ({selectedIds.length})
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
              onClick={handleAddClass} 
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              添加班级
            </button>
          </div>
        </div>
      </div>

      {/* 班级列表 - 纯粹的班级信息，支持横向滚动 */}
      <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <button 
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 hover:text-blue-600"
                >
                  {selectedIds.length === filteredClasses.length && filteredClasses.length > 0 ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  全选
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">班级编号</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">班级名称</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">入学年份</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">当前年级</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">教室位置</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredClasses.map((cls) => {
              const gradeInfo = getClassGradeInfo(cls);
              return (
                <tr key={cls.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => toggleSelect(cls.id)}
                      className="text-gray-400 hover:text-blue-600"
                    >
                      {selectedIds.includes(cls.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{cls.id}</td>
                  <td className="px-6 py-4 text-sm font-bold text-blue-600">
                    {formatClassDisplayName(cls)}
                    {cls.derived_from_students && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                        学生档案派生
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{cls.enrollment_year}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                      {gradeInfo?.name || '未知'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      {cls.classroom_location || '未设置'}
                    </div>
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(cls.status)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleViewDetail(cls)}
                        className="text-blue-600 hover:text-blue-900"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEditClass(cls)}
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
                          handleDeleteClass(cls);
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

      {/* 添加班级弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">添加班级</h2>
              <button onClick={() => setShowAddModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            <form onSubmit={handleSaveAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">入学年份 *</label>
                  <input
                    type="number"
                    required
                    value={formData.enrollment_year}
                    onChange={(e) => setFormData({...formData, enrollment_year: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="如：2025"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">班级序号 *</label>
                  <input
                    type="text"
                    required
                    value={formData.class_no}
                    onChange={(e) => setFormData({...formData, class_no: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="如：01"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">教室位置</label>
                <input
                  type="text"
                  value={formData.classroom_location}
                  onChange={(e) => setFormData({...formData, classroom_location: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="如：教学楼A-101"
                />
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={classSaving}
                  className={`px-4 py-2 rounded-lg ${
                    classSaving
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {classSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 编辑班级弹窗 */}
      {showEditModal && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">编辑班级</h2>
              <button onClick={() => setShowEditModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">入学年份</label>
                  <input
                    type="number"
                    value={formData.enrollment_year}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">班级序号</label>
                  <input
                    type="text"
                    value={formData.class_no}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">教室位置</label>
                <input
                  type="text"
                  value={formData.classroom_location}
                  onChange={(e) => setFormData({...formData, classroom_location: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="active">在读</option>
                  <option value="inactive">已毕业</option>
                </select>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={classSaving}
                  className={`px-4 py-2 rounded-lg ${
                    classSaving
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {classSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 班级详情弹窗 */}
      {showDetailModal && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {formatClassDisplayName(selectedClass)}
              </h2>
              <button onClick={() => setShowDetailModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            {(() => {
              const gradeInfo = getClassGradeInfo(selectedClass);
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-500">班级名称</p>
                      <p className="font-bold text-blue-600">{formatClassDisplayName(selectedClass)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">入学年份</p>
                      <p className="font-medium">{selectedClass.enrollment_year}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">当前年级</p>
                      <p className="font-medium">{gradeInfo?.name || '未知'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">教室位置</p>
                      <p className="font-medium">{selectedClass.classroom_location || '未设置'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">状态</p>
                      <p className="font-medium">{getStatusBadge(selectedClass.status)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">创建时间</p>
                      <p className="font-medium">{selectedClass.created_at}</p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>提示：</strong>班主任和任课教师请在"职务管理"模块中设置
                    </p>
                  </div>

                  <div className="flex justify-end pt-4">
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

      {/* 导入弹窗 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">导入班级数据</h2>
              <button onClick={() => setShowImportModal(false)}><X className="w-6 h-6 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">下载导入模板</p>
                    <p className="text-xs text-blue-700 mt-1">请使用标准模板格式导入班级基础信息</p>
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
                  disabled={classImporting}
                  className={`px-4 py-2 rounded-lg ${
                    classImporting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {classImporting ? '处理中...' : '预览导入'}
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
        title="班级导入预览"
        columns={[
          { key: 'class_no', label: '班级序号' },
          { key: 'enrollment_year', label: '入学年份' },
          { key: 'classroom_location', label: '教室位置' },
          {
            key: 'status',
            label: '状态',
            render: value => value === 'inactive' ? '已毕业' : '在读'
          }
        ]}
      />
    </div>
  );
};

export default ClassManagement;
