import React, { useEffect, useMemo, useState } from 'react';
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
  ResponsiveContainer
} from 'recharts';
import {
  Award,
  BookOpen,
  Lock,
  Target,
  TrendingDown,
  TrendingUp,
  Users
} from 'lucide-react';
import schoolData from '../data/schoolData';
import { fetchClassList } from '../lib/classApi';
import {
  GRADE_BANDS,
  buildExamAnalytics,
  buildPercentileProgress,
  formatNumber,
  getExamScores,
  getLayerOptions,
  getSubjectFullScore,
  getSubjects,
  mean,
  normalizeClassLayers
} from '../lib/educationAnalytics';
import { fetchExamListWithStatistics, fetchExamScoreRows } from '../lib/examApi';
import { recalculateScoreRanks } from '../lib/scoreImport';
import { hasBackendAuthToken } from '../lib/sessionToken';
import {
  getResearchAccessState,
  getTeacherAccessState,
} from '../lib/teacherAccess';
import { fetchTeacherListWithAssignments } from '../lib/teacherApi';
import {
  getLocalScoreVisibilitySettings,
  maskRankValue,
  resolveScoreVisibility,
} from '../lib/scoreVisibility';
import {
  getEffectiveDashboardUser,
  readStoredUser,
  ROLE_PREVIEW_CHANGED_EVENT,
} from '../lib/rolePreview';

const useEffectiveRoleDashboardUser = (data = {}) => {
  const [, setPreviewVersion] = useState(0);
  const { teachers = [], classes = [], students = [] } = data;

  useEffect(() => {
    const updatePreviewUser = () => setPreviewVersion(version => version + 1);
    window.addEventListener(ROLE_PREVIEW_CHANGED_EVENT, updatePreviewUser);
    window.addEventListener('schoolData:changed', updatePreviewUser);
    return () => {
      window.removeEventListener(ROLE_PREVIEW_CHANGED_EVENT, updatePreviewUser);
      window.removeEventListener('schoolData:changed', updatePreviewUser);
    };
  }, []);

  return getEffectiveDashboardUser(readStoredUser(), { teachers, classes, students });
};

const getExamLabel = (exam) => {
  if (!exam) return '';
  const name = exam.exam_name || exam.name || `考试${exam.id}`;
  return exam.term ? `${exam.term} ${name}` : name;
};

const getCurrentTerm = () => (
  schoolData.getCurrentSemesterDisplay?.() ||
  `${schoolData.config?.currentAcademicYear || ''}-${schoolData.config?.currentSemester || ''}`
);

const hasBackendToken = hasBackendAuthToken;

const getGradeExams = (gradeLevel, exams = schoolData.exams || []) => (
  (exams || [])
    .filter(exam => !gradeLevel || exam.grade_level === gradeLevel)
    .sort((a, b) => (Date.parse(a.exam_date || '') || Number(a.id)) - (Date.parse(b.exam_date || '') || Number(b.id)))
);

const defaultGrade = (exams = schoolData.exams || []) => {
  const first = (exams || []).find(exam => exam.grade_level)?.grade_level;
  return first || '7年级';
};

const getLocalScoreRows = (examId, { includeInvalid = false } = {}) => (
  (schoolData.examScores || [])
    .filter(score => Number(score.exam_id) === Number(examId))
    .filter(score => includeInvalid || (score.is_valid !== false && score.is_included !== false))
);

const noticeTone = (status) => {
  if (status === 'ready') return 'border-green-100 bg-green-50 text-green-700';
  if (status === 'loading') return 'border-blue-100 bg-blue-50 text-blue-700';
  if (status === 'fallback' || status === 'error') return 'border-amber-100 bg-amber-50 text-amber-700';
  return 'border-slate-100 bg-slate-50 text-slate-600';
};

