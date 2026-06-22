/**
 * 缺考管理组件
 * 支持教务处统一录入和班主任上报两种模式
 */

import React, { useCallback, useState, useEffect } from 'react';
import { API_BASE_URL } from '../lib/api';
import { notify } from '../lib/notify';
import { useConfirm } from './ui/confirm';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit,
  X,
  Upload,
  ChevronLeft,
  ChevronRight,
  Users
} from 'lucide-react';

const AbsenceManagement = ({ mode = 'admin', examId = null, className = null }) => {
  // mode: 'admin' - 教务处模式, 'teacher' - 班主任模式
  const { confirm: confirmAction } = useConfirm();
  
  // 状态管理
  const [absenceRecords, setAbsenceRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  
  // 筛选条件
  const [filters, setFilters] = useState({
    exam_id: examId || '',
    class_name: className || '',
    status: '',
    reason_type: '',
    keyword: ''
  });
  
  // 分页
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 20,
    total: 0
  });
  
  // 统计数据
  const [statistics, setStatistics] = useState({
    total_absence: 0,
    pending_count: 0,
    approved_count: 0,
    rejected_count: 0
  });
  
  // 表单数据
  const [formData, setFormData] = useState({
    exam_id: examId || '',
    student_id: '',
    student_code: '',
    student_name: '',
    class_name: className || '',
    absent_subjects: [],
    reason_type: '其他',
    reason_detail: '',
    report_source: mode === 'admin' ? '教务处' : '班主任',
    attachments: []
  });
  
  // 审核表单
  const [auditForm, setAuditForm] = useState({
    status: '已通过',
    audit_comment: ''
  });

  // 可用选项
  const reasonTypes = ['病假', '事假', '旷考', '其他'];
  const statusOptions = ['待审核', '已通过', '已驳回'];
  
  // 获取缺考记录列表
  const fetchAbsenceRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        page_size: pagination.page_size,
        ...filters
      });
      
      const response = await fetch(`${API_BASE_URL}/absence/list?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setAbsenceRecords(data.records);
        setPagination(prev => ({ ...prev, total: data.total }));
      }
    } catch (error) {
      console.error('获取缺考记录失败:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.page_size]);
  
  // 获取统计数据
  const fetchStatistics = useCallback(async () => {
    if (!filters.exam_id) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/absence/statistics/${filters.exam_id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        setStatistics({
          total_absence: data.total_absence,
          pending_count: data.pending_count,
          approved_count: data.approved_count,
          rejected_count: data.rejected_count
        });
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    }
  }, [filters.exam_id]);
  
  // 初始加载
  useEffect(() => {
    fetchAbsenceRecords();
    fetchStatistics();
  }, [fetchAbsenceRecords, fetchStatistics]);
  
  // 创建缺考记录
  const handleCreate = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${API_BASE_URL}/absence/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      if (data.success) {
        notify(data.message);
        setShowCreateModal(false);
        fetchAbsenceRecords();
        fetchStatistics();
        resetForm();
      } else {
        notify(data.message || '创建失败');
      }
    } catch (error) {
      console.error('创建缺考记录失败:', error);
      notify('创建失败，请检查网络连接');
    }
  };
  
  // 审核缺考记录
  const handleAudit = async (e) => {
    e.preventDefault();
    
    if (!selectedRecord) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/absence/${selectedRecord.id}/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(auditForm)
      });
      
      const data = await response.json();
      if (data.success) {
        notify(data.message);
        setShowAuditModal(false);
        setSelectedRecord(null);
        fetchAbsenceRecords();
        fetchStatistics();
      } else {
        notify(data.message || '审核失败');
      }
    } catch (error) {
      console.error('审核失败:', error);
      notify('审核失败，请检查网络连接');
    }
  };
  
  // 删除缺考记录
  const handleDelete = async (record) => {
    const confirmed = await confirmAction({
      title: '删除缺考记录',
      message: `确定要删除 ${record.student_name} 的缺考记录吗？`,
      confirmText: '删除'
    });
    if (!confirmed) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/absence/${record.id}/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        notify('删除成功');
        fetchAbsenceRecords();
        fetchStatistics();
      } else {
        notify(data.message || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      notify('删除失败，请检查网络连接');
    }
  };
  
  // 重置表单
  const resetForm = () => {
    setFormData({
      exam_id: examId || '',
      student_id: '',
      student_code: '',
      student_name: '',
      class_name: className || '',
      absent_subjects: [],
      reason_type: '其他',
      reason_detail: '',
      report_source: mode === 'admin' ? '教务处' : '班主任',
      attachments: []
    });
  };
  
  // 获取状态颜色
  const getStatusColor = (status) => {
    switch (status) {
      case '待审核': return 'bg-yellow-100 text-yellow-800';
      case '已通过': return 'bg-green-100 text-green-800';
      case '已驳回': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // 获取原因类型颜色
  const getReasonColor = (reason) => {
    switch (reason) {
      case '病假': return 'bg-blue-100 text-blue-800';
      case '事假': return 'bg-purple-100 text-purple-800';
      case '旷考': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">缺考总数</p>
              <p className="text-2xl font-bold text-gray-800">{statistics.total_absence}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">待审核</p>
              <p className="text-2xl font-bold text-yellow-600">{statistics.pending_count}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已通过</p>
              <p className="text-2xl font-bold text-green-600">{statistics.approved_count}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已驳回</p>
              <p className="text-2xl font-bold text-red-600">{statistics.rejected_count}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="搜索学生姓名或学籍号..."
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          
          {!examId && (
            <select
              value={filters.exam_id}
              onChange={(e) => setFilters({ ...filters, exam_id: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">所有考试</option>
              {/* 这里需要从父组件传入考试列表 */}
            </select>
          )}
          
          {!className && (
            <select
              value={filters.class_name}
              onChange={(e) => setFilters({ ...filters, class_name: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">所有班级</option>
              {/* 这里需要从父组件传入班级列表 */}
            </select>
          )}
          
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">所有状态</option>
            {statusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          
          <select
            value={filters.reason_type}
            onChange={(e) => setFilters({ ...filters, reason_type: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">所有原因</option>
            {reasonTypes.map(reason => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
          </select>
          
          <button
            onClick={() => {
              setFilters({
                exam_id: examId || '',
                class_name: className || '',
                status: '',
                reason_type: '',
                keyword: ''
              });
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            重置
          </button>
          
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {mode === 'admin' ? '录入缺考' : '上报缺考'}
          </button>
        </div>
      </div>

      {/* 缺考记录列表 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">学生信息</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">班级</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">缺考科目</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">原因</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">上报来源</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">上报时间</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : absenceRecords.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    暂无缺考记录
                  </td>
                </tr>
              ) : (
                absenceRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{record.student_name}</p>
                        <p className="text-xs text-gray-500">{record.student_code}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{record.class_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {record.absent_subjects?.map(subject => (
                          <span key={subject} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                            {subject}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getReasonColor(record.reason_type)}`}>
                        {record.reason_type}
                      </span>
                      {record.reason_detail && (
                        <p className="text-xs text-gray-500 mt-1 truncate max-w-[150px]" title={record.reason_detail}>
                          {record.reason_detail}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div>
                        <span>{record.report_source}</span>
                        <p className="text-xs text-gray-400">{record.reported_by_name}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(record.report_time).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {mode === 'admin' && record.status === '待审核' && (
                          <button
                            onClick={() => {
                              setSelectedRecord(record);
                              setAuditForm({ status: '已通过', audit_comment: '' });
                              setShowAuditModal(true);
                            }}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="审核"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        
                        {record.status === '待审核' && (
                          <button
                            onClick={() => {
                              setSelectedRecord(record);
                              setFormData({
                                exam_id: record.exam_id,
                                student_id: record.student_id,
                                student_code: record.student_code,
                                student_name: record.student_name,
                                class_name: record.class_name,
                                absent_subjects: record.absent_subjects || [],
                                reason_type: record.reason_type,
                                reason_detail: record.reason_detail || '',
                                report_source: record.report_source,
                                attachments: record.attachments || []
                              });
                              setShowCreateModal(true);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="编辑"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        
                        {mode === 'admin' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDelete(record);
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* 分页 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            共 {pagination.total} 条记录
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 bg-blue-600 text-white rounded">
              {pagination.page}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page * pagination.page_size >= pagination.total}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 创建/编辑弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {selectedRecord ? '编辑缺考记录' : (mode === 'admin' ? '录入缺考' : '上报缺考')}
              </h2>
              <button onClick={() => {
                setShowCreateModal(false);
                setSelectedRecord(null);
                resetForm();
              }}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4">
              {/* 学生信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">学籍辅号 *</label>
                  <input
                    type="text"
                    required
                    value={formData.student_code}
                    onChange={(e) => setFormData({ ...formData, student_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="请输入学籍辅号"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">学生姓名 *</label>
                  <input
                    type="text"
                    required
                    value={formData.student_name}
                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="请输入学生姓名"
                  />
                </div>
              </div>
              
              {/* 班级 */}
              {!className && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">班级 *</label>
                  <input
                    type="text"
                    required
                    value={formData.class_name}
                    onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="如：701"
                  />
                </div>
              )}
              
              {/* 缺考科目 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">缺考科目 *</label>
                <div className="flex gap-2 flex-wrap">
                  {['语文', '数学', '英语', '科学', '社会'].map(subject => (
                    <label key={subject} className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded cursor-pointer hover:bg-gray-200">
                      <input
                        type="checkbox"
                        checked={formData.absent_subjects.includes(subject)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, absent_subjects: [...formData.absent_subjects, subject] });
                          } else {
                            setFormData({ ...formData, absent_subjects: formData.absent_subjects.filter(s => s !== subject) });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{subject}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* 缺考原因 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">缺考原因 *</label>
                <select
                  value={formData.reason_type}
                  onChange={(e) => setFormData({ ...formData, reason_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {reasonTypes.map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>
              
              {/* 详细说明 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">详细说明</label>
                <textarea
                  value={formData.reason_detail}
                  onChange={(e) => setFormData({ ...formData, reason_detail: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows="3"
                  placeholder="请说明具体原因..."
                />
              </div>
              
              {/* 附件上传 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">附件（如病假条）</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    上传附件
                  </button>
                  <span className="text-sm text-gray-500">支持图片、PDF格式</span>
                </div>
              </div>
              
              {/* 按钮 */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedRecord(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {selectedRecord ? '保存修改' : (mode === 'admin' ? '确认录入' : '提交上报')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 审核弹窗 */}
      {showAuditModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">审核缺考记录</h2>
              <button onClick={() => {
                setShowAuditModal(false);
                setSelectedRecord(null);
              }}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-medium">学生：</span>{selectedRecord.student_name}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">班级：</span>{selectedRecord.class_name}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">缺考科目：</span>{selectedRecord.absent_subjects?.join('、')}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">原因：</span>{selectedRecord.reason_type}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">详细说明：</span>{selectedRecord.reason_detail || '无'}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">上报人：</span>{selectedRecord.reported_by_name} ({selectedRecord.report_source})
              </p>
            </div>
            
            <form onSubmit={handleAudit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">审核结果 *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="已通过"
                      checked={auditForm.status === '已通过'}
                      onChange={(e) => setAuditForm({ ...auditForm, status: e.target.value })}
                      className="text-green-600"
                    />
                    <span className="text-green-600 font-medium">通过</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="已驳回"
                      checked={auditForm.status === '已驳回'}
                      onChange={(e) => setAuditForm({ ...auditForm, status: e.target.value })}
                      className="text-red-600"
                    />
                    <span className="text-red-600 font-medium">驳回</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">审核意见</label>
                <textarea
                  value={auditForm.audit_comment}
                  onChange={(e) => setAuditForm({ ...auditForm, audit_comment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows="3"
                  placeholder="请输入审核意见..."
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAuditModal(false);
                    setSelectedRecord(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white rounded-lg ${
                    auditForm.status === '已通过' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  确认{auditForm.status === '已通过' ? '通过' : '驳回'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbsenceManagement;
