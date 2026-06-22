/**
 * 成绩分析组件
 * 支持分层教学分析和成果发布
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  BookOpen,
  BarChart3,
  Award,
} from 'lucide-react';
import schoolData from '../data/schoolData';
import { API_BASE_URL } from '../lib/api';
import { fetchExamListWithStatistics, fetchExamScoreRows } from '../lib/examApi';
import { recalculateScoreRanks } from '../lib/scoreImport';
import { getStoredToken, hasBackendAuthToken } from '../lib/sessionToken';
import ScoreAnalysisResultCenter from './score-analysis/ScoreAnalysisResultCenter';
import ScoreAnalysisHistory from './score-analysis/ScoreAnalysisHistory';
import ScoreAnalysisHelpModal from './score-analysis/ScoreAnalysisHelpModal';
import ScoreAnalysisHeaderTabs, {
  ScoreAnalysisAccessDenied,
  ScoreAnalysisNotice,
  isScoreAnalysisAdminUser,
} from './score-analysis/ScoreAnalysisShell';
import {
  ScoreAnalysisLogs,
  ScoreAnalysisPublications,
  ScoreAnalysisPublishModal,
} from './score-analysis/ScoreAnalysisRecords';
import ScoreAnalysisLayerSettings from './score-analysis/ScoreAnalysisLayerSettings';
import ScoreAnalysisLayerImportModal from './score-analysis/ScoreAnalysisLayerImportModal';
import { buildHistoryTrendModel } from './score-analysis/ScoreAnalysisHistoryTrend';
import {
  buildComprehensiveReportHtml,
  buildHistoryTrendReportHtml,
  printHtmlReport,
} from './score-analysis/scoreAnalysisReportExport';
import {
  computeComprehensive as computeScoreComprehensive,
  scopeKeyFromValue,
} from '../lib/scoreAnalysisComputation';
import { refreshScoreAnalysisBundle } from '../lib/scoreAnalysisBundleApi';
import {
  fetchScoreVisibilitySettings,
  getLocalScoreVisibilitySettings,
  resolveScoreVisibility,
} from '../lib/scoreVisibility';

const readApiJson = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
};

const getExamTimestamp = (exam) => {
  const parsedDate = Date.parse(exam?.exam_date || exam?.created_at || '');
  if (Number.isFinite(parsedDate)) return parsedDate;
  return Number(exam?.id || 0);
};

const formatMetric = (value, digits = 1, empty = '-') => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : empty;
};

const ScoreAnalysis = ({ currentUser: propUser }) => {
  // 状态管理
  const [activeTab, setActiveTab] = useState('analysis'); // analysis, layers, publications, logs
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState('7年级');
  const [analysisType, setAnalysisType] = useState('overall');
  const [analysisScope, setAnalysisScope] = useState('all');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [classLayers, setClassLayers] = useState([]);
  const [historyCompare] = useState({
    scope: 'all',
    examIds: [],
    subject: 'all'
  });
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showAnalysisHistory, setShowAnalysisHistory] = useState(false);
  const [publishForm, setPublishForm] = useState({
    title: '',
    content_summary: '',
    recipient_types: []
  });
  const [publications, setPublications] = useState([]);
  const [logs, setLogs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [notice, setNotice] = useState(null);
  const [, setExamDataSource] = useState('local');
  const [, setScoreDataSource] = useState('local');
  const [scoreDataLoading, setScoreDataLoading] = useState(false);
  const [dataSyncMessage, setDataSyncMessage] = useState('正在使用本地成绩缓存');
  const [scoreVisibilitySettings, setScoreVisibilitySettings] = useState(getLocalScoreVisibilitySettings);
  const [autoAnalyzeKey, setAutoAnalyzeKey] = useState('');
  
  // 成绩数据状态
  const [examScores, setExamScores] = useState([]);
  const [taggedExamScores, setTaggedExamScores] = useState([]);
  const [allScopeExamScores, setAllScopeExamScores] = useState([]);
  const [scoreRowsByExam, setScoreRowsByExam] = useState({});
  
  // 层次配置编辑状态
  const [editingLayers, setEditingLayers] = useState(false);
  const [editedClassLayers, setEditedClassLayers] = useState([]);
  const [showLayerImportModal, setShowLayerImportModal] = useState(false);

  // 层次配置常量
  const LAYER_CONFIG = {
    'A': { name: '实验班', color: 'bg-green-100 text-green-700', borderColor: 'border-green-200', bgColor: 'bg-green-50' },
    'B': { name: '创新班', color: 'bg-blue-100 text-blue-700', borderColor: 'border-blue-200', bgColor: 'bg-blue-50' },
    'C': { name: '平行班', color: 'bg-orange-100 text-orange-700', borderColor: 'border-orange-200', bgColor: 'bg-orange-50' }
  };

  // 接收对象选项
  const recipientOptions = [
    { value: 'school_leader', label: '校级领导' },
    { value: 'middle_manager', label: '中层干部' },
    { value: 'research_leader', label: '教研组长' },
    { value: 'prep_leader', label: '备课组长' },
    { value: 'grade_leader', label: '年段长' },
    { value: 'head_teacher', label: '班主任' },
    { value: 'teacher', label: '任课教师' }
  ];

  // 分析类型选项
  const analysisTypes = [
    { value: 'overall', label: '整体分析', icon: BarChart3 },
    { value: 'subject_analysis', label: '学科分析', icon: BookOpen },
    { value: 'teaching_score', label: '教学积分', icon: Award },
    { value: 'student_progress', label: '进退步分析', icon: TrendingUp }
  ];

  // 年级选项
  const gradeOptions = ['7年级', '8年级', '9年级'];

  const notify = (message, type = 'info') => {
    const id = Date.now();
    setNotice({ id, message, type });
    window.setTimeout(() => {
      setNotice(current => (current?.id === id ? null : current));
    }, 3200);
  };

  const getScopeLabel = (scopeValue = analysisScope) => {
    const scopeKey = scopeKeyFromValue(scopeValue);
    if (scopeKey === 'all') return '全段';
    return `${scopeKey}层`;
  };

  const getGradeNumber = (gradeLevel) => {
    const match = String(gradeLevel || '').match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  };

  const normalizeClassLayers = (layers, gradeLevel) => {
    const gradeNum = getGradeNumber(gradeLevel);
    const gradeClasses = (schoolData.classes || []).filter(c => gradeNum && Math.floor(Number(c.id) / 100) === gradeNum);
    const classIdSet = new Set(gradeClasses.map(c => Number(c.id)));

    const normalizeOne = (layer) => {
      const next = { ...layer };
      if (!next.grade_level) next.grade_level = gradeLevel;
      if (!next.academic_year) next.academic_year = schoolData.getCurrentAcademicYearDisplay?.() || '2024-2025';
      if (!next.term) next.term = '第一学期';

      if (!next.class_id) {
        const m = String(next.class_name || '').match(/\d{3,4}/);
        const parsedId = m ? Number(m[0]) : null;
        if (parsedId && classIdSet.has(parsedId)) next.class_id = parsedId;
      }

      if (next.class_id && !next.class_name) {
        const cls = gradeClasses.find(c => Number(c.id) === Number(next.class_id));
        next.class_name = cls ? (schoolData.formatClassName?.(cls.id) || cls.name || String(cls.id)) : String(next.class_id);
      }

      return next;
    };

    const normalized = (layers || []).map(normalizeOne);
    const filtered = normalized.filter(l => l.grade_level === gradeLevel);

    const existingByClassId = new Map(filtered.filter(l => l.class_id).map(l => [Number(l.class_id), l]));
    gradeClasses.forEach(cls => {
      const classId = Number(cls.id);
      if (!existingByClassId.has(classId)) {
        existingByClassId.set(classId, {
          id: `local_${gradeLevel}_${classId}`,
          grade_level: gradeLevel,
          class_id: classId,
          class_name: schoolData.formatClassName?.(cls.id) || cls.name || String(cls.id),
          layer_code: 'C',
          layer_name: LAYER_CONFIG.C.name,
          academic_year: schoolData.getCurrentAcademicYearDisplay?.() || '2024-2025',
          term: '第一学期'
        });
      }
    });

    return Array.from(existingByClassId.values()).sort((a, b) => Number(a.class_id || 0) - Number(b.class_id || 0));
  };

  const getExamOptionLabel = (exam) => {
    const name = exam?.exam_name || '';
    const term = exam?.term || '';
    const baseName = String(name || '').replace(/^\s*\d{4}-\d{1,2}\s+/, '').trim();
    if (term) {
      return `${term} ${baseName || ''}`.trim();
    }
    return String(baseName || '').trim();
  };

  const computeComprehensive = (options) => (
    computeScoreComprehensive({
      ...options,
      formatClassName: schoolData.formatClassName,
    })
  );

  // 获取当前用户
  useEffect(() => {
    // 优先使用 props 传入的用户，否则从 localStorage 获取
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const user = propUser || storedUser;
    setCurrentUser(user);
    
    // 检查权限 - 与后端成绩分析接口保持同一角色边界
    const allowedRoles = ['super_admin', 'dean', 'school_leader', 'principal', 'vice_principal', 'middle_manager', 'grade_leader', 'grade_deputy', 'research_leader', '教务处主任', '教务处主任/校领导', '校长', '副校长', '系统管理员', '考务与学籍管理员', '年段长', '段长', '副段长', '教研组长', '管理员'];
    const allowedPermissions = ['sys_admin', 'edu_admin', 'principal', 'vice_principal', 'exam_admin', 'grade_leader', 'grade_deputy', 'subject_leader'];
    const userRole = user?.role || user?.role_name || '';
    const userPermission = user?.permission_code || '';
    
    const hasAllowedRole = allowedRoles.includes(userRole) || 
      allowedRoles.some(role => userRole.includes(role));
    const hasAllowedPermission = allowedPermissions.includes(userPermission);
    
    setHasPermission(hasAllowedRole || hasAllowedPermission);
  }, [propUser]);

  useEffect(() => {
    if (!hasBackendAuthToken()) {
      setScoreVisibilitySettings(getLocalScoreVisibilitySettings());
      return;
    }

    fetchScoreVisibilitySettings()
      .then(setScoreVisibilitySettings)
      .catch(() => setScoreVisibilitySettings(getLocalScoreVisibilitySettings()));
  }, []);

  const loadLocalExams = (message) => {
    const schoolExams = schoolData.exams || [];
    if (schoolExams.length > 0) {
      const formattedExams = schoolExams.map(exam => ({
        id: exam.id,
        exam_name: exam.exam_name,
        term: exam.term,
        exam_type: exam.exam_type,
        grade_level: exam.grade_level,
        exam_date: exam.exam_date,
        subjects: exam.subjects || [],
        subject_scores: exam.subject_scores || {},
        full_score: exam.full_score || 0,
        status: exam.status,
        total_students: exam.total_students || 0
      }));
      setExams(formattedExams);
      setSelectedExam(prev => (prev ? formattedExams.find(ex => ex.id === prev.id) || prev : prev));
      setExamDataSource('local');
      setDataSyncMessage(message || '后端考试库暂未同步，当前使用本地考试缓存');
    } else {
      setExams([]);
      setSelectedExam(null);
      setExamDataSource('local');
      setDataSyncMessage('暂无考试数据，请先在考务管理中创建考试');
    }
  };

  // 获取考试列表 - 后端优先，本地兜底
  const fetchExams = async () => {
    if (!hasBackendAuthToken()) {
      loadLocalExams();
      return;
    }

    try {
      const payload = await fetchExamListWithStatistics({ pageSize: 100 });
      const backendExams = payload.exams || [];
      if (backendExams.length === 0 && (schoolData.exams || []).length > 0) {
        loadLocalExams('后端考试库暂无考试记录，当前使用本地真实导入数据');
        return;
      }
      setExams(backendExams);
      setSelectedExam(prev => (prev ? backendExams.find(ex => Number(ex.id) === Number(prev.id)) || null : null));
      setExamDataSource('backend');
      setDataSyncMessage('已连接后端考试库，考试与成绩优先来自数据库');
    } catch (error) {
      console.warn('后端考试列表加载失败:', error);
      loadLocalExams();
      setDataSyncMessage(`后端考试库暂不可用，当前使用本地缓存：${error.message || '连接失败'}`);
    }
  };

  const getScoreRowsForExam = (examId) => {
    const backendRows = scoreRowsByExam[Number(examId)];
    if (backendRows) return backendRows;
    return (schoolData.examScores || []).filter(score => Number(score.exam_id) === Number(examId));
  };

  const loadExamScoreRows = async (examId) => {
    if (!examId) return;

    if (!hasBackendAuthToken()) {
      setScoreDataSource('local');
      setDataSyncMessage('未登录后端，当前使用本地成绩缓存');
      return;
    }

    setScoreDataLoading(true);
    try {
      const payload = await fetchExamScoreRows(examId, { includeInvalid: true });
      const rankedRows = recalculateScoreRanks(payload.scores || []);
      const localRows = (schoolData.examScores || []).filter(score => Number(score.exam_id) === Number(examId));
      if (rankedRows.length === 0 && localRows.length > 0) {
        setScoreDataSource('local');
        setDataSyncMessage('后端成绩行暂无记录，当前使用本地真实成绩数据');
        return;
      }
      setScoreRowsByExam(prev => ({
        ...prev,
        [Number(examId)]: rankedRows,
      }));
      setScoreDataSource('backend');
      setDataSyncMessage(`已同步后端成绩行 · ${rankedRows.length} 条`);
    } catch (error) {
      console.warn('后端成绩行加载失败:', error);
      setScoreDataSource('local');
      setDataSyncMessage(`后端成绩行暂不可用，当前使用本地缓存：${error.message || '连接失败'}`);
    } finally {
      setScoreDataLoading(false);
    }
  };

  // 获取班级层次
  const fetchClassLayers = async () => {
    try {
      const localLayers = normalizeClassLayers(schoolData.classLayers || [], selectedGrade);
      setClassLayers(localLayers);
      if (!Array.isArray(schoolData.classLayers) || schoolData.classLayers.length === 0) {
        schoolData.classLayers = localLayers;
      } else {
        const others = (schoolData.classLayers || []).filter(l => l.grade_level !== selectedGrade);
        schoolData.classLayers = [...others, ...localLayers];
      }
    } catch (error) {
      console.error('获取班级层次失败:', error);
    }
  };

  // 获取分析历史
  const fetchAnalysisHistory = async () => {
    if (!hasBackendAuthToken()) {
      setAnalysisHistory([]);
      return;
    }

    try {
      const params = new URLSearchParams({
        grade_level: selectedGrade,
        page: 1,
        page_size: 20
      });
      
      const response = await fetch(
        `${API_BASE_URL}/score-analysis/results?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${getStoredToken()}`
          }
        }
      );
      const data = await readApiJson(response);
      if (data?.success) {
        setAnalysisHistory(data.records || []);
      } else {
        setAnalysisHistory([]);
      }
    } catch (error) {
      setAnalysisHistory([]);
    }
  };

  // 获取发布记录
  const fetchPublications = async () => {
    if (!hasBackendAuthToken()) {
      setPublications([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/score-analysis/publications?grade_level=${selectedGrade}`,
        {
          headers: {
            'Authorization': `Bearer ${getStoredToken()}`
          }
        }
      );
      const data = await readApiJson(response);
      if (data?.success) {
        setPublications(data.records || []);
      } else {
        setPublications([]);
      }
    } catch (error) {
      setPublications([]);
    }
  };

  // 获取操作日志
  const fetchLogs = async () => {
    if (!hasBackendAuthToken()) {
      setLogs([]);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/score-analysis/logs?page=1&page_size=50`,
        {
          headers: {
            'Authorization': `Bearer ${getStoredToken()}`
          }
        }
      );
      const data = await readApiJson(response);
      if (data?.success) {
        setLogs(data.records || []);
      } else {
        setLogs([]);
      }
    } catch (error) {
      setLogs([]);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchExams();
    // fetchExams intentionally owns backend/local fallback and should run once at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => fetchExams();
    window.addEventListener('schoolData:changed', handler);
    return () => window.removeEventListener('schoolData:changed', handler);
    // fetchExams intentionally owns backend/local fallback for this event bridge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const gradeExams = exams
      .filter(ex => ex.grade_level === selectedGrade)
      .sort((a, b) => getExamTimestamp(b) - getExamTimestamp(a));

    if (gradeExams.length === 0) {
      if (selectedExam) setSelectedExam(null);
      return;
    }

    const currentExamStillAvailable = selectedExam
      && selectedExam.grade_level === selectedGrade
      && gradeExams.some(ex => Number(ex.id) === Number(selectedExam.id));

    if (!currentExamStillAvailable) {
      setSelectedExam(gradeExams[0]);
      setAnalysisResult(null);
      setTaggedExamScores([]);
      setExamScores([]);
      setAllScopeExamScores([]);
    }
  }, [exams, selectedGrade, selectedExam]);

  useEffect(() => {
    if (!selectedExam?.id) return;
    loadExamScoreRows(selectedExam.id);
    // loadExamScoreRows intentionally reads the latest auth/local fallback state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExam?.id]);

  // 当年级变化时
  useEffect(() => {
    fetchClassLayers();
    fetchAnalysisHistory();
    fetchPublications();
    // Grade changes are the intended refresh boundary for these local grade-scoped loaders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGrade]);

  useEffect(() => {
    if (!analysisResult || analysisResult.analysis_type !== 'comprehensive') return;
    if (!taggedExamScores || taggedExamScores.length === 0) return;
    const scopeKey = scopeKeyFromValue(analysisScope);
    const scopedAll = taggedExamScores.filter(s => scopeKey === 'all' ? true : s._layer === scopeKey);
    const scoped = taggedExamScores
      .filter(s => s.is_valid !== false)
      .filter(s => scopeKey === 'all' ? true : s._layer === scopeKey);
    setExamScores(scoped);
    setAllScopeExamScores(scopedAll);
  }, [analysisScope, analysisResult, taggedExamScores]);

  // 执行分析 - 后端成绩行优先，本地缓存兜底，计算逻辑保持不变
  const handleAnalyze = async ({ silent = false } = {}) => {
    if (!selectedExam) {
      if (!silent) notify('请选择考试', 'warning');
      return null;
    }

    setLoading(true);
    try {
      const allExamScores = getScoreRowsForExam(selectedExam.id);
      if (allExamScores.length === 0) {
        if (!silent) notify('该考试暂无成绩数据，请先导入成绩', 'warning');
        return null;
      }

      const layersForGrade = normalizeClassLayers(schoolData.classLayers || [], selectedGrade);
      const result = computeComprehensive({
        exam: selectedExam,
        gradeLevel: selectedGrade,
        allScores: allExamScores,
        layersForGrade
      });

      setAnalysisResult(result);
      setTaggedExamScores(result._tagged_scores || []);

      const scopeKey = scopeKeyFromValue(analysisScope);
      const scopedAll = (result._tagged_scores || []).filter(s => scopeKey === 'all' ? true : s._layer === scopeKey);
      const scoped = scopedAll.filter(s => s.is_valid !== false);
      setExamScores(scoped);
      setAllScopeExamScores(scopedAll);

      if (!silent) notify('分析完成，已刷新所有结果', 'success');
      return result;
    } catch (error) {
      console.error('分析失败:', error);
      if (!silent) notify('分析失败：' + error.message, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshResults = async () => {
    const result = await handleAnalyze();
    if (!result || !hasBackendAuthToken() || !selectedExam?.id) return;

    refreshScoreAnalysisBundle({
      examId: selectedExam.id,
      gradeLevel: selectedGrade,
    }).catch(error => {
      console.warn('后端结果包刷新失败:', error);
    });
  };

  // 发布成果
  const handlePublish = async () => {
    if (!analysisResult || !analysisResult.analysis_id) {
      notify('请执行分析后查看结果', 'warning');
      return;
    }

    if (!publishForm.title) {
      notify('请输入发布标题', 'warning');
      return;
    }

    if (publishForm.recipient_types.length === 0) {
      notify('请至少选择一个接收对象', 'warning');
      return;
    }

    if (!hasBackendAuthToken()) {
      notify('当前为本地演示模式，发布需要连接后端账号', 'warning');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/score-analysis/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getStoredToken()}`
        },
        body: JSON.stringify({
          analysis_id: analysisResult.analysis_id,
          title: publishForm.title,
          content_summary: publishForm.content_summary,
          recipient_types: publishForm.recipient_types
        })
      });

      const data = await readApiJson(response);
      if (data?.success) {
        notify(data.message || '发布成功', 'success');
        setShowPublishModal(false);
        setPublishForm({ title: '', content_summary: '', recipient_types: [] });
        fetchPublications();
      } else {
        notify(data?.message || '发布失败', 'error');
      }
    } catch (error) {
      console.error('发布失败:', error);
      notify('发布失败，请检查网络连接', 'error');
    }
  };

  // 导出分析结果
  const handleExport = async (format) => {
    if (!analysisResult || !analysisResult.analysis_id) {
      notify('请执行分析后查看结果', 'warning');
      return;
    }

    if (!hasBackendAuthToken()) {
      notify('当前为本地演示模式，请使用页面内标准报告导出', 'warning');
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/score-analysis/export/${analysisResult.analysis_id}?format=${format}`,
        {
          headers: {
            'Authorization': `Bearer ${getStoredToken()}`
          }
        }
      );

      if (!response.ok) {
        const errorPayload = await readApiJson(response);
        notify(errorPayload?.detail || errorPayload?.message || '导出失败', 'error');
        return;
      }

      if (format === 'json') {
        const data = await readApiJson(response);
        const blob = new Blob([JSON.stringify(data?.data || data || {}, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analysis_${analysisResult.analysis_id}.json`;
        a.click();
        URL.revokeObjectURL(url);
        notify('分析数据已导出', 'success');
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analysis_${analysisResult.analysis_id}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
      notify(format === 'pdf' ? 'PDF报告已导出' : 'Excel报告已导出', 'success');
    } catch (error) {
      console.error('导出失败:', error);
      notify('导出失败，请检查网络连接', 'error');
    }
  };

  const escapeExcelCell = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

  const exportLocalExcelReport = () => {
    if (!analysisResult || analysisResult.analysis_type !== 'comprehensive') {
      notify('请执行分析后查看结果', 'warning');
      return;
    }

    const scopeKey = scopeKeyFromValue(analysisScope);
    const scopeData = analysisResult?.scopes?.[scopeKey] || analysisResult?.scopes?.all || {};
    const summary = scopeData.summary || {};
    const subjectRows = Object.entries(scopeData.subject_analysis?.subject_statistics || {});
    const classRows = scopeData.teaching_score?.class_rows || [];
    const layerRows = Object.entries(analysisResult.layer_comparison?.layer_statistics || {});
    const row = (cells) => `<tr>${cells.map(cell => `<td>${escapeExcelCell(cell)}</td>`).join('')}</tr>`;
    const table = `
      <table border="1">
        ${row(['考试', analysisResult.exam_name])}
        ${row(['年级', analysisResult.grade_level])}
        ${row(['范围', getScopeLabel(analysisScope)])}
        ${row(['参与人数', summary.participated || 0])}
        ${row(['均分', formatMetric(summary.grade_mean)])}
        ${row(['达标率', `${formatMetric(summary.pass_rate)}%`])}
        ${row([])}
        ${row(['层次', '人数', '均分', '优秀率', '达标率'])}
        ${layerRows.map(([layer, stats]) => row([layer, stats.student_count, formatMetric(stats.mean), `${formatMetric(stats.excellent_rate)}%`, `${formatMetric(stats.pass_rate)}%`])).join('')}
        ${row([])}
        ${row(['学科', '均分', '与全段差', '最高分', '最低分', '优秀率', '达标率'])}
        ${subjectRows.map(([subject, stats]) => row([subject, formatMetric(stats.mean), formatMetric(stats.range_diff), formatMetric(stats.max), formatMetric(stats.min), `${formatMetric(stats.excellent_rate)}%`, `${formatMetric(stats.pass_rate)}%`])).join('')}
        ${row([])}
        ${row(['班级排名', '班级', '层次', '班级均分', '与全段差', '与同层次差', '综合积分'])}
        ${classRows.map(item => row([item.rank, item.class_name, item.layer_code || '-', formatMetric(item.class_mean), formatMetric(item.range_mean_diff), formatMetric(item.same_layer_diff), formatMetric(item.comprehensive_score, 2)])).join('')}
      </table>
    `;
    const blob = new Blob([`\ufeff<html><head><meta charset="UTF-8" /></head><body>${table}</body></html>`], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${analysisResult.exam_name || '成绩分析'}_${getScopeLabel(analysisScope)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    notify('Excel报告已导出', 'success');
  };

  const exportExcelReport = () => {
    if (hasBackendAuthToken() && analysisResult?.analysis_id && !String(analysisResult.analysis_id).startsWith('LOCAL_')) {
      handleExport('excel');
      return;
    }
    exportLocalExcelReport();
  };

  const exportPdfReport = () => {
    if (analysisType === 'history_compare') {
      const trendModel = buildHistoryTrendModel({
        exams,
        selectedGrade,
        historyCompare,
        normalizeClassLayers,
        computeComprehensive,
        getExamOptionLabel,
        scopeKeyFromValue,
      });
      if (trendModel.trendRows.length < 2) {
        notify('至少需要两次有成绩数据的考试，才能导出历史趋势报告', 'warning');
        return;
      }

      const scopeLabel = getScopeLabel(historyCompare.scope);
      const html = buildHistoryTrendReportHtml({
        trendModel,
        selectedGrade,
        scopeLabel,
      });
      if (!printHtmlReport(html, `历史趋势-${selectedGrade}-${scopeLabel}`)) {
        notify('浏览器阻止了打印窗口，请允许弹窗后重试', 'warning');
      }
      return;
    }

    if (!analysisResult || analysisResult.analysis_type !== 'comprehensive') {
      notify('请执行分析后查看结果', 'warning');
      return;
    }

    const scopeKey = scopeKeyFromValue(analysisScope);
    const scopeLabel = getScopeLabel(analysisScope);
    const html = buildComprehensiveReportHtml({
      analysisResult,
      selectedExam,
      scopeKey,
      scopeLabel,
    });

    if (!printHtmlReport(html, `${analysisResult.exam_name}-${scopeLabel}-成绩分析报告`)) {
      notify('浏览器阻止了打印窗口，请允许弹窗后重试', 'warning');
    }
  };

  const gradeExamOptions = exams
    .filter(ex => ex.grade_level === selectedGrade)
    .sort((a, b) => getExamTimestamp(b) - getExamTimestamp(a));
  const selectedExamScoreRows = selectedExam
    ? getScoreRowsForExam(selectedExam.id)
    : [];
  const selectedValidScoreCount = selectedExamScoreRows.filter(score => score.is_valid !== false && score.is_included !== false).length;
  const currentScoreVisibility = resolveScoreVisibility(currentUser, scoreVisibilitySettings);
  const canExportScoreReport = Boolean(currentScoreVisibility.allow_export || isScoreAnalysisAdminUser(currentUser));
  const hasSelectedExam = Boolean(selectedExam);
  const hasScoreRows = selectedExamScoreRows.length > 0;
  const canAnalyze = hasSelectedExam && hasScoreRows;

  useEffect(() => {
    if (!canAnalyze || analysisResult || loading || scoreDataLoading) return;

    const key = [
      selectedGrade,
      selectedExam?.id || '',
      selectedExamScoreRows.length,
      selectedValidScoreCount,
      classLayers.length,
    ].join(':');

    if (autoAnalyzeKey === key) return;
    setAutoAnalyzeKey(key);
    handleAnalyze({ silent: true });
    // Auto-run should fire only when the selected exam's data boundary changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canAnalyze,
    analysisResult,
    loading,
    scoreDataLoading,
    selectedGrade,
    selectedExam?.id,
    selectedExamScoreRows.length,
    selectedValidScoreCount,
    classLayers.length,
    autoAnalyzeKey,
  ]);

  const handleScoreImportSuccess = (result) => {
    setAnalysisResult(null);
    setTaggedExamScores([]);
    setExamScores((result.mergedScores || []).filter(score => score.is_valid !== false));
    setAllScopeExamScores(result.mergedScores || []);
    if (selectedExam?.id) {
      setScoreRowsByExam(prev => ({
        ...prev,
        [Number(selectedExam.id)]: result.mergedScores || [],
      }));
      setScoreDataSource('local');
      setDataSyncMessage('已使用本次导入结果刷新当前考试成绩');
    }
    setExams([...(schoolData.exams || [])]);
    const checkText = result.errors?.length ? `，${result.errors.length} 行需检查` : '';
    notify(`导入完成：新增 ${result.insertedCount} 条，覆盖 ${result.updatedCount} 条${checkText}。现在可以执行分析。`, result.errors?.length ? 'warning' : 'success');
  };

  const handleOpenHistoryAnalysis = (item) => {
    if (!hasBackendAuthToken()) {
      notify('当前为本地演示模式，暂无后端历史详情', 'warning');
      return;
    }

    fetch(`${API_BASE_URL}/score-analysis/results/${item.analysis_id}`, {
      headers: { 'Authorization': `Bearer ${getStoredToken()}` }
    })
      .then(readApiJson)
      .then(data => {
        if (data?.success) {
          setAnalysisResult(data.data);
          setAnalysisType(data.data.analysis_type);
        }
      })
      .catch(() => {
        notify('历史分析结果加载失败，请稍后重试', 'error');
      });
  };

  // 如果没有权限，显示提示
  if (!hasPermission) {
    return <ScoreAnalysisAccessDenied />;
  }

  return (
    <div className="space-y-6">
      <ScoreAnalysisNotice notice={notice} onClose={() => setNotice(null)} />

      <ScoreAnalysisHeaderTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onOpenLogs={fetchLogs}
      />

      {/* 成绩分析Tab */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          <ScoreAnalysisResultCenter
            selectedGrade={selectedGrade}
            setSelectedGrade={setSelectedGrade}
            gradeOptions={gradeOptions}
            selectedExam={selectedExam}
            selectedExamId={selectedExam?.id || ''}
            setSelectedExamById={(value) => {
              const exam = exams.find(ex => ex.id === parseInt(value, 10));
              setSelectedExam(exam || null);
              setAnalysisResult(null);
            }}
            gradeExamOptions={gradeExamOptions}
            getExamOptionLabel={getExamOptionLabel}
            analysisScope={analysisScope}
            setAnalysisScope={setAnalysisScope}
            analysisResult={analysisResult}
            examScores={examScores}
            allScopeExamScores={allScopeExamScores}
            taggedExamScores={taggedExamScores}
            classLayers={classLayers}
            loading={loading}
            scoreDataLoading={scoreDataLoading}
            dataSyncMessage={dataSyncMessage}
            onRefresh={handleRefreshResults}
            onExportPdf={exportPdfReport}
            onExportExcel={exportExcelReport}
            onPublish={() => setShowPublishModal(true)}
            onImportSuccess={handleScoreImportSuccess}
            canPublish={Boolean(analysisResult && hasBackendAuthToken())}
            canExport={canExportScoreReport}
          />

          {showAnalysisHistory && (
            <ScoreAnalysisHistory
              analysisHistory={analysisHistory}
              analysisTypes={analysisTypes}
              onOpenAnalysis={handleOpenHistoryAnalysis}
              onClose={() => setShowAnalysisHistory(false)}
            />
          )}
        </div>
      )}

      {/* 层次配置Tab */}
      {activeTab === 'layers' && (
        <ScoreAnalysisLayerSettings
          selectedGrade={selectedGrade}
          classLayers={classLayers}
          setClassLayers={setClassLayers}
          editingLayers={editingLayers}
          setEditingLayers={setEditingLayers}
          editedClassLayers={editedClassLayers}
          setEditedClassLayers={setEditedClassLayers}
          normalizeClassLayers={normalizeClassLayers}
          getGradeNumber={getGradeNumber}
          layerConfig={LAYER_CONFIG}
          notify={notify}
          onShowImport={() => setShowLayerImportModal(true)}
        />
      )}

      {/* 发布记录Tab */}
      {activeTab === 'publications' && (
        <ScoreAnalysisPublications publications={publications} />
      )}

      {/* 操作日志Tab */}
      {activeTab === 'logs' && isScoreAnalysisAdminUser(currentUser) && (
        <ScoreAnalysisLogs logs={logs} />
      )}

      {/* 发布弹窗 */}
      {showPublishModal && (
        <ScoreAnalysisPublishModal
          publishForm={publishForm}
          setPublishForm={setPublishForm}
          recipientOptions={recipientOptions}
          onClose={() => setShowPublishModal(false)}
          onPublish={handlePublish}
        />
      )}

      {showHelpModal && (
        <ScoreAnalysisHelpModal onClose={() => setShowHelpModal(false)} />
      )}

      {/* 层次导入弹窗 */}
      {showLayerImportModal && (
        <ScoreAnalysisLayerImportModal
          selectedGrade={selectedGrade}
          editedClassLayers={editedClassLayers}
          setEditedClassLayers={setEditedClassLayers}
          normalizeClassLayers={normalizeClassLayers}
          layerConfig={LAYER_CONFIG}
          notify={notify}
          onClose={() => setShowLayerImportModal(false)}
        />
      )}
    </div>
  );
};

export default ScoreAnalysis;
