import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  School,
  Download,
  Share2,
  AlertCircle,
  Award,
  BookOpen,
  Loader2,
  Sparkles,
  Target
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import schoolData from '../data/schoolData';
import { analyzeStudentScoreWithAI, buildStudentScoreAiPayload } from '../lib/aiAnalysisApi';
import {
  getLocalScoreVisibilitySettings,
  maskRankValue,
  resolveScoreVisibility,
} from '../lib/scoreVisibility';

const DEFAULT_SUBJECTS = ['语文', '数学', '英语', '科学', '社会'];
const CHART_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];

const normalizeText = (value) => String(value ?? '').trim();

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatNumber = (value, digits = 1) => {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : '-';
};

const mean = (values) => {
  const nums = values.filter(Number.isFinite);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : 0;
};

const std = (values) => {
  const nums = values.filter(Number.isFinite);
  if (!nums.length) return 0;
  const avg = mean(nums);
  return Math.sqrt(nums.reduce((sum, value) => sum + (value - avg) ** 2, 0) / nums.length);
};

const isValidScoreRow = (row) => row && row.is_valid !== false && row.is_included !== false;

const getStudentKey = (row) => normalizeText(row?.student_id || row?.student_code || row?.code);

const studentMatchesRow = (student, row) => {
  const studentKeys = [student?.id, student?.student_code, student?.code].map(normalizeText).filter(Boolean);
  const rowKeys = [row?.student_id, row?.student_code, row?.code].map(normalizeText).filter(Boolean);
  return studentKeys.some((key) => rowKeys.includes(key));
};

const getScoreClassId = (row, fallbackClassId) => {
  const direct = toNumber(row?.class_id);
  if (direct) return direct;
  const text = normalizeText(row?.class_name || row?.className);
  const match = text.match(/\d{3,4}/);
  return match ? Number(match[0]) : toNumber(fallbackClassId);
};

const getStudentClassIdFromScoreRow = (row) => {
  const directClassId = getScoreClassId(row);
  if (directClassId) return directClassId;

  const scoreStudentKey = getStudentKey(row);
  const matchedStudent = (schoolData.students || []).find((student) => (
    [student.id, student.student_code, student.code].map(normalizeText).includes(scoreStudentKey)
  ));
  return toNumber(matchedStudent?.class_id);
};

const getRowTotal = (row) => {
  const direct = toNumber(row?.total_score ?? row?.total);
  if (direct !== null) return direct;
  const scores = Object.values(row?.scores || {}).map(toNumber).filter(Number.isFinite);
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) : null;
};

const getExamLabel = (exam, examId) => exam?.exam_name || exam?.name || `考试 ${examId}`;

const getExamDateValue = (exam, examId) => {
  const parsed = Date.parse(exam?.exam_date || exam?.date || exam?.created_at || '');
  return Number.isFinite(parsed) ? parsed : Number(examId) || 0;
};

const getSubjectFullScore = (exam, subject) => {
  const configured = toNumber(exam?.subject_scores?.[subject]);
  return configured && configured > 0 ? configured : 100;
};

const getExamFullScore = (exam, subjects) => {
  const fullScore = toNumber(exam?.full_score);
  if (fullScore && fullScore > 0) return fullScore;
  return subjects.reduce((sum, subject) => sum + getSubjectFullScore(exam, subject), 0);
};

