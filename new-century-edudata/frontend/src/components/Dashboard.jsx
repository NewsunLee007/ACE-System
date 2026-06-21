import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Trophy,
  TrendingUp,
  Users,
  Target,
  Award,
  ChevronDown,
  Upload,
  RefreshCw,
  BarChart3,
  MonitorPlay
} from 'lucide-react';
import schoolData from '../data/schoolData';
import { fetchExamListWithStatistics, fetchExamScoreRows } from '../lib/examApi';
import { getStoredDashboardPreviewRole } from '../lib/rolePreview';
import { recalculateScoreRanks } from '../lib/scoreImport';
import { hasBackendAuthToken } from '../lib/sessionToken';

const DEFAULT_SUBJECTS = ['语文', '数学', '英语', '科学', '社会'];

const DEFAULT_LAYERS = [
  { id: 'ALL', code: 'ALL', name: '全段', description: '全年级全部班级' },
  { id: 'A', code: 'A', name: 'A层', description: 'A层班级对比' },
  { id: 'B', code: 'B', name: 'B层', description: 'B层班级对比' },
  { id: 'C', code: 'C', name: 'C层', description: 'C层班级对比' },
];

const getClassId = (score) => {
  if (score?.class_id) return Number(score.class_id);
  const classText = String(score?.class_name || score?.className || '');
  const match = classText.match(/\d{3,4}/);
  return match ? Number(match[0]) : null;
};

const getClassName = (score) => {
  const classId = getClassId(score);
  if (classId) return String(classId);
  return String(score?.class_name || score?.className || '未知');
};

const getSubjects = (exam, scores) => {
  if (Array.isArray(exam?.subjects) && exam.subjects.length > 0) return exam.subjects;
  const detected = Array.from(new Set((scores || []).flatMap(s => Object.keys(s.scores || {}))));
  return detected.length > 0 ? detected : DEFAULT_SUBJECTS;
};

const mean = (values) => {
  const nums = values.filter(v => Number.isFinite(v));
  return nums.length ? nums.reduce((sum, v) => sum + v, 0) / nums.length : 0;
};

const std = (values) => {
  const nums = values.filter(v => Number.isFinite(v));
  if (!nums.length) return 0;
  const avg = mean(nums);
  return Math.sqrt(nums.reduce((sum, v) => sum + (v - avg) ** 2, 0) / nums.length);
};

const valueAtPercent = (values, pct) => {
  const nums = values.filter(v => Number.isFinite(v)).sort((a, b) => b - a);
  if (!nums.length) return 0;
  const index = Math.min(nums.length - 1, Math.max(0, Math.ceil(nums.length * pct) - 1));
  return nums[index] || 0;
};

const formatNumber = (value, digits = 1) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(digits));
};

