import React, { useState, useEffect } from 'react';
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
  MessageSquare,
  Send,
  Download,
  Upload,
  FileSpreadsheet,
  Square,
  CheckSquare
} from 'lucide-react';
import schoolData from '../data/schoolData';

const ParentManagement = () => {
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(false);
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
    relation: '父亲',
    status: 'active'
  });

  const [bindForm, setBindForm] = useState({
    student_id: '',
    relation: '父亲'
  });
  const [importFile, setImportFile] = useState(null);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    // 从schoolData加载家长数据
    setParents(schoolData.parents || []);
  }, []);

  // 获取家长关联的学生信息（从schoolData查询）
  const getParentChildren = (parent) => {
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
    const headers = ['家长姓名', '与学生关系(父亲/母亲/爷爷/奶奶/外公/外婆/其他)', '联系电话', '邮箱(可选)', '学生学籍辅号', '学生姓名', '状态(正常/停用)'];
    const sampleData = [
      ['张大明', '父亲', '13800138001', '', '20240701001', '张三', '正常'],
      ['李秀英', '母亲', '13800138002', '', '20240701002', '李四', '正常'],
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

  // 处理导入
  const handleImport = () => {
    if (!importFile) {
      alert('请先选择要导入的文件');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('文件格式错误：缺少表头或数据行');
        return;
      }
      
      // 跳过标题行，解析数据
      const newParents = [];
      const errors = [];
      
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length >= 3) {
          const name = cols[0]?.trim();
          const relation = cols[1]?.trim();
          const phone = cols[2]?.trim();
          const email = cols[3]?.trim();
          const studentCode = cols[4]?.trim();
          const studentName = cols[5]?.trim();
          const status = cols[6]?.trim();

          // 验证必填字段
          if (!name) {
            errors.push(`第${i + 1}行: 家长姓名不能为空`);
            continue;
          }
          if (!phone) {
            errors.push(`第${i + 1}行: 联系电话不能为空`);
            continue;
          }

          // 查找学生ID（通过学籍号）
          const studentIds = [];
          if (studentCode) {
            const student = schoolData.students.find(s => s.student_code === studentCode);
            if (student) {
              // 验证学生姓名是否匹配
              if (studentName && student.name !== studentName) {
                errors.push(`第${i + 1}行: 学籍号 "${studentCode}" 对应的学生姓名是 "${student.name}"，但您填写的是 "${studentName}"，请核对`);
                continue;
              }
              studentIds.push(student.id);
            } else {
              errors.push(`第${i + 1}行: 学籍辅号 "${studentCode}" 不存在，请先导入该学生`);
              continue;
            }
          } else {
            errors.push(`第${i + 1}行: 学生学籍辅号不能为空`);
            continue;
          }

          newParents.push({
            id: Date.now() + i,
            name: name,
            relation: relation || '父亲',
            phone: phone,
            email: email || '',
            status: status === '停用' ? 'inactive' : 'active',
            created_at: new Date().toISOString().split('T')[0],
            student_ids: studentIds
          });
        }
      }
      
      // 显示结果
      let message = '';
      if (newParents.length > 0) {
        const updatedParents = [...parents, ...newParents];
        setParents(updatedParents);
        // 同步到schoolData
        schoolData.parents = updatedParents;
        message += `成功导入 ${newParents.length} 条家长数据\n`;
      }
      
      if (errors.length > 0) {
        message += `\n错误信息（前5条）：\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          message += `\n...还有 ${errors.length - 5} 条错误`;
        }
      }
      
      if (newParents.length === 0 && errors.length === 0) {
        message = '未能解析到有效数据，请检查文件格式';
      }
      
      alert(message);
      
      if (newParents.length > 0) {
        setShowImportModal(false);
        setImportFile(null);
      }
    };
    
    reader.readAsText(importFile);
  };

  const handleAddParent = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
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

  const handleSaveAdd = (e) => {
    e.preventDefault();
    const newParent = {
      id: parents.length + 1,
      ...formData,
      created_at: new Date().toISOString().split('T')[0],
      student_ids: []
    };
    const updatedParents = [...parents, newParent];
    setParents(updatedParents);
    // 同步到schoolData
    schoolData.parents = updatedParents;
    setShowAddModal(false);
    alert('家长添加成功！');
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (selectedParent) {
      const updatedParents = parents.map(p =>
        p.id === selectedParent.id
          ? { ...p, ...formData }
          : p
      );
      setParents(updatedParents);
      // 同步到schoolData
      schoolData.parents = updatedParents;
      setShowEditModal(false);
      alert('家长信息更新成功！');
    }
  };

  const handleSaveBind = (e) => {
    e.preventDefault();
    if (selectedParent && bindForm.student_id) {
      const studentId = parseInt(bindForm.student_id);
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
          // 同步到schoolData
          schoolData.parents = updatedParents;
          setShowBindModal(false);
          alert('学生绑定成功！');
        } else {
          alert('该学生已绑定');
        }
      }
    }
  };

  const handleDeleteParent = (id) => {
    if (window.confirm('确定要删除这位家长吗？')) {
      const updatedParents = parents.filter(p => p.id !== id);
      setParents(updatedParents);
      // 同步到schoolData
      schoolData.parents = updatedParents;
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
    if (selectedIds.length === filteredParents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredParents.map(p => p.id));
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) {
      alert('请先选择要删除的家长');
      return;
    }
    if (window.confirm(`确定要删除选中的 ${selectedIds.length} 位家长吗？`)) {
      const updatedParents = parents.filter(p => !selectedIds.includes(p.id));
      setParents(updatedParents);
      // 同步到schoolData
      schoolData.parents = updatedParents;
      setSelectedIds([]);
      alert('批量删除成功！');
    }
  };

  const handleUnbindStudent = (parentId, studentId) => {
    if (window.confirm('确定要解除与该学生的绑定关系吗？')) {
      const updatedParents = parents.map(p =>
        p.id === parentId
          ? { ...p, student_ids: (p.student_ids || []).filter(id => id !== studentId) }
          : p
      );
      setParents(updatedParents);
      // 同步到schoolData
      schoolData.parents = updatedParents;
    }
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
    const matchSearch = parent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       parent.phone.includes(searchTerm);
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  保存
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
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  绑定
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">导入家长数据</h2>
              <button onClick={() => setShowImportModal(false)}><X className="w-6 h-6 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">下载导入模板</p>
                    <p className="text-xs text-blue-700 mt-1">请使用标准模板格式导入家长数据，支持通过学籍号自动关联学生</p>
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
                  onClick={handleImport}
                  disabled={!importFile}
                  className={`px-4 py-2 rounded-lg ${importFile ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                >
                  开始导入
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentManagement;