const rankRowsByValue = (rows, targetRow, valueGetter) => {
  const targetValue = valueGetter(targetRow);
  if (!Number.isFinite(targetValue)) return '-';

  const ranked = rows
    .map((row) => ({ row, value: valueGetter(row), key: getStudentKey(row) }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value);
  const targetKey = getStudentKey(targetRow);
  const index = ranked.findIndex((item) => item.row === targetRow || (targetKey && item.key === targetKey));
  return index >= 0 ? index + 1 : '-';
};

const getProfile = (student) => {
  if (!student) return {};

  const classId = toNumber(student.class_id);
  const classInfo = classId ? schoolData.getClassById?.(classId) : null;
  const headTeacher = classId ? schoolData.getHeadTeacherByClassId?.(classId) : null;
  const parents = schoolData.getParentsByStudentId?.(student.id) || [];

  return {
    ...student,
    classId,
    class_name: student.class_name || student.className || (classId ? schoolData.formatClassName?.(classId) : '') || classInfo?.name || '未分班',
    head_teacher: student.head_teacher || headTeacher?.name || '未设置',
    gender: student.gender || '未登记',
    student_code: student.student_code || student.code || '-',
    parentCount: parents.length,
  };
};

export const findStudentForScoreDetail = (studentId) => {
  const target = normalizeText(studentId);
  if (!target) return null;

  return (schoolData.students || []).find((student) => (
    [student.id, student.student_code, student.code].map(normalizeText).includes(target)
  )) || null;
};

export const buildStudentExamScores = (student) => {
  if (!student) return [];

  const rows = (schoolData.examScores || [])
    .filter(isValidScoreRow)
    .filter((row) => studentMatchesRow(student, row));

  return rows.map((row) => {
    const examId = row.exam_id;
    const exam = (schoolData.exams || []).find((item) => Number(item.id) === Number(examId));
    const examRows = (schoolData.examScores || [])
      .filter(isValidScoreRow)
      .filter((item) => Number(item.exam_id) === Number(examId));
    const targetClassId = getStudentClassIdFromScoreRow(row) || toNumber(student.class_id);
    const classRows = examRows.filter((item) => getStudentClassIdFromScoreRow(item) === targetClassId);
    const subjects = Array.from(new Set([
      ...Object.keys(row.scores || {}),
      ...(Array.isArray(exam?.subjects) ? exam.subjects : []),
      ...DEFAULT_SUBJECTS.filter((subject) => row.scores?.[subject] !== undefined)
    ])).filter((subject) => row.scores?.[subject] !== undefined);
    const total = getRowTotal(row) ?? 0;
    const allTotals = examRows.map(getRowTotal).filter(Number.isFinite);
    const gradeMean = mean(allTotals);
    const gradeStd = std(allTotals);
    const fullScore = getExamFullScore(exam, subjects.length ? subjects : DEFAULT_SUBJECTS);
    const gradeRank = row.rank || row.grade_rank || rankRowsByValue(examRows, row, getRowTotal);
    const classRank = row.class_rank || rankRowsByValue(classRows, row, getRowTotal);
    const gradePercentile = Number.isFinite(Number(gradeRank)) && examRows.length > 1
      ? ((examRows.length - Number(gradeRank)) / (examRows.length - 1)) * 100
      : null;
    const subjectScores = subjects.reduce((result, subject) => {
      const score = toNumber(row.scores?.[subject]);
      const full = getSubjectFullScore(exam, subject);
      if (!Number.isFinite(score)) return result;
      const gradeValues = examRows.map((item) => toNumber(item.scores?.[subject])).filter(Number.isFinite);
      const classValues = classRows.map((item) => toNumber(item.scores?.[subject])).filter(Number.isFinite);
      const subjectGradeMean = mean(gradeValues);
      const subjectClassMean = mean(classValues);
      result[subject] = {
        score: formatNumber(score, 1),
        full_score: full,
        score_rate: formatNumber((score / full) * 100, 1),
        class_mean: formatNumber(subjectClassMean, 1),
        grade_mean: formatNumber(subjectGradeMean, 1),
        gap_to_grade_mean: formatNumber(score - subjectGradeMean, 1),
        class_rank: rankRowsByValue(classRows, row, (item) => toNumber(item.scores?.[subject])),
        grade_rank: rankRowsByValue(examRows, row, (item) => toNumber(item.scores?.[subject])),
      };
      return result;
    }, {});

    return {
      exam_id: examId,
      exam_name: getExamLabel(exam, examId),
      exam_date: exam?.exam_date || exam?.date || '',
      dateValue: getExamDateValue(exam, examId),
      subjects: subjectScores,
      total: {
        score: formatNumber(total, 1),
        class_rank: classRank,
        grade_rank: gradeRank,
        full_score: fullScore,
        grade_mean: formatNumber(gradeMean, 1),
        gap_to_grade_mean: formatNumber(total - gradeMean, 1),
        grade_percentile: gradePercentile === null ? null : formatNumber(gradePercentile, 1),
        participants: examRows.length,
      },
      z_value: formatNumber(gradeStd > 0 ? (total - gradeMean) / gradeStd : 0, 2),
    };
  }).sort((a, b) => b.dateValue - a.dateValue);
};

const remedyForSubject = ({ subject, rate, gap, delta }) => {
  if (rate < 60) {
    return `${subject}先补基础概念和必会题，每周完成一次错题回炉并由教师复批。`;
  }
  if (gap < -8) {
    return `${subject}低于年级均分较多，建议按知识点拆分短板，安排2周小专题训练。`;
  }
  if (delta < -5) {
    return `${subject}近期回落明显，先复盘本次失分题型，恢复原有优势题的稳定性。`;
  }
  return `${subject}保持日清周结，针对低得分题型追加限时训练。`;
};

export const buildStudentDynamicDiagnosis = (examScores = []) => {
  const chronological = [...examScores].reverse();
  const latest = examScores[0] || null;
  const previous = examScores[1] || null;
  const baseline = examScores[examScores.length - 1] || null;

  if (!latest) {
    return {
      examCount: 0,
      hasHistory: false,
      totalTrend: null,
      weakSubjects: [],
      advantageSubjects: [],
      summary: '暂无成绩数据，无法生成动态诊断。',
    };
  }

  const totalDelta = previous ? Number(latest.total.score) - Number(previous.total.score) : null;
  const baselineDelta = baseline && baseline !== latest ? Number(latest.total.score) - Number(baseline.total.score) : null;
  const percentileDelta = previous && latest.total.grade_percentile !== null && previous.total.grade_percentile !== null
    ? Number(latest.total.grade_percentile) - Number(previous.total.grade_percentile)
    : null;
  const rankDelta = previous && Number.isFinite(Number(latest.total.grade_rank)) && Number.isFinite(Number(previous.total.grade_rank))
    ? Number(previous.total.grade_rank) - Number(latest.total.grade_rank)
    : null;
  const direction = totalDelta === null
    ? 'stable'
    : totalDelta > 3 || (percentileDelta ?? 0) > 2
      ? 'up'
      : totalDelta < -3 || (percentileDelta ?? 0) < -2
        ? 'down'
        : 'stable';

  const subjectRows = Object.entries(latest.subjects || {}).map(([subject, data]) => {
    const previousSubject = previous?.subjects?.[subject];
    const rate = Number(data.score_rate);
    const gap = Number(data.gap_to_grade_mean);
    const delta = previousSubject ? Number(data.score) - Number(previousSubject.score) : null;
    return {
      subject,
      score: Number(data.score),
      fullScore: Number(data.full_score || 100),
      rate,
      gradeMean: Number(data.grade_mean),
      gapToGradeMean: gap,
      previousScore: previousSubject ? Number(previousSubject.score) : null,
      scoreDelta: delta,
      gradeRank: data.grade_rank,
      classRank: data.class_rank,
      remedy: remedyForSubject({ subject, rate, gap, delta: delta ?? 0 }),
    };
  });

  const weakSubjects = subjectRows
    .filter(item => item.rate < 75 || item.gapToGradeMean < -3 || (item.scoreDelta ?? 0) < -5)
    .sort((a, b) => (
      (a.gapToGradeMean - b.gapToGradeMean) ||
      (a.rate - b.rate) ||
      ((a.scoreDelta ?? 0) - (b.scoreDelta ?? 0))
    ))
    .slice(0, 3);
  const advantageSubjects = subjectRows
    .filter(item => item.rate >= 85 && item.gapToGradeMean >= 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);
  const trendCopy = direction === 'up'
    ? '整体上升'
    : direction === 'down'
      ? '近期回落'
      : '整体平稳';
  const weakCopy = weakSubjects.length
    ? `薄弱学科集中在${weakSubjects.map(item => item.subject).join('、')}。`
    : '暂未出现明显薄弱学科。';

  return {
    examCount: examScores.length,
    hasHistory: examScores.length >= 2,
    chronological,
    latest,
    previous,
    baseline,
    totalTrend: {
      direction,
      latestScore: Number(latest.total.score),
      previousScore: previous ? Number(previous.total.score) : null,
      totalDelta,
      baselineDelta,
      latestRank: latest.total.grade_rank,
      previousRank: previous?.total?.grade_rank || null,
      rankDelta,
      latestPercentile: latest.total.grade_percentile,
      previousPercentile: previous?.total?.grade_percentile ?? null,
      percentileDelta,
    },
    weakSubjects,
    advantageSubjects,
    summary: `${trendCopy}；${weakCopy}`,
  };
};

function EmptyState({ title, description, onBack, detail }) {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
            返回
          </button>
        )}
        <h1 className="text-2xl font-bold text-gray-800">学生成绩详情</h1>
      </div>
      <div className="rounded-lg border border-slate-100 bg-white p-8 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
          <AlertCircle className="h-4 w-4" />
          数据未就绪
        </div>
        <h2 className="mt-4 text-xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        {detail && <p className="mt-4 text-xs text-slate-400">{detail}</p>}
      </div>
    </div>
  );
}

