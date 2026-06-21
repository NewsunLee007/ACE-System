/**
 * 分层成绩分析组件
 * 支持全年级范围分析、分层维度统计、分层推送
 */

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../lib/api';
import { notify } from '../lib/notify';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  Users,
  BookOpen,
  Download,
  Share2,
  Settings,
  ChevronDown,
  ChevronRight,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  CheckCircle,
  AlertCircle,
  Loader2,
  Filter,
  RefreshCw,
  FileText,
  Eye,
  X,
  Edit2,
  Save,
  Plus,
  Upload,
  Bell,
  Shield,
  Layers
} from 'lucide-react';

const LayeredScoreAnalysis = ({ currentUser: propUser }) => {
  // 状态管理
  const [activeTab, setActiveTab] = useState('analysis'); // analysis, comparison, thresholds, push, logs
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState('ALL');
  const [selectedSubject, setSelectedSubject] = useState('total');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [layerComparison, setLayerComparison] = useState(null);
  const [thresholds, setThresholds] = useState([]);
  const [layerDefinitions, setLayerDefinitions] = useState([]);
  const [accessibleLayers, setAccessibleLayers] = useState([]);
  const [pushForm, setPushForm] = useState({
    title: '',
    content: '',
    notification_type: 'teacher',
    target_role: 'all'
  });
  const [pushHistory, setPushHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // 层次配置常量
  const LAYER_CONFIG = {
    'ALL': { name: '全年级', color: 'bg-purple-100 text-purple-700', borderColor: 'border-purple-200', bgColor: 'bg-purple-50' },
    'A': { name: 'A层(实验班)', color: 'bg-green-100 text-green-700', borderColor: 'border-green-200', bgColor: 'bg-green-50' },
    'B': { name: 'B层(创新班)', color: 'bg-blue-100 text-blue-700', borderColor: 'border-blue-200', bgColor: 'bg-blue-50' },
    'C': { name: 'C层(平行班)', color: 'bg-orange-100 text-orange-700', borderColor: 'border-orange-200', bgColor: 'bg-orange-50' }
  };

  // 学科选项
  const subjectOptions = [
    { value: 'total', label: '总分' },
    { value: 'chinese', label: '语文' },
    { value: 'math', label: '数学' },
    { value: 'english', label: '英语' },
    { value: 'science', label: '科学' },
    { value: 'society', label: '社会' }
  ];

  // 颜色配置
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // 获取当前用户
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const user = propUser || storedUser;
    setCurrentUser(user);
  }, [propUser]);

  // 获取考试列表
  const fetchExams = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/exams`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setExams(data.data || []);
      }
    } catch (error) {
      console.error('获取考试列表失败:', error);
    }
  };

  // 获取分层定义
  const fetchLayerDefinitions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/layered-analysis/layers/definitions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setLayerDefinitions(data.data || []);
      }
    } catch (error) {
      console.error('获取分层定义失败:', error);
    }
  };

  // 获取用户可访问的层次
  const fetchAccessibleLayers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/layered-analysis/permissions/my-layers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setAccessibleLayers(data.data || []);
      }
    } catch (error) {
      console.error('获取可访问层次失败:', error);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchExams();
    fetchLayerDefinitions();
    fetchAccessibleLayers();
  }, []);

  // 执行全年级范围分析
  const handleGradeRangeAnalysis = async () => {
    if (!selectedExam) {
      notify('请先选择考试');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/layered-analysis/grade-range/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          exam_id: selectedExam.id,
          save_results: true
        })
      });

      const data = await response.json();
      if (data.success) {
        setAnalysisResult(data.data);
        notify('全年级分析完成！');
      } else {
        notify(data.message || '分析失败');
      }
    } catch (error) {
      console.error('分析失败:', error);
      notify('分析失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 获取层次对比数据
  const fetchLayerComparison = async () => {
    if (!selectedExam) {
      notify('请先选择考试');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/layered-analysis/layer-comparison?exam_id=${selectedExam.id}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        setLayerComparison(data.data);
      } else {
        notify(data.message || '获取对比数据失败');
      }
    } catch (error) {
      console.error('获取对比数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 计算分层临界分
  const handleCalculateThresholds = async () => {
    if (!selectedExam) {
      notify('请先选择考试');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/layered-analysis/thresholds/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          exam_id: selectedExam.id,
          layer_code: selectedLayer,
          percentages: [0.20, 0.40, 0.60, 0.80]
        })
      });

      const data = await response.json();
      if (data.success) {
        setThresholds(data.data);
        notify('临界分计算完成！');
      } else {
        notify(data.message || '计算失败');
      }
    } catch (error) {
      console.error('计算失败:', error);
      notify('计算失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 查询分层统计数据
  const fetchLayerStatistics = async () => {
    if (!selectedExam) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/layered-analysis/statistics/query?exam_id=${selectedExam.id}&layer_code=${selectedLayer}&subject_name=${selectedSubject}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const data = await response.json();
      if (data.success && data.data.length > 0) {
        // 更新分析结果
        const stats = data.data[0];
        setAnalysisResult({
          exam_id: selectedExam.id,
          exam_name: selectedExam.exam_name,
          layer_code: selectedLayer,
          subject_name: selectedSubject,
          ...stats
        });
      }
    } catch (error) {
      console.error('查询统计数据失败:', error);
    }
  };

  // 创建分层推送
  const handleCreatePush = async () => {
    if (!selectedExam) {
      notify('请先选择考试');
      return;
    }

    if (!pushForm.title || !pushForm.content) {
      notify('请填写推送标题和内容');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/layered-analysis/push/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          exam_id: selectedExam.id,
          layer_code: selectedLayer,
          title: pushForm.title,
          content: pushForm.content,
          notification_type: pushForm.notification_type,
          target_role: pushForm.target_role
        })
      });

      const data = await response.json();
      if (data.success) {
        notify('分层推送已发送！');
        setPushForm({ title: '', content: '', notification_type: 'teacher', target_role: 'all' });
        fetchPushHistory();
      } else {
        notify(data.message || '推送失败');
      }
    } catch (error) {
      console.error('推送失败:', error);
      notify('推送失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 获取推送历史
  const fetchPushHistory = async () => {
    if (!selectedExam) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/layered-analysis/push/notifications?exam_id=${selectedExam.id}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        setPushHistory(data.data.notifications || []);
      }
    } catch (error) {
      console.error('获取推送历史失败:', error);
    }
  };

  // 获取操作日志
  const fetchLogs = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/layered-analysis/logs?page=1&page_size=50`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        setLogs(data.data.logs || []);
      }
    } catch (error) {
      console.error('获取日志失败:', error);
    }
  };

  // 渲染分析结果
  const renderAnalysisResult = () => {
    if (!analysisResult) {
      return (
        <div className="text-center py-12 text-gray-500">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>请选择考试，然后点击"执行分析"</p>
        </div>
      );
    }

    const layerConfig = LAYER_CONFIG[analysisResult.layer_code] || LAYER_CONFIG['ALL'];

    return (
      <div className="space-y-6">
        {/* 分析报告头部 */}
        <div className={`rounded-lg p-6 text-white ${layerConfig.color.replace('text-', 'bg-').replace('100', '600')}`}>
          <h2 className="text-2xl font-bold mb-2">
            {analysisResult.exam_name || selectedExam?.exam_name} - {layerConfig.name}分析
          </h2>
          <div className="flex flex-wrap gap-6 text-sm opacity-90">
            <span>学科: {subjectOptions.find(s => s.value === selectedSubject)?.label}</span>
            <span>参与人数: {analysisResult.valid_students}/{analysisResult.total_students}</span>
          </div>
        </div>

        {/* 核心指标概览 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">平均分</p>
            <p className="text-3xl font-bold text-blue-600">{analysisResult.mean_score?.toFixed(1) || '0.0'}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">标准差</p>
            <p className="text-3xl font-bold text-purple-600">{analysisResult.std_score?.toFixed(2) || '0.00'}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">及格率</p>
            <p className="text-3xl font-bold text-green-600">{analysisResult.pass_rate?.toFixed ? analysisResult.pass_rate.toFixed(1) : analysisResult.pass_rate}%</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">优秀率</p>
            <p className="text-3xl font-bold text-yellow-600">{analysisResult.excellent_rate?.toFixed ? analysisResult.excellent_rate.toFixed(1) : analysisResult.excellent_rate}%</p>
          </div>
        </div>

        {/* 分数段分布图表 */}
        {analysisResult.score_distribution && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold mb-4">分数段分布</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analysisResult.score_distribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" name="人数" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  // 渲染层次对比
  const renderLayerComparison = () => {
    if (!layerComparison) {
      return (
        <div className="text-center py-12 text-gray-500">
          <Layers className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>请选择考试，然后点击"获取对比数据"</p>
        </div>
      );
    }

    const comparisonData = Object.entries(layerComparison).map(([code, data]) => ({
      layer_code: code,
      ...data
    }));

    return (
      <div className="space-y-6">
        {/* 层次统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {comparisonData.map((layer) => {
            const config = LAYER_CONFIG[layer.layer_code];
            return (
              <div key={layer.layer_code} className={`rounded-lg p-5 border-2 ${config.borderColor} ${config.bgColor}`}>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-lg">{layer.layer_name}</h4>
                  <span className="text-sm text-gray-500">{layer.student_count}人</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">平均分</span>
                    <span className="font-semibold text-lg">{layer.mean_score?.toFixed(1) || '0.0'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">及格率</span>
                    <span className="font-semibold text-green-600">{layer.pass_rate?.toFixed ? layer.pass_rate.toFixed(1) : layer.pass_rate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">优秀率</span>
                    <span className="font-semibold text-yellow-600">{layer.excellent_rate?.toFixed ? layer.excellent_rate.toFixed(1) : layer.excellent_rate}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 对比图表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold mb-4">各层次平均分对比</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="layer_name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="mean_score" fill="#3b82f6" name="平均分" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold mb-4">各层次及格率对比</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="layer_name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="pass_rate" fill="#10b981" name="及格率(%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  // 渲染临界分表格
  const renderThresholds = () => {
    if (thresholds.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>请选择考试和层次，然后点击"计算临界分"</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">百分比</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总分临界分</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">语文</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数学</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">英语</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">科学</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">社会</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">达标人数</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {thresholds.map((threshold, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  前{Math.round(threshold.percentage * 100)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                  {threshold.threshold_total}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{threshold.threshold_chinese || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{threshold.threshold_math || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{threshold.threshold_english || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{threshold.threshold_science || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{threshold.threshold_society || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{threshold.student_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // 渲染推送表单
  const renderPushForm = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            创建分层推送
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">推送标题</label>
              <input
                type="text"
                value={pushForm.title}
                onChange={(e) => setPushForm({ ...pushForm, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入推送标题"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">推送内容</label>
              <textarea
                value={pushForm.content}
                onChange={(e) => setPushForm({ ...pushForm, content: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="请输入推送内容"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">推送类型</label>
                <select
                  value={pushForm.notification_type}
                  onChange={(e) => setPushForm({ ...pushForm, notification_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="teacher">教师推送</option>
                  <option value="parent">家长推送</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">目标角色</label>
                <select
                  value={pushForm.target_role}
                  onChange={(e) => setPushForm({ ...pushForm, target_role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">全部</option>
                  <option value="headmaster">班主任</option>
                  <option value="teacher">任课教师</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={handleCreatePush}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              发送推送
            </button>
          </div>
        </div>

        {/* 推送历史 */}
        {pushHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-bold mb-4">推送历史</h3>
            <div className="space-y-2">
              {pushHistory.map((push) => (
                <div key={push.notification_id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{push.title}</p>
                      <p className="text-sm text-gray-500">{push.content}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {push.layer_code}层 · {push.notification_type === 'teacher' ? '教师' : '家长'} · 
                        发送{push.sent_count}人 · 已读{push.read_count}人
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      push.status === 'sent' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {push.status === 'sent' ? '已发送' : '待发送'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Layers className="w-8 h-8 text-blue-600" />
          分层成绩分析
        </h1>
        <p className="text-gray-600 mt-1">支持全年级范围分析、分层维度统计、分层推送</p>
      </div>

      {/* 控制面板 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择考试</label>
            <select
              value={selectedExam?.id || ''}
              onChange={(e) => {
                const exam = exams.find(ex => ex.id === parseInt(e.target.value));
                setSelectedExam(exam);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">请选择考试</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.exam_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择层次</label>
            <select
              value={selectedLayer}
              onChange={(e) => setSelectedLayer(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {layerDefinitions.map((layer) => (
                <option key={layer.layer_code} value={layer.layer_code}>
                  {layer.layer_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择学科</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {subjectOptions.map((subject) => (
                <option key={subject.value} value={subject.value}>
                  {subject.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGradeRangeAnalysis}
              disabled={loading || !selectedExam}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
              全年级分析
            </button>
            <button
              onClick={fetchLayerComparison}
              disabled={loading || !selectedExam}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              层次对比
            </button>
            <button
              onClick={handleCalculateThresholds}
              disabled={loading || !selectedExam}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              计算临界分
            </button>
          </div>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="border-b">
          <nav className="flex">
            {[
              { id: 'analysis', label: '成绩分析', icon: BarChart3 },
              { id: 'comparison', label: '层次对比', icon: Layers },
              { id: 'thresholds', label: '临界分', icon: FileText },
              { id: 'push', label: '分层推送', icon: Bell }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* 标签页内容 */}
        <div className="p-6">
          {activeTab === 'analysis' && renderAnalysisResult()}
          {activeTab === 'comparison' && renderLayerComparison()}
          {activeTab === 'thresholds' && renderThresholds()}
          {activeTab === 'push' && renderPushForm()}
        </div>
      </div>
    </div>
  );
};

export default LayeredScoreAnalysis;
