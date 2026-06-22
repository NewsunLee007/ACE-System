import React, { useCallback, useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  BookOpen,
  X,
  CheckCircle,
  Download,
  Upload,
  Square,
  CheckSquare,
  GraduationCap
} from 'lucide-react';
import {
  addLocalSubject,
  createSubject,
  deleteLocalSubjects,
  deleteSubject,
  deleteSubjects,
  getLocalSubjectRows,
  loadSubjectCatalog,
  normalizeSubjectList,
  shouldUseLocalSubjectFallback,
  syncSubjectRowsToSchoolData,
  updateLocalSubject,
  updateSubject
} from '../lib/subjectCatalog';
import { notify, notifyError, notifySuccess, notifyWarning } from '../lib/notify';
import SmartImportModal from './SmartImportModal';
import ConfirmDialog from './ConfirmDialog';

const SubjectManagement = () => {
  const [subjects, setSubjects] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dataSource, setDataSource] = useState('local');
  const fileInputRef = React.useRef(null);
  
  // 智能导入相关状态
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState([]);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null });

  const loadSubjects = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const result = await loadSubjectCatalog();
      setSubjects(result.subjects);
      setDataSource(result.source);
      if (result.source === 'local' && !silent) {
        notifyWarning('后端学科接口暂不可用，当前使用本地数据');
      }
    } catch (error) {
      setSubjects(getLocalSubjectRows());
      setDataSource('local');
      if (!silent) notifyError(error.message || '学科数据加载失败');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => subjects.some(subject => Number(subject.id) === Number(id))));
  }, [subjects]);

  const getPayloadFromForm = () => ({
    name: formData.name.trim(),
    code: formData.code.trim(),
    description: formData.description.trim()
  });

  const hasDuplicateSubjectName = (name, ignoreId = null, list = subjects) => (
    list.some(subject => (
      subject.name === name && (ignoreId === null || Number(subject.id) !== Number(ignoreId))
    ))
  );

  const applyApiSubjects = (nextSubjects) => {
    const normalized = normalizeSubjectList(nextSubjects);
    syncSubjectRowsToSchoolData(normalized);
    setSubjects(normalized);
    setDataSource('api');
    return normalized;
  };

  const applyLocalSubjects = (nextSubjects) => {
    const normalized = normalizeSubjectList(nextSubjects);
    syncSubjectRowsToSchoolData(normalized);
    setSubjects(normalized);
    setDataSource('local');
    return normalized;
  };

  const runWithLocalFallback = async ({ apiAction, localAction }) => {
    try {
      return { value: await apiAction(), localOnly: false };
    } catch (error) {
      if (!shouldUseLocalSubjectFallback(error)) {
        notifyError(error.message || '操作失败');
        return null;
      }
      notifyWarning('后端暂不可用，已保存到本地数据');
      return { value: localAction(), localOnly: true };
    }
  };

  // 下载导入模板
  const downloadTemplate = () => {
    const headers = ['学科名称', '学科代码', '学科描述(可选)'];
    const comments = [
      '# 学科导入模板',
      '# 学科名称: 如 语文、数学、英语等',
      '# 学科代码: 学科简称，如 YW、SX、YY',
      '#',
      '# 示例：',
    ];
    const sampleData = [
      ['语文', 'YW', '基础学科'],
      ['数学', 'SX', '基础学科'],
      ['英语', 'YY', '外语学科'],
    ];

    const csvContent = [
      ...comments,
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '学科导入模板.csv';
    link.click();
  };

  // 导出学科数据
  const exportData = () => {
    const headers = ['学科名称', '学科代码', '学科描述'];
    const data = filteredSubjects.map(s => [s.name, s.code, s.description || '']);
    
    const csvContent = [headers.join(','), ...data.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `学科列表_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  // 智能导入 - 解析文件并显示预览
  const handleImportPreview = (content) => {
    const lines = content.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#');
    });

    if (lines.length < 2) {
      notify('文件格式错误');
      return;
    }

    const previewData = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length >= 1) {
        const name = cols[0]?.trim();
        const code = cols[1]?.trim() || name.substring(0, 2).toUpperCase();
        const description = cols[2]?.trim() || '';

        if (!name) continue;

        const existingSubject = subjects.find(subject => subject.name === name);

        if (existingSubject) {
          // 检查是否有变化（学科管理主要检查名称是否存在）
          previewData.push({
            type: 'unchanged',
            data: { name, code, description },
            existingData: existingSubject
          });
        } else {
          previewData.push({
            type: 'new',
            data: { name, code, description }
          });
        }
      }
    }

    setImportPreviewData(previewData);
    setShowSmartImport(true);
    setShowImportModal(false);
  };

  // 确认智能导入
  const handleConfirmImport = async (selectedData) => {
    let addedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let forceLocal = dataSource === 'local';
    let nextSubjects = subjects;

    setSaving(true);
    for (const item of selectedData) {
      if (item.type !== 'new') {
        skippedCount++;
        continue;
      }

      if (hasDuplicateSubjectName(item.data.name, null, nextSubjects)) {
        skippedCount++;
        continue;
      }

      if (forceLocal) {
        nextSubjects = addLocalSubject(nextSubjects, item.data);
        addedCount++;
        continue;
      }

      try {
        const created = await createSubject(item.data);
        nextSubjects = normalizeSubjectList([...nextSubjects, created]);
        addedCount++;
      } catch (error) {
        if (shouldUseLocalSubjectFallback(error)) {
          forceLocal = true;
          nextSubjects = addLocalSubject(nextSubjects, item.data);
          addedCount++;
        } else {
          failedCount++;
          notifyError(error.message || `导入 ${item.data.name} 失败`);
        }
      }
    }
    setSaving(false);

    if (forceLocal) {
      applyLocalSubjects(nextSubjects);
    } else {
      applyApiSubjects(nextSubjects);
    }
    setShowSmartImport(false);
    setImportFile(null);

    let message = `导入完成：新增 ${addedCount} 个学科`;
    if (skippedCount > 0) message += `，跳过 ${skippedCount} 个（已存在）`;
    if (failedCount > 0) message += `，失败 ${failedCount} 个`;
    if (forceLocal) message += '，当前为本地兜底保存';
    notify(message);
  };

  const handleAddSubject = () => {
    setFormData({ name: '', code: '', description: '' });
    setShowAddModal(true);
  };

  const handleEditSubject = (subject) => {
    setSelectedSubject(subject);
    setFormData({ name: subject.name, code: subject.code, description: subject.description });
    setShowEditModal(true);
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    const payload = getPayloadFromForm();
    if (!payload.name) {
      notify('学科名称不能为空');
      return;
    }

    if (hasDuplicateSubjectName(payload.name)) {
      notify('该学科已存在');
      return;
    }

    setSaving(true);
    const result = await runWithLocalFallback({
      apiAction: () => createSubject(payload),
      localAction: () => addLocalSubject(subjects, payload)
    });
    setSaving(false);
    if (!result) return;

    if (result.localOnly) {
      applyLocalSubjects(result.value);
    } else {
      applyApiSubjects([...subjects, result.value]);
    }
    setShowAddModal(false);
    notifySuccess(result.localOnly ? '学科已保存到本地' : '学科添加成功');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedSubject) return;

    const payload = getPayloadFromForm();
    if (!payload.name) {
      notify('学科名称不能为空');
      return;
    }
    if (hasDuplicateSubjectName(payload.name, selectedSubject.id)) {
      notify('该学科已存在');
      return;
    }

    setSaving(true);
    const result = await runWithLocalFallback({
      apiAction: () => updateSubject(selectedSubject.id, payload),
      localAction: () => updateLocalSubject(subjects, selectedSubject.id, payload)
    });
    setSaving(false);
    if (!result) return;

    if (result.localOnly) {
      applyLocalSubjects(result.value);
    } else {
      applyApiSubjects(subjects.map(subject => (
        Number(subject.id) === Number(selectedSubject.id) ? result.value : subject
      )));
    }
    setShowEditModal(false);
    notifySuccess(result.localOnly ? '学科已保存到本地' : '学科信息更新成功');
  };

  const closeConfirm = () => {
    setConfirmState({ open: false, title: '', message: '', onConfirm: null });
  };

  const openConfirm = ({ title, message, onConfirm }) => {
    setConfirmState({ open: true, title, message, onConfirm });
  };

  const deleteSubjectById = async (id) => {
    setSaving(true);
    const result = await runWithLocalFallback({
      apiAction: () => deleteSubject(id),
      localAction: () => deleteLocalSubjects(subjects, [id])
    });
    setSaving(false);
    if (!result) return;

    if (result.localOnly) {
      applyLocalSubjects(result.value);
    } else {
      const nextSubjects = subjects.filter(s => Number(s.id) !== Number(id));
      applyApiSubjects(nextSubjects);
    }
    notifySuccess(result.localOnly ? '学科已从本地删除' : '学科删除成功');
  };

  const handleDeleteSubject = (id) => {
    openConfirm({
      title: '删除学科',
      message: '确定要删除这个学科吗？',
      onConfirm: () => deleteSubjectById(id)
    });
  };

  // 批量选择
  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSubjects.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSubjects.map(s => s.id));
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) {
      notify('请先选择要删除的学科');
      return;
    }
    openConfirm({
      title: '批量删除学科',
      message: `确定要删除选中的 ${selectedIds.length} 个学科吗？`,
      onConfirm: async () => {
        setSaving(true);
        const ids = [...selectedIds];
        const result = await runWithLocalFallback({
          apiAction: () => deleteSubjects(ids),
          localAction: () => deleteLocalSubjects(subjects, ids)
        });
        setSaving(false);
        if (!result) return;

        if (result.localOnly) {
          applyLocalSubjects(result.value);
        } else {
          const idSet = new Set(ids.map(id => Number(id)));
          applyApiSubjects(subjects.filter(subject => !idSet.has(Number(subject.id))));
        }
        setSelectedIds([]);
        notifySuccess(result.localOnly ? '已从本地批量删除' : '批量删除成功');
      }
    });
  };

  const searchKeyword = searchTerm.trim().toLowerCase();
  const filteredSubjects = subjects.filter(s =>
    s.name.toLowerCase().includes(searchKeyword) ||
    s.code.toLowerCase().includes(searchKeyword)
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 页面标题 */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">学科管理</h1>
          <p className="text-gray-500 mt-1">管理系统学科信息，用于教师任教科目和课程设置</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`rounded-full border px-3 py-1 font-medium ${
            dataSource === 'api'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}>
            {dataSource === 'api' ? '后端同步' : '本地兜底'}
          </span>
          {loading ? <span className="text-gray-500">加载中...</span> : null}
          {saving ? <span className="text-blue-600">保存中...</span> : null}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-indigo-100 text-indigo-600">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">学科总数</p>
              <p className="text-2xl font-bold text-gray-800">{subjects.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">基础学科</p>
              <p className="text-2xl font-bold text-green-600">
                {subjects.filter(s => ['语文', '数学', '英语'].includes(s.name)).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">理科类</p>
              <p className="text-2xl font-bold text-blue-600">
                {subjects.filter(s => ['物理', '化学', '生物', '科学'].includes(s.name)).length}
              </p>
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
                placeholder="搜索学科名称..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-64"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <button 
                type="button"
                disabled={saving || loading}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleBatchDelete();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                批量删除 ({selectedIds.length})
              </button>
            )}
            <button 
              type="button"
              disabled={saving || loading}
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              导入
            </button>
            <button 
              type="button"
              disabled={saving || loading || filteredSubjects.length === 0}
              onClick={exportData}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Upload className="w-4 h-4" />
              导出
            </button>
            <button 
              type="button"
              disabled={saving || loading}
              onClick={handleAddSubject} 
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              添加学科
            </button>
          </div>
        </div>
      </div>

      {/* 学科列表 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <button 
                  type="button"
                  disabled={loading || filteredSubjects.length === 0}
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {selectedIds.length === filteredSubjects.length && filteredSubjects.length > 0 ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  全选
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">学科编号</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">学科名称</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">学科代码</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">描述</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                  正在加载学科目录...
                </td>
              </tr>
            ) : filteredSubjects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                  没有符合条件的学科
                </td>
              </tr>
            ) : filteredSubjects.map((subject) => (
              <tr key={subject.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <button 
                    type="button"
                    disabled={saving}
                    onClick={() => toggleSelect(subject.id)}
                    className="text-gray-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {selectedIds.includes(subject.id) ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{subject.id}</td>
                <td className="px-6 py-4 text-sm font-medium text-indigo-600">{subject.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{subject.code}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{subject.description || '-'}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      disabled={saving}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSubject(subject);
                      }}
                      className="text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                      title="编辑"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      disabled={saving}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteSubject(subject.id);
                      }}
                      className="text-red-600 hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-60"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 添加学科弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">添加学科</h2>
              <button onClick={() => setShowAddModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleSaveAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">学科名称 *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="如：语文"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">学科代码</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="如：YW（可选，默认取前两个字）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">学科描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows="3"
                  placeholder="学科描述（可选）"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 编辑学科弹窗 */}
      {showEditModal && selectedSubject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">编辑学科</h2>
              <button onClick={() => setShowEditModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">学科名称 *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">学科代码</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">学科描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows="3"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? '保存中...' : '保存'}
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
              <h2 className="text-xl font-bold text-gray-800">导入学科</h2>
              <button onClick={() => {setShowImportModal(false); setImportFile(null);}}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">导入说明</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 支持CSV格式文件</li>
                  <li>• 学科名称重复的将更新，不重复的将新增</li>
                  <li>• 请先下载模板查看格式</li>
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
                  type="button"
                  disabled={saving}
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="w-4 h-4" />
                  下载模板
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={saving || !importFile}
                    onClick={() => {setShowImportModal(false); setImportFile(null);}}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (importFile) {
                        const reader = new FileReader();
                        reader.onload = (ev) => handleImportPreview(ev.target.result);
                        reader.readAsText(importFile);
                      } else {
                        notify('请先选择文件');
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:opacity-100"
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
        title="学科导入预览"
        columns={[
          { key: 'name', label: '学科名称' },
          { key: 'code', label: '学科代码' },
          { key: 'description', label: '描述' }
        ]}
      />
      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onCancel={closeConfirm}
        onConfirm={() => {
          const fn = confirmState.onConfirm;
          closeConfirm();
          if (fn) fn();
        }}
      />
    </div>
  );
};

export default SubjectManagement;