const StudentScoreDetail = ({ studentId, onBack }) => {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState('latest');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiError, setAiError] = useState('');
  const [visibilitySettings] = useState(getLocalScoreVisibilitySettings);

  useEffect(() => {
    setStudent(findStudentForScoreDetail(studentId));
    setSelectedExam('latest');
    setAiResult('');
    setAiError('');
    setLoading(false);
  }, [studentId]);

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
      return {};
    }
  }, []);
  const scoreVisibility = useMemo(
    () => resolveScoreVisibility(currentUser, visibilitySettings),
    [currentUser, visibilitySettings]
  );
  const profile = useMemo(() => getProfile(student), [student]);
  const examScores = useMemo(() => buildStudentExamScores(student), [student]);
  const currentExam = selectedExam === 'latest'
    ? examScores[0]
    : examScores.find((exam) => String(exam.exam_id) === String(selectedExam)) || examScores[0];
  const subjectNames = useMemo(() => Array.from(new Set(examScores.flatMap((exam) => Object.keys(exam.subjects)))), [examScores]);
  const trendData = useMemo(() => examScores.map((exam) => ({
    exam: exam.exam_name,
    total: exam.total.score,
    ...Object.fromEntries(Object.entries(exam.subjects).map(([subject, data]) => [subject, data.score]))
  })).reverse(), [examScores]);
  const dynamicDiagnosis = useMemo(() => buildStudentDynamicDiagnosis(examScores), [examScores]);
  const chartSubjects = Object.keys(currentExam?.subjects || {}).slice(0, 3);
  const chartMax = Math.max(currentExam?.total?.full_score || 100, ...trendData.map((item) => Number(item.total) || 0));
  const radarData = Object.entries(currentExam?.subjects || {}).map(([subject, data]) => ({
    subject,
    scoreRate: formatNumber((Number(data.score) / Number(data.full_score || 100)) * 100, 1),
  }));
  const masteryData = Object.entries(currentExam?.subjects || {}).map(([subject, data]) => {
    const previous = examScores[1]?.subjects?.[subject];
    const currentRate = Number(data.score) / Number(data.full_score || 100);
    const previousRate = previous ? Number(previous.score) / Number(previous.full_score || 100) : null;
    const trend = previousRate === null ? 'stable' : currentRate > previousRate ? 'up' : currentRate < previousRate ? 'down' : 'stable';
    return {
      subject,
      area: `${subject}综合表现`,
      mastery: formatNumber(currentRate * 100, 0),
      trend,
    };
  });

  const getScoreColor = (score, fullScore = 100) => {
    const rate = Number(score) / Number(fullScore || 100);
    if (rate >= 0.9) return 'text-green-600';
    if (rate >= 0.8) return 'text-blue-600';
    if (rate >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score, fullScore = 100) => {
    const rate = Number(score) / Number(fullScore || 100);
    if (rate >= 0.9) return 'bg-green-100';
    if (rate >= 0.8) return 'bg-blue-100';
    if (rate >= 0.6) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const handleExport = () => {
    const headers = [
      '考试',
      '日期',
      ...subjectNames,
      '总分',
      ...(scoreVisibility.show_class_rank ? ['班排'] : []),
      ...(scoreVisibility.show_grade_rank ? ['年排'] : []),
      'Z值',
    ];
    const rows = examScores.map((exam) => [
      exam.exam_name,
      exam.exam_date,
      ...subjectNames.map((subject) => exam.subjects[subject]?.score ?? ''),
      exam.total.score,
      ...(scoreVisibility.show_class_rank ? [exam.total.class_rank] : []),
      ...(scoreVisibility.show_grade_rank ? [exam.total.grade_rank] : []),
      exam.z_value,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${profile.name || '学生'}_成绩单_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleAiAnalysis = async () => {
    setAiLoading(true);
    setAiError('');
    setAiResult('');

    try {
      const payload = buildStudentScoreAiPayload({ profile, currentExam, dynamicDiagnosis });
      if (!scoreVisibility.show_grade_rank) {
        payload.history = (payload.history || []).map(exam => ({
          ...exam,
          grade_rank: null,
          grade_percentile: null,
        }));
        payload.trend_summary = `${payload.trend_summary}（当前角色未开放年级排名，AI不参考年级名次。）`;
      }
      const result = await analyzeStudentScoreWithAI(payload);
      setAiResult(result?.analysis || 'AI未返回有效分析内容');
    } catch (error) {
      setAiError(error?.message || 'AI分析暂不可用，请确认后端已配置 DEEPSEEK_API_KEY');
    } finally {
      setAiLoading(false);
    }
  };

  const trendTone = dynamicDiagnosis.totalTrend?.direction === 'up'
    ? 'text-green-700 bg-green-50 border-green-100'
    : dynamicDiagnosis.totalTrend?.direction === 'down'
      ? 'text-red-700 bg-red-50 border-red-100'
      : 'text-blue-700 bg-blue-50 border-blue-100';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <EmptyState
        onBack={onBack}
        title="未找到学生档案"
        description="请从学生管理选择已登记学生后再查看成绩详情。系统不会用样例学生替代真实学生。"
        detail={studentId ? `查询标识：${studentId}` : '当前未传入学生标识'}
      />
    );
  }

  const studentHeader = (
    <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
            <span className="text-3xl font-bold text-blue-600">{profile.name?.charAt(0) || '学'}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">{profile.name || '未命名学生'}</h2>
            <p className="text-gray-500">{profile.student_code}</p>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <School className="h-4 w-4" />
                {profile.class_name}
              </span>
              <span>班主任：{profile.head_teacher}</span>
              <span>性别：{profile.gender}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={examScores.length === 0}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <Download className="h-4 w-4" />
            导出成绩单
          </button>
          <button
            type="button"
            disabled
            title={profile.parentCount > 0 ? '家长端会读取同一份成绩数据' : '请先在家长管理中完成学生绑定'}
            className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-400"
          >
            <Share2 className="h-4 w-4" />
            家长端同步
          </button>
        </div>
      </div>
    </div>
  );

  if (examScores.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center gap-4">
          {onBack && (
            <button type="button" onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
              <ArrowLeft className="h-5 w-5" />
              返回
            </button>
          )}
          <h1 className="text-2xl font-bold text-gray-800">学生成绩详情</h1>
        </div>
        {studentHeader}
        <div className="rounded-lg border border-slate-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-slate-900">暂无有效成绩</h2>
          <p className="mt-2 text-sm text-slate-500">导入并确认该学生的有效考试成绩后，本页会自动生成趋势、排名和学科表现。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
            返回
          </button>
        )}
        <h1 className="text-2xl font-bold text-gray-800">学生成绩详情</h1>
      </div>

      {studentHeader}

      <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-lg font-semibold text-gray-800">考试成绩总览</h3>
          <select
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1 text-sm"
          >
            <option value="latest">最新：{examScores[0].exam_name}</option>
            {examScores.map((exam) => (
              <option key={exam.exam_id} value={exam.exam_id}>{exam.exam_name}</option>
            ))}
          </select>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className={`rounded-lg p-4 ${getScoreBg(currentExam.total.score, currentExam.total.full_score)}`}>
            <p className="mb-1 text-sm text-gray-600">总分</p>
            <p className={`text-2xl font-bold ${getScoreColor(currentExam.total.score, currentExam.total.full_score)}`}>
              {currentExam.total.score}
            </p>
            <p className="text-xs text-gray-500">满分{currentExam.total.full_score}</p>
            <div className="mt-2 text-xs">
              <span className="text-gray-600">班排：{maskRankValue(currentExam.total.class_rank, scoreVisibility.show_class_rank)}</span>
              <span className="mx-2">|</span>
              <span className="text-gray-600">年排：{maskRankValue(currentExam.total.grade_rank, scoreVisibility.show_grade_rank)}</span>
            </div>
          </div>

          {Object.entries(currentExam.subjects).map(([subject, data]) => (
            <div key={subject} className={`rounded-lg p-4 ${getScoreBg(data.score, data.full_score)}`}>
              <p className="mb-1 text-sm text-gray-600">{subject}</p>
              <p className={`text-xl font-bold ${getScoreColor(data.score, data.full_score)}`}>
                {data.score}
              </p>
              <div className="mt-2 text-xs text-gray-600">
                <span>班排{maskRankValue(data.class_rank, scoreVisibility.show_class_rank)}</span>
                <span className="mx-1">|</span>
                <span>年排{maskRankValue(data.grade_rank, scoreVisibility.show_grade_rank)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-gray-50 p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Z值：</span>
              <span className={`text-lg font-bold ${Number(currentExam.z_value) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Number(currentExam.z_value) > 0 ? '+' : ''}{currentExam.z_value}
              </span>
            </div>
            <div className="h-2 flex-1 rounded-full bg-gray-200">
              <div
                className={`h-2 rounded-full ${Number(currentExam.z_value) >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(Math.abs(Number(currentExam.z_value)) * 50, 100)}%` }}
              />
            </div>
            <span className="text-sm text-gray-500">
              {Number(currentExam.z_value) >= 0.5 ? '优秀' : Number(currentExam.z_value) >= 0 ? '良好' : Number(currentExam.z_value) >= -0.5 ? '一般' : '需努力'}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">学科能力分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar
                name="得分率"
                dataKey="scoreRate"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.3}
              />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">历次考试趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="exam" />
              <YAxis domain={[0, chartMax]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" name="总分" stroke="#3B82F6" strokeWidth={2} />
              {chartSubjects.map((subject, index) => (
                <Line
                  key={subject}
                  type="monotone"
                  dataKey={subject}
                  name={subject}
                  stroke={CHART_COLORS[(index + 1) % CHART_COLORS.length]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">多次成绩动态诊断</h3>
            <p className="mt-1 text-sm text-gray-500">{dynamicDiagnosis.summary}</p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${trendTone}`}>
            <TrendingUp className="h-4 w-4" />
            {dynamicDiagnosis.examCount}次考试
          </div>
        </div>

        {!dynamicDiagnosis.hasHistory && (
          <div className="mb-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            至少导入两次历史考试后，系统会自动计算进退步、百分位变化和薄弱学科趋势。
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Target className="h-4 w-4" />
              最近总分变化
            </div>
            <p className={`mt-2 text-2xl font-bold ${(dynamicDiagnosis.totalTrend?.totalDelta ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {dynamicDiagnosis.totalTrend?.totalDelta === null ? '-' : `${dynamicDiagnosis.totalTrend.totalDelta > 0 ? '+' : ''}${formatNumber(dynamicDiagnosis.totalTrend.totalDelta, 1)}`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {dynamicDiagnosis.totalTrend?.previousScore === null ? '暂无上一场可比考试' : `${dynamicDiagnosis.totalTrend.previousScore} → ${dynamicDiagnosis.totalTrend.latestScore}`}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <TrendingUp className="h-4 w-4" />
              年级名次变化
            </div>
            <p className={`mt-2 text-2xl font-bold ${(dynamicDiagnosis.totalTrend?.rankDelta ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {scoreVisibility.show_grade_rank
                ? (dynamicDiagnosis.totalTrend?.rankDelta === null ? '-' : `${dynamicDiagnosis.totalTrend.rankDelta > 0 ? '+' : ''}${dynamicDiagnosis.totalTrend.rankDelta}`)
                : '暂未开放'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {scoreVisibility.show_grade_rank
                ? (dynamicDiagnosis.totalTrend?.previousRank ? `年排 ${dynamicDiagnosis.totalTrend.previousRank} → ${dynamicDiagnosis.totalTrend.latestRank}` : `年排 ${dynamicDiagnosis.totalTrend?.latestRank || '-'}`)
                : '教务端未开放年级排名'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <Award className="h-4 w-4" />
              年级百分位
            </div>
            <p className={`mt-2 text-2xl font-bold ${(dynamicDiagnosis.totalTrend?.percentileDelta ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {scoreVisibility.show_percentile ? `${dynamicDiagnosis.totalTrend?.latestPercentile ?? '-'}%` : '暂未开放'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {scoreVisibility.show_percentile
                ? `环比 ${dynamicDiagnosis.totalTrend?.percentileDelta === null ? '-' : `${dynamicDiagnosis.totalTrend.percentileDelta > 0 ? '+' : ''}${formatNumber(dynamicDiagnosis.totalTrend.percentileDelta, 1)}pct`}`
                : '教务端未开放百分位'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <BookOpen className="h-4 w-4" />
              薄弱学科
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{dynamicDiagnosis.weakSubjects.length}</p>
            <p className="mt-1 text-xs text-slate-500">
              {dynamicDiagnosis.weakSubjects.map(item => item.subject).join('、') || '暂无明显短板'}
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">薄弱学科</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">最新得分</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">年级均分</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">具体差距</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">最近变化</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">补救方法</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(dynamicDiagnosis.weakSubjects.length ? dynamicDiagnosis.weakSubjects : dynamicDiagnosis.advantageSubjects.slice(0, 1)).map((item) => (
                <tr key={item.subject}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.subject}</td>
                  <td className="px-4 py-3 text-center">{formatNumber(item.score, 1)}/{item.fullScore}</td>
                  <td className="px-4 py-3 text-center">{formatNumber(item.gradeMean, 1)}</td>
                  <td className={`px-4 py-3 text-center font-semibold ${item.gapToGradeMean >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {item.gapToGradeMean > 0 ? '+' : ''}{formatNumber(item.gapToGradeMean, 1)}
                  </td>
                  <td className={`px-4 py-3 text-center font-semibold ${(item.scoreDelta ?? 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {item.scoreDelta === null ? '-' : `${item.scoreDelta > 0 ? '+' : ''}${formatNumber(item.scoreDelta, 1)}`}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{item.remedy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h4 className="flex items-center gap-2 font-semibold text-blue-900">
                <Sparkles className="h-4 w-4" />
                AI学情分析
              </h4>
              <p className="mt-1 text-sm text-blue-700">调用后端 DeepSeek，根据上面的多次成绩、薄弱学科和差距生成补救建议。</p>
            </div>
            <button
              type="button"
              onClick={handleAiAnalysis}
              disabled={aiLoading || !dynamicDiagnosis.examCount || !scoreVisibility.allow_ai_analysis}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiLoading ? '分析中' : (scoreVisibility.allow_ai_analysis ? '生成AI建议' : 'AI未开放')}
            </button>
          </div>
          {aiError && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {aiError}
            </div>
          )}
          {aiResult && (
            <div className="mt-4 whitespace-pre-wrap rounded-lg border border-blue-100 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
              {aiResult}
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-800">学科掌握情况</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {masteryData.map((item) => (
            <div key={item.subject} className="rounded-lg border border-gray-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{item.area}</p>
                  <p className="text-xs text-gray-500">由最新成绩得分率计算</p>
                </div>
                <div className="flex items-center gap-1">
                  {item.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
                  {item.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-600" />}
                  {item.trend === 'stable' && <span className="text-gray-400">→</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-gray-200">
                  <div
                    className={`h-2 rounded-full ${
                      Number(item.mastery) >= 80 ? 'bg-green-500' :
                      Number(item.mastery) >= 60 ? 'bg-blue-500' :
                      'bg-yellow-500'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(Number(item.mastery), 100))}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700">{item.mastery}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-800">历史成绩记录</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">考试</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">日期</th>
                {subjectNames.map((subject) => (
                  <th key={subject} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{subject}</th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">总分</th>
                {scoreVisibility.show_class_rank && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">班排</th>
                )}
                {scoreVisibility.show_grade_rank && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">年排</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Z值</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {examScores.map((exam) => (
                <tr key={exam.exam_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{exam.exam_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{exam.exam_date || '-'}</td>
                  {subjectNames.map((subject) => (
                    <td key={subject} className="px-4 py-3 text-sm">
                      {exam.subjects[subject] ? (
                        <span className={getScoreColor(exam.subjects[subject].score, exam.subjects[subject].full_score)}>
                          {exam.subjects[subject].score}
                        </span>
                      ) : '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{exam.total.score}</td>
                  {scoreVisibility.show_class_rank && (
                    <td className="px-4 py-3 text-sm text-gray-600">{exam.total.class_rank}</td>
                  )}
                  {scoreVisibility.show_grade_rank && (
                    <td className="px-4 py-3 text-sm text-gray-600">{exam.total.grade_rank}</td>
                  )}
                  <td className="px-4 py-3 text-sm">
                    <span className={Number(exam.z_value) >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {Number(exam.z_value) > 0 ? '+' : ''}{exam.z_value}
                    </span>
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

export default StudentScoreDetail;
