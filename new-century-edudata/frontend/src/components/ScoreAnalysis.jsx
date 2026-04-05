/**
 * 成绩分析组件
 * 支持分层教学分析和成果发布
 */

import React, { useState, useEffect } from 'react';
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
  Upload
} from 'lucide-react';
import schoolData from '../data/schoolData';
import SubjectThresholdAnalysis from './SubjectThresholdAnalysis';
import SubjectScoreDistribution from './SubjectScoreDistribution';
import SubjectScoreAnalysisBoard from './SubjectScoreAnalysisBoard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import ScoreRawData from './score-analysis/ScoreRawData';
import ThreeRatesStats from './score-analysis/ThreeRatesStats';
import TopStudentsTracking from './score-analysis/TopStudentsTracking';
import AdmissionPrediction from './score-analysis/AdmissionPrediction';

const API_BASE_URL = 'http://localhost:8000/api/v1';

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
  const [layerConfig, setLayerConfig] = useState([]);
  const [classLayers, setClassLayers] = useState([]);
  const [keyPanel, setKeyPanel] = useState('metrics');
  const [rankFocus, setRankFocus] = useState(0);
  const [historyCompare, setHistoryCompare] = useState({
    baseExamId: '',
    targetExamId: '',
    scope: 'all'
  });
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishForm, setPublishForm] = useState({
    title: '',
    content_summary: '',
    recipient_types: []
  });
  const [publications, setPublications] = useState([]);
  const [logs, setLogs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  
  // 成绩数据状态
  const [examScores, setExamScores] = useState([]);
  const [taggedExamScores, setTaggedExamScores] = useState([]);
  const [allScopeExamScores, setAllScopeExamScores] = useState([]);
  
  // 层次配置编辑状态
  const [editingLayers, setEditingLayers] = useState(false);
  const [editedClassLayers, setEditedClassLayers] = useState([]);
  const [savingLayers, setSavingLayers] = useState(false);
  const [showLayerImportModal, setShowLayerImportModal] = useState(false);
  const [layerImportFile, setLayerImportFile] = useState(null);

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
    { value: 'student_progress', label: '进退步分析', icon: TrendingUp }
  ];

  // 年级选项
  const gradeOptions = ['7年级', '8年级', '9年级'];

  // 颜色配置
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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

  const scopeKeyFromValue = (value) => {
    if (value === 'all') return 'all';
    const m = String(value || '').match(/layer_([a-c])/i);
    return m ? m[1].toUpperCase() : 'all';
  };

  const calcBasicStats = (nums) => {
    const values = (nums || []).filter(v => typeof v === 'number' && Number.isFinite(v));
    if (values.length === 0) {
      return { count: 0, mean: 0, median: 0, std: 0, min: 0, max: 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const mean = sorted.reduce((a, b) => a + b, 0) / count;
    const median = count % 2 === 0 ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2 : sorted[Math.floor(count / 2)];
    const std = Math.sqrt(sorted.reduce((sq, n) => sq + (n - mean) ** 2, 0) / count);
    return { count, mean, median, std, min: sorted[0], max: sorted[sorted.length - 1] };
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

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const escapeHtml = (s) => String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const openPrintWindow = (html, title) => {
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;
    w.document.open();
    w.document.write(`<title>${escapeHtml(title || '导出')}</title>${html}`);
    w.document.close();
    w.focus();
    w.print();
  };

  const computeComprehensive = ({ exam, gradeLevel, allScores, layersForGrade }) => {
    const subjectList = (exam?.subjects || []).length > 0
      ? exam.subjects
      : Array.from(new Set((allScores || []).flatMap(s => Object.keys(s.scores || {}))));
    const maxTotal = Math.max(100, subjectList.length * 100);
    const thresholds = {
      excellent: maxTotal * 0.9,
      good: maxTotal * 0.8,
      pass: maxTotal * 0.6
    };

    const layerByClassId = new Map((layersForGrade || []).filter(l => l.class_id).map(l => [Number(l.class_id), String(l.layer_code || 'C').toUpperCase()]));

    const tagged = (allScores || []).map(s => {
      const classId = Number(s.class_id);
      const layer = layerByClassId.get(classId) || 'C';
      return { ...s, _layer: layer };
    });

    const baselineTotals = tagged
      .filter(s => s.is_valid !== false)
      .map(s => Number(s.total_score || 0))
      .filter(n => Number.isFinite(n) && n > 0);
    const baselineStats = calcBasicStats(baselineTotals);
    const baselineMean = baselineStats.mean;
    const baselineStd = baselineStats.std;

    const makeScope = (scopeKey) => {
      const scopedAll = scopeKey === 'all' ? tagged : tagged.filter(s => s._layer === scopeKey);
      const scopedValid = scopedAll.filter(s => s.is_valid !== false);
      const totalScores = scopedValid.map(s => Number(s.total_score || 0)).filter(n => Number.isFinite(n) && n > 0);
      const totalStats = calcBasicStats(totalScores);
      const totalSortedDesc = [...totalScores].sort((a, b) => b - a);
      const topRatio = 0.2;
      const scoreAtRatio = (ratio) => {
        const n = totalSortedDesc.length;
        if (!n) return { rank: 0, score: 0 };
        const r = Math.min(n, Math.max(1, Math.ceil(n * ratio)));
        return { rank: r, score: totalSortedDesc[r - 1] ?? 0 };
      };
      const top20 = scoreAtRatio(0.2);
      const top40 = scoreAtRatio(0.4);
      const top80 = scoreAtRatio(0.8);
      const standardScore = baselineStd > 0 ? (15 * (totalStats.mean - baselineMean) / baselineStd + 70) : 70;
      const ratioAtLine = (lineScore) => {
        if (!totalScores.length) return 0;
        return totalScores.filter(s => s >= lineScore).length / totalScores.length;
      };
      const top20Ratio = ratioAtLine(top20.score);
      const top80Ratio = ratioAtLine(top80.score);
      const zScore = standardScore * 0.5 + top20Ratio * 20 + top80Ratio * 30;

      const dist = {
        excellent: totalScores.filter(s => s >= thresholds.excellent).length,
        good: totalScores.filter(s => s >= thresholds.good && s < thresholds.excellent).length,
        pass: totalScores.filter(s => s >= thresholds.pass && s < thresholds.good).length,
        fail: totalScores.filter(s => s < thresholds.pass).length
      };

      const subjectStatistics = {};
      const keySubjects = {};
      subjectList.forEach(subject => {
        const values = scopedValid
          .map(s => (s.scores && s.scores[subject] !== undefined ? Number(s.scores[subject]) : null))
          .filter(v => v !== null && Number.isFinite(v));
        const st = calcBasicStats(values);
        const passCount = values.filter(v => v >= 60).length;
        const excellentCount = values.filter(v => v >= 90).length;
        subjectStatistics[subject] = {
          ...st,
          pass_rate: values.length ? (passCount / values.length * 100) : 0,
          excellent_rate: values.length ? (excellentCount / values.length * 100) : 0
        };

        const sortedDesc = [...values].sort((a, b) => b - a);
        const subjectTopRank = sortedDesc.length ? Math.ceil(sortedDesc.length * topRatio) : 0;
        const subjectTopScore = subjectTopRank ? sortedDesc[subjectTopRank - 1] : 0;
        const fullScore = Number(exam?.subject_scores?.[subject] ?? 100);
        keySubjects[subject] = {
          max: st.max,
          mean: st.mean,
          full_score: Number.isFinite(fullScore) ? fullScore : 100,
          top20_rank: subjectTopRank,
          top20_score: subjectTopScore
        };
      });

      const fullTotal = Number(exam?.full_score ?? subjectList.reduce((sum, subj) => sum + Number(exam?.subject_scores?.[subj] ?? 100), 0));
      const rankPointsBase = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800];
      const rankPoints = [...rankPointsBase, totalSortedDesc.length].filter(r => r > 0 && r <= totalSortedDesc.length);
      const uniqueRankPoints = Array.from(new Set(rankPoints)).sort((a, b) => a - b);
      const rankBands = uniqueRankPoints.map(rank => ({
        rank,
        score: totalSortedDesc[rank - 1] ?? 0
      }));

      return {
        summary: {
          total_students: scopedAll.length,
          participated: scopedValid.length,
          participation_rate: scopedAll.length ? (scopedValid.length / scopedAll.length * 100) : 0,
          grade_mean: totalStats.mean,
          grade_std: totalStats.std,
          pass_rate: totalScores.length ? ((dist.excellent + dist.good + dist.pass) / totalScores.length * 100) : 0,
          excellent_rate: totalScores.length ? (dist.excellent / totalScores.length * 100) : 0
        },
        overall: {
          summary: {
            total_students: scopedAll.length,
            participated: scopedValid.length,
            participation_rate: scopedAll.length ? (scopedValid.length / scopedAll.length * 100) : 0
          },
          grade_statistics: {
            total_score: {
              mean: totalStats.mean,
              median: totalStats.median,
              std: totalStats.std,
              min: totalStats.min,
              max: totalStats.max
            }
          },
          distribution: dist,
          chart_data: {
            score_distribution: [
              { range: `${Math.round(thresholds.excellent)}-${maxTotal}`, count: dist.excellent, percentage: totalScores.length ? (dist.excellent / totalScores.length * 100) : 0 },
              { range: `${Math.round(thresholds.good)}-${Math.round(thresholds.excellent) - 1}`, count: dist.good, percentage: totalScores.length ? (dist.good / totalScores.length * 100) : 0 },
              { range: `${Math.round(thresholds.pass)}-${Math.round(thresholds.good) - 1}`, count: dist.pass, percentage: totalScores.length ? (dist.pass / totalScores.length * 100) : 0 },
              { range: `0-${Math.round(thresholds.pass) - 1}`, count: dist.fail, percentage: totalScores.length ? (dist.fail / totalScores.length * 100) : 0 }
            ]
          }
        },
        subject_analysis: {
          subject_statistics: subjectStatistics,
          chart_data: {
            subject_scores: Object.entries(subjectStatistics).map(([subject, stats]) => ({
              subject,
              mean: stats.mean,
              pass_rate: stats.pass_rate
            }))
          }
        },
        key_metrics: {
          top_ratio: topRatio,
          subjects: keySubjects,
          total: {
            max: totalStats.max,
            mean: totalStats.mean,
            full_score: Number.isFinite(fullTotal) ? fullTotal : maxTotal,
            standard_score: standardScore,
            z_score: zScore,
            top20_rank: top20.rank,
            top20_score: top20.score,
            top40_rank: top40.rank,
            top40_score: top40.score,
            top80_rank: top80.rank,
            top80_score: top80.score
          },
          rank_bands: {
            total: rankBands
          }
        }
      };
    };

    const layerGroups = { A: [], B: [], C: [] };
    tagged.filter(s => s.is_valid !== false).forEach(s => {
      const layer = s._layer || 'C';
      if (layerGroups[layer]) layerGroups[layer].push(Number(s.total_score || 0));
    });
    const layerStatistics = {};
    Object.entries(layerGroups).forEach(([layer, scores]) => {
      const values = scores.filter(n => Number.isFinite(n) && n > 0);
      const st = calcBasicStats(values);
      const passCount = values.filter(v => v >= thresholds.pass).length;
      const excellentCount = values.filter(v => v >= thresholds.excellent).length;
      layerStatistics[layer] = {
        student_count: values.length,
        mean: st.mean,
        std: st.std,
        pass_rate: values.length ? (passCount / values.length * 100) : 0,
        excellent_rate: values.length ? (excellentCount / values.length * 100) : 0
      };
    });

    return {
      analysis_id: `LOCAL_${Date.now()}`,
      exam_id: exam.id,
      exam_name: exam.exam_name,
      grade_level: gradeLevel,
      analysis_type: 'comprehensive',
      created_at: new Date().toISOString(),
      scopes: {
        all: makeScope('all'),
        A: makeScope('A'),
        B: makeScope('B'),
        C: makeScope('C')
      },
      layer_comparison: {
        layer_statistics: layerStatistics,
        chart_data: {
          layer_comparison: Object.entries(layerStatistics).map(([layer, stats]) => ({
            layer: `${layer}层(${layer === 'A' ? '实验班' : layer === 'B' ? '创新班' : '平行班'})`,
            mean: stats.mean,
            pass_rate: stats.pass_rate,
            count: stats.student_count
          }))
        }
      },
      _tagged_scores: tagged
    };
  };

  // 获取当前用户
  useEffect(() => {
    // 优先使用 props 传入的用户，否则从 localStorage 获取
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const user = propUser || storedUser;
    setCurrentUser(user);
    
    // 检查权限 - 支持多种角色字段
    const allowedRoles = ['super_admin', 'dean', 'research_leader', '教务处主任', '系统管理员', '教研组长'];
    const allowedPermissions = ['sys_admin', 'edu_admin', 'exam_admin'];
    const userRole = user?.role || user?.role_name || '';
    const userPermission = user?.permission_code || '';
    
    const hasAllowedRole = allowedRoles.includes(userRole) || 
      allowedRoles.some(role => userRole.includes(role));
    const hasAllowedPermission = allowedPermissions.includes(userPermission);
    
    console.log('User:', user);
    console.log('Has permission:', hasAllowedRole || hasAllowedPermission);
    
    setHasPermission(hasAllowedRole || hasAllowedPermission);
  }, [propUser]);

  // 获取考试列表 - 从 schoolData 获取，与考务管理数据关联
  const fetchExams = () => {
    // 从 schoolData 获取考试数据
    const schoolExams = schoolData.exams || [];
    if (schoolExams.length > 0) {
      // 转换为组件需要的格式
      const formattedExams = schoolExams.map(exam => ({
        id: exam.id,
        exam_name: exam.exam_name,
        term: exam.term,
        exam_type: exam.exam_type,
        grade_level: exam.grade_level,
        exam_date: exam.exam_date,
        subjects: exam.subjects || [],
        status: exam.status,
        total_students: exam.total_students || 0
      }));
      setExams(formattedExams);
      setSelectedExam(prev => (prev ? formattedExams.find(ex => ex.id === prev.id) || prev : prev));
    } else {
      // 如果没有数据，使用模拟数据
      setExams([
        { id: 1, exam_name: '七年级期中教学调研', grade_level: '7年级', exam_date: '2025-02-20', subjects: ['语文', '数学', '英语', '科学', '社会'], status: '已完成', total_students: 0 },
        { id: 2, exam_name: '八年级期中教学调研', grade_level: '8年级', exam_date: '2025-02-21', subjects: ['语文', '数学', '英语', '科学', '社会'], status: '已完成', total_students: 0 },
        { id: 3, exam_name: '九年级期中教学调研', grade_level: '9年级', exam_date: '2025-02-22', subjects: ['语文', '数学', '英语', '科学', '社会'], status: '已完成', total_students: 0 }
      ]);
    }
  };

  // 获取层次配置
  const fetchLayerConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/score-analysis/layers/config`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setLayerConfig(data.layers || []);
      }
    } catch (error) {
      console.error('获取层次配置失败:', error);
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
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        setAnalysisHistory(data.records || []);
      }
    } catch (error) {
      console.error('获取分析历史失败:', error);
    }
  };

  // 获取发布记录
  const fetchPublications = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/score-analysis/publications?grade_level=${selectedGrade}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        setPublications(data.records || []);
      }
    } catch (error) {
      console.error('获取发布记录失败:', error);
    }
  };

  // 获取操作日志
  const fetchLogs = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/score-analysis/logs?page=1&page_size=50`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        setLogs(data.records || []);
      }
    } catch (error) {
      console.error('获取操作日志失败:', error);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchExams();
    fetchLayerConfig();
  }, []);

  useEffect(() => {
    const handler = () => fetchExams();
    window.addEventListener('schoolData:changed', handler);
    return () => window.removeEventListener('schoolData:changed', handler);
  }, []);

  // 当年级变化时
  useEffect(() => {
    fetchClassLayers();
    fetchAnalysisHistory();
    fetchPublications();
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

  useEffect(() => {
    if (!analysisResult || analysisResult.analysis_type !== 'comprehensive') return;
    const scopeKey = scopeKeyFromValue(analysisScope);
    const scopeData = analysisResult?.scopes?.[scopeKey] || analysisResult?.scopes?.all;
    const topRank = scopeData?.key_metrics?.total?.top20_rank || 0;
    setRankFocus(prev => (prev > 0 ? Math.min(prev, scopeData?.summary?.participated || prev) : topRank));
  }, [analysisResult, analysisScope]);

  // 执行分析 - 从 schoolData 获取真实成绩数据进行分析
  const handleAnalyze = async () => {
    if (!selectedExam) {
      alert('请先选择考试');
      return;
    }

    setLoading(true);
    try {
      const allExamScores = schoolData.examScores?.filter(score => score.exam_id === selectedExam.id) || [];
      if (allExamScores.length === 0) {
        alert('该考试暂无成绩数据，请先导入成绩！');
        return;
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

      alert('分析完成！');
    } catch (error) {
      console.error('分析失败:', error);
      alert('分析失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 发布成果
  const handlePublish = async () => {
    if (!analysisResult || !analysisResult.analysis_id) {
      alert('请先执行分析');
      return;
    }

    if (!publishForm.title) {
      alert('请输入发布标题');
      return;
    }

    if (publishForm.recipient_types.length === 0) {
      alert('请至少选择一个接收对象');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/score-analysis/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          analysis_id: analysisResult.analysis_id,
          title: publishForm.title,
          content_summary: publishForm.content_summary,
          recipient_types: publishForm.recipient_types
        })
      });

      const data = await response.json();
      if (data.success) {
        alert(data.message);
        setShowPublishModal(false);
        setPublishForm({ title: '', content_summary: '', recipient_types: [] });
        fetchPublications();
      } else {
        alert(data.message || '发布失败');
      }
    } catch (error) {
      console.error('发布失败:', error);
      alert('发布失败，请检查网络连接');
    }
  };

  // 导出分析结果
  const handleExport = async (format) => {
    if (!analysisResult || !analysisResult.analysis_id) {
      alert('请先执行分析');
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/score-analysis/export/${analysisResult.analysis_id}?format=${format}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        if (format === 'json') {
          // 下载JSON文件
          const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `analysis_${analysisResult.analysis_id}.json`;
          a.click();
        } else {
          alert(data.message || '导出成功');
        }
      } else {
        alert(data.message || '导出失败');
      }
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请检查网络连接');
    }
  };

  const exportPdfReport = () => {
    if (analysisType === 'history_compare') {
      const gradeExams = exams.filter(ex => ex.grade_level === selectedGrade);
      const baseExam = gradeExams.find(ex => ex.id === Number(historyCompare.baseExamId)) || null;
      const targetExam = gradeExams.find(ex => ex.id === Number(historyCompare.targetExamId)) || null;
      if (!baseExam || !targetExam) {
        alert('请先选择基准考试与对比考试');
        return;
      }

      const computeForExam = (exam) => {
        const allExamScores = schoolData.examScores?.filter(score => score.exam_id === exam.id) || [];
        if (allExamScores.length === 0) return null;
        const layersForGrade = normalizeClassLayers(schoolData.classLayers || [], selectedGrade);
        return computeComprehensive({ exam, gradeLevel: selectedGrade, allScores: allExamScores, layersForGrade });
      };

      const baseResult = computeForExam(baseExam);
      const targetResult = computeForExam(targetExam);
      if (!baseResult || !targetResult) {
        alert('所选考试缺少成绩数据，无法导出');
        return;
      }

      const scopeKey = scopeKeyFromValue(historyCompare.scope);
      const baseScope = baseResult?.scopes?.[scopeKey] || baseResult?.scopes?.all;
      const targetScope = targetResult?.scopes?.[scopeKey] || targetResult?.scopes?.all;
      const baseSummary = baseScope?.summary || {};
      const targetSummary = targetScope?.summary || {};
      const baseTotal = baseScope?.key_metrics?.total || {};
      const targetTotal = targetScope?.key_metrics?.total || {};

      const fmt1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '0.0');
      const absBase = (baseSummary.total_students || 0) - (baseSummary.participated || 0);
      const absTarget = (targetSummary.total_students || 0) - (targetSummary.participated || 0);

      const subjects = (targetExam?.subjects || baseExam?.subjects || []).filter(Boolean);
      const baseSubjects = baseScope?.key_metrics?.subjects || {};
      const targetSubjects = targetScope?.key_metrics?.subjects || {};
      const deltaRows = subjects.map(s => ({
        subject: s,
        base: baseSubjects?.[s]?.mean || 0,
        target: targetSubjects?.[s]?.mean || 0,
        delta: (targetSubjects?.[s]?.mean || 0) - (baseSubjects?.[s]?.mean || 0)
      }));

      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              @page { margin: 14mm; }
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #111827; }
              .header { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; padding-bottom:10px; border-bottom:1px solid #e5e7eb; }
              .title { font-size:18px; font-weight:800; margin:0; }
              .sub { font-size:12px; color:#6b7280; margin-top:4px; }
              .meta { font-size:12px; color:#6b7280; text-align:right; }
              .grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:10px; margin:12px 0; }
              .card { border:1px solid #e5e7eb; border-radius:10px; padding:10px; }
              .k { font-size:11px; color:#6b7280; }
              .v { font-size:18px; font-weight:800; margin-top:4px; }
              .vpos { color:#047857; }
              .vneg { color:#b91c1c; }
              h2 { font-size:14px; font-weight:800; margin:18px 0 10px; }
              table { width:100%; border-collapse:collapse; font-size:12px; }
              th, td { border:1px solid #e5e7eb; padding:6px 8px; text-align:center; }
              th { background:#f9fafb; color:#374151; }
              td:first-child, th:first-child { text-align:left; }
              .pagebreak { page-break-before: always; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <h1 class="title">历史对比报告</h1>
                <div class="sub">${escapeHtml(selectedGrade)} · 范围：${escapeHtml(historyCompare.scope)}</div>
              </div>
              <div class="meta">
                <div>${escapeHtml(getExamOptionLabel(baseExam))} → ${escapeHtml(getExamOptionLabel(targetExam))}</div>
                <div>${escapeHtml(new Date().toLocaleString())}</div>
              </div>
            </div>

            <div class="grid">
              ${[
                { k: '均分变化', d: targetSummary.grade_mean - baseSummary.grade_mean },
                { k: '标准差变化', d: targetSummary.grade_std - baseSummary.grade_std },
                { k: '标准分变化', d: (targetTotal.standard_score || 0) - (baseTotal.standard_score || 0) },
                { k: '前20%分数线变化', d: (targetTotal.top20_score || 0) - (baseTotal.top20_score || 0) },
                { k: '前40%分数线变化', d: (targetTotal.top40_score || 0) - (baseTotal.top40_score || 0) },
                { k: '后20%分数线变化', d: (targetTotal.top80_score || 0) - (baseTotal.top80_score || 0) },
                { k: 'Z分变化', d: (targetTotal.z_score || 0) - (baseTotal.z_score || 0) },
                { k: '缺考人数变化', d: absTarget - absBase, raw: true }
              ].map(item => `
                <div class="card">
                  <div class="k">${escapeHtml(item.k)}</div>
                  <div class="v ${item.d >= 0 ? 'vpos' : 'vneg'}">${item.raw ? String(item.d) : fmt1(item.d)}</div>
                </div>
              `).join('')}
            </div>

            <h2>总分关键指标（基准 → 对比）</h2>
            <table>
              <thead>
                <tr>
                  <th>指标</th>
                  <th>基准</th>
                  <th>对比</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>平均分</td><td>${fmt1(baseSummary.grade_mean)}</td><td>${fmt1(targetSummary.grade_mean)}</td></tr>
                <tr><td>标准差</td><td>${fmt1(baseSummary.grade_std)}</td><td>${fmt1(targetSummary.grade_std)}</td></tr>
                <tr><td>标准分</td><td>${fmt1(baseTotal.standard_score)}</td><td>${fmt1(targetTotal.standard_score)}</td></tr>
                <tr><td>前20%分数线</td><td>${fmt1(baseTotal.top20_score)}</td><td>${fmt1(targetTotal.top20_score)}</td></tr>
                <tr><td>前40%分数线</td><td>${fmt1(baseTotal.top40_score)}</td><td>${fmt1(targetTotal.top40_score)}</td></tr>
                <tr><td>后20%分数线</td><td>${fmt1(baseTotal.top80_score)}</td><td>${fmt1(targetTotal.top80_score)}</td></tr>
                <tr><td>Z分</td><td>${fmt1(baseTotal.z_score)}</td><td>${fmt1(targetTotal.z_score)}</td></tr>
                <tr><td>缺考人数</td><td>${absBase}</td><td>${absTarget}</td></tr>
              </tbody>
            </table>

            <div class="pagebreak"></div>
            <h2>学科均分对比（基准 / 对比 / 变化）</h2>
            <table>
              <thead>
                <tr>
                  <th>学科</th>
                  <th>基准均分</th>
                  <th>对比均分</th>
                  <th>变化</th>
                </tr>
              </thead>
              <tbody>
                ${deltaRows.map(r => `
                  <tr>
                    <td>${escapeHtml(r.subject)}</td>
                    <td>${fmt1(r.base)}</td>
                    <td>${fmt1(r.target)}</td>
                    <td style="color:${r.delta >= 0 ? '#047857' : '#b91c1c'}; font-weight:700;">${fmt1(r.delta)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;

      openPrintWindow(html, `历史对比-${selectedGrade}`);
      return;
    }

    if (!analysisResult || analysisResult.analysis_type !== 'comprehensive') {
      alert('请先执行分析');
      return;
    }

    const scopeKey = scopeKeyFromValue(analysisScope);
    const scopeData = analysisResult?.scopes?.[scopeKey] || analysisResult?.scopes?.all;
    const summary = scopeData?.summary || {};
    const key = scopeData?.key_metrics?.total || {};
    const subjects = (selectedExam?.subjects || []).filter(Boolean);
    const subjectKey = scopeData?.key_metrics?.subjects || {};
    const subjectStats = scopeData?.subject_analysis?.subject_statistics || {};
    const rankBands = scopeData?.key_metrics?.rank_bands?.total || [];
    const scoreDist = scopeData?.overall?.chart_data?.score_distribution || [];

    const fmt1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '0.0');
    const absence = (summary.total_students || 0) - (summary.participated || 0);
    const scopeLabel = scopeKey === 'all' ? '全部' : `${scopeKey}层`;

    const rankRows = [];
    for (let i = 0; i < rankBands.length; i += 8) rankRows.push(rankBands.slice(i, i + 8));

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            @page { margin: 14mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #111827; }
            .header { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; padding-bottom:10px; border-bottom:1px solid #e5e7eb; }
            .title { font-size:18px; font-weight:800; margin:0; }
            .sub { font-size:12px; color:#6b7280; margin-top:4px; }
            .meta { font-size:12px; color:#6b7280; text-align:right; }
            .grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:10px; margin:12px 0; }
            .card { border:1px solid #e5e7eb; border-radius:10px; padding:10px; }
            .k { font-size:11px; color:#6b7280; }
            .v { font-size:18px; font-weight:800; margin-top:4px; }
            h2 { font-size:14px; font-weight:800; margin:18px 0 10px; }
            table { width:100%; border-collapse:collapse; font-size:12px; }
            th, td { border:1px solid #e5e7eb; padding:6px 8px; text-align:center; }
            th { background:#f9fafb; color:#374151; }
            td:first-child, th:first-child { text-align:left; }
            .pagebreak { page-break-before: always; }
            .note { font-size:12px; color:#6b7280; margin-top:8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">${escapeHtml(analysisResult.exam_name)} · 成绩分析报告</h1>
              <div class="sub">${escapeHtml(analysisResult.grade_level)} · 范围：${escapeHtml(scopeLabel)}</div>
            </div>
            <div class="meta">
              <div>参与人数 ${summary.participated || 0}/${summary.total_students || 0}</div>
              <div>${escapeHtml(new Date(analysisResult.created_at).toLocaleString())}</div>
            </div>
          </div>

          <div class="grid">
            ${[
              { k: '平均分', v: fmt1(summary.grade_mean) },
              { k: '标准差', v: fmt1(summary.grade_std) },
              { k: '标准分', v: fmt1(key.standard_score) },
              { k: '前20%分数线', v: fmt1(key.top20_score) },
              { k: '前40%分数线', v: fmt1(key.top40_score) },
              { k: '后20%分数线', v: fmt1(key.top80_score) },
              { k: 'Z分', v: fmt1(key.z_score) },
              { k: '缺考人数', v: String(absence) }
            ].map(item => `
              <div class="card">
                <div class="k">${escapeHtml(item.k)}</div>
                <div class="v">${escapeHtml(item.v)}</div>
              </div>
            `).join('')}
          </div>

          <h2>总分分布（分数段）</h2>
          <table>
            <thead>
              <tr><th>分数段</th><th>人数</th><th>占比</th></tr>
            </thead>
            <tbody>
              ${scoreDist.map(r => `<tr><td>${escapeHtml(r.range)}</td><td>${r.count}</td><td>${fmt1(r.percentage)}%</td></tr>`).join('')}
            </tbody>
          </table>

          <h2>关键数值表</h2>
          <table>
            <thead>
              <tr>
                <th>指标</th>
                ${subjects.map(s => `<th>${escapeHtml(s)}</th>`).join('')}
                <th>总分（统计维度）</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>最高分</td>
                ${subjects.map(s => `<td>${fmt1(subjectKey?.[s]?.max)}</td>`).join('')}
                <td>${fmt1(key.max)}</td>
              </tr>
              <tr>
                <td>优秀分（前20%分数线）</td>
                ${subjects.map(s => `<td>${fmt1(subjectKey?.[s]?.top20_score)}</td>`).join('')}
                <td>${fmt1(key.top20_score)}</td>
              </tr>
              <tr>
                <td>平均分</td>
                ${subjects.map(s => `<td>${fmt1(subjectKey?.[s]?.mean)}</td>`).join('')}
                <td>${fmt1(key.mean)}</td>
              </tr>
              <tr>
                <td>卷面分</td>
                ${subjects.map(s => `<td>${fmt1(subjectKey?.[s]?.full_score)}</td>`).join('')}
                <td>${fmt1(key.full_score)}</td>
              </tr>
            </tbody>
          </table>

          <div class="pagebreak"></div>
          <h2>总分排名分数段</h2>
          <table>
            <tbody>
              ${rankRows.map(row => `
                <tr>
                  <td style="font-weight:700;background:#f9fafb;">名次</td>
                  ${row.map(i => `<td style="font-weight:700;">${i.rank}</td>`).join('')}
                </tr>
                <tr>
                  <td style="font-weight:700;">分数</td>
                  ${row.map(i => `<td>${fmt1(i.score)}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h2>学科统计（均分 / 标准差 / 前20%分数线）</h2>
          <table>
            <thead>
              <tr><th>学科</th><th>平均分</th><th>标准差</th><th>前20%分数线</th></tr>
            </thead>
            <tbody>
              ${subjects.map(s => `
                <tr>
                  <td>${escapeHtml(s)}</td>
                  <td>${fmt1(subjectStats?.[s]?.mean)}</td>
                  <td>${fmt1(subjectStats?.[s]?.std)}</td>
                  <td>${fmt1(subjectKey?.[s]?.top20_score)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="note">Z分 = 标准分×0.5 + 前20%占比×20 + 前80%占比×30</div>
        </body>
      </html>
    `;

    openPrintWindow(html, `${analysisResult.exam_name}-${scopeLabel}-成绩分析报告`);
  };

  // 渲染分析结果 - 综合呈现所有层次
  const renderAnalysisResult = () => {
    if (!analysisResult) {
      return (
        <div className="text-center py-12 text-gray-500">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>请选择考试，然后点击"执行分析"</p>
        </div>
      );
    }

    if (analysisType === 'history_compare') {
      const gradeExams = exams.filter(ex => ex.grade_level === selectedGrade);
      const baseExam = gradeExams.find(ex => ex.id === Number(historyCompare.baseExamId)) || null;
      const targetExam = gradeExams.find(ex => ex.id === Number(historyCompare.targetExamId)) || null;

      const computeForExam = (exam) => {
        if (!exam) return null;
        const allExamScores = schoolData.examScores?.filter(score => score.exam_id === exam.id) || [];
        if (allExamScores.length === 0) return null;
        const layersForGrade = normalizeClassLayers(schoolData.classLayers || [], selectedGrade);
        return computeComprehensive({
          exam,
          gradeLevel: selectedGrade,
          allScores: allExamScores,
          layersForGrade
        });
      };

      const baseResult = computeForExam(baseExam);
      const targetResult = computeForExam(targetExam);
      const scopeKey = scopeKeyFromValue(historyCompare.scope);
      const baseScope = baseResult?.scopes?.[scopeKey] || baseResult?.scopes?.all;
      const targetScope = targetResult?.scopes?.[scopeKey] || targetResult?.scopes?.all;
      const baseKey = baseScope?.key_metrics || {};
      const targetKey = targetScope?.key_metrics || {};
      const baseSummary = baseScope?.summary || {};
      const targetSummary = targetScope?.summary || {};

      const fmt1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '0.0');
      const fmtPct = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '0.0');

      const subjects = (targetExam?.subjects || baseExam?.subjects || []).filter(Boolean);
      const deltaSubjectMeans = subjects.map(s => ({
        subject: s,
        delta: (targetKey?.subjects?.[s]?.mean || 0) - (baseKey?.subjects?.[s]?.mean || 0)
      }));

      return (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">历史对比</h2>
                <p className="text-sm text-gray-500 mt-1">按学期/学年维度对比关键指标与学科均分变化</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={historyCompare.baseExamId}
                  onChange={(e) => setHistoryCompare(prev => ({ ...prev, baseExamId: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">基准考试</option>
                  {gradeExams.map(ex => (
                    <option key={ex.id} value={ex.id}>{getExamOptionLabel(ex)}</option>
                  ))}
                </select>
                <select
                  value={historyCompare.targetExamId}
                  onChange={(e) => setHistoryCompare(prev => ({ ...prev, targetExamId: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">对比考试</option>
                  {gradeExams.map(ex => (
                    <option key={ex.id} value={ex.id}>{getExamOptionLabel(ex)}</option>
                  ))}
                </select>
                <select
                  value={historyCompare.scope}
                  onChange={(e) => setHistoryCompare(prev => ({ ...prev, scope: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="all">全部</option>
                  <option value="layer_a">A层（实验班）</option>
                  <option value="layer_b">B层（创新班）</option>
                  <option value="layer_c">C层（平行班）</option>
                </select>
              </div>
            </div>
          </div>

          {(!baseExam || !targetExam) && (
            <div className="bg-white rounded-lg shadow-sm p-6 text-gray-600">
              请选择“基准考试”和“对比考试”，即可查看对比结果。
            </div>
          )}

          {(baseExam && targetExam) && (!baseResult || !targetResult) && (
            <div className="bg-white rounded-lg shadow-sm p-6 text-gray-600">
              所选考试缺少成绩数据，无法进行对比。
            </div>
          )}

          {baseScope && targetScope && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <p className="text-sm text-gray-500 mb-1">全段均分变化</p>
                  <p className={`text-2xl font-bold ${(targetSummary.grade_mean - baseSummary.grade_mean) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt1(targetSummary.grade_mean - baseSummary.grade_mean)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{fmt1(baseSummary.grade_mean)} → {fmt1(targetSummary.grade_mean)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <p className="text-sm text-gray-500 mb-1">标准差变化</p>
                  <p className={`text-2xl font-bold ${(targetSummary.grade_std - baseSummary.grade_std) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt1(targetSummary.grade_std - baseSummary.grade_std)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{fmt1(baseSummary.grade_std)} → {fmt1(targetSummary.grade_std)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <p className="text-sm text-gray-500 mb-1">标准分变化</p>
                  <p className={`text-2xl font-bold ${((targetKey?.total?.standard_score || 0) - (baseKey?.total?.standard_score || 0)) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt1((targetKey?.total?.standard_score || 0) - (baseKey?.total?.standard_score || 0))}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{fmt1(baseKey?.total?.standard_score)} → {fmt1(targetKey?.total?.standard_score)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <p className="text-sm text-gray-500 mb-1">前20%分数线变化</p>
                  <p className={`text-2xl font-bold ${(targetKey?.total?.top20_score - baseKey?.total?.top20_score) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt1((targetKey?.total?.top20_score || 0) - (baseKey?.total?.top20_score || 0))}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{fmt1(baseKey?.total?.top20_score)} → {fmt1(targetKey?.total?.top20_score)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <p className="text-sm text-gray-500 mb-1">前40%分数线变化</p>
                  <p className={`text-2xl font-bold ${((targetKey?.total?.top40_score || 0) - (baseKey?.total?.top40_score || 0)) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt1((targetKey?.total?.top40_score || 0) - (baseKey?.total?.top40_score || 0))}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{fmt1(baseKey?.total?.top40_score)} → {fmt1(targetKey?.total?.top40_score)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <p className="text-sm text-gray-500 mb-1">后20%分数线变化</p>
                  <p className={`text-2xl font-bold ${((targetKey?.total?.top80_score || 0) - (baseKey?.total?.top80_score || 0)) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt1((targetKey?.total?.top80_score || 0) - (baseKey?.total?.top80_score || 0))}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{fmt1(baseKey?.total?.top80_score)} → {fmt1(targetKey?.total?.top80_score)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <p className="text-sm text-gray-500 mb-1">Z分变化</p>
                  <p className={`text-2xl font-bold ${((targetKey?.total?.z_score || 0) - (baseKey?.total?.z_score || 0)) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt1((targetKey?.total?.z_score || 0) - (baseKey?.total?.z_score || 0))}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{fmt1(baseKey?.total?.z_score)} → {fmt1(targetKey?.total?.z_score)}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm p-4">
                  <p className="text-sm text-gray-500 mb-1">缺考人数变化</p>
                  <p className={`text-2xl font-bold ${((targetSummary.total_students - targetSummary.participated) - (baseSummary.total_students - baseSummary.participated)) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {(targetSummary.total_students - targetSummary.participated) - (baseSummary.total_students - baseSummary.participated)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{baseSummary.total_students - baseSummary.participated} → {targetSummary.total_students - targetSummary.participated}</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">学科均分变化（对比考试 - 基准考试）</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={deltaSubjectMeans}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" />
                    <YAxis />
                    <Tooltip formatter={(v) => fmt1(Number(v))} />
                    <ReferenceLine y={0} stroke="#000" />
                    <Bar dataKey="delta" name="均分变化">
                      {deltaSubjectMeans.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.delta >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      );
    }

    // 如果是综合分析结果，渲染综合视图
    if (analysisResult.analysis_type === 'comprehensive') {
      return renderComprehensiveAnalysis(analysisResult);
    }

    // 否则根据分析类型渲染
    const { analysis_data } = analysisResult;
    switch (analysisType) {
      case 'overall':
        return renderOverallAnalysis(analysis_data);
      case 'layer_comparison':
        return renderLayerComparison(analysis_data);
      case 'subject_analysis':
        return renderSubjectAnalysis(analysis_data);
      case 'student_progress':
        return renderStudentProgress(analysis_data);
      case 'class_contrast':
        return renderClassContrast(analysis_data);
      default:
        return <div>未知的分析类型</div>;
    }
  };

  // 综合分析结果渲染 - 一次性展示所有层次
  const renderComprehensiveAnalysis = (data) => {
    const scopeKey = scopeKeyFromValue(analysisScope);
    const scopeData = data?.scopes?.[scopeKey] || data?.scopes?.all;
    const summary = scopeData?.summary || {};
    const overall = scopeData?.overall || {};
    const subject_analysis = scopeData?.subject_analysis || {};
    const layer_comparison = data?.layer_comparison || {};
    const keyMetrics = scopeData?.key_metrics || {};
    const fmt1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '0.0');
    const fmtPct = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '0.0');
    const validTotalsSorted = (examScores || [])
      .map(s => Number(s.total_score || 0))
      .filter(n => Number.isFinite(n) && n > 0)
      .sort((a, b) => b - a);
    const participated = validTotalsSorted.length;
    const safeRank = participated ? Math.min(Math.max(Number(rankFocus || 0) || 0, 1), participated) : 0;
    const scoreAtRank = safeRank ? (validTotalsSorted[safeRank - 1] ?? 0) : 0;
    const percentAtRank = participated ? (safeRank / participated * 100) : 0;
    const top20Rank = keyMetrics?.total?.top20_rank || (participated ? Math.ceil(participated * 0.2) : 0);
    const top20Score = keyMetrics?.total?.top20_score || (top20Rank ? (validTotalsSorted[top20Rank - 1] ?? 0) : 0);
    const subjectsForTable = (selectedExam?.subjects || []).filter(Boolean);

    return (
      <div className="space-y-8">
        {/* 分析报告头部 */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">{data.exam_name} - 综合分析报告</h2>
          <div className="flex flex-wrap gap-6 text-sm opacity-90">
            <span>年级: {data.grade_level}</span>
            <span>范围: {scopeKey === 'all' ? '全部' : `${scopeKey}层（${scopeKey === 'A' ? '实验班' : scopeKey === 'B' ? '创新班' : '平行班'}）`}</span>
            <span>分析时间: {new Date(data.created_at).toLocaleString()}</span>
            <span>参与人数: {summary.participated}/{summary.total_students}</span>
          </div>
        </div>

        {/* 核心指标概览 */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">年级平均分</p>
            <p className="text-3xl font-bold text-blue-600">{fmt1(summary.grade_mean)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">标准差</p>
            <p className="text-3xl font-bold text-purple-600">{fmt1(summary.grade_std)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">标准分</p>
            <p className="text-3xl font-bold text-indigo-600">{fmt1(keyMetrics?.total?.standard_score)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">前20%分数线</p>
            <p className="text-3xl font-bold text-blue-700">{fmt1(keyMetrics?.total?.top20_score)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">前40%分数线</p>
            <p className="text-3xl font-bold text-blue-700">{fmt1(keyMetrics?.total?.top40_score)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">后20%分数线</p>
            <p className="text-3xl font-bold text-orange-600">{fmt1(keyMetrics?.total?.top80_score)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Z分</p>
            <p className="text-3xl font-bold text-emerald-600">{fmt1(keyMetrics?.total?.z_score)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 text-center">
            <p className="text-sm text-gray-500 mb-1">缺考人数</p>
            <p className="text-3xl font-bold text-red-600">{summary.total_students - summary.participated}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-gray-800">综合分析关键数值</h3>
              <span className="text-sm text-gray-500">优秀分 = 年级前20%分数线</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setKeyPanel('metrics')}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  keyPanel === 'metrics' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                关键数值表
              </button>
              <button
                onClick={() => setKeyPanel('ranks')}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                  keyPanel === 'ranks' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                总分名次分数段
              </button>
            </div>
          </div>

          {keyPanel === 'metrics' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">指标</th>
                    {subjectsForTable.map(subj => (
                      <th key={subj} className="px-4 py-3 text-center">{subj}</th>
                    ))}
                    <th className="px-4 py-3 text-center">总分（统计维度）</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-700">最高分</td>
                    {subjectsForTable.map(subj => (
                      <td key={subj} className="px-4 py-3 text-center">{fmt1(keyMetrics?.subjects?.[subj]?.max)}</td>
                    ))}
                    <td className="px-4 py-3 text-center">{fmt1(keyMetrics?.total?.max)}</td>
                  </tr>
                  <tr className="bg-blue-50/40">
                    <td className="px-4 py-3 font-medium text-gray-700">优秀分（前20%分数线）</td>
                    {subjectsForTable.map(subj => (
                      <td key={subj} className="px-4 py-3 text-center font-semibold text-blue-700">{fmt1(keyMetrics?.subjects?.[subj]?.top20_score)}</td>
                    ))}
                    <td className="px-4 py-3 text-center font-semibold text-blue-700">{fmt1(keyMetrics?.total?.top20_score)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-700">平均分</td>
                    {subjectsForTable.map(subj => (
                      <td key={subj} className="px-4 py-3 text-center">{fmt1(keyMetrics?.subjects?.[subj]?.mean)}</td>
                    ))}
                    <td className="px-4 py-3 text-center">{fmt1(keyMetrics?.total?.mean)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium text-gray-700">卷面分</td>
                    {subjectsForTable.map(subj => (
                      <td key={subj} className="px-4 py-3 text-center">{fmt1(keyMetrics?.subjects?.[subj]?.full_score)}</td>
                    ))}
                    <td className="px-4 py-3 text-center">{fmt1(keyMetrics?.total?.full_score)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {keyPanel === 'ranks' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">名次</p>
                  <p className="text-2xl font-bold text-gray-800">{safeRank || '-'}</p>
                  <p className="text-xs text-gray-500">实考人数 {participated || 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">对应总分</p>
                  <p className="text-2xl font-bold text-blue-700">{safeRank ? fmt1(scoreAtRank) : '-'}</p>
                  <p className="text-xs text-gray-500">约前 {fmtPct(percentAtRank)}%</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">优秀分（前20%）</p>
                  <p className="text-2xl font-bold text-indigo-700">{top20Rank ? fmt1(top20Score) : '-'}</p>
                  <p className="text-xs text-gray-500">名次 {top20Rank || '-'}</p>
                </div>
              </div>

              {participated > 0 && (
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={participated}
                    value={safeRank || 1}
                    onChange={(e) => setRankFocus(parseInt(e.target.value, 10))}
                    className="w-full"
                  />
                  <div className="flex gap-2 flex-wrap">
                    {[50, 100, 150, 200, 250, 300, 350, 400].filter(r => r <= participated).map(r => (
                      <button
                        key={r}
                        onClick={() => setRankFocus(r)}
                        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                      >
                        {r}
                      </button>
                    ))}
                    {participated > 0 && (
                      <button
                        onClick={() => setRankFocus(participated)}
                        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                      >
                        {participated}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">总分名次-分数曲线</h4>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart
                      data={(() => {
                        const n = validTotalsSorted.length;
                        if (!n) return [];
                        const step = Math.max(1, Math.ceil(n / 200));
                        const arr = [];
                        for (let i = 0; i < n; i += step) {
                          arr.push({ rank: i + 1, score: validTotalsSorted[i] });
                        }
                        if (arr.length === 0 || arr[arr.length - 1].rank !== n) {
                          arr.push({ rank: n, score: validTotalsSorted[n - 1] });
                        }
                        return arr;
                      })()}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="rank" />
                      <YAxis />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const v = payload[0]?.value;
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3">
                              <div className="text-sm font-semibold text-gray-900">名次：{label}</div>
                              <div className="text-sm font-semibold text-blue-600 mt-1">总分：{fmt1(Number(v))}</div>
                            </div>
                          );
                        }}
                      />
                      <Line type="monotone" dataKey="score" stroke="#3b82f6" dot={false} name="总分" />
                      {safeRank ? <ReferenceLine x={safeRank} stroke="#10b981" strokeDasharray="4 4" /> : null}
                      {top20Rank ? <ReferenceLine x={top20Rank} stroke="#6366f1" strokeDasharray="4 4" /> : null}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white border rounded-lg p-4 overflow-x-auto">
                  <h4 className="font-semibold mb-3">总分排名分数段</h4>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-200">
                      {(() => {
                        const bands = keyMetrics?.rank_bands?.total || [];
                        const rows = [];
                        for (let i = 0; i < bands.length; i += 8) {
                          rows.push(bands.slice(i, i + 8));
                        }
                        return rows.map((row, idx) => (
                          <React.Fragment key={idx}>
                            <tr className="bg-gray-50">
                              <td className="px-3 py-2 font-medium text-gray-700">名次</td>
                              {row.map(item => (
                                <td key={item.rank} className="px-3 py-2 text-center font-semibold">{item.rank}</td>
                              ))}
                            </tr>
                            <tr>
                              <td className="px-3 py-2 font-medium text-gray-700">分数</td>
                              {row.map(item => (
                                <td key={item.rank} className="px-3 py-2 text-center">{fmt1(item.score)}</td>
                              ))}
                            </tr>
                          </React.Fragment>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {!['overall', 'layer_comparison', 'subject_analysis'].includes(analysisType) && (
          <div className="bg-white rounded-lg shadow-sm p-6 text-gray-600">
            当前已完成综合计算，可在“分析类型”里选择：整体分析 / 层次对比 / 学科分析进行查看。
          </div>
        )}

        {/* 层次对比分析 */}
        {analysisType === 'layer_comparison' && layer_comparison?.layer_statistics && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              层次对比分析
            </h3>
            
            {/* 层次统计卡片 */}
            {(() => {
              const layerKeys = ['A', 'B', 'C'].filter(l => scopeKey === 'all' ? true : l === scopeKey);
              const layerMetrics = layerKeys.map(layer => {
                const sc = data?.scopes?.[layer];
                const sm = sc?.summary || {};
                const km = sc?.key_metrics?.total || {};
                return {
                  layer,
                  label: layer === 'A' ? 'A层（实验班）' : layer === 'B' ? 'B层（创新班）' : 'C层（平行班）',
                  participated: sm.participated || 0,
                  absence: (sm.total_students || 0) - (sm.participated || 0),
                  mean: sm.grade_mean || 0,
                  std: sm.grade_std || 0,
                  standardScore: km.standard_score || 0,
                  top20: km.top20_score || 0,
                  top40: km.top40_score || 0,
                  bottom20: km.top80_score || 0,
                  z: km.z_score || 0
                };
              });

              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {layerMetrics.map(m => (
                      <div key={m.layer} className={`rounded-lg p-5 border-2 ${
                        m.layer === 'A' ? 'border-green-200 bg-green-50' :
                        m.layer === 'B' ? 'border-blue-200 bg-blue-50' :
                        'border-orange-200 bg-orange-50'
                      }`}>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-lg">{m.label}</h4>
                          <span className="text-sm text-gray-500">{m.participated}人</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-600">平均分</span>
                            <span className="font-semibold">{fmt1(m.mean)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-600">标准差</span>
                            <span className="font-semibold">{fmt1(m.std)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-600">标准分</span>
                            <span className="font-semibold">{fmt1(m.standardScore)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-600">前20%</span>
                            <span className="font-semibold">{fmt1(m.top20)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-600">前40%</span>
                            <span className="font-semibold">{fmt1(m.top40)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-600">后20%</span>
                            <span className="font-semibold">{fmt1(m.bottom20)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-600">Z分</span>
                            <span className="font-semibold">{fmt1(m.z)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-600">缺考</span>
                            <span className="font-semibold text-red-600">{m.absence}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3">各层次平均分对比</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={layerMetrics}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="layer" />
                          <YAxis />
                          <Tooltip formatter={(v) => fmt1(Number(v))} />
                          <Bar dataKey="mean" fill="#3b82f6" name="平均分" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3">各层次Z分对比</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={layerMetrics}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="layer" />
                          <YAxis />
                          <Tooltip formatter={(v) => fmt1(Number(v))} />
                          <Bar dataKey="z" fill="#10b981" name="Z分" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* T检验结果 */}
            {layer_comparison.t_test_results && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-3">层次间差异显著性检验（T检验）</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(layer_comparison.t_test_results).map(([comparison, result]) => (
                    <div key={comparison} className="bg-white rounded p-3 text-sm">
                      <p className="font-medium mb-1">
                        {comparison === 'A_vs_B' ? 'A层 vs B层' :
                         comparison === 'B_vs_C' ? 'B层 vs C层' : 'A层 vs C层'}
                      </p>
                      <p className="text-gray-600">t值: {result.t_statistic.toFixed(2)}</p>
                      <p className="text-gray-600">p值: {result.p_value.toFixed(4)}</p>
                      <p className={result.significant ? 'text-green-600 font-medium' : 'text-gray-500'}>
                        {result.significant ? '✓ 差异显著' : '差异不显著'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 学科分析 */}
        {analysisType === 'subject_analysis' && subject_analysis?.subject_statistics && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-600" />
              学科分析
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 学科平均分对比 */}
              <div>
                <h4 className="font-semibold mb-3">各学科平均分</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={subject_analysis.chart_data?.subject_scores || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(v) => fmt1(Number(v))} />
                    <Bar dataKey="mean" fill="#8b5cf6" name="平均分" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 学科标准差对比 */}
              <div>
                <h4 className="font-semibold mb-3">各学科标准差</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={Object.entries(subject_analysis.subject_statistics || {}).map(([subject, stats]) => ({
                      subject,
                      std: stats.std
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" />
                    <YAxis />
                    <Tooltip formatter={(v) => fmt1(Number(v))} />
                    <Bar dataKey="std" fill="#3b82f6" name="标准差" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 学科详细统计表 */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">学科</th>
                    <th className="px-4 py-3 text-center">平均分</th>
                    <th className="px-4 py-3 text-center">标准差</th>
                    <th className="px-4 py-3 text-center">前20%分数线</th>
                    <th className="px-4 py-3 text-center">评价</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(subject_analysis.subject_statistics).map(([subject, stats]) => (
                    <tr key={subject}>
                      <td className="px-4 py-3 font-medium">{subject}</td>
                      <td className="px-4 py-3 text-center">{fmt1(stats.mean)}</td>
                      <td className="px-4 py-3 text-center">{fmt1(stats.std)}</td>
                      <td className="px-4 py-3 text-center font-semibold text-blue-700">{fmt1(keyMetrics?.subjects?.[subject]?.top20_score)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          stats.mean >= 80 ? 'bg-green-100 text-green-700' :
                          stats.mean >= 70 ? 'bg-blue-100 text-blue-700' :
                          stats.mean >= 60 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {stats.mean >= 80 ? '优秀' : stats.mean >= 70 ? '良好' : stats.mean >= 60 ? '及格' : '需改进'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 成绩分布 */}
        {analysisType === 'overall' && overall?.distribution && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <PieChartIcon className="w-6 h-6 text-blue-600" />
              成绩分布
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 饼图 */}
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: '优秀', value: overall.distribution.excellent, color: '#10b981' },
                      { name: '良好', value: overall.distribution.good, color: '#3b82f6' },
                      { name: '及格', value: overall.distribution.pass, color: '#f59e0b' },
                      { name: '不及格', value: overall.distribution.fail, color: '#ef4444' }
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {[
                      { color: '#10b981' },
                      { color: '#3b82f6' },
                      { color: '#f59e0b' },
                      { color: '#ef4444' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>

              {/* 柱状图 */}
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={overall.chart_data?.score_distribution || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" name="人数" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 班级对比 */}
        {layer_comparison?.chart_data?.class_comparison && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              班级对比
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={layer_comparison.chart_data.class_comparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="class" />
                <YAxis />
                <Tooltip formatter={(v) => fmt1(Number(v))} />
                <Legend />
                <Bar 
                  dataKey="mean" 
                  name="平均分"
                  fill="#3b82f6"
                >
                  {layer_comparison.chart_data.class_comparison.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.layer === 'A' ? '#10b981' : entry.layer === 'B' ? '#3b82f6' : '#f59e0b'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span> A层（实验班）
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span> B层（创新班）
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span> C层（平行班）
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 整体分析渲染
  const renderOverallAnalysis = (data) => {
    const { basic_statistics, score_distribution, class_analysis } = data;

    // 成绩分布数据
    const distributionData = [
      { name: '优秀', value: score_distribution.excellent, color: '#10b981' },
      { name: '良好', value: score_distribution.good, color: '#3b82f6' },
      { name: '及格', value: score_distribution.pass, color: '#f59e0b' },
      { name: '不及格', value: score_distribution.fail, color: '#ef4444' }
    ];

    // 班级对比数据
    const classData = Object.entries(class_analysis || {}).map(([className, stats]) => ({
      className,
      mean: stats.mean,
      median: stats.median
    }));

    return (
      <div className="space-y-6">
        {/* 基础统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">平均分</p>
            <p className="text-2xl font-bold text-blue-600">{basic_statistics.mean.toFixed(1)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">中位数</p>
            <p className="text-2xl font-bold text-green-600">{basic_statistics.median.toFixed(1)}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">标准差</p>
            <p className="text-2xl font-bold text-purple-600">{basic_statistics.std.toFixed(1)}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">总人数</p>
            <p className="text-2xl font-bold text-orange-600">{basic_statistics.count}</p>
          </div>
        </div>

        {/* 图表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 成绩分布饼图 */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-lg font-semibold mb-4">成绩分布</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* 班级对比柱状图 */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-lg font-semibold mb-4">班级平均分对比</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={classData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="className" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="mean" name="平均分" fill="#3b82f6" />
                <Bar dataKey="median" name="中位数" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };

  // 层次对比分析渲染
  const renderLayerComparison = (data) => {
    const { layer_statistics, layer_comparisons, sample_sizes } = data;

    // 层次统计数据
    const layerData = Object.entries(layer_statistics || {}).map(([layerCode, stats]) => ({
      layer: layerCode,
      mean: stats.mean,
      median: stats.median,
      std: stats.std,
      count: sample_sizes[layerCode] || 0
    }));

    return (
      <div className="space-y-6">
        {/* 层次统计 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {layerData.map((layer) => (
            <div key={layer.layer} className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-semibold mb-2">{layer.layer}层</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">平均分:</span>
                  <span className="font-medium">{layer.mean.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">中位数:</span>
                  <span className="font-medium">{layer.median.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">标准差:</span>
                  <span className="font-medium">{layer.std.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">人数:</span>
                  <span className="font-medium">{layer.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 层次对比图表 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold mb-4">层次对比</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={layerData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="layer" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="mean" name="平均分" fill="#3b82f6" />
              <Bar dataKey="median" name="中位数" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 显著性检验结果 */}
        {Object.keys(layer_comparisons || {}).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h3 className="text-lg font-semibold mb-4">层次间差异显著性检验</h3>
            <div className="space-y-2">
              {Object.entries(layer_comparisons).map(([comparison, result]) => (
                <div key={comparison} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="font-medium">{comparison.replace('_', ' vs ')}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">p值: {result.p_value.toFixed(4)}</span>
                    <span className={`px-2 py-1 rounded text-sm ${
                      result.significant ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {result.significant ? '显著' : '不显著'}
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

  // 学科分析渲染
  const renderSubjectAnalysis = (data) => {
    const { subject_statistics } = data;

    const subjectData = Object.entries(subject_statistics || {}).map(([subject, stats]) => ({
      subject,
      mean: stats.mean,
      median: stats.median,
      std: stats.std
    }));

    return (
      <div className="space-y-6">
        {/* 学科统计表格 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">学科</th>
                <th className="px-4 py-3 text-center">平均分</th>
                <th className="px-4 py-3 text-center">中位数</th>
                <th className="px-4 py-3 text-center">标准差</th>
                <th className="px-4 py-3 text-center">最高分</th>
                <th className="px-4 py-3 text-center">最低分</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {subjectData.map((item) => (
                <tr key={item.subject}>
                  <td className="px-4 py-3 font-medium">{item.subject}</td>
                  <td className="px-4 py-3 text-center">{item.mean.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center">{item.median.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center">{item.std.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center">{subject_statistics[item.subject].max.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center">{subject_statistics[item.subject].min.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 学科对比图表 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold mb-4">学科平均分对比</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={subjectData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="subject" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="mean" name="平均分" fill="#3b82f6" />
              <Bar dataKey="median" name="中位数" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // 进退步分析渲染
  const renderStudentProgress = (data) => {
    const { current_exam, previous_exam, total_students, improved_count, declined_count, unchanged_count, top_improved, top_declined } = data;

    if (!current_exam) {
      return <div className="text-center py-8 text-gray-500">{data.message || '暂无数据'}</div>;
    }

    return (
      <div className="space-y-6">
        {/* 统计概览 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">对比考试</p>
            <p className="text-lg font-bold text-blue-600">{current_exam}</p>
            <p className="text-sm text-gray-500">vs {previous_exam}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">进步人数</p>
            <p className="text-2xl font-bold text-green-600">{improved_count}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">退步人数</p>
            <p className="text-2xl font-bold text-red-600">{declined_count}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">持平人数</p>
            <p className="text-2xl font-bold text-gray-600">{unchanged_count}</p>
          </div>
        </div>

        {/* 进步最大学生 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold mb-4 text-green-700">进步最大（Top 10）</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">排名</th>
                  <th className="px-4 py-2 text-left">姓名</th>
                  <th className="px-4 py-2 text-center">上次成绩</th>
                  <th className="px-4 py-2 text-center">本次成绩</th>
                  <th className="px-4 py-2 text-center">变化</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {top_improved.map((student, index) => (
                  <tr key={student.student_id}>
                    <td className="px-4 py-2">{index + 1}</td>
                    <td className="px-4 py-2 font-medium">{student.student_name}</td>
                    <td className="px-4 py-2 text-center">{student.previous_score}</td>
                    <td className="px-4 py-2 text-center">{student.current_score}</td>
                    <td className="px-4 py-2 text-center">
                      <span className="text-green-600 font-medium">+{student.score_change}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 退步最大学生 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold mb-4 text-red-700">需要关注（退步Top 10）</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">排名</th>
                  <th className="px-4 py-2 text-left">姓名</th>
                  <th className="px-4 py-2 text-center">上次成绩</th>
                  <th className="px-4 py-2 text-center">本次成绩</th>
                  <th className="px-4 py-2 text-center">变化</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {top_declined.map((student, index) => (
                  <tr key={student.student_id}>
                    <td className="px-4 py-2">{index + 1}</td>
                    <td className="px-4 py-2 font-medium">{student.student_name}</td>
                    <td className="px-4 py-2 text-center">{student.previous_score}</td>
                    <td className="px-4 py-2 text-center">{student.current_score}</td>
                    <td className="px-4 py-2 text-center">
                      <span className="text-red-600 font-medium">{student.score_change}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // 班级对比分析渲染
  const renderClassContrast = (data) => {
    const { class_statistics, class_z_scores, class_ranking, grade_mean, grade_std } = data;

    const classData = Object.entries(class_statistics || {}).map(([className, stats]) => ({
      className,
      mean: stats.mean,
      zScore: class_z_scores[className] || 0,
      rank: class_ranking.findIndex(r => r.class_name === className) + 1
    }));

    return (
      <div className="space-y-6">
        {/* 年级基准 */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-8">
            <div>
              <span className="text-gray-600">年级平均分: </span>
              <span className="text-xl font-bold text-blue-600">{grade_mean.toFixed(1)}</span>
            </div>
            <div>
              <span className="text-gray-600">年级标准差: </span>
              <span className="text-xl font-bold text-blue-600">{grade_std.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* 班级排名 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold mb-4">班级排名（按Z值）</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-center">排名</th>
                  <th className="px-4 py-3 text-left">班级</th>
                  <th className="px-4 py-3 text-center">平均分</th>
                  <th className="px-4 py-3 text-center">Z值</th>
                  <th className="px-4 py-3 text-center">评价</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {class_ranking.map((item, index) => (
                  <tr key={item.class_name}>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                        index < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{item.class_name}</td>
                    <td className="px-4 py-3 text-center">
                      {class_statistics[item.class_name]?.mean.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={item.z_score > 0 ? 'text-green-600' : 'text-red-600'}>
                        {item.z_score > 0 ? '+' : ''}{item.z_score.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.z_score > 0.5 ? '优秀' : item.z_score > 0 ? '良好' : item.z_score > -0.5 ? '一般' : '需努力'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Z值分布图 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold mb-4">班级Z值分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={classData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="className" />
              <YAxis />
              <Tooltip />
              <ReferenceLine y={0} stroke="#000" />
              <Bar dataKey="zScore" name="Z值">
                {classData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.zScore > 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // 如果没有权限，显示提示
  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">无权访问</h2>
          <p className="text-gray-600">您没有权限访问成绩分析功能</p>
          <p className="text-sm text-gray-500 mt-2">请联系教务处主任或系统管理员</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">成绩分析</h1>
          <p className="text-sm text-gray-500 mt-1">分层教学数据分析与成果发布</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              activeTab === 'analysis' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            成绩分析
          </button>
          <button
            onClick={() => setActiveTab('layers')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              activeTab === 'layers' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            层次配置
          </button>
          <button
            onClick={() => setActiveTab('publications')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              activeTab === 'publications' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Share2 className="w-4 h-4" />
            发布记录
          </button>
          {currentUser?.role === 'super_admin' && (
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                activeTab === 'logs' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              操作日志
            </button>
          )}
        </div>
      </div>

      {/* 成绩分析Tab */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          {/* 分析配置 */}
          <div className="sticky top-0 z-40">
            <div className="bg-white/90 backdrop-blur rounded-lg shadow-sm p-4 border border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">年级</label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {gradeOptions.map(grade => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">考试</label>
                  <select
                    value={selectedExam?.id || ''}
                    onChange={(e) => {
                      const exam = exams.find(ex => ex.id === parseInt(e.target.value));
                      setSelectedExam(exam);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">请选择考试</option>
                    {exams.filter(ex => ex.grade_level === selectedGrade).map(exam => (
                      <option key={exam.id} value={exam.id}>{getExamOptionLabel(exam)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结果维度</label>
                  <select
                    value={analysisTypes.some(t => t.value === analysisType) ? analysisType : 'overall'}
                    onChange={(e) => setAnalysisType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {analysisTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结果范围</label>
                  <select
                    value={analysisScope}
                    onChange={(e) => setAnalysisScope(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="all">全部</option>
                    <option value="layer_a">A层（实验班）</option>
                    <option value="layer_b">B层（创新班）</option>
                    <option value="layer_c">C层（平行班）</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (analysisResult) scrollToSection('section-analysis-result');
                    }}
                    disabled={!analysisResult}
                    className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                  >
                    报告
                  </button>
                  <button
                    onClick={() => {
                      if (analysisResult) scrollToSection('section-subject-threshold');
                    }}
                    disabled={!analysisResult}
                    className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                  >
                    临界分
                  </button>
                  <button
                    onClick={() => {
                      if (analysisResult) scrollToSection('section-subject-distribution');
                    }}
                    disabled={!analysisResult}
                    className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                  >
                    分数段
                  </button>
                  <button
                    onClick={() => {
                      if (analysisResult) scrollToSection('section-subject-analysis-board');
                    }}
                    disabled={!analysisResult}
                    className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                  >
                    学科分析
                  </button>
                  <button
                    onClick={() => {
                      if (analysisResult) scrollToSection('section-analysis-history');
                    }}
                    disabled={!analysisResult}
                    className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                  >
                    历史
                  </button>
                </div>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-500">对比</span>
                    <button
                      onClick={() => {
                        setAnalysisType('layer_comparison');
                        if (analysisResult) scrollToSection('section-analysis-result');
                      }}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        analysisType === 'layer_comparison' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      层次对比
                    </button>
                    <button
                      onClick={() => {
                        setAnalysisType('class_contrast');
                        if (analysisResult) scrollToSection('section-analysis-result');
                      }}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        analysisType === 'class_contrast' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      班级对比
                    </button>
                    <button
                      onClick={() => {
                        setAnalysisType('history_compare');
                        setHistoryCompare(prev => ({
                          baseExamId: prev.baseExamId || (selectedExam?.id ? String(selectedExam.id) : ''),
                          targetExamId: prev.targetExamId || '',
                          scope: prev.scope || analysisScope || 'all'
                        }));
                        if (analysisResult) scrollToSection('section-analysis-result');
                      }}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        analysisType === 'history_compare' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      }`}
                    >
                      历史对比
                    </button>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      onClick={() => setShowHelpModal(true)}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      操作指引
                    </button>
                    <button
                      onClick={() => {
                        setSelectedExam(null);
                        setAnalysisResult(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Filter className="w-4 h-4" />
                      重置
                    </button>
                    <button
                      onClick={handleAnalyze}
                      disabled={loading || !selectedExam}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      {loading ? '分析中...' : '执行分析'}
                    </button>
                    {analysisResult && (
                      <>
                        <button
                          onClick={() => setShowPublishModal(true)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                        >
                          <Share2 className="w-4 h-4" />
                          发布成果
                        </button>
                        <button
                          onClick={exportPdfReport}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          导出PDF
                        </button>
                        <button
                          onClick={() => handleExport('json')}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          导出
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 分析结果区包裹在 Tabs 中 */}
          <Tabs defaultValue="z-value" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-6 h-auto p-1 gap-2">
              <TabsTrigger value="raw-data" className="py-2">原始数据展示</TabsTrigger>
              <TabsTrigger value="z-value" className="py-2">Z值综合评价</TabsTrigger>
              <TabsTrigger value="three-rates" className="py-2">三率一分统计</TabsTrigger>
              <TabsTrigger value="top-students" className="py-2">尖子生追踪</TabsTrigger>
              <TabsTrigger value="admission" className="py-2">模拟进线预测</TabsTrigger>
            </TabsList>

            <TabsContent value="raw-data">
              <ScoreRawData 
                examData={selectedExam} 
                onImportSuccess={(data) => {
                  alert('导入成功，请点击"执行分析"刷新数据');
                }} 
              />
            </TabsContent>

            <TabsContent value="z-value" className="space-y-6">
              {/* 原有分析结果 */}
              <div id="section-analysis-result" className="bg-white rounded-lg shadow-sm p-6 scroll-mt-28">
                <h2 className="text-lg font-semibold mb-4">分析结果</h2>
                {renderAnalysisResult()}
              </div>

              {/* 各学科临界分分析 */}
              {analysisResult && selectedExam && examScores.length > 0 && (
                <div id="section-subject-threshold" className="scroll-mt-28">
                  <SubjectThresholdAnalysis
                    examData={selectedExam}
                    examScores={examScores}
                    subjects={selectedExam.subjects || ['语文', '数学', '英语', '科学', '社会']}
                  />
                </div>
              )}

              {/* 各学科分数段人数统计 */}
              {analysisResult && selectedExam && examScores.length > 0 && (
                <div id="section-subject-distribution" className="scroll-mt-28">
                  <SubjectScoreDistribution
                    examData={selectedExam}
                    examScores={examScores}
                    subjects={selectedExam.subjects || ['语文', '数学', '英语', '科学', '社会']}
                  />
                </div>
              )}

              {analysisResult && selectedExam && allScopeExamScores.length > 0 && (
                <div id="section-subject-analysis-board" className="scroll-mt-28">
                  <SubjectScoreAnalysisBoard
                    examData={selectedExam}
                    allExamScores={allScopeExamScores}
                    classLayers={classLayers}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="three-rates">
              {analysisResult ? (
                <ThreeRatesStats examScores={examScores} allScopeExamScores={allScopeExamScores} subjects={selectedExam?.subjects || []} classLayers={classLayers} />
              ) : (
                <div className="p-8 text-center text-gray-500 bg-white rounded-lg border">请先选择考试并执行分析</div>
              )}
            </TabsContent>

            <TabsContent value="top-students">
              {analysisResult ? (
                <TopStudentsTracking examScores={allScopeExamScores} classLayers={classLayers} />
              ) : (
                <div className="p-8 text-center text-gray-500 bg-white rounded-lg border">请先选择考试并执行分析</div>
              )}
            </TabsContent>

            <TabsContent value="admission">
              {analysisResult ? (
                <AdmissionPrediction examScores={allScopeExamScores} allScopeExamScores={allScopeExamScores} subjects={selectedExam?.subjects || []} classLayers={classLayers} />
              ) : (
                <div className="p-8 text-center text-gray-500 bg-white rounded-lg border">请先选择考试并执行分析</div>
              )}
            </TabsContent>
          </Tabs>

          {/* 分析历史 */}
          <div id="section-analysis-history" className="bg-white rounded-lg shadow-sm p-6 scroll-mt-28">
            <h2 className="text-lg font-semibold mb-4">分析历史</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">分析时间</th>
                    <th className="px-4 py-3 text-left">考试</th>
                    <th className="px-4 py-3 text-left">分析类型</th>
                    <th className="px-4 py-3 text-left">分析人</th>
                    <th className="px-4 py-3 text-center">状态</th>
                    <th className="px-4 py-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analysisHistory.map((item) => (
                    <tr key={item.analysis_id}>
                      <td className="px-4 py-3">{new Date(item.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">{item.exam_name}</td>
                      <td className="px-4 py-3">
                        {analysisTypes.find(t => t.value === item.analysis_type)?.label || item.analysis_type}
                      </td>
                      <td className="px-4 py-3">{item.created_by_name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {item.status === 'published' ? '已发布' : '草稿'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            // 加载历史分析结果
                            fetch(`${API_BASE_URL}/score-analysis/results/${item.analysis_id}`, {
                              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                            })
                              .then(res => res.json())
                              .then(data => {
                                if (data.success) {
                                  setAnalysisResult(data.data);
                                  setAnalysisType(data.data.analysis_type);
                                }
                              });
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 层次配置Tab */}
      {activeTab === 'layers' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">班级层次配置</h2>
            <div className="flex gap-2">
              {!editingLayers ? (
                <button
                  onClick={() => {
                    setEditedClassLayers(classLayers.map(l => ({...l})));
                    setEditingLayers(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  编辑配置
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditingLayers(false);
                      setEditedClassLayers([]);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={async () => {
                      setSavingLayers(true);
                      try {
                        const normalized = normalizeClassLayers(editedClassLayers, selectedGrade);
                        const others = (schoolData.classLayers || []).filter(l => l.grade_level !== selectedGrade);
                        schoolData.classLayers = [...others, ...normalized];
                        setClassLayers(normalized);
                        setEditingLayers(false);
                        alert('保存成功！');
                      } catch (error) {
                        console.error('保存失败:', error);
                        alert('保存失败：' + error.message);
                      }
                      setSavingLayers(false);
                    }}
                    disabled={savingLayers}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingLayers ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    保存配置
                  </button>
                </>
              )}
            </div>
          </div>
          
          <p className="text-gray-500 mb-4">当前年级: {selectedGrade}</p>
          
          {classLayers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>暂无层次配置，请点击上方"编辑配置"按钮进行设置</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">班级</th>
                    <th className="px-4 py-3 text-left">层次</th>
                    <th className="px-4 py-3 text-left">层次名称</th>
                    <th className="px-4 py-3 text-left">学年</th>
                    <th className="px-4 py-3 text-left">学期</th>
                    {editingLayers && <th className="px-4 py-3 text-center">操作</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(editingLayers ? editedClassLayers : classLayers).map((layer, index) => (
                    <tr key={layer.id || index}>
                      <td className="px-4 py-3 font-medium">{layer.class_name}</td>
                      <td className="px-4 py-3">
                        {editingLayers ? (
                          <select
                            value={layer.layer_code}
                            onChange={(e) => {
                              const newLayers = [...editedClassLayers];
                              newLayers[index].layer_code = e.target.value;
                              newLayers[index].layer_name = LAYER_CONFIG[e.target.value]?.name || layer.layer_name;
                              setEditedClassLayers(newLayers);
                              const normalized = normalizeClassLayers(newLayers, selectedGrade);
                              const others = (schoolData.classLayers || []).filter(l => l.grade_level !== selectedGrade);
                              schoolData.classLayers = [...others, ...normalized];
                            }}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="A">A层（实验班）</option>
                            <option value="B">B层（创新班）</option>
                            <option value="C">C层（平行班）</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-1 rounded text-xs ${
                            layer.layer_code === 'A' ? 'bg-green-100 text-green-700' :
                            layer.layer_code === 'B' ? 'bg-blue-100 text-blue-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {layer.layer_code}层
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{layer.layer_name}</td>
                      <td className="px-4 py-3">{layer.academic_year}</td>
                      <td className="px-4 py-3">第{editingLayers ? 
                        (layer.term === '第一学期' || layer.term === '第二学期' ? layer.term : '第一学期') : layer.term}学期</td>
                      {editingLayers && (
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              const newLayers = editedClassLayers.filter((_, i) => i !== index);
                              setEditedClassLayers(newLayers);
                              const normalized = normalizeClassLayers(newLayers, selectedGrade);
                              const others = (schoolData.classLayers || []).filter(l => l.grade_level !== selectedGrade);
                              schoolData.classLayers = [...others, ...normalized];
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            删除
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {editingLayers && (
            <div className="mt-4 space-y-4">
              {/* 单个添加 */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">添加单个班级</h4>
                <div className="flex gap-4 items-end">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">班级名称</label>
                    <select
                      id="newClassId"
                      className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                      defaultValue=""
                    >
                      <option value="">请选择班级</option>
                      {(schoolData.classes || [])
                        .filter(cls => {
                          const gradeNum = getGradeNumber(selectedGrade);
                          return gradeNum && Math.floor(Number(cls.id) / 100) === gradeNum;
                        })
                        .map(cls => (
                          <option key={cls.id} value={cls.id}>
                            {schoolData.formatClassName?.(cls.id) || cls.name || cls.id}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">层次</label>
                    <select id="newClassLayer" className="px-3 py-2 border border-gray-300 rounded-lg">
                      <option value="A">A层（实验班）</option>
                      <option value="B">B层（创新班）</option>
                      <option value="C">C层（平行班）</option>
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      const classInput = document.getElementById('newClassId');
                      const layerInput = document.getElementById('newClassLayer');
                      const classId = classInput?.value ? Number(classInput.value) : null;
                      if (classId) {
                        const cls = (schoolData.classes || []).find(c => Number(c.id) === classId);
                        const className = cls ? (schoolData.formatClassName?.(cls.id) || cls.name || String(cls.id)) : String(classId);
                        const newClass = {
                          id: Date.now(),
                          grade_level: selectedGrade,
                          class_id: classId,
                          class_name: className,
                          layer_code: layerInput.value,
                          layer_name: LAYER_CONFIG[layerInput.value].name,
                          academic_year: schoolData.getCurrentAcademicYearDisplay?.() || '2024-2025',
                          term: '第一学期'
                        };
                        const updatedLayers = [...editedClassLayers, newClass];
                        setEditedClassLayers(updatedLayers);
                        const normalized = normalizeClassLayers(updatedLayers, selectedGrade);
                        const others = (schoolData.classLayers || []).filter(l => l.grade_level !== selectedGrade);
                        schoolData.classLayers = [...others, ...normalized];
                        classInput.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    添加班级
                  </button>
                </div>
              </div>

              {/* 批量导入按钮 */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-blue-800">批量导入班级</h4>
                    <p className="text-sm text-gray-600 mt-1">支持CSV格式文件导入</p>
                  </div>
                  <button
                    onClick={() => setShowLayerImportModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    导入班级
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 发布记录Tab */}
      {activeTab === 'publications' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">发布记录</h2>
          
          {publications.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Share2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>暂无发布记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">发布时间</th>
                    <th className="px-4 py-3 text-left">标题</th>
                    <th className="px-4 py-3 text-left">考试</th>
                    <th className="px-4 py-3 text-left">发布人</th>
                    <th className="px-4 py-3 text-center">接收人数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {publications.map((pub) => (
                    <tr key={pub.publication_id}>
                      <td className="px-4 py-3">{new Date(pub.published_at).toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium">{pub.title}</td>
                      <td className="px-4 py-3">{pub.exam_name}</td>
                      <td className="px-4 py-3">{pub.published_by_name}</td>
                      <td className="px-4 py-3 text-center">{pub.recipient_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 操作日志Tab */}
      {activeTab === 'logs' && currentUser?.role === 'super_admin' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">操作日志</h2>
          
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>暂无操作日志</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">时间</th>
                    <th className="px-4 py-3 text-left">操作类型</th>
                    <th className="px-4 py-3 text-left">操作人</th>
                    <th className="px-4 py-3 text-left">角色</th>
                    <th className="px-4 py-3 text-left">IP地址</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {log.action_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">{log.action_by_name}</td>
                      <td className="px-4 py-3">{log.action_by_role}</td>
                      <td className="px-4 py-3 text-gray-500">{log.ip_address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 发布弹窗 */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">发布分析成果</h2>
              <button onClick={() => setShowPublishModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">发布标题 *</label>
                <input
                  type="text"
                  value={publishForm.title}
                  onChange={(e) => setPublishForm({ ...publishForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="请输入发布标题"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内容摘要</label>
                <textarea
                  value={publishForm.content_summary}
                  onChange={(e) => setPublishForm({ ...publishForm, content_summary: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows="3"
                  placeholder="请输入内容摘要（可选）"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">接收对象 *</label>
                <div className="space-y-2">
                  {recipientOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={publishForm.recipient_types.includes(option.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPublishForm({
                              ...publishForm,
                              recipient_types: [...publishForm.recipient_types, option.value]
                            });
                          } else {
                            setPublishForm({
                              ...publishForm,
                              recipient_types: publishForm.recipient_types.filter(t => t !== option.value)
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handlePublish}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                确认发布
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">操作指引</h2>
              <button onClick={() => setShowHelpModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="space-y-4 text-sm text-gray-700">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="font-semibold text-gray-800 mb-2">快速路径</div>
                <div>选择年级与考试 → 点击“执行分析” → 用“结果范围”查看全部/A/B/C → 用上方“报告/临界分/分数段/学科分析”快速跳转。</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <div className="font-semibold text-gray-800 mb-2">层次对比</div>
                  <div>点击“层次对比”后，查看不同层次在均分、分布、优秀分（前20%）等维度的差异。</div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="font-semibold text-gray-800 mb-2">班级对比</div>
                  <div>点击“班级对比”后，按班级查看核心指标对比，可用排序快速定位强弱班。</div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="font-semibold text-gray-800 mb-2">历史对比</div>
                  <div>点击“历史对比”，选择基准考试与对比考试，系统会展示关键指标变化与学科均分变化。</div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="font-semibold text-gray-800 mb-2">导出</div>
                  <div>“导出PDF”使用浏览器打印能力保存为PDF；“导出”导出当前分析JSON；学科成绩分析板块支持导出CSV与PDF。</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 层次导入弹窗 */}
      {showLayerImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">导入班级层次配置</h2>
              <button onClick={() => setShowLayerImportModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h3 className="font-medium text-blue-900 mb-2">导入说明</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• 支持CSV格式文件</li>
                <li>• 表头必须包含：班级名称、层次代码</li>
                <li>• 层次代码：A=实验班, B=创新班, C=平行班</li>
                <li>• 导入后会自动覆盖现有配置</li>
              </ul>
            </div>

            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              onClick={() => document.getElementById('layer-file-input').click()}
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">点击选择文件或拖拽到此处</p>
              <input
                id="layer-file-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const content = event.target.result;
                      const lines = content.split('\n').filter(line => line.trim());
                      const newClasses = [];
                      const errors = [];
                      
                      // 跳过表头
                      const startIndex = lines[0].includes('班级名称') || lines[0].includes('层次') ? 1 : 0;
                      
                      lines.slice(startIndex).forEach((line, index) => {
                        const parts = line.split(',').map(s => s.trim());
                        if (parts.length >= 2) {
                          const className = parts[0];
                          const layerCode = parts[1].toUpperCase();
                          
                          if (!className) {
                            errors.push(`第${index + 1}行：班级名称不能为空`);
                            return;
                          }
                          
                          if (!['A', 'B', 'C'].includes(layerCode)) {
                            errors.push(`第${index + 1}行：层次代码必须是A、B或C`);
                            return;
                          }
                          const matchId = String(className).match(/\d{3,4}/);
                          const classId = matchId ? Number(matchId[0]) : null;
                          const cls = classId ? (schoolData.classes || []).find(c => Number(c.id) === classId) : null;
                          if (!cls) {
                            errors.push(`第${index + 1}行：无法匹配班级ID（请用701/701班等格式）`);
                            return;
                          }

                          newClasses.push({
                            id: Date.now() + index,
                            grade_level: selectedGrade,
                            class_id: Number(cls.id),
                            class_name: schoolData.formatClassName?.(cls.id) || cls.name || className,
                            layer_code: layerCode,
                            layer_name: LAYER_CONFIG[layerCode].name,
                            academic_year: schoolData.getCurrentAcademicYearDisplay?.() || '2024-2025',
                            term: '第一学期'
                          });
                        }
                      });
                      
                      if (errors.length > 0) {
                        alert('导入完成，以下行有误：\n' + errors.join('\n'));
                      }
                      
                      if (newClasses.length > 0) {
                        // 合并新导入的班级（去重）
                        const existingIds = new Set(editedClassLayers.map(l => Number(l.class_id)).filter(Boolean));
                        const uniqueNewClasses = newClasses.filter(c => !existingIds.has(Number(c.class_id)));
                        const updatedLayers = normalizeClassLayers([...editedClassLayers, ...uniqueNewClasses], selectedGrade);
                        setEditedClassLayers(updatedLayers);
                        const others = (schoolData.classLayers || []).filter(l => l.grade_level !== selectedGrade);
                        schoolData.classLayers = [...others, ...updatedLayers];
                        alert(`成功导入${uniqueNewClasses.length}个班级`);
                        setShowLayerImportModal(false);
                      } else if (errors.length === 0) {
                        alert('没有可导入的数据');
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
              />
            </div>

            <div className="flex justify-between items-center mt-6">
              <button
                onClick={() => {
                  const csvContent = '班级名称,层次代码\n701班,A\n702班,A\n703班,B\n704班,C\n705班,C';
                  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = '班级层次导入模板.csv';
                  link.click();
                }}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                <Download className="w-4 h-4" />
                下载模板
              </button>
              <button
                onClick={() => setShowLayerImportModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoreAnalysis;