function DataSourceNotice({ directory, dashboard }) {
  const items = [
    directory && {
      key: 'directory',
      label: '任课范围',
      status: directory.status,
      message: directory.message,
    },
    dashboard && {
      key: 'scores',
      label: '考试成绩',
      status: dashboard.dataStatus,
      message: dashboard.dataMessage,
    },
  ].filter(Boolean);

  if (!items.length) return null;

  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
      {items.map(item => (
        <div key={item.key} className={`rounded-lg border px-3 py-2 text-sm ${noticeTone(item.status)}`}>
          <span className="font-semibold">{item.label}</span>
          <span className="mx-2 text-current/50">·</span>
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  );
}

function ScopeLoadingState({ title, description, directory, dashboard }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
      <DataSourceNotice directory={directory} dashboard={dashboard} />
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
            <Users className="w-4 h-4" />
            正在同步数据范围
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mt-4">正在读取后端教师任课与考试成绩</h2>
          <p className="text-sm text-slate-600 mt-2 leading-6">
            同步完成后再展示看板，避免在角色范围未确认前显示跨班级或跨学科数据。
          </p>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, subtitle, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700'
  };

  return (
    <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-2">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-lg ${tones[tone] || tones.blue}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}

const signedNumber = (value, digits = 1) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${number >= 0 ? '+' : ''}${formatNumber(number, digits)}`;
};

const diffToneClass = (value) => (Number(value) >= 0 ? 'text-green-700' : 'text-red-600');

function TeacherAccessEmptyState({ status, user, teacher, directory, dashboard }) {
  const copy = {
    'no-teacher': {
      title: '未匹配到教师档案',
      description: '当前登录账号没有匹配到教师基础信息。系统不会用全年级数据作为默认范围。',
      steps: ['在教师管理中确认教师姓名或工号', '确保账号用户名、姓名或手机号与教师档案一致', '配置任教学科和任教班级后再查看看板'],
    },
    'no-classes': {
      title: '暂无任教班级',
      description: '已识别教师档案，但尚未配置任教班级。科任教师看板只展示本人任教班级的数据。',
      steps: ['进入教师管理', '编辑该教师的任教班级', '保存后重新进入科任教师看板'],
    },
    'no-subjects': {
      title: '暂无任教学科',
      description: '已识别教师档案和任教班级，但尚未配置任教学科。请先补齐学科范围。',
      steps: ['进入教师管理', '为该教师选择任教学科', '确认任教记录里的学科字段完整'],
    },
  };
  const state = copy[status] || copy['no-teacher'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">科任教师看板</h1>
        <p className="text-sm text-slate-500 mt-1">只展示本人任教学科和任教班级的数据。</p>
      </div>
      <DataSourceNotice directory={directory} dashboard={dashboard} />
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-sm font-medium">
            <BookOpen className="w-4 h-4" />
            数据范围未配置
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mt-4">{state.title}</h2>
          <p className="text-sm text-slate-600 mt-2 leading-6">{state.description}</p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            {state.steps.map((step, index) => (
              <div key={step} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-400">步骤 {index + 1}</p>
                <p className="text-sm font-medium text-slate-700 mt-2">{step}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-5">
            当前账号：{user?.real_name || user?.name || user?.username || '未识别'}{teacher?.name ? `；教师档案：${teacher.name}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

function ResearchAccessEmptyState({ status, user, teacher, directory, dashboard }) {
  const copy = {
    'no-teacher': {
      title: '未匹配到教研/备课组教师档案',
      description: '当前账号不是教务管理员，也没有匹配到教师基础信息。教研看板不会默认开放全年级数据。',
      steps: ['在教师管理中确认教师姓名或工号', '确保账号用户名、姓名或手机号与教师档案一致', '配置负责学科和负责班级后再查看看板'],
    },
    'no-classes': {
      title: '暂无负责班级/年级范围',
      description: '已识别教师档案，但尚未配置负责班级。教研组长和备课组长只展示其负责范围内的数据。',
      steps: ['进入教师管理', '为该教师配置任教或负责班级', '保存后重新进入教研看板'],
    },
    'no-subjects': {
      title: '暂无负责学科',
      description: '已识别教师档案和负责班级，但尚未配置学科范围。请先补齐学科后再进行教研分析。',
      steps: ['进入教师管理', '为该教师选择负责学科', '确认任教记录里的学科字段完整'],
    },
  };
  const state = copy[status] || copy['no-teacher'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">教研看板</h1>
        <p className="text-sm text-slate-500 mt-1">按负责年级、负责班级和负责学科展示教研分析。</p>
      </div>
      <DataSourceNotice directory={directory} dashboard={dashboard} />
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-sm font-medium">
            <BookOpen className="w-4 h-4" />
            教研范围未配置
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mt-4">{state.title}</h2>
          <p className="text-sm text-slate-600 mt-2 leading-6">{state.description}</p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            {state.steps.map((step, index) => (
              <div key={step} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-400">步骤 {index + 1}</p>
                <p className="text-sm font-medium text-slate-700 mt-2">{step}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-5">
            当前账号：{user?.real_name || user?.name || user?.username || '未识别'}{teacher?.name ? `；教师档案：${teacher.name}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

function FilterBar({
  grade,
  setGrade,
  examId,
  setExamId,
  layer,
  setLayer,
  subject,
  setSubject,
  subjects = [],
  layers = [],
  grades = ['7年级', '8年级', '9年级'],
  exams: scopedExams,
  allowAllSubjects = true,
}) {
  const exams = scopedExams || getGradeExams(grade);
  return (
    <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3">
      <select value={grade} onChange={(e) => setGrade(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
        {grades.map(item => <option key={item} value={item}>{item}</option>)}
      </select>
      <select value={examId} onChange={(e) => setExamId(e.target.value)} disabled={!exams.length} className="px-3 py-2 border border-slate-300 rounded-lg bg-white min-w-56 disabled:bg-slate-50 disabled:text-slate-400">
        {exams.length
          ? exams.map(exam => <option key={exam.id} value={exam.id}>{getExamLabel(exam)}</option>)
          : <option value="">暂无考试数据</option>}
      </select>
      <select value={layer} onChange={(e) => setLayer(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
        {layers.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      {setSubject && (
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
          {allowAllSubjects && <option value="all">全部学科</option>}
          {subjects.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      )}
    </div>
  );
}

function GradeDistribution({ bands, count }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {GRADE_BANDS.map(band => (
        <div key={band.key} className={`${band.bg} rounded-lg p-4`}>
          <p className={`text-sm font-medium ${band.text}`}>{band.label} · {band.name}</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{bands?.[band.key] || 0}</p>
          <p className="text-xs text-slate-500 mt-1">
            {count ? formatNumber(((bands?.[band.key] || 0) / count) * 100, 1) : 0}%
          </p>
        </div>
      ))}
    </div>
  );
}

const subjectZRows = (analytics) => {
  const means = analytics.subjectStats.map(item => item.mean).filter(Number.isFinite);
  const avg = mean(means);
  const variance = means.length ? Math.sqrt(means.reduce((sum, value) => sum + (value - avg) ** 2, 0) / means.length) : 0;
  return analytics.subjectStats.map(item => ({
    ...item,
    zScore: variance > 0 ? (item.mean - avg) / variance : 0
  })).sort((a, b) => a.zScore - b.zScore);
};

const weakStudentRows = (rows, subject = 'all') => rows
  .map(row => ({
    row,
    name: row.student_name || schoolData.getStudentById?.(row.student_id)?.name || `学生${row.student_id}`,
    className: schoolData.formatClassName?.(row.class_id) || `${row.class_id}班`,
    score: subject && subject !== 'all' ? Number(row.scores?.[subject]) : Number(row.total_score)
  }))
  .filter(item => Number.isFinite(item.score))
  .sort((a, b) => a.score - b.score);

const scoreValueFor = (row, subject = 'all') => (
  subject && subject !== 'all' ? Number(row?.scores?.[subject]) : Number(row?.total_score)
);

const buildProjectedAnalysis = ({ analytics, exam, subject = 'all' }) => {
  const scores = (analytics.rows || [])
    .map(row => ({ row, score: scoreValueFor(row, subject) }))
    .filter(item => Number.isFinite(item.score) && item.score >= 0)
    .sort((a, b) => b.score - a.score);
  const fullScore = subject && subject !== 'all'
    ? getSubjectFullScore(exam, subject, analytics.rows)
    : analytics.fullScore;
  const excellentLine = fullScore * 0.9;
  const passLine = fullScore * 0.6;
  const simulatedLine = scores.length ? scores[Math.max(0, Math.ceil(scores.length * 0.2) - 1)]?.score || 0 : 0;
  const classRows = (analytics.classRows || []).map(row => {
    const count = Math.max(row.count || 0, 1);
    const passCount = (row.bands.A || 0) + (row.bands.B || 0) + (row.bands.C || 0);
    const passRate = (passCount / count) * 100;
    const excellentRate = ((row.bands.A || 0) / count) * 100;
    const teachingScore = row.mean * 0.5 + row.zScore * 20 + passRate * 0.2 + excellentRate * 0.2 - row.failRate * 0.1;
    return { ...row, passRate, excellentRate, teachingScore };
  }).sort((a, b) => b.teachingScore - a.teachingScore);

  return {
    count: scores.length,
    excellentLine,
    passLine,
    simulatedLine,
    simulatedCount: scores.filter(item => item.score >= simulatedLine).length,
    topStudents: scores.slice(0, 8).map((item, index) => ({
      rank: index + 1,
      name: item.row.student_name || schoolData.getStudentById?.(item.row.student_id)?.name || `学生${item.row.student_id}`,
      className: schoolData.formatClassName?.(item.row.class_id) || `${item.row.class_id}班`,
      score: item.score
    })),
    classRows
  };
};

const filterRowsByClassIds = (rows = [], classIds = []) => {
  const classIdSet = new Set(classIds.map(Number).filter(Number.isFinite));
  if (!classIdSet.size) return [];
  return rows.filter(row => classIdSet.has(Number(row.class_id)));
};

const limitRowsToSubjects = (rows = [], subjects = []) => {
  const allowedSubjects = new Set(subjects.filter(Boolean));
  if (!allowedSubjects.size) return rows;

  return rows.map(row => {
    const scores = Object.fromEntries(
      Object.entries(row.scores || {}).filter(([subject]) => allowedSubjects.has(subject))
    );
    const totalScore = Object.values(scores)
      .map(Number)
      .filter(Number.isFinite)
      .reduce((sum, value) => sum + value, 0);

    return {
      ...row,
      scores,
      total_score: totalScore,
    };
  });
};

const getScopedSubjectExam = (exam, subjects = []) => (
  exam && subjects.length ? { ...exam, subjects } : exam
);

const buildMultiExamTrendFromRows = ({ exams, layers, layerCode = 'all', subject = 'all', getScoreRowsForExam = getExamScores }) => (
  (exams || []).map(exam => {
    const analytics = buildExamAnalytics({
      exam,
      rows: getScoreRowsForExam(exam.id, { includeInvalid: true }),
      layers,
      layerCode,
      subject,
    });

    return {
      examId: exam.id,
      examName: getExamLabel(exam),
      examDate: exam.exam_date || '',
      participants: analytics.total.count,
      mean: formatNumber(analytics.total.mean, 1),
      std: formatNumber(analytics.total.std, 1),
      passRate: formatNumber(analytics.total.passRate, 1),
      failRate: formatNumber(analytics.total.failRate, 1),
      aRate: analytics.total.count ? formatNumber((analytics.total.bands.A / analytics.total.count) * 100, 1) : 0,
      bRate: analytics.total.count ? formatNumber((analytics.total.bands.B / analytics.total.count) * 100, 1) : 0,
      cRate: analytics.total.count ? formatNumber((analytics.total.bands.C / analytics.total.count) * 100, 1) : 0,
      dRate: analytics.total.count ? formatNumber((analytics.total.bands.D / analytics.total.count) * 100, 1) : 0,
      analytics,
    };
  })
);

const buildScopedResearchTrend = ({
  exams,
  layers,
  classIds,
  layerCode = 'all',
  subject = 'all',
  subjects = [],
  getScoreRowsForExam = getExamScores,
}) => {
  const trendSubjects = subject && subject !== 'all' ? [subject] : subjects;

  return (exams || []).map(exam => {
    const scopedRows = filterRowsByClassIds(getScoreRowsForExam(exam.id, { includeInvalid: true }), classIds);
    const rows = limitRowsToSubjects(scopedRows, trendSubjects);
    const analytics = buildExamAnalytics({
      exam: getScopedSubjectExam(exam, trendSubjects),
      rows,
      layers,
      layerCode,
      subject,
    });

    return {
      examId: exam.id,
      examName: getExamLabel(exam),
      examDate: exam.exam_date || '',
      participants: analytics.total.count,
      mean: formatNumber(analytics.total.mean, 1),
      std: formatNumber(analytics.total.std, 1),
      passRate: formatNumber(analytics.total.passRate, 1),
      failRate: formatNumber(analytics.total.failRate, 1),
      aRate: analytics.total.count ? formatNumber((analytics.total.bands.A / analytics.total.count) * 100, 1) : 0,
      bRate: analytics.total.count ? formatNumber((analytics.total.bands.B / analytics.total.count) * 100, 1) : 0,
      cRate: analytics.total.count ? formatNumber((analytics.total.bands.C / analytics.total.count) * 100, 1) : 0,
      dRate: analytics.total.count ? formatNumber((analytics.total.bands.D / analytics.total.count) * 100, 1) : 0,
      analytics,
    };
  });
};

function AnalysisProjectionPanel({ title = '成绩分析投送', analytics, exam, subject = 'all', scopeLabel = '全段' }) {
  const projected = buildProjectedAnalysis({ analytics, exam, subject });
  const zRows = subjectZRows(analytics);

  return (
    <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-5 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500 mt-1">当前范围：{scopeLabel}；当前学科：{subject === 'all' ? '总分/全科' : subject}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-blue-50 px-3 py-2">
            <p className="text-xs text-blue-700">Z值基准</p>
            <p className="text-lg font-bold text-blue-900">{formatNumber(analytics.total.mean, 1)}</p>
          </div>
          <div className="rounded-lg bg-green-50 px-3 py-2">
            <p className="text-xs text-green-700">三率一分</p>
            <p className="text-lg font-bold text-green-900">{formatNumber(analytics.total.passRate, 1)}%</p>
          </div>
          <div className="rounded-lg bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-700">尖子线</p>
            <p className="text-lg font-bold text-amber-900">{formatNumber(projected.excellentLine, 1)}</p>
          </div>
          <div className="rounded-lg bg-purple-50 px-3 py-2">
            <p className="text-xs text-purple-700">模拟进线</p>
            <p className="text-lg font-bold text-purple-900">{formatNumber(projected.simulatedLine, 1)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="border border-slate-100 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-800">Z值综合评价 / 教学积分</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white text-slate-500">
                  <th className="px-3 py-2 text-left">班级</th>
                  <th className="px-3 py-2 text-center">层次</th>
                  <th className="px-3 py-2 text-center">均分</th>
                  <th className="px-3 py-2 text-center">同层差</th>
                  <th className="px-3 py-2 text-center">班级Z</th>
                  <th className="px-3 py-2 text-center">教学积分</th>
                  <th className="px-3 py-2 text-center">D等</th>
                </tr>
              </thead>
              <tbody>
                {projected.classRows.slice(0, 10).map(row => (
                  <tr key={row.classId} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{row.className}</td>
                    <td className="px-3 py-2 text-center">{row.layerCode || '-'}</td>
                    <td className="px-3 py-2 text-center">{formatNumber(row.mean, 1)}</td>
                    <td className={`px-3 py-2 text-center font-semibold ${diffToneClass(row.sameLayerDiff)}`}>{signedNumber(row.sameLayerDiff, 1)}</td>
                    <td className={`px-3 py-2 text-center font-semibold ${row.zScore >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatNumber(row.zScore, 2)}</td>
                    <td className="px-3 py-2 text-center font-semibold text-blue-700">{formatNumber(row.teachingScore, 1)}</td>
                    <td className="px-3 py-2 text-center text-red-600">{row.bands.D || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-slate-100 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-800">三率一分 / 学科短板</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white text-slate-500">
                  <th className="px-3 py-2 text-left">学科</th>
                  <th className="px-3 py-2 text-center">均分</th>
                  <th className="px-3 py-2 text-center">Z值</th>
                  <th className="px-3 py-2 text-center">及格率</th>
                  <th className="px-3 py-2 text-center">D等率</th>
                </tr>
              </thead>
              <tbody>
                {zRows.map(row => (
                  <tr key={row.subject} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{row.subject}</td>
                    <td className="px-3 py-2 text-center">{formatNumber(row.mean, 1)}</td>
                    <td className={`px-3 py-2 text-center font-semibold ${row.zScore >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatNumber(row.zScore, 2)}</td>
                    <td className="px-3 py-2 text-center">{formatNumber(row.passRate, 1)}%</td>
                    <td className="px-3 py-2 text-center text-red-600">{formatNumber(row.failRate, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="border border-slate-100 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 font-semibold text-slate-800">尖子生追踪</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white text-slate-500">
                  <th className="px-3 py-2 text-center">序</th>
                  <th className="px-3 py-2 text-left">学生</th>
                  <th className="px-3 py-2 text-center">班级</th>
                  <th className="px-3 py-2 text-center">分数</th>
                </tr>
              </thead>
              <tbody>
                {projected.topStudents.map(item => (
                  <tr key={`${item.rank}-${item.name}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-center">
                      {maskRankValue(item.rank, resolveScoreVisibility('subject_leader', getLocalScoreVisibilitySettings()).show_grade_rank)}
                    </td>
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2 text-center">{item.className}</td>
                    <td className="px-3 py-2 text-center font-semibold text-blue-700">{formatNumber(item.score, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-slate-100 rounded-lg p-4">
          <h3 className="font-semibold text-slate-800 mb-3">模拟进线预测</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-500">模拟线</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{formatNumber(projected.simulatedLine, 1)}</p>
              <p className="text-xs text-slate-500 mt-1">按当前范围前20%反算</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm text-slate-500">上线人数</p>
              <p className="text-3xl font-bold text-slate-900 mt-2">{projected.simulatedCount}</p>
              <p className="text-xs text-slate-500 mt-1">参考人数 {projected.count}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            该模块与成绩分析页口径保持一致：先按角色权限和基础分层限定数据范围，再输出 Z值、积分、三率一分、尖子生和模拟进线，避免不同层级老师看到无关数据。
          </p>
        </div>
      </div>
    </div>
  );
}

function useRoleDirectory() {
  const [directory, setDirectory] = useState(() => {
    const backendMode = hasBackendToken();
    return {
      teachers: backendMode ? [] : (schoolData.teachers || []),
      classes: backendMode ? [] : (schoolData.classes || []),
      status: backendMode ? 'loading' : 'local',
      source: backendMode ? 'backend' : 'local',
      message: backendMode ? '正在同步后端教师任课范围' : '未登录后端，当前使用本地教师配置',
    };
  });

  useEffect(() => {
    let alive = true;

    const loadDirectory = async () => {
      if (!hasBackendToken()) return;

      const term = getCurrentTerm();
      setDirectory(prev => ({
        ...prev,
        status: 'loading',
        source: 'backend',
        message: `正在同步后端教师任课范围 · ${term}`,
      }));

      try {
        const classPayload = await fetchClassList({ pageSize: 200 });
        const backendClasses = classPayload.classes || [];
        const teacherPayload = await fetchTeacherListWithAssignments({
          pageSize: 100,
          term,
          includeInactive: false,
        }, backendClasses);

        if (!alive) return;

        const backendTeachers = teacherPayload.teachers || [];
        if ((backendTeachers.length === 0 || backendClasses.length === 0) &&
          (schoolData.teachers || []).length > 0 &&
          (schoolData.classes || []).length > 0) {
          setDirectory({
            teachers: schoolData.teachers || [],
            classes: schoolData.classes || [],
            status: 'fallback',
            source: 'local',
            message: '后端教师目录暂无任课记录，当前使用本地真实样态数据',
          });
          return;
        }

        setDirectory({
          teachers: backendTeachers,
          classes: backendClasses,
          status: 'ready',
          source: 'backend',
          message: `已同步后端教师任课范围 · ${term} · ${backendTeachers.length}名教师`,
        });
      } catch {
        if (!alive) return;
        setDirectory({
          teachers: schoolData.teachers || [],
          classes: schoolData.classes || [],
          status: 'fallback',
          source: 'local',
          message: '后端教师目录暂不可用，当前使用本地教师配置',
        });
      }
    };

    loadDirectory();

    return () => {
      alive = false;
    };
  }, []);

  return directory;
}

function useDashboardState() {
  const [examState, setExamState] = useState(() => {
    const backendMode = hasBackendToken();
    return {
      exams: backendMode ? [] : (schoolData.exams || []),
      dataStatus: backendMode ? 'loading' : 'local',
      dataSource: backendMode ? 'backend' : 'local',
      dataMessage: backendMode ? '正在同步后端考试与成绩' : '未登录后端，当前使用本地成绩缓存',
    };
  });
  const [scoreRowsByExam, setScoreRowsByExam] = useState({});
  const [scoreLoading, setScoreLoading] = useState(false);
  const [grade, setGrade] = useState(defaultGrade());
  const exams = getGradeExams(grade, examState.exams);
  const [examId, setExamId] = useState('');
  const activeExamId = examId || String(exams[exams.length - 1]?.id || '');
  const exam = exams.find(item => String(item.id) === String(activeExamId)) || exams[exams.length - 1] || null;
  const layers = normalizeClassLayers(schoolData.classLayers || [], grade);
  const layerOptions = getLayerOptions(layers);
  const [layer, setLayer] = useState('all');
  const getScoreRowsForExam = (targetExamId, { includeInvalid = false } = {}) => {
    if (!targetExamId) return [];
    const cachedRows = scoreRowsByExam[Number(targetExamId)];
    const rows = cachedRows || (examState.dataSource === 'backend'
      ? []
      : getLocalScoreRows(targetExamId, { includeInvalid: true }));

    return (rows || [])
      .filter(row => Number(row.exam_id) === Number(targetExamId))
      .filter(row => includeInvalid || (row.is_valid !== false && row.is_included !== false));
  };
  const subjects = getSubjects(exam, getScoreRowsForExam(exam?.id));
  const preloadExamIds = [
    activeExamId,
    ...exams.slice(-5).map(item => String(item.id)),
  ].filter(Boolean);
  const preloadKey = [...new Set(preloadExamIds)].join(',');

  useEffect(() => {
    let alive = true;

    const loadExams = async () => {
      if (!hasBackendToken()) return;

      try {
        const payload = await fetchExamListWithStatistics({ pageSize: 100 });
        if (!alive) return;
        const backendExams = payload.exams || [];
        if (backendExams.length === 0 && (schoolData.exams || []).length > 0) {
          setExamState({
            exams: schoolData.exams || [],
            dataStatus: 'fallback',
            dataSource: 'local',
            dataMessage: '后端考试库暂无考试记录，当前使用本地真实成绩缓存',
          });
          return;
        }
        setExamState({
          exams: backendExams,
          dataStatus: 'ready',
          dataSource: 'backend',
          dataMessage: `已同步后端考试库 · ${backendExams.length}场考试`,
        });
      } catch {
        if (!alive) return;
        setExamState({
          exams: schoolData.exams || [],
          dataStatus: 'fallback',
          dataSource: 'local',
          dataMessage: '后端考试库暂不可用，当前使用本地成绩缓存',
        });
      }
    };

    loadExams();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!examState.exams.length) return;
    const nextGrade = defaultGrade(examState.exams);
    if (!getGradeExams(grade, examState.exams).length && nextGrade !== grade) {
      setGrade(nextGrade);
    }
  }, [examState.exams, grade]);

  useEffect(() => {
    let alive = true;

    const loadScoreRows = async () => {
      if (!hasBackendToken() || examState.dataSource !== 'backend' || !preloadKey) return;
      const missingIds = [...new Set(preloadExamIds)]
        .map(Number)
        .filter(Number.isFinite)
        .filter(id => !scoreRowsByExam[id]);

      if (!missingIds.length) return;

      setScoreLoading(true);
      const entries = await Promise.all(missingIds.map(async (id) => {
        try {
          const payload = await fetchExamScoreRows(id, { includeInvalid: true });
          const rows = recalculateScoreRanks(payload.scores || [])
            .map(row => ({ ...row, exam_id: row.exam_id ?? id }));
          return [id, rows];
        } catch {
          return [id, null];
        }
      }));

      if (!alive) return;

      const successful = entries.filter(([, rows]) => Array.isArray(rows));
      if (successful.length) {
        const rowCount = successful.reduce((sum, [, rows]) => sum + rows.length, 0);
        const hasLocalRows = missingIds.some(id => getLocalScoreRows(id, { includeInvalid: true }).length > 0);
        if (rowCount === 0 && hasLocalRows) {
          setExamState(prev => ({
            ...prev,
            dataStatus: 'fallback',
            dataSource: 'local',
            dataMessage: '后端成绩行暂无记录，当前使用本地真实成绩缓存',
          }));
          setScoreLoading(false);
          return;
        }
        setScoreRowsByExam(prev => successful.reduce((next, [id, rows]) => ({
          ...next,
          [id]: rows,
        }), prev));
        setExamState(prev => ({
          ...prev,
          dataStatus: 'ready',
          dataMessage: `已同步后端成绩行 · ${rowCount}条`,
        }));
      } else {
        setExamState(prev => ({
          ...prev,
          dataStatus: 'error',
          dataMessage: '后端成绩行暂不可用，当前范围暂无可展示成绩',
        }));
      }
      setScoreLoading(false);
    };

    loadScoreRows();

    return () => {
      alive = false;
    };
    // scoreRowsByExam is intentionally omitted so the same exam set is not refetched after cache writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examState.dataSource, preloadKey]);

  return {
    grade,
    setGrade,
    allExams: examState.exams,
    exams,
    exam,
    examId: String(activeExamId),
    setExamId,
    layers,
    layerOptions,
    layer,
    setLayer,
    subjects,
    getScoreRowsForExam,
    scoreLoading,
    dataStatus: scoreLoading ? 'loading' : examState.dataStatus,
    dataSource: examState.dataSource,
    dataMessage: scoreLoading ? '正在读取后端成绩行' : examState.dataMessage,
  };
}

export function ResearchDashboard() {
  const state = useDashboardState();
  const directory = useRoleDirectory();
  const previewDirectory = {
    teachers: directory.teachers.length ? directory.teachers : (schoolData.teachers || []),
    classes: directory.classes.length ? directory.classes : (schoolData.classes || []),
  };
  const user = useEffectiveRoleDashboardUser({
    teachers: previewDirectory.teachers,
    classes: previewDirectory.classes,
    students: schoolData.students || [],
  });
  const scopedDirectory = user?.is_role_preview ? {
    ...directory,
    ...previewDirectory,
    status: directory.teachers.length ? directory.status : 'local',
    source: directory.teachers.length ? directory.source : 'local',
    message: directory.teachers.length ? directory.message : '管理员预览使用本地样态数据',
  } : directory;
  const accessState = getResearchAccessState({
    teachers: scopedDirectory.teachers,
    classes: scopedDirectory.classes,
    user,
  });
  const teacher = accessState.teacher;
  const [subject, setSubject] = useState('all');

  if (!accessState.fullAccess && scopedDirectory.status === 'loading') {
    return (
      <ScopeLoadingState
        title="教研看板"
        description="按负责年级、负责班级和负责学科展示教研分析。"
        directory={scopedDirectory}
        dashboard={state}
      />
    );
  }

  if (!accessState.fullAccess && accessState.status !== 'ready') {
    return <ResearchAccessEmptyState status={accessState.status} user={user} teacher={teacher} directory={scopedDirectory} dashboard={state} />;
  }

  const allowedGrades = accessState.fullAccess
    ? ['7年级', '8年级', '9年级']
    : (accessState.gradeLevels.length ? accessState.gradeLevels : [state.grade]);
  const selectedGrade = allowedGrades.includes(state.grade) ? state.grade : allowedGrades[0] || state.grade;
  const exams = getGradeExams(selectedGrade, state.allExams);
  const activeExamId = exams.some(exam => String(exam.id) === String(state.examId))
    ? state.examId
    : String(exams[exams.length - 1]?.id || '');
  const exam = exams.find(item => String(item.id) === String(activeExamId)) || exams[exams.length - 1] || null;
  const gradeLayers = normalizeClassLayers(schoolData.classLayers || [], selectedGrade);
  const classIdSet = new Set(accessState.classIds.map(Number));
  const layers = accessState.fullAccess
    ? gradeLayers
    : gradeLayers.filter(layer => classIdSet.has(Number(layer.class_id)));
  const layerOptions = getLayerOptions(layers);
  const selectedLayer = layerOptions.some(item => item.value === state.layer) ? state.layer : 'all';
  const rawRows = state.getScoreRowsForExam(exam?.id, { includeInvalid: true });
  const scopedRows = accessState.fullAccess
    ? rawRows
    : filterRowsByClassIds(rawRows, accessState.classIds);
  const subjectOptions = accessState.fullAccess || accessState.allSubjects
    ? getSubjects(exam, scopedRows)
    : [...new Set(accessState.subjects)];
  const selectedSubject = accessState.fullAccess || accessState.allSubjects
    ? ((subject === 'all' || subjectOptions.includes(subject)) ? subject : 'all')
    : (subjectOptions.includes(subject) ? subject : subjectOptions[0] || 'all');
  const scopedSubjects = !accessState.fullAccess && !accessState.allSubjects && selectedSubject !== 'all'
    ? [selectedSubject]
    : subjectOptions;
  const analysisRows = accessState.fullAccess || accessState.allSubjects ? scopedRows : limitRowsToSubjects(scopedRows, scopedSubjects);
  const analysisExam = accessState.fullAccess || accessState.allSubjects ? exam : getScopedSubjectExam(exam, scopedSubjects);
  const analytics = buildExamAnalytics({
    exam: analysisExam,
    rows: analysisRows,
    layers,
    layerCode: selectedLayer,
    subject: selectedSubject
  });
  const trend = accessState.fullAccess
    ? buildMultiExamTrendFromRows({
      exams: exams.slice(-5),
      layers,
      layerCode: selectedLayer,
      subject: selectedSubject,
      getScoreRowsForExam: state.getScoreRowsForExam,
    })
    : buildScopedResearchTrend({
      exams: exams.slice(-5),
      layers,
      classIds: accessState.classIds,
      layerCode: selectedLayer,
      subject: selectedSubject,
      subjects: scopedSubjects,
      getScoreRowsForExam: state.getScoreRowsForExam,
    });
  const filterState = {
    ...state,
    grade: selectedGrade,
    exams,
    exam,
    examId: String(activeExamId),
    layers,
    layerOptions,
    layer: selectedLayer,
  };
  const zRows = subjectZRows(analytics);
  const weakRows = weakStudentRows(analytics.rows, selectedSubject).slice(0, 10);
  const latestTrend = trend[trend.length - 1];
  const firstTrend = trend[0];
  const layerLabel = layerOptions.find(item => item.value === selectedLayer)?.label || '全段';
  const scopeLabel = accessState.fullAccess
    ? `${selectedGrade} · ${layerLabel}`
    : `${teacher?.name || '负责范围'} · ${selectedGrade} · ${selectedSubject} · ${accessState.classIds.length}个班级 · ${layerLabel}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">教研看板</h1>
        <p className="text-sm text-slate-500 mt-1">
          {accessState.fullAccess ? '按学科、年级和基础班级分层追踪教学质量。' : '按本人负责学科、负责年级和负责班级追踪教学质量。'}
        </p>
      </div>
      <DataSourceNotice directory={directory} dashboard={state} />
      <FilterBar
        {...filterState}
        subject={selectedSubject}
        setSubject={setSubject}
        subjects={subjectOptions}
        layers={layerOptions}
        grades={allowedGrades}
        allowAllSubjects={accessState.fullAccess || accessState.allSubjects}
      />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <KpiCard title="参考人数" value={analytics.total.count} subtitle={`缺考/无效 ${analytics.total.absent} 人`} icon={Users} />
        <KpiCard title="平均分" value={formatNumber(analytics.total.mean, 1)} subtitle={`标准差 ${formatNumber(analytics.total.std, 1)}`} icon={TrendingUp} tone="green" />
        <KpiCard title="及格率" value={`${formatNumber(analytics.total.passRate, 1)}%`} subtitle="A/B/C 计为达标" icon={Award} tone="purple" />
        <KpiCard title="D等不合格" value={`${formatNumber(analytics.total.failRate, 1)}%`} subtitle={`${analytics.total.bands.D} 人`} icon={TrendingDown} tone="red" />
        <KpiCard title="趋势变化" value={latestTrend && firstTrend ? `${formatNumber(latestTrend.mean - firstTrend.mean, 1)}` : '-'} subtitle="最新均分 - 首次均分" icon={Target} tone="amber" />
      </div>
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">A/B/C/D 等级结构</h2>
        <GradeDistribution bands={analytics.total.bands} count={analytics.total.count} />
      </div>
      <AnalysisProjectionPanel
        title="教研组成绩分析投送"
        analytics={analytics}
        exam={analysisExam}
        subject={selectedSubject}
        scopeLabel={scopeLabel}
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">多考试动态趋势</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="examName" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="mean" name="均分" stroke="#2563eb" strokeWidth={2} />
                <Line type="monotone" dataKey="passRate" name="及格率" stroke="#16a34a" strokeWidth={2} />
                <Line type="monotone" dataKey="dRate" name="D等率" stroke="#dc2626" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">班级教学积分对比</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.classRows.slice(0, 12)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="className" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="mean" name="均分" fill="#2563eb" />
                <Bar dataKey="failRate" name="D等率" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">学科Z值与薄弱学科</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-3 py-2 text-left">学科</th>
                  <th className="px-3 py-2 text-center">均分</th>
                  <th className="px-3 py-2 text-center">学科Z值</th>
                  <th className="px-3 py-2 text-center">D等率</th>
                </tr>
              </thead>
              <tbody>
                {zRows.map(row => (
                  <tr key={row.subject} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium">{row.subject}</td>
                    <td className="px-3 py-2 text-center">{formatNumber(row.mean, 1)}</td>
                    <td className={`px-3 py-2 text-center font-semibold ${row.zScore >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatNumber(row.zScore, 2)}</td>
                    <td className="px-3 py-2 text-center">{formatNumber(row.failRate, 1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">薄弱学生清单</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-3 py-2 text-left">学生</th>
                  <th className="px-3 py-2 text-center">班级</th>
                  <th className="px-3 py-2 text-center">当前分</th>
                  <th className="px-3 py-2 text-center">建议</th>
                </tr>
              </thead>
              <tbody>
                {weakRows.map(item => (
                  <tr key={`${item.row.student_id}-${item.score}`} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2 text-center">{item.className}</td>
                    <td className="px-3 py-2 text-center text-red-600 font-semibold">{formatNumber(item.score, 1)}</td>
                    <td className="px-3 py-2 text-center">纳入跟踪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TeacherDashboard() {
  const state = useDashboardState();
  const directory = useRoleDirectory();
  const previewDirectory = {
    teachers: directory.teachers.length ? directory.teachers : (schoolData.teachers || []),
    classes: directory.classes.length ? directory.classes : (schoolData.classes || []),
  };
  const user = useEffectiveRoleDashboardUser({
    teachers: previewDirectory.teachers,
    classes: previewDirectory.classes,
    students: schoolData.students || [],
  });
  const scopedDirectory = user?.is_role_preview ? {
    ...directory,
    ...previewDirectory,
    status: directory.teachers.length ? directory.status : 'local',
    source: directory.teachers.length ? directory.source : 'local',
    message: directory.teachers.length ? directory.message : '管理员预览使用本地样态数据',
  } : directory;
  const scoreVisibility = useMemo(
    () => resolveScoreVisibility(user, getLocalScoreVisibilitySettings()),
    [user]
  );
  const accessState = getTeacherAccessState({
    teachers: scopedDirectory.teachers,
    user,
  });
  const teacher = accessState.teacher;
  const teacherSubjects = accessState.subjects.length ? accessState.subjects : state.subjects;
  const [subject, setSubject] = useState(teacherSubjects[0] || state.subjects[0] || 'all');
  const selectedSubject = teacherSubjects.includes(subject) ? subject : teacherSubjects[0] || 'all';

  if (scopedDirectory.status === 'loading') {
    return (
      <ScopeLoadingState
        title="科任教师看板"
        description="只展示本人任教学科和任教班级的数据。"
        directory={scopedDirectory}
        dashboard={state}
      />
    );
  }

  if (accessState.status !== 'ready') {
    return <TeacherAccessEmptyState status={accessState.status} user={user} teacher={teacher} directory={scopedDirectory} dashboard={state} />;
  }

  const teacherClassIds = new Set(accessState.classIds);
  const baseRows = state.getScoreRowsForExam(state.exam?.id, { includeInvalid: true });
  const rows = baseRows.filter(row => teacherClassIds.has(Number(row.class_id)));
  const analytics = buildExamAnalytics({ exam: state.exam, rows, layers: state.layers, layerCode: state.layer, subject: selectedSubject });
  const previousExam = [...state.exams].reverse().find(exam => (
    Number(exam.id) !== Number(state.exam?.id) &&
    state.getScoreRowsForExam(exam.id).length > 0
  ));
  const previousRows = previousExam
    ? state.getScoreRowsForExam(previousExam.id).filter(row => teacherClassIds.has(Number(row.class_id)))
    : [];
  const progress = buildPercentileProgress(
    rows.filter(row => row.is_valid !== false),
    previousRows
  ).filter(item => rows.some(row => Number(row.student_id) === Number(item.studentId))).slice(0, 12);
  const weakRows = weakStudentRows(analytics.rows, selectedSubject).slice(0, 10);
  const scopeLabel = state.layerOptions.find(item => item.value === state.layer)?.label || '全段';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">科任教师看板</h1>
        <p className="text-sm text-slate-500 mt-1">聚焦本人任教学科、任教班级、薄弱学生和动态进退步。</p>
      </div>
      <DataSourceNotice directory={directory} dashboard={state} />
      <FilterBar
        {...state}
        subject={selectedSubject}
        setSubject={setSubject}
        subjects={teacherSubjects}
        layers={state.layerOptions}
        allowAllSubjects={false}
      />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="任教班级" value={teacherClassIds.size} subtitle={teacher?.name || '本人任教范围'} icon={BookOpen} />
        <KpiCard title="学科均分" value={formatNumber(analytics.total.mean, 1)} subtitle={selectedSubject} icon={TrendingUp} tone="green" />
        <KpiCard title="D等不合格" value={analytics.total.bands.D} subtitle={`${formatNumber(analytics.total.failRate, 1)}%`} icon={TrendingDown} tone="red" />
        <KpiCard title="及格率" value={`${formatNumber(analytics.total.passRate, 1)}%`} subtitle="按当前满分比例" icon={Award} tone="purple" />
      </div>
      <AnalysisProjectionPanel
        title="科任教师成绩分析投送"
        analytics={analytics}
        exam={state.exam}
        subject={selectedSubject}
        scopeLabel={scopeLabel}
      />
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">班级责任清单</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left">班级</th>
                <th className="px-3 py-2 text-center">层次</th>
                <th className="px-3 py-2 text-center">均分</th>
                <th className="px-3 py-2 text-center">同层差</th>
                <th className="px-3 py-2 text-center">班级Z</th>
                <th className="px-3 py-2 text-center">D等人数</th>
                <th className="px-3 py-2 text-center">责任动作</th>
              </tr>
            </thead>
            <tbody>
              {analytics.classRows.map(row => (
                <tr key={row.classId} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{row.className}</td>
                  <td className="px-3 py-2 text-center">{row.layerCode || '-'}</td>
                  <td className="px-3 py-2 text-center">{formatNumber(row.mean, 1)}</td>
                  <td className={`px-3 py-2 text-center font-semibold ${diffToneClass(row.sameLayerDiff)}`}>{signedNumber(row.sameLayerDiff, 1)}</td>
                  <td className={`px-3 py-2 text-center font-semibold ${row.zScore >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatNumber(row.zScore, 2)}</td>
                  <td className="px-3 py-2 text-center text-red-600 font-semibold">{row.bands.D}</td>
                  <td className="px-3 py-2 text-center">{row.bands.D > 0 || row.zScore < 0 ? '制定帮扶名单' : '保持优势'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">任教班级对比</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.classRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="className" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="mean" name="均分" fill="#2563eb" />
                <Bar dataKey="failRate" name="D等率" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">薄弱学生与负责跟踪</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-3 py-2 text-left">学生</th>
                  <th className="px-3 py-2 text-center">班级</th>
                  <th className="px-3 py-2 text-center">当前分</th>
                  <th className="px-3 py-2 text-center">跟踪责任</th>
                </tr>
              </thead>
              <tbody>
                {weakRows.map(item => (
                  <tr key={`${item.row.student_id}-${item.score}`} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2 text-center">{item.className}</td>
                    <td className="px-3 py-2 text-center text-red-600 font-semibold">{formatNumber(item.score, 1)}</td>
                    <td className="px-3 py-2 text-center">科任教师课后跟踪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">学生进退步（百分位）</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-3 py-2 text-left">学生</th>
                  <th className="px-3 py-2 text-center">当前分</th>
                  {scoreVisibility.show_class_rank && (
                    <th className="px-3 py-2 text-center">名次变化</th>
                  )}
                  {scoreVisibility.show_percentile && (
                    <th className="px-3 py-2 text-center">百分位变化</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {progress.map(item => (
                  <tr key={item.studentId} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium">{item.studentName}</td>
                    <td className="px-3 py-2 text-center">{formatNumber(item.currentScore, 1)}</td>
                    {scoreVisibility.show_class_rank && (
                      <td className="px-3 py-2 text-center">{item.rankDelta === null ? '不可比' : `${item.rankDelta > 0 ? '+' : ''}${item.rankDelta}`}</td>
                    )}
                    {scoreVisibility.show_percentile && (
                      <td className={`px-3 py-2 text-center font-semibold ${(item.percentileDelta || 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {item.percentileDelta === null ? '不可比' : `${item.percentileDelta > 0 ? '+' : ''}${formatNumber(item.percentileDelta, 1)}pct`}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const buildParentPreview = (user, scoreVisibility) => {
  const student = user.preview_student || (schoolData.students || [])[0];
  if (!student) return null;

  const scoreRows = (schoolData.examScores || [])
    .filter(row => Number(row.student_id) === Number(student.id))
    .filter(row => row.is_valid !== false && row.is_included !== false)
    .sort((a, b) => Number(b.exam_id) - Number(a.exam_id));
  const row = scoreRows[0];
  if (!row) return null;

  const exam = (schoolData.exams || []).find(item => Number(item.id) === Number(row.exam_id));
  const classInfo = (schoolData.classes || []).find(item => Number(item.id) === Number(row.class_id || student.class_id));
  const subjectScores = Object.entries(row.scores || {}).map(([subject, score]) => ({ subject, score }));

  return {
    studentName: student.name || row.student_name || '学生',
    className: classInfo?.class_no ? `${classInfo.class_no}班` : `${row.class_id || student.class_id || '-'}班`,
    examName: exam?.exam_name || exam?.name || `考试${row.exam_id}`,
    totalScore: row.total_score,
    classRank: scoreVisibility.show_class_rank ? maskRankValue(row.class_rank, true) : '未开放',
    gradeRank: scoreVisibility.show_grade_rank ? maskRankValue(row.rank, true) : '未开放',
    subjectScores,
  };
};

export function ParentDashboard() {
  const user = useEffectiveRoleDashboardUser({
    teachers: schoolData.teachers || [],
    classes: schoolData.classes || [],
    students: schoolData.students || [],
  });
  const scoreVisibility = resolveScoreVisibility(user, getLocalScoreVisibilitySettings());
  const parentPreview = user?.is_role_preview && user.preview_role === 'parent'
    ? buildParentPreview(user, scoreVisibility)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">家长看板</h1>
        <p className="text-sm text-slate-500 mt-1">
          家长成绩查询采用学生级鉴权，只展示被验证学生本人的成绩、趋势和学情诊断。
        </p>
      </div>
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              <Lock className="h-4 w-4" />
              单学生安全查询
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">进入家长专属查询入口</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              当前后台登录账号不会直接读取本地学生样例或跨学生成绩。家长需要输入学生姓名、班级和鉴权码，验证成功后系统只返回该学生的数据。
            </p>
            <p className="mt-4 text-xs text-slate-400">
              当前账号：{user?.real_name || user?.name || user?.username || '未识别'}
            </p>
          </div>
          <a
            href="/parent-portal"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            打开家长查询
          </a>
        </div>
      </div>
      {parentPreview && (
        <div className="rounded-lg border border-blue-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                <Lock className="h-4 w-4" />
                管理员预览 · 家长视图
              </div>
              <h2 className="mt-4 text-xl font-semibold text-slate-900">
                {parentPreview.studentName} · {parentPreview.className}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {parentPreview.examName} · 总分 {formatNumber(parentPreview.totalScore, 1)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-slate-500">班级排名</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {scoreVisibility.show_class_rank ? parentPreview.classRank : '未开放'}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-slate-500">年级排名</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {scoreVisibility.show_grade_rank ? parentPreview.gradeRank : '未开放'}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-slate-500">AI分析</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {scoreVisibility.allow_ai_analysis ? '可用' : '未开放'}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {parentPreview.subjectScores.map(item => (
              <div key={item.subject} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">{item.subject}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(item.score, 1)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-900">验证信息</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">学生姓名、所在班级、学籍辅号或身份证号后 6 位。</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-900">数据范围</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">接口 token 绑定单个学生，无法请求其他学生报告。</p>
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-900">查询内容</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            历次成绩、{resolveScoreVisibility('parent', getLocalScoreVisibilitySettings()).show_class_rank ? '班级排名、' : ''}学科表现和学情诊断。
          </p>
        </div>
      </div>
    </div>
  );
}
