import React, { useState, useEffect } from 'react';
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
  MapPin,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import schoolData from '../data/schoolData';
import SmartImportModal from './SmartImportModal';

const ClassManagement = () => {
  const [classes, setClasses] = useState([]);
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
  const [importStats, setImportStats] = useState({ new: 0, update: 0, total: 0 });

  useEffect(() => {
    setClasses(schoolData.classes || []);
  }, []);

  // 获取当前学年显示
  const getCurrentAcademicYearDisplay = () => {
    return schoolData.getCurrentAcademicYearDisplay();
  };

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
      const gradeInfo = schoolData.getClassGradeInfo(c.id);
      return [
        c.id, schoolData.formatClassName(c.id), c.enrollment_year, gradeInfo?.name || '未知',
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
      
      // 从第2行开始读取数据
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length >= 2) {
          const classNo = cols[0]?.trim() || '';
          const enrollmentYear = parseInt(cols[1]?.trim()) || schoolData.config.currentAcademicYear;
          const classroomLocation = cols[2]?.trim() || '';
          const status = cols[3]?.trim() === '已毕业' ? 'inactive' : 'active';
          
          // 查找是否已存在
          const existingClass = schoolData.classes.find(c => 
            c.class_no === classNo && c.enrollment_year === enrollmentYear
          );
          
          if (existingClass) {
            // 检查是否有变化
            const changes = [];
            if (classroomLocation && classroomLocation !== existingClass.classroom_location) {
              changes.push('classroom_location');
            }
            if (status !== existingClass.status) {
              changes.push('status');
            }
            
            previewData.push({
              type: changes.length > 0 ? 'update' : 'unchanged',
              data: {
                class_no: classNo,
                enrollment_year: enrollmentYear,
                classroom_location: classroomLocation,
                status: status
              },
              existingData: existingClass,
              changes: changes
            });
          } else {
            // 新班级
            previewData.push({
              type: 'new',
              data: {
                class_no: classNo,
                enrollment_year: enrollmentYear,
                classroom_location: classroomLocation,
                status: status
              }
            });
          }
        }
      }
      
      setImportPreviewData(previewData);
      setImportStats({
        new: previewData.filter(p => p.type === 'new').length,
        update: previewData.filter(p => p.type === 'update').length,
        unchanged: previewData.filter(p => p.type === 'unchanged').length,
        total: previewData.length
      });
      setShowSmartImport(true);
      setShowImportModal(false);
    };
    
    reader.readAsText(importFile);
  };

  // 确认智能导入
  const handleConfirmImport = (selectedData) => {
    let updatedCount = 0;
    let addedCount = 0;
    
    selectedData.forEach(item => {
      if (item.type === 'new') {
        // 创建新班级
        const gradeInfo = schoolData.calculateGradeLevel(item.data.enrollment_year);
        const gradeNum = gradeInfo.grade;
        const classNum = parseInt(item.data.class_no) || 1;
        const classId = gradeNum * 100 + classNum;
        
        let finalClassId = classId;
        let counter = 0;
        while (schoolData.classes.some(c => c.id === finalClassId)) {
          counter++;
          finalClassId = classId * 10 + counter;
        }
        
        const isGraduated = gradeInfo.isGraduated || 
                           (item.data.status === 'inactive') ||
                           (item.data.enrollment_year <= schoolData.config.currentAcademicYear - 3);
        
        schoolData.classes.push({
          id: finalClassId,
          class_no: item.data.class_no,
          enrollment_year: item.data.enrollment_year,
          head_teacher_id: null,
          classroom_location: item.data.classroom_location,
          status: isGraduated ? 'inactive' : 'active',
          created_at: new Date().toISOString().split('T')[0]
        });
        addedCount++;
      } else if (item.type === 'update') {
        // 更新现有班级
        const existingClass = item.existingData;
        if (item.data.classroom_location) {
          existingClass.classroom_location = item.data.classroom_location;
        }
        existingClass.status = item.data.status;
        updatedCount++;
      }
    });
    
    setClasses([...schoolData.classes]);
    setShowSmartImport(false);
    setImportFile(null);
    
    let message = `导入完成：`;
    if (addedCount > 0) message += `新增 ${addedCount} 个班级`;
    if (updatedCount > 0) message += `${addedCount > 0 ? '，' : ''}更新 ${updatedCount} 个班级`;
    alert(message);
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
      class_no: cls.class_no,
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
    
    // 生成有意义的班级ID
    const gradeInfo = schoolData.calculateGradeLevel(formData.enrollment_year);
    const gradeNum = gradeInfo.grade;
    const classNum = parseInt(formData.class_no) || 1;
    
    // 生成班级ID: 年级(1位) + 班级序号(2位) = 如 701, 702
    let classId = gradeNum * 100 + classNum;
    
    // 检查是否已存在相同ID
    let counter = 0;
    while (schoolData.classes.some(c => c.id === classId)) {
      counter++;
      classId = (gradeNum * 100 + classNum) * 10 + counter;
    }
    
    // 判断是否已毕业
    const isGraduated = gradeInfo.isGraduated || 
                       (formData.enrollment_year <= schoolData.config.currentAcademicYear - 3);
    
    const newClass = {
      id: classId,
      ...formData,
      status: isGraduated ? 'inactive' : 'active',
      head_teacher_id: null,
      created_at: new Date().toISOString().split('T')[0]
    };
    const updatedClasses = [...classes, newClass];
    setClasses(updatedClasses);
    schoolData.classes = updatedClasses;
    setShowAddModal(false);
    alert('班级添加成功！');
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (selectedClass) {
      const updatedClasses = classes.map(c => 
        c.id === selectedClass.id 
          ? { ...c, ...formData }
          : c
      );
      setClasses(updatedClasses);
      schoolData.classes = updatedClasses;
      setShowEditModal(false);
      alert('班级信息更新成功！');
    }
  };

  const handleDeleteClass = (id) => {
    if (window.confirm('确定要删除这个班级吗？')) {
      const updatedClasses = classes.filter(c => c.id !== id);
      setClasses(updatedClasses);
      schoolData.classes = updatedClasses;
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
    if (selectedIds.length === filteredClasses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredClasses.map(c => c.id));
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) {
      alert('请先选择要删除的班级');
      return;
    }
    if (window.confirm(`确定要删除选中的 ${selectedIds.length} 个班级吗？`)) {
      const updatedClasses = classes.filter(c => !selectedIds.includes(c.id));
      setClasses(updatedClasses);
      schoolData.classes = updatedClasses;
      setSelectedIds([]);
      alert('批量删除成功！');
    }
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
    const gradeInfo = schoolData.getClassGradeInfo(cls.id);
    const matchSearch = cls.class_no.includes(searchTerm) || 
                       schoolData.formatClassName(cls.id).includes(searchTerm);
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
              const gradeInfo = schoolData.getClassGradeInfo(cls.id);
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
                    {schoolData.formatClassName(cls.id)}
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
                          handleDeleteClass(cls.id);
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  保存
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  保存
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
                {schoolData.formatClassName(selectedClass.id)}
              </h2>
              <button onClick={() => setShowDetailModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            {(() => {
              const gradeInfo = schoolData.getClassGradeInfo(selectedClass.id);
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-500">班级名称</p>
                      <p className="font-bold text-blue-600">{schoolData.formatClassName(selectedClass.id)}</p>
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
        title="班级导入预览"
        columns={[
          { key: 'class_no', label: '班级序号' },
          { key: 'enrollment_year', label: '入学年份' },
          { key: 'classroom_location', label: '教室位置' },
          { key: 'status', label: '状态' }
        ]}
      />
    </div>
  );
};

export default ClassManagement;
