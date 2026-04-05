import React, { useState, useEffect } from 'react';
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
  FileSpreadsheet,
  Square,
  CheckSquare,
  GraduationCap,
  RefreshCw
} from 'lucide-react';
import schoolData from '../data/schoolData';
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
  const fileInputRef = React.useRef(null);
  
  // 智能导入相关状态
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState([]);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    // 从schoolData加载学科列表
    setSubjects(schoolData.subjects.map((name, index) => ({
      id: index + 1,
      name: name,
      code: name.substring(0, 2).toUpperCase(),
      description: ''
    })));
  }, []);

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
      alert('文件格式错误');
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

        // 查找是否已存在
        const existingIndex = schoolData.subjects.indexOf(name);
        const existingSubject = existingIndex !== -1 ? {
          id: existingIndex + 1,
          name: name,
          code: name.substring(0, 2).toUpperCase(),
          description: ''
        } : null;

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
  const handleConfirmImport = (selectedData) => {
    let addedCount = 0;
    let skippedCount = 0;

    selectedData.forEach(item => {
      if (item.type === 'new') {
        // 检查是否已存在（再次检查避免重复）
        if (!schoolData.subjects.includes(item.data.name)) {
          schoolData.subjects.push(item.data.name);
          addedCount++;
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    });

    // 刷新列表
    setSubjects(schoolData.subjects.map((name, index) => ({
      id: index + 1,
      name: name,
      code: name.substring(0, 2).toUpperCase(),
      description: ''
    })));

    setShowSmartImport(false);
    setImportFile(null);

    let message = `导入完成：新增 ${addedCount} 个学科`;
    if (skippedCount > 0) message += `，跳过 ${skippedCount} 个（已存在）`;
    alert(message);
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

  const handleSaveAdd = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('学科名称不能为空');
      return;
    }

    // 检查是否已存在
    if (schoolData.subjects.includes(formData.name)) {
      alert('该学科已存在');
      return;
    }

    schoolData.subjects.push(formData.name);
    setSubjects([...subjects, {
      id: subjects.length + 1,
      name: formData.name,
      code: formData.code || formData.name.substring(0, 2).toUpperCase(),
      description: formData.description
    }]);
    setShowAddModal(false);
    alert('学科添加成功！');
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (selectedSubject) {
      // 更新schoolData中的学科名称
      const index = schoolData.subjects.indexOf(selectedSubject.name);
      if (index !== -1) {
        schoolData.subjects[index] = formData.name;
      }

      const updatedSubjects = subjects.map(s => 
        s.id === selectedSubject.id 
          ? { ...s, name: formData.name, code: formData.code, description: formData.description }
          : s
      );
      setSubjects(updatedSubjects);
      setShowEditModal(false);
      alert('学科信息更新成功！');
    }
  };

  const closeConfirm = () => {
    setConfirmState({ open: false, title: '', message: '', onConfirm: null });
  };

  const openConfirm = ({ title, message, onConfirm }) => {
    setConfirmState({ open: true, title, message, onConfirm });
  };

  const deleteSubjectById = (id) => {
    const subject = subjects.find(s => s.id === id);
    if (subject) {
      const index = schoolData.subjects.indexOf(subject.name);
      if (index !== -1) {
        schoolData.subjects.splice(index, 1);
      }
    }
    setSubjects(subjects.filter(s => s.id !== id));
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
      alert('请先选择要删除的学科');
      return;
    }
    openConfirm({
      title: '批量删除学科',
      message: `确定要删除选中的 ${selectedIds.length} 个学科吗？`,
      onConfirm: () => {
        selectedIds.forEach(id => {
          const subject = subjects.find(s => s.id === id);
          if (subject) {
            const index = schoolData.subjects.indexOf(subject.name);
            if (index !== -1) {
              schoolData.subjects.splice(index, 1);
            }
          }
        });
        setSubjects(subjects.filter(s => !selectedIds.includes(s.id)));
        setSelectedIds([]);
        alert('批量删除成功！');
      }
    });
  };

  const filteredSubjects = subjects.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">学科管理</h1>
        <p className="text-gray-500 mt-1">管理系统学科信息，用于教师任教科目和课程设置</p>
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
              onClick={handleAddSubject} 
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
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
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 hover:text-blue-600"
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
            {filteredSubjects.map((subject) => (
              <tr key={subject.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <button 
                    onClick={() => toggleSelect(subject.id)}
                    className="text-gray-400 hover:text-blue-600"
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSubject(subject);
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
                        handleDeleteSubject(subject.id);
                      }}
                      className="text-red-600 hover:text-red-900"
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
                  onClick={() => setShowAddModal(false)}
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
                  onClick={() => setShowEditModal(false)}
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
                    onClick={() => {
                      if (importFile) {
                        const reader = new FileReader();
                        reader.onload = (ev) => handleImportPreview(ev.target.result);
                        reader.readAsText(importFile);
                      } else {
                        alert('请先选择文件');
                      }
                    }}
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