const formatSignedNumber = (value, digits = 1) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}`;
};

const diffTextColor = (value) => (Number(value) >= 0 ? 'text-green-600' : 'text-red-600');

const normalizeLayerCode = (value) => String(value || '').trim().toUpperCase();

const normalizeExam = (exam) => ({
  ...exam,
  id: Number(exam.id),
  name: exam.exam_name || exam.name || `考试 ${exam.id}`,
  grade: exam.grade_level || exam.grade || '',
});

const hasBackendToken = hasBackendAuthToken;
const isDashboardPreviewActive = () => getStoredDashboardPreviewRole() !== 'actual';

const getLocalExamScores = (examId) => (
  (schoolData.examScores || []).filter(score => Number(score.exam_id) === Number(examId))
);

const dataNoticeTone = (source) => (
  source === 'backend'
    ? 'border-green-100 bg-green-50 text-green-700'
    : 'border-amber-100 bg-amber-50 text-amber-700'
);

// 教务处统测大屏组件
const Dashboard = ({
  title = '教务处看板',
  description = '',
  defaultLayer = 'A',
  allowedGrades = null,
}) => {
  const navigate = useNavigate();
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState(defaultLayer);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState([]);
  const [scoreRowsByExam, setScoreRowsByExam] = useState({});
  const [dataSource, setDataSource] = useState(hasBackendToken() ? 'backend' : 'local');
  const [syncMessage, setSyncMessage] = useState(hasBackendToken() ? '正在同步后端考试库' : '未登录后端，当前使用本地成绩缓存');
  const [layers] = useState(DEFAULT_LAYERS);
  const allowedGradeKey = Array.isArray(allowedGrades) ? allowedGrades.filter(Boolean).join('|') : '';

  const filterExamsByAllowedGrades = useCallback((items = []) => {
    const allowed = allowedGradeKey ? allowedGradeKey.split('|') : [];
    if (!allowed.length) return items;
    return items.filter(exam => allowed.includes(exam.grade));
  }, [allowedGradeKey]);

  const getScoreRowsForExam = useCallback((examId) => {
    if (!examId) return [];
    const cachedRows = scoreRowsByExam[Number(examId)];
    if (cachedRows) return cachedRows;
    return dataSource === 'backend' ? [] : getLocalExamScores(examId);
  }, [dataSource, scoreRowsByExam]);

  const buildDashboardData = useCallback((examId, layerCode) => {
    const exam = exams.find(item => Number(item.id) === Number(examId));
    if (!exam) return null;

    const examScores = getScoreRowsForExam(exam.id);
    const subjects = getSubjects(exam, examScores);
    const layer = layers.find(item => item.code === layerCode) || layers.find(item => item.code === 'ALL') || layers[0];
    const layersForGrade = (schoolData.classLayers || [])
      .filter(item => !exam.grade || item.grade_level === exam.grade);
    const layerByClass = new Map(layersForGrade
      .map(item => [Number(item.class_id), normalizeLayerCode(item.layer_code)])
      .filter(([classId, code]) => Number.isFinite(classId) && code));

    const getLayerCodeForScore = (score) => {
      const classId = getClassId(score);
      const explicitCode = normalizeLayerCode(score?.layer_code || score?._layer);
      if (explicitCode) return explicitCode;
      return layerByClass.get(classId) || '';
    };

    const isInLayer = (score) => {
      const classId = getClassId(score);
      if (!classId) return false;
      if (layer.code === 'ALL') return true;
      const classLayerCode = getLayerCodeForScore(score);
      if (classLayerCode) return classLayerCode === layer.code;
      return true;
    };

    const scopedScores = examScores.filter(isInLayer);
    const validScores = scopedScores.filter(score => score.is_valid !== false && score.is_included !== false);
    const allValidScores = examScores.filter(score => score.is_valid !== false && score.is_included !== false);
    const totals = validScores
      .map(score => Number(score.total_score))
      .filter(value => Number.isFinite(value) && value > 0);

    if (!validScores.length || !totals.length) {
      return {
        exam_id: exam.id,
        exam_name: exam.name,
        layer_id: layer.id,
        layer_name: layer.name,
        layer_stats: {
          total_students: 0,
          mean_score: 0,
          std_score: 0,
          max_score: 0,
          min_score: 0,
          threshold_20: 0,
          threshold_40: 0,
          threshold_60: 0,
          threshold_80: 0,
        },
        class_rankings: [],
        subject_thresholds: [],
      };
    }

    const layerMean = mean(totals);
    const layerStd = std(totals);
    const threshold20 = valueAtPercent(totals, 0.2);
    const threshold40 = valueAtPercent(totals, 0.4);
    const threshold60 = valueAtPercent(totals, 0.6);
    const threshold80 = valueAtPercent(totals, 0.8);

    const sameLayerTotals = new Map();
    allValidScores.forEach(score => {
      const total = Number(score.total_score);
      if (!Number.isFinite(total) || total <= 0) return;
      const layerCodeForScore = getLayerCodeForScore(score) || '未分层';
      if (!sameLayerTotals.has(layerCodeForScore)) sameLayerTotals.set(layerCodeForScore, []);
      sameLayerTotals.get(layerCodeForScore).push(total);
    });
    const sameLayerMeans = new Map(Array.from(sameLayerTotals.entries()).map(([code, values]) => [code, mean(values)]));

    const classGroups = new Map();
    validScores.forEach(score => {
      const className = getClassName(score);
      if (!classGroups.has(className)) classGroups.set(className, []);
      classGroups.get(className).push(score);
    });

    const classRankings = Array.from(classGroups.entries()).map(([className, rows]) => {
      const representativeClassId = getClassId(rows[0]);
      const classLayerCode = getLayerCodeForScore(rows[0]) || '未分层';
      const classTotals = rows.map(score => Number(score.total_score)).filter(value => Number.isFinite(value) && value > 0);
      const classMean = mean(classTotals);
      const standardScore = layerStd > 0 ? (classMean - layerMean) / layerStd : 0;
      const top20Ratio = classTotals.length ? classTotals.filter(value => value >= threshold20).length / classTotals.length : 0;
      const top80Ratio = classTotals.length ? classTotals.filter(value => value >= threshold80).length / classTotals.length : 0;
      const finalZValue = standardScore * 0.5 + top20Ratio * 0.2 + top80Ratio * 0.3;
      const sameLayerMean = sameLayerMeans.get(classLayerCode) ?? layerMean;

      return {
        class_id: representativeClassId,
        class_name: className,
        layer_code: classLayerCode,
        final_z_value: formatNumber(finalZValue, 4),
        class_mean: formatNumber(classMean, 1),
        range_mean_diff: formatNumber(classMean - layerMean, 1),
        same_layer_mean: formatNumber(sameLayerMean, 1),
        same_layer_diff: formatNumber(classMean - sameLayerMean, 1),
        top20_ratio: top20Ratio,
        top80_ratio: top80Ratio,
        class_count: classTotals.length,
      };
    }).sort((a, b) => b.final_z_value - a.final_z_value);

    const subjectKeyMap = {
      '语文': 'threshold_chinese',
      '数学': 'threshold_math',
      '英语': 'threshold_english',
      '科学': 'threshold_science',
      '社会': 'threshold_society',
    };

    const subjectThresholds = [0.2, 0.4, 0.6, 0.8].map(pct => {
      const row = {
        percentage: pct,
        label: `前${Math.round(pct * 100)}%`,
        threshold_total: formatNumber(valueAtPercent(totals, pct), 1),
        student_count: Math.min(validScores.length, Math.ceil(validScores.length * pct)),
      };

      subjects.forEach(subject => {
        const key = subjectKeyMap[subject];
        if (!key) return;
        const subjectScores = validScores
          .map(score => Number(score.scores?.[subject]))
          .filter(value => Number.isFinite(value));
        row[key] = formatNumber(valueAtPercent(subjectScores, pct), 1);
      });

      return row;
    });

    return {
      exam_id: exam.id,
      exam_name: exam.name,
      layer_id: layer.id,
      layer_name: layer.name,
      layer_stats: {
        total_students: validScores.length,
        mean_score: formatNumber(layerMean, 1),
        std_score: formatNumber(layerStd, 2),
        max_score: formatNumber(Math.max(...totals), 1),
        min_score: formatNumber(Math.min(...totals), 1),
        threshold_20: formatNumber(threshold20, 1),
        threshold_40: formatNumber(threshold40, 1),
        threshold_60: formatNumber(threshold60, 1),
        threshold_80: formatNumber(threshold80, 1),
      },
      class_rankings: classRankings,
      subject_thresholds: subjectThresholds,
      meeting_summary: {
        top_class: classRankings[0] || null,
        weak_class: classRankings[classRankings.length - 1] || null,
        spread: formatNumber(Math.max(...totals) - Math.min(...totals), 1),
        excellent_line: formatNumber(threshold20, 1),
        middle_line: formatNumber(threshold60, 1),
        risk_line: formatNumber(threshold80, 1),
      }
    };
  }, [exams, getScoreRowsForExam, layers]);

  const refreshDashboard = useCallback((examId = selectedExam, layerCode = selectedLayer) => {
    setLoading(true);
    setDashboardData(buildDashboardData(examId, layerCode));
    setTimeout(() => setLoading(false), 250);
  }, [buildDashboardData, selectedExam, selectedLayer]);

  useEffect(() => {
    const loadLocalExams = () => {
      const localExams = filterExamsByAllowedGrades((schoolData.exams || []).map(normalizeExam));
      setExams(localExams);
      setDataSource('local');
      setSyncMessage(hasBackendToken() ? '后端考试库暂不可用，当前使用本地成绩缓存' : '未登录后端，当前使用本地成绩缓存');

      if (localExams.length > 0) {
        setSelectedExam(prev => (
          prev && localExams.some(exam => Number(exam.id) === Number(prev))
            ? prev
            : String(localExams[0].id)
        ));
      } else {
        setSelectedExam(null);
        setDashboardData(null);
      }
    };

    const loadExams = async () => {
      if (!hasBackendToken()) {
        loadLocalExams();
        return;
      }

      try {
        setSyncMessage('正在同步后端考试库');
        const payload = await fetchExamListWithStatistics({ pageSize: 100 });
        const backendExams = filterExamsByAllowedGrades((payload.exams || []).map(normalizeExam));
        if (backendExams.length === 0 && isDashboardPreviewActive()) {
          loadLocalExams();
          return;
        }

        setExams(backendExams);
        setDataSource('backend');
        setSyncMessage(`已同步后端考试库 · ${backendExams.length}场考试`);

        if (backendExams.length > 0) {
          setSelectedExam(prev => (
            prev && backendExams.some(exam => Number(exam.id) === Number(prev))
              ? prev
              : String(backendExams[0].id)
          ));
        } else {
          setSelectedExam(null);
          setDashboardData(null);
        }
      } catch {
        loadLocalExams();
      }
    };

    loadExams();
    window.addEventListener('schoolData:changed', loadExams);
    return () => window.removeEventListener('schoolData:changed', loadExams);
  }, [filterExamsByAllowedGrades]);

  useEffect(() => {
    let alive = true;

    const loadScoreRows = async () => {
      if (!selectedExam || dataSource !== 'backend' || scoreRowsByExam[Number(selectedExam)]) return;

      setLoading(true);
      try {
        const payload = await fetchExamScoreRows(selectedExam, { includeInvalid: true });
        const rankedRows = recalculateScoreRanks(payload.scores || [])
          .map(row => ({ ...row, exam_id: row.exam_id ?? Number(selectedExam) }));
        if (!alive) return;
        setScoreRowsByExam(prev => ({
          ...prev,
          [Number(selectedExam)]: rankedRows,
        }));
        setSyncMessage(`已同步后端成绩行 · ${rankedRows.length}条`);
      } catch {
        if (!alive) return;
        setSyncMessage('后端成绩行暂不可用，当前考试暂无可展示成绩');
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadScoreRows();

    return () => {
      alive = false;
    };
  }, [dataSource, scoreRowsByExam, selectedExam]);

  useEffect(() => {
    if (selectedExam && exams.length > 0) {
      setDashboardData(buildDashboardData(selectedExam, selectedLayer));
    }
  }, [selectedExam, selectedLayer, exams, buildDashboardData]);

  const handleRefresh = () => {
    refreshDashboard();
  };

  const getZValueColor = (zValue) => {
    if (zValue >= 0.5) return '#10b981'; // 绿色-优秀
    if (zValue >= 0) return '#3b82f6';   // 蓝色-良好
    if (zValue >= -0.3) return '#f59e0b'; // 黄色-一般
    return '#ef4444'; // 红色-需改进
  };

  const getZValueLevel = (zValue) => {
    if (zValue >= 0.5) return '优秀';
    if (zValue >= 0) return '良好';
    if (zValue >= -0.3) return '一般';
    return '需改进';
  };

  if (!dashboardData && exams.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">暂无考试数据，请先在考务管理中创建考试并导入成绩。</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">正在加载教务大屏数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 顶部导航栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {dashboardData.exam_name} | {dashboardData.layer_name}{description ? ` | ${description}` : ''}
            </p>
            <div className={`mt-2 inline-flex rounded-lg border px-3 py-1 text-xs ${dataNoticeTone(dataSource)}`}>
              {syncMessage}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* 考试选择 */}
            <div className="relative">
              <select
                className="appearance-none bg-gray-50 border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedExam || ''}
                onChange={(e) => setSelectedExam(e.target.value)}
              >
                <option value="">选择考试</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            {/* 分层选择 */}
            <div className="relative">
              <select
                className="appearance-none bg-gray-50 border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedLayer || ''}
                onChange={(e) => setSelectedLayer(e.target.value)}
              >
                <option value="">选择分层</option>
                {layers.map((layer) => (
                  <option key={layer.id} value={layer.id}>
                    {layer.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            {/* 刷新按钮 */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新数据
            </button>

            <button
              onClick={() => navigate('/analysis')}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              成绩分析
            </button>

            {/* 导出按钮 */}
            <button className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
              <Upload className="w-4 h-4" />
              导出报表
            </button>
          </div>
        </div>
      </div>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">分层总人数</p>
              <p className="text-3xl font-bold text-gray-800">
                {dashboardData.layer_stats.total_students}
              </p>
              <p className="text-xs text-gray-400 mt-1">参与统计学生</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">分层平均分</p>
              <p className="text-3xl font-bold text-gray-800">
                {dashboardData.layer_stats.mean_score}
              </p>
              <p className="text-xs text-gray-400 mt-1">标准差: {dashboardData.layer_stats.std_score}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">前20%分数线</p>
              <p className="text-3xl font-bold text-gray-800">
                {dashboardData.layer_stats.threshold_20}
              </p>
              <p className="text-xs text-gray-400 mt-1">高分段 cutoff</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Target className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">最高/最低分</p>
              <p className="text-3xl font-bold text-gray-800">
                {dashboardData.layer_stats.max_score}
              </p>
              <p className="text-xs text-gray-400 mt-1">最低: {dashboardData.layer_stats.min_score}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">班级均分极差</p>
          <p className="text-3xl font-bold text-gray-800">{dashboardData.meeting_summary.spread}</p>
          <p className="text-xs text-gray-400 mt-1">用于判断层内离散度</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">领跑班级</p>
          <p className="text-3xl font-bold text-green-700">{dashboardData.meeting_summary.top_class?.class_name || '-'}</p>
          <p className="text-xs text-gray-400 mt-1">Z值 {dashboardData.meeting_summary.top_class?.final_z_value ?? '-'}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">重点帮扶班级</p>
          <p className="text-3xl font-bold text-red-600">{dashboardData.meeting_summary.weak_class?.class_name || '-'}</p>
          <p className="text-xs text-gray-400 mt-1">均分 {dashboardData.meeting_summary.weak_class?.class_mean ?? '-'}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-gray-500 mb-1">会议展示</p>
          <p className="text-3xl font-bold text-blue-700">一键</p>
          <p className="text-xs text-gray-400 mt-1">下方展示板可直接投屏</p>
        </div>
      </div>

      {/* 主要内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 班级Z值排名 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              班级综合Z值排名
            </h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              50-20-30加权模型
            </span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dashboardData.class_rankings}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[-0.5, 1]} />
                <YAxis dataKey="class_name" type="category" width={40} />
                <Tooltip
                  formatter={(value) => [value, 'Z值']}
                  labelFormatter={(label) => `${label}班`}
                />
                <Bar dataKey="final_z_value" radius={[0, 4, 4, 0]}>
                  {dashboardData.class_rankings.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getZValueColor(entry.final_z_value)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span>优秀(≥0.5)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span>良好(0~0.5)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-500"></div>
              <span>一般(-0.3~0)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span>需改进(&lt;-0.3)</span>
            </div>
          </div>
        </div>

        {/* 学科有效分/下限分 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              各学科有效分/下限分
            </h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              基于总分前N%反算
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">分数段</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">总分</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">语文</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">数学</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600 text-red-600">英语</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">科学</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">社会</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">人数</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.subject_thresholds.map((threshold, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{threshold.label}</td>
                    <td className="px-3 py-2 text-center font-bold text-blue-600">{threshold.threshold_total}</td>
                    <td className="px-3 py-2 text-center">{threshold.threshold_chinese}</td>
                    <td className="px-3 py-2 text-center">{threshold.threshold_math}</td>
                    <td className="px-3 py-2 text-center text-red-600 font-medium">{threshold.threshold_english}</td>
                    <td className="px-3 py-2 text-center">{threshold.threshold_science}</td>
                    <td className="px-3 py-2 text-center">{threshold.threshold_society}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{threshold.student_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 班级详细排名表 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-500" />
            班级详细数据表
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">共 {dashboardData.class_rankings.length} 个班级</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">排名</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">班级</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">层次</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">综合Z值</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">等级</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">班级均分</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">与年段差</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">与同层次差</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">前20%率</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">前80%率</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">有效人数</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.class_rankings.map((cls, index) => (
                <tr key={cls.class_name} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {index === 0 && <span className="text-yellow-500 font-bold">🥇</span>}
                    {index === 1 && <span className="text-gray-400 font-bold">🥈</span>}
                    {index === 2 && <span className="text-amber-600 font-bold">🥉</span>}
                    {index > 2 && <span className="text-gray-500">{index + 1}</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{cls.class_name}班</td>
                  <td className="px-4 py-3 text-center text-gray-600">{cls.layer_code || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="px-2 py-1 rounded text-white font-medium"
                      style={{ backgroundColor: getZValueColor(cls.final_z_value) }}
                    >
                      {cls.final_z_value.toFixed(4)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{getZValueLevel(cls.final_z_value)}</td>
                  <td className="px-4 py-3 text-center font-medium">{cls.class_mean}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={diffTextColor(cls.range_mean_diff)}>
                      {formatSignedNumber(cls.range_mean_diff)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={diffTextColor(cls.same_layer_diff)}>
                      {formatSignedNumber(cls.same_layer_diff)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{(cls.top20_ratio * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-center">{(cls.top80_ratio * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-center text-gray-500">{cls.class_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 bg-slate-900 text-white rounded-lg shadow-sm p-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <MonitorPlay className="w-8 h-8 text-blue-300" />
              统测分析结果展示
            </h2>
            <p className="text-slate-300 mt-2 text-lg">{dashboardData.exam_name} · {dashboardData.layer_name}</p>
          </div>
          <button
            onClick={() => navigate('/analysis')}
            className="bg-white text-slate-900 px-5 py-3 rounded-lg font-semibold hover:bg-blue-50"
          >
            打开完整成绩分析
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-slate-800 rounded-lg p-5">
            <p className="text-slate-400 text-base">核心结论</p>
            <p className="text-2xl font-bold mt-3">
              当前均分 {dashboardData.layer_stats.mean_score}，标准差 {dashboardData.layer_stats.std_score}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-5">
            <p className="text-slate-400 text-base">优势班级</p>
            <p className="text-2xl font-bold mt-3 text-green-300">
              {dashboardData.meeting_summary.top_class?.class_name || '-'}班 · 均分 {dashboardData.meeting_summary.top_class?.class_mean || '-'}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg p-5">
            <p className="text-slate-400 text-base">干预重点</p>
            <p className="text-2xl font-bold mt-3 text-red-300">
              {dashboardData.meeting_summary.weak_class?.class_name || '-'}班 · 需跟踪低分段
            </p>
          </div>
        </div>
        <div className="mt-6 h-72 bg-white rounded-lg p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dashboardData.class_rankings.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="class_name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="class_mean" name="班级均分" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 底部说明 */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Z值计算公式说明</h3>
        <p className="text-sm text-blue-700">
          <strong>Z_class = (Score_standard × 50%) + (Top20%_ratio × 20%) + (Top80%_ratio × 30%)</strong>
        </p>
        <p className="text-xs text-blue-600 mt-1">
          其中 Score_standard 为班级标准分，Top20%_ratio 为班级进入分层前20%人数占比，Top80%_ratio 为班级进入分层前80%人数占比。
          该公式综合考量班级整体水平、优秀生比例和中坚生比例，全面评估班级教学成效。
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
