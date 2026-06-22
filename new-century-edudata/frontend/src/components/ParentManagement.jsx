import React, { useCallback, useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  Phone,
  Mail,
  UserCircle,
  GraduationCap,
  Link,
  CheckCircle,
  X,
  Eye,
  Download,
  Upload,
  FileSpreadsheet,
  Square,
  CheckSquare
} from 'lucide-react';
import schoolData from '../data/schoolData';
import { notify } from '../lib/notify';
import {
  buildParentImport,
  commitParentImport,
  parseParentImportText,
} from '../lib/parentImport';
import {
  bindParentStudent,
  createParentRecord,
  fetchParentList,
  unbindParentStudent,
  updateParentRecord,
} from '../lib/parentManagementApi';
import { hasBackendAuthToken } from '../lib/sessionToken';
import { useConfirm } from './ui/confirm';

const hasBackendSession = hasBackendAuthToken;

const isSensitiveImportHeader = (header) => ['初始密码', '密码', 'password', 'initial_password'].includes(header);

const ParentManagement = () => {
  const { confirm: confirmAction } = useConfirm();
  const [parents, setParents] = useState([]);
  const [parentSyncSource, setParentSyncSource] = useState('local');
  const [parentListLoading, setParentListLoading] = useState(false);
  const [parentListError, setParentListError] = useState('');
  const [parentSaving, setParentSaving] = useState(false);
  const [parentImporting, setParentImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBindModal, setShowBindModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    initial_password: '',
    relation: '父亲',
    status: 'active'
  });

  const [bindForm, setBindForm] = useState({
    student_id: '',
    relation: '父亲'
  });
  const [importText, setImportText] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importHeaders, setImportHeaders] = useState([]);
  const [importRows, setImportRows] = useState([]);
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = React.useRef(null);
  const skipInitialParentSync = React.useRef(true);
  const localParentCacheRef = React.useRef([]);
  const backendSessionActive = hasBackendSession();

  useEffect(() => {
    const localParents = schoolData.parents || [];
    localParentCacheRef.current = localParents;
    setParents(localParents);
  }, []);

  const refreshParents = useCallback(async () => {
    if (!hasBackendSession()) {
      setParentSyncSource('local');
      return null;
    }

    setParentListLoading(true);
    try {
      const payload = await fetchParentList({ pageSize: 100 });
      const remoteParents = payload.parents || [];
      if (remoteParents.length === 0 && localParentCacheRef.current.length > 0) {
        setParents(localParentCacheRef.current);
        setParentSyncSource('local');
        setParentListError('后端家长库暂无家长记录，当前显示本地真实导入数据。');
        return {
          ...payload,
          parents: localParentCacheRef.current,
          source: 'local-fallback',
        };
      }

      setParents(remoteParents);
      if (remoteParents.length > 0) {
        localParentCacheRef.current = remoteParents;
      }
      setParentSyncSource('backend');
      setParentListError('');
      return payload;
    } catch (error) {
      setParentSyncSource('local');
      setParentListError(`后端家长库暂不可用，当前显示本地缓存：${error.message || '连接失败'}`);
      return null;
    } finally {
      setParentListLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshParents();
  }, [refreshParents]);

  useEffect(() => {
    if (skipInitialParentSync.current) {
      skipInitialParentSync.current = false;
      return;
    }
    schoolData.parents = parents;
    if (parents.length > 0) {
      localParentCacheRef.current = parents;
    }
  }, [parents]);

  // 获取家长关联的学生信息（从schoolData查询）
  const getParentChildren = (parent) => {
    if (Array.isArray(parent.students) && parent.students.length > 0) {
      return parent.students.map(student => ({
        id: Number(student.student_id || student.id),
        name: student.name,
        student_code: student.student_code,
        class_id: Number(student.class_id) || student.class_id,
        class_name: student.class_name || student.class_id || '未分配班级'
      }));
    }
    if (!parent.student_ids || parent.student_ids.length === 0) {
      return [];
    }
    return parent.student_ids.map(studentId => {
      const student = schoolData.getStudentById(studentId);
      if (student) {
        const classInfo = schoolData.getClassById(student.class_id);
        return {
          id: student.id,
          name: student.name,
          student_code: student.student_code,
          class_id: student.class_id,
          class_name: classInfo ? schoolData.formatClassName(classInfo.id) : '未分配班级'
        };
      }
      return null;
    }).filter(Boolean);
  };

  // 获取家长关联的班级信息
  const getParentClasses = (parent) => {
    const children = getParentChildren(parent);
    const classIds = [...new Set(children.map(c => c.class_id).filter(Boolean))];
    return classIds.map(classId => {
      const cls = schoolData.getClassById(classId);
      return cls ? schoolData.formatClassName(cls.id) : '';
    }).filter(Boolean);
  };

  // 下载导入模板
  const downloadTemplate = () => {
    const headers = ['家长姓名', '与学生关系(父亲/母亲/爷爷/奶奶/外公/外婆/其他)', '联系电话', '邮箱(可选)', '初始密码', '学生学籍辅号', '学生姓名', '状态(正常/停用)'];
    const sampleData = [
      ['张大明', '父亲', '13800138001', '', 'ChangeMe123', '20240701001', '张三', '正常'],
      ['李秀英', '母亲', '13800138002', '', 'ChangeMe123', '20240701002', '李四', '正常'],
    ];
    
    const csvContent = [headers.join(','), ...sampleData.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '家长导入模板.csv';
    link.click();
  };

  // 导出家长数据
  const exportData = () => {
    const headers = ['家长姓名', '关系', '联系电话', '邮箱', '绑定学生数', '关联班级', '状态'];
    const data = filteredParents.map(p => {
      const children = getParentChildren(p);
      const classes = getParentClasses(p);
      return [
        p.name, p.relation, p.phone, p.email || '', 
        children.length, classes.join(';'),
        p.status === 'active' ? '正常' : '停用'
      ];
    });
    
    const csvContent = [headers.join(','), ...data.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `家长名单_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  const resetImportState = () => {
    setImportText('');
    setImportFileName('');
    setImportHeaders([]);
    setImportRows([]);
    setImportPreview(null);
    setImportError('');
    setImportResult(null);
  };

  const previewImport = (text) => {
    if (!text.trim()) {
      setImportHeaders([]);
      setImportRows([]);
      setImportPreview(null);
      setImportError('');
      setImportResult(null);
      return null;
    }

    try {
      const parsed = parseParentImportText(text);
      const result = buildParentImport({
        parsedRows: parsed.rows,
        parents,
        students: schoolData.students || [],
      });
      setImportHeaders(parsed.headers);
      setImportRows(parsed.rows);
      setImportPreview(result);
      setImportResult(null);
      setImportError(result.items.length === 0 ? (result.errors[0] || '没有可导入的数据') : '');
      return result;
    } catch (error) {
      setImportHeaders([]);
      setImportRows([]);
      setImportPreview(null);
      setImportError(error.message);
      setImportResult(null);
      return null;
    }
  };

  const handleImportFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const text = readerEvent.target?.result || '';
      setImportFileName(file.name);
      setImportText(text);
      previewImport(text);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // 处理导入
  const handleImport = async () => {
    const result = importPreview || previewImport(importText);
    if (!result || result.items.length === 0) {
      setImportError(result?.errors?.[0] || '没有可导入的数据');
      return;
    }

    if (hasBackendSession()) {
      const missingPasswordItems = result.items.filter(item => (
        item.type === 'new' && String(item.data?.initial_password || '').trim().length < 6
      ));
      if (missingPasswordItems.length > 0) {
        setImportError(`有 ${missingPasswordItems.length} 位新增家长缺少至少 6 位初始密码。`);
        return;
      }

      setParentImporting(true);
      try {
        for (const item of result.items) {
          const data = item.data || {};
          let parentId = item.existingData?.id;
          if (item.type === 'new') {
            const created = await createParentRecord(data);
            if (created?.success === false) {
              throw new Error(created.message || `${data.name || data.phone} 创建失败`);
            }
            parentId = created.parent_id;
          } else if (parentId) {
            const updated = await updateParentRecord(parentId, data);
            if (updated?.success === false) {
              throw new Error(updated.message || `${data.name || data.phone} 更新失败`);
            }
          }

          if (parentId) {
            for (const studentId of data.student_ids || []) {
              const bound = await bindParentStudent({
                parentId,
                studentId,
                relation: data.relation,
              });
              if (bound?.success === false) {
                throw new Error(bound.message || `${data.name || data.phone} 绑定学生失败`);
              }
            }
          }
        }
        await refreshParents();
        setImportResult(result);
        setImportError(result.errors.length ? `已写入有效家长数据，但有 ${result.errors.length} 行需要检查。` : '');
        notify(`家长导入完成：新增 ${result.insertedCount} 条，更新 ${result.updatedCount} 条，绑定学生 ${result.boundStudentCount} 人次。`, result.errors.length ? 'warning' : 'success');
        return;
      } catch (error) {
        setImportError(error.message || '后端家长导入失败');
        notify('家长导入失败：' + (error.message || '请稍后重试'), 'error');
        return;
      } finally {
        setParentImporting(false);
      }
    }

    const updatedParents = commitParentImport({ parents, importResult: result });
    setParents(updatedParents);
    setImportResult(result);
    setImportError(result.errors.length ? `已写入有效家长数据，但有 ${result.errors.length} 行需要检查。` : '');
    notify(`家长导入完成：新增 ${result.insertedCount} 条，更新 ${result.updatedCount} 条，绑定学生 ${result.boundStudentCount} 人次。`, result.errors.length ? 'warning' : 'success');
  };

  const handleAddParent = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      initial_password: '',
      relation: '父亲',
      status: 'active'
    });
    setShowAddModal(true);
  };

  const handleEditParent = (parent) => {
    setSelectedParent(parent);
    setFormData({
      name: parent.name,
      phone: parent.phone,
      email: parent.email,
      initial_password: '',
      relation: parent.relation,
      status: parent.status
    });
    setShowEditModal(true);
  };

  const handleViewDetail = (parent) => {
    setSelectedParent(parent);
    setShowDetailModal(true);
  };

  const handleBindStudent = (parent) => {
    setSelectedParent(parent);
    setBindForm({
      student_id: '',
      relation: parent.relation || '父亲'
    });
    setShowBindModal(true);
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    if (hasBackendSession()) {
      if (formData.initial_password.trim().length < 6) {
        notify('后端创建家长账号时，初始密码至少需要 6 位。', 'warning');
        return;
      }
      setParentSaving(true);
      try {
        const result = await createParentRecord(formData);
        if (result?.success === false) {
          notify(result.message || '家长账号创建失败', 'warning');
          return;
        }
        await refreshParents();
        setShowAddModal(false);
        notify(result?.message || '家长账号创建成功！', 'success');
      } catch (error) {
        notify('家长账号创建失败：' + (error.message || '请稍后重试'), 'error');
      } finally {
        setParentSaving(false);
      }
      return;
    }

    const localParentData = { ...formData };
    delete localParentData.initial_password;
    const newParent = {
      id: parents.length + 1,
      ...localParentData,
      created_at: new Date().toISOString().split('T')[0],
      student_ids: []
    };
    const updatedParents = [...parents, newParent];
    setParents(updatedParents);
    setShowAddModal(false);
    notify('家长添加成功！');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (selectedParent) {
      if (hasBackendSession()) {
        setParentSaving(true);
        try {
          const result = await updateParentRecord(selectedParent.id, formData);
          if (result?.success === false) {
            notify(result.message || '家长信息更新失败', 'warning');
            return;
          }
          await refreshParents();
          setShowEditModal(false);
          notify(result?.message || '家长信息更新成功！', 'success');
        } catch (error) {
          notify('家长信息更新失败：' + (error.message || '请稍后重试'), 'error');
        } finally {
          setParentSaving(false);
        }
        return;
      }

      const localParentData = { ...formData };
      delete localParentData.initial_password;
      const updatedParents = parents.map(p =>
        p.id === selectedParent.id
          ? { ...p, ...localParentData }
          : p
      );
      setParents(updatedParents);
      setShowEditModal(false);
      notify('家长信息更新成功！');
    }
  };

  const handleSaveBind = async (e) => {
    e.preventDefault();
    if (selectedParent && bindForm.student_id) {
      const studentId = parseInt(bindForm.student_id);
      if (hasBackendSession()) {
        setParentSaving(true);
        try {
          const result = await bindParentStudent({
            parentId: selectedParent.id,
            studentId,
            relation: bindForm.relation,
          });
          if (result?.success === false) {
            notify(result.message || '学生绑定失败', 'warning');
            return;
          }
          await refreshParents();
          setShowBindModal(false);
          notify(result?.message || '学生绑定成功！', 'success');
        } catch (error) {
          notify('学生绑定失败：' + (error.message || '请稍后重试'), 'error');
        } finally {
          setParentSaving(false);
        }
        return;
      }

      const student = schoolData.getStudentById(studentId);
      if (student) {
        const currentStudentIds = selectedParent.student_ids || [];
        if (!currentStudentIds.includes(studentId)) {
          const updatedParents = parents.map(p =>
            p.id === selectedParent.id
              ? { ...p, student_ids: [...currentStudentIds, studentId] }
              : p
          );
          setParents(updatedParents);
          setShowBindModal(false);
          notify('学生绑定成功！');
        } else {
          notify('该学生已绑定');
        }
      }
    }
  };

  const handleDeleteParent = async (id) => {
    const confirmed = await confirmAction({
      title: hasBackendSession() ? '停用家长账号' : '删除家长',
      message: hasBackendSession()
        ? '确定要停用这位家长账号吗？学生绑定关系会保留。'
        : '确定要删除这位家长吗？',
      confirmText: hasBackendSession() ? '停用账号' : '删除'
    });
    if (!confirmed) return;

    if (hasBackendSession()) {
      const parent = parents.find(p => p.id === id);
      if (!parent) return;
      try {
        const result = await updateParentRecord(id, { ...parent, status: 'inactive' });
        if (result?.success === false) {
          notify(result.message || '家长账号停用失败', 'warning');
          return;
        }
        await refreshParents();
        notify(result?.message || '家长账号已停用', 'success');
      } catch (error) {
        notify('家长账号停用失败：' + (error.message || '请稍后重试'), 'error');
      }
      return;
    }

    const updatedParents = parents.filter(p => p.id !== id);
    setParents(updatedParents);
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
    if (selectedIds.length === filteredParents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredParents.map(p => p.id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) {
      notify('请先选择要删除的家长');
      return;
    }
    const confirmed = await confirmAction({
      title: hasBackendSession() ? '批量停用家长账号' : '批量删除家长',
      message: hasBackendSession()
        ? `确定要停用选中的 ${selectedIds.length} 位家长账号吗？学生绑定关系会保留。`
        : `确定要删除选中的 ${selectedIds.length} 位家长吗？`,
      confirmText: hasBackendSession() ? '批量停用' : '批量删除'
    });
    if (!confirmed) return;

    if (hasBackendSession()) {
      try {
        const targets = parents.filter(parent => selectedIds.includes(parent.id));
        for (const parent of targets) {
          await updateParentRecord(parent.id, { ...parent, status: 'inactive' });
        }
        await refreshParents();
        setSelectedIds([]);
        notify(`已停用 ${targets.length} 位家长账号。`, 'success');
      } catch (error) {
        notify('批量停用失败：' + (error.message || '请稍后重试'), 'error');
      }
      return;
    }

    const updatedParents = parents.filter(p => !selectedIds.includes(p.id));
    setParents(updatedParents);
    setSelectedIds([]);
    notify('批量删除成功！');
  };

  const handleUnbindStudent = async (parentId, studentId) => {
    const confirmed = await confirmAction({
      title: '解除学生绑定',
      message: '确定要解除与该学生的绑定关系吗？',
      confirmText: '解除绑定'
    });
    if (!confirmed) return;

    if (hasBackendSession()) {
      try {
        const result = await unbindParentStudent({ parentId, studentId });
        if (result?.success === false) {
          notify(result.message || '解除绑定失败', 'warning');
          return;
        }
        await refreshParents();
        notify(result?.message || '学生绑定已解除', 'success');
      } catch (error) {
        notify('解除绑定失败：' + (error.message || '请稍后重试'), 'error');
      }
      return;
    }

    const updatedParents = parents.map(p =>
      p.id === parentId
        ? { ...p, student_ids: (p.student_ids || []).filter(id => id !== studentId) }
        : p
    );
    setParents(updatedParents);
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800'
    };
    const labels = {
      active: '正常',
      inactive: '停用'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const filteredParents = parents.filter(parent => {
    const keyword = searchTerm.toLowerCase();
    const matchSearch = String(parent.name || '').toLowerCase().includes(keyword) ||
                       String(parent.phone || '').includes(searchTerm);
    const matchStatus = filterStatus === 'all' || parent.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: parents.length,
    active: parents.filter(p => p.status === 'active').length,
    bound: parents.filter(p => (p.student_ids || []).length > 0).length,
    totalChildren: parents.reduce((sum, p) => sum + (p.student_ids || []).length, 0)
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">家长管理</h1>
        <p className="text-gray-500 mt-1">管理家长信息、学生绑定关系（通过学生关联班级）</p>
      </div>

      {(parentListLoading || parentListError || parentSyncSource === 'backend') && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
          parentListError
            ? 'border-amber-100 bg-amber-50 text-amber-700'
            : 'border-emerald-100 bg-emerald-50 text-emerald-700'
        }`}>
          {parentListError ? <X className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          <span>
            {parentListLoading
              ? '正在同步后端家长库...'
              : parentListError || '已连接后端家长库，家长账号和学生绑定来自数据库。'}
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
              <p className="text-sm text-gray-500">家长总数</p>
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
              <p className="text-sm text-gray-500">正常家长</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <Link className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">已绑定学生</p>
              <p className="text-2xl font-bold text-purple-600">{stats.bound}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-orange-100 text-orange-600">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">绑定学生数</p>
              <p className="text-2xl font-bold text-orange-600">{stats.totalChildren}</p>
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
                placeholder="搜索家长姓名或电话..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-64"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">全部状态</option>
              <option value="active">正常</option>
              <option value="inactive">停用</option>
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
                {backendSessionActive ? '批量停用' : '批量删除'} ({selectedIds.length})
              </button>
            )}
            <button 
              onClick={() => {
                resetImportState();
                setShowImportModal(true);
              }}
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
              onClick={handleAddParent}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              添加家长
            </button>
          </div>
        </div>
      </div>

      {/* 家长列表 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <button 
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 hover:text-blue-600"
                >
                  {selectedIds.length === filteredParents.length && filteredParents.length > 0 ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  全选
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">家长姓名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">关系</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">联系电话</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">绑定学生</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">关联班级</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredParents.map((parent) => {
              const children = getParentChildren(parent);
              const classes = getParentClasses(parent);
              return (
                <tr key={parent.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      onClick={() => toggleSelect(parent.id)}
                      className="text-gray-400 hover:text-blue-600"
                    >
                      {selectedIds.includes(parent.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <UserCircle className="h-6 w-6 text-purple-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{parent.name}</div>
                        <div className="text-sm text-gray-500">{parent.email || '未设置邮箱'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{parent.relation}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{parent.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {children.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {children.map(child => (
                          <span key={child.id} className="text-sm text-gray-700">
                            {child.name} ({child.student_code})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">未绑定</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {classes.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {classes.map((cls, idx) => (
                          <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {cls}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(parent.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetail(parent)}
                        className="text-blue-600 hover:text-blue-900"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleBindStudent(parent)}
                        className="text-green-600 hover:text-green-900"
                        title="绑定学生"
                      >
                        <Link className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditParent(parent)}
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
                          handleDeleteParent(parent.id);
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

      {/* 添加家长弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">添加家长</h2>
              <button onClick={() => setShowAddModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleSaveAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">家长姓名 *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">与学生关系 *</label>
                <select
                  required
                  value={formData.relation}
                  onChange={(e) => setFormData({...formData, relation: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="父亲">父亲</option>
                  <option value="母亲">母亲</option>
                  <option value="爷爷">爷爷</option>
                  <option value="奶奶">奶奶</option>
                  <option value="外公">外公</option>
                  <option value="外婆">外婆</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系电话 *</label>
                <input
                  type="tel"
                  required
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
                  <p className="text-xs text-gray-500 mt-1">用于创建家长登录账号，至少 6 位。</p>
                </div>
              )}
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
                  disabled={parentSaving}
                  className={`px-4 py-2 rounded-lg ${
                    parentSaving
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {parentSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 编辑家长弹窗 */}
      {showEditModal && selectedParent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">编辑家长信息</h2>
              <button onClick={() => setShowEditModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">家长姓名</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">与学生关系</label>
                <select
                  value={formData.relation}
                  onChange={(e) => setFormData({...formData, relation: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="父亲">父亲</option>
                  <option value="母亲">母亲</option>
                  <option value="爷爷">爷爷</option>
                  <option value="奶奶">奶奶</option>
                  <option value="外公">外公</option>
                  <option value="外婆">外婆</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系电话</label>
                <input
                  type="tel"
                  required
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
                <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="active">正常</option>
                  <option value="inactive">停用</option>
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
                  disabled={parentSaving}
                  className={`px-4 py-2 rounded-lg ${
                    parentSaving
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {parentSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 绑定学生弹窗 */}
      {showBindModal && selectedParent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">绑定学生</h2>
              <button onClick={() => setShowBindModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600">家长：{selectedParent.name} ({selectedParent.relation})</p>
            </div>
            <form onSubmit={handleSaveBind} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择学生 *</label>
                <select
                  required
                  value={bindForm.student_id}
                  onChange={(e) => setBindForm({...bindForm, student_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">请选择学生</option>
                  {schoolData.students
                    .filter(s => !(selectedParent.student_ids || []).includes(s.id))
                    .map(student => (
                      <option key={student.id} value={student.id}>
                        {student.name} - {schoolData.formatClassName(student.class_id)} ({student.student_code})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">关系确认</label>
                <input
                  type="text"
                  value={bindForm.relation}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">关系继承自家长信息</p>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowBindModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={parentSaving}
                  className={`px-4 py-2 rounded-lg ${
                    parentSaving
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {parentSaving ? '绑定中...' : '绑定'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 家长详情弹窗 */}
      {showDetailModal && selectedParent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">家长详情</h2>
              <button onClick={() => setShowDetailModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                  <UserCircle className="w-10 h-10 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{selectedParent.name}</h3>
                  <p className="text-sm text-gray-500">{selectedParent.relation}</p>
                  {getStatusBadge(selectedParent.status)}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{selectedParent.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{selectedParent.email || '未设置'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">注册时间：{selectedParent.created_at}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h4 className="font-medium text-gray-800 mb-3">绑定学生</h4>
                {(() => {
                  const children = getParentChildren(selectedParent);
                  return children.length > 0 ? (
                    <div className="space-y-2">
                      {children.map(child => (
                        <div key={child.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-800">{child.name}</p>
                            <p className="text-sm text-gray-500">{child.class_name} | 学号：{child.student_code}</p>
                          </div>
                          <button
                            onClick={() => handleUnbindStudent(selectedParent.id, child.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            解除绑定
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">暂无绑定学生</p>
                  );
                })()}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleBindStudent(selectedParent);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  绑定学生
                </button>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 导入弹窗 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-5xl m-4 max-h-[92vh] overflow-y-auto p-6">
            <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800">导入家长数据</h2>
                <p className="mt-1 text-sm text-gray-500">通过学籍辅号绑定学生，确认前会预检新增、更新和异常行。</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="self-end md:self-start">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">下载导入模板</p>
                    <p className="text-xs text-blue-700 mt-1">字段包含家长姓名、关系、联系电话、初始密码、学生学籍辅号和状态。</p>
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

                <button
                  type="button"
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">
                    {importFileName || '选择 CSV/TSV 文件'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">也可以从 Excel 复制后粘贴到右侧</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt"
                    className="hidden"
                    onChange={handleImportFileChange}
                  />
                </button>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">粘贴家长绑定表</label>
                <textarea
                  value={importText}
                  onChange={(event) => {
                    setImportText(event.target.value);
                    setImportFileName('');
                    previewImport(event.target.value);
                  }}
                  className="h-56 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="家长姓名\t与学生关系\t联系电话\t邮箱\t初始密码\t学生学籍辅号\t学生姓名\t状态"
                />
              </div>
            </div>

            {importError && (
              <div className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-sm ${importResult ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>
                <X className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {importPreview && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    ['新增', importPreview.insertedCount],
                    ['更新', importPreview.updatedCount],
                    ['绑定学生', importPreview.boundStudentCount],
                    ['需检查', importPreview.errors.length],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                    <p className="font-medium text-gray-800">解析预览</p>
                    <p className="text-sm text-gray-500">共 {importRows.length} 行，仅显示前 20 行</p>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr>
                          {importHeaders.map(header => (
                            <th key={header} className="px-3 py-2 text-left font-medium text-gray-500">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {importRows.slice(0, 20).map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {importHeaders.map(header => (
                              <td key={header} className="whitespace-nowrap px-3 py-2 text-gray-700">
                                {isSensitiveImportHeader(header) && row[header] ? '已填写' : row[header] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {importPreview.errors.length > 0 && (
                  <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                    <p className="font-medium">需检查行</p>
                    <ul className="mt-2 space-y-1">
                      {importPreview.errors.slice(0, 8).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {importResult && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle className="h-4 w-4" />
                <span>家长档案和学生绑定已写入。</span>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={!importPreview?.items?.length || parentImporting}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {parentImporting ? '写入中...' : '确认写入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentManagement;
