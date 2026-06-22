import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  BookOpen,
  Award,
  ChevronDown,
  AlertCircle,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import AbsenceManagement from './AbsenceManagement';
import schoolData from '../data/schoolData';
import { fetchClassList } from '../lib/classApi';
import { fetchExamListWithStatistics, fetchExamScoreRows } from '../lib/examApi';
import { recalculateScoreRanks } from '../lib/scoreImport';
import { hasBackendAuthToken } from '../lib/sessionToken';
import { getHeadTeacherAccessState } from '../lib/teacherAccess';
import { fetchTeacherListWithAssignments } from '../lib/teacherApi';
import {
  getLocalScoreVisibilitySettings,
  maskRankValue,
  resolveScoreVisibility,
} from '../lib/scoreVisibility';
import {
  getEffectiveDashboardUser,
  ROLE_PREVIEW_CHANGED_EVENT,
} from '../lib/rolePreview';

const DEFAULT_SUBJECTS = ['语文', '数学', '英语', '科学', '社会'];

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const mean = (values) => {
  const nums = values.filter(value => Number.isFinite(value));
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : 0;
};

const std = (values) => {
  const nums = values.filter(value => Number.isFinite(value));
  if (!nums.length) return 0;
  const avg = mean(nums);
  return Math.sqrt(nums.reduce((sum, value) => sum + (value - avg) ** 2, 0) / nums.length);
};

const formatNumber = (value, digits = 1) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(digits));
};

const getClassId = (score) => {
  if (score?.class_id) return Number(score.class_id);
  const text = String(score?.class_name || score?.className || '');
  const match = text.match(/\d{3,4}/);
  return match ? Number(match[0]) : null;
};

const getScoreTotal = (score) => {
  const direct = toNumber(score?.total_score);
  if (direct && direct > 0) return direct;
  const values = Object.values(score?.scores || {}).map(toNumber).filter(value => Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) : 0;
};

const getScoreSubjectValue = (score, subject) => {
  const value = toNumber(score?.scores?.[subject]);
  return Number.isFinite(value) ? value : null;
};

const getScoreStudentName = (score) => {
  const student = schoolData.getStudentById?.(score?.student_id);
  return score?.student_name || student?.name || student?.student_name || '未知学生';
};

const getScoreStudentCode = (score) => {
  const student = schoolData.getStudentById?.(score?.student_id);
  return score?.student_code || student?.student_code || student?.code || '';
};

const normalizeExam = (exam) => ({
  ...exam,
  id: Number(exam.id),
  name: exam.exam_name || exam.name || `考试 ${exam.id}`,
  dateValue: Date.parse(exam.exam_date || exam.date || exam.created_at || '') || Number(exam.id) || 0,
  term: exam.term || exam.semester || schoolData.getCurrentSemesterDisplay?.() || '',
});

const hasBackendToken = hasBackendAuthToken;

const getCurrentTerm = () => (
  schoolData.getCurrentSemesterDisplay?.() ||
  `${schoolData.config?.currentAcademicYear || ''}-${schoolData.config?.currentSemester || ''}`
);

const getSubjects = (exam, rows) => {
  if (Array.isArray(exam?.subjects) && exam.subjects.length > 0) return exam.subjects;
  const detected = Array.from(new Set((rows || []).flatMap(row => Object.keys(row.scores || {}))));
  return detected.length ? detected : DEFAULT_SUBJECTS;
};

const getLocalExamScores = (examId) => (
  (schoolData.examScores || [])
    .filter(score => Number(score.exam_id) === Number(examId))
    .filter(score => score.is_valid !== false && score.is_included !== false)
);

const getExamScores = (examId) => getLocalExamScores(examId);

const rankClasses = (scores) => {
  const groups = new Map();
  scores.forEach(score => {
    const classId = getClassId(score);
    const total = getScoreTotal(score);
    if (!classId || !Number.isFinite(total) || total <= 0) return;
    if (!groups.has(classId)) groups.set(classId, []);
    groups.get(classId).push(total);
  });

  return Array.from(groups.entries())
    .map(([classId, totals]) => ({ classId, classMean: mean(totals) }))
    .sort((a, b) => b.classMean - a.classMean);
};

const buildStudentRankChanges = (currentRows, previousRows) => {
  const sortRows = (rows) => rows
    .map(row => ({ row, total: getScoreTotal(row) }))
    .filter(item => Number.isFinite(item.total) && item.total > 0)
    .sort((a, b) => b.total - a.total);

  const percentile = (rank, count) => {
    if (!rank || !count || count <= 1) return null;
    return 1 - ((rank - 1) / (count - 1));
  };

  const previousRanked = sortRows(previousRows);
  const currentRanked = sortRows(currentRows);
  const previousRankByStudent = new Map();
  previousRanked.forEach((item, index) => {
    const rank = index + 1;
    previousRankByStudent.set(String(item.row.student_id || getScoreStudentCode(item.row)), {
      rank,
      percentile: percentile(rank, previousRanked.length)
    });
  });

  return currentRanked.map((item, index) => {
    const key = String(item.row.student_id || getScoreStudentCode(item.row));
    const currentRank = index + 1;
    const currentPercentile = percentile(currentRank, currentRanked.length);
    const previous = previousRankByStudent.get(key);
    const previousRank = previous?.rank || null;
    const rankChange = previousRank ? previousRank - currentRank : null;
    const percentileChange = previous && currentPercentile !== null && previous.percentile !== null
      ? (currentPercentile - previous.percentile) * 100
      : null;

    return {
      student_id: key,
      student_name: getScoreStudentName(item.row),
      student_code: getScoreStudentCode(item.row),
      current_rank: currentRank,
      previous_rank: previousRank,
      rank_change: rankChange,
      percentile_change: percentileChange,
      change_direction: percentileChange === null ? '不可比' : percentileChange >= 0 ? '进步' : '退步',
      current_score: formatNumber(item.total, 1),
    };
  }).sort((a, b) => (b.percentile_change ?? -999) - (a.percentile_change ?? -999));
};

const buildStudentProgressHistory = (classId, exams, getRowsForExam = getExamScores) => {
  const targetClassId = Number(classId);
  const studentMap = new Map();
  exams.forEach(exam => {
    const classRows = getRowsForExam(exam.id).filter(score => getClassId(score) === targetClassId);
    const ranked = classRows
      .map(row => ({ row, total: getScoreTotal(row) }))
      .filter(item => Number.isFinite(item.total) && item.total > 0)
      .sort((a, b) => b.total - a.total);
    ranked.forEach((item, index) => {
      const key = String(item.row.student_id || getScoreStudentCode(item.row));
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          student_id: key,
          student_name: getScoreStudentName(item.row),
          points: []
        });
      }
      const count = ranked.length;
      const percentile = count > 1 ? (1 - (index / (count - 1))) * 100 : null;
      studentMap.get(key).points.push({
        exam_name: exam.name,
        rank: index + 1,
        percentile,
        score: item.total
      });
    });
  });

  return Array.from(studentMap.values()).map(student => {
    const points = student.points;
    const first = points[0]?.percentile ?? null;
    const last = points[points.length - 1]?.percentile ?? null;
    return {
      ...student,
      delta: first !== null && last !== null ? last - first : null,
      display: points.slice(-4)
    };
  }).filter(student => student.display.length >= 2)
    .sort((a, b) => (b.delta ?? -999) - (a.delta ?? -999));
};

const buildClassData = (classId, selectedSubject, {
  exams: sourceExams = schoolData.exams || [],
  classes = schoolData.classes || [],
  getRowsForExam = getExamScores,
} = {}) => {
  const exams = (sourceExams || []).map(normalizeExam).sort((a, b) => a.dateValue - b.dateValue);
  const targetClassId = Number(classId);
  const classInfo = (classes || []).find(cls => Number(cls.id) === targetClassId) || schoolData.getClassById?.(targetClassId);
  const currentExam = [...exams].reverse().find(exam => (
    getRowsForExam(exam.id).some(score => getClassId(score) === targetClassId)
  ));

  if (!currentExam) return null;

  const currentExamScores = getRowsForExam(currentExam.id);
  const currentClassRows = currentExamScores.filter(score => getClassId(score) === targetClassId);
  const subjects = getSubjects(currentExam, currentExamScores);
  const totals = currentExamScores.map(getScoreTotal).filter(value => Number.isFinite(value) && value > 0);
  const classTotals = currentClassRows.map(getScoreTotal).filter(value => Number.isFinite(value) && value > 0);
  const layerMean = mean(totals);
  const layerStd = std(totals);
  const classMean = mean(classTotals);
  const currentRankings = rankClasses(currentExamScores);
  const rankInLayer = currentRankings.findIndex(item => item.classId === targetClassId) + 1 || 0;

  const currentExamIndex = exams.findIndex(exam => Number(exam.id) === Number(currentExam.id));
  const previousExam = [...exams.slice(0, currentExamIndex)].reverse().find(exam => (
    getRowsForExam(exam.id).some(score => getClassId(score) === targetClassId)
  ));
  const previousScores = previousExam ? getRowsForExam(previousExam.id) : [];
  const previousRankings = rankClasses(previousScores);
  const previousRank = previousRankings.findIndex(item => item.classId === targetClassId) + 1 || rankInLayer;
  const rankChange = previousRank && rankInLayer ? previousRank - rankInLayer : 0;

  const subjectAnalysis = subjects.reduce((result, subject) => {
    const classSubjectScores = currentClassRows
      .map(score => getScoreSubjectValue(score, subject))
      .filter(value => Number.isFinite(value));
    const layerSubjectScores = currentExamScores
      .map(score => getScoreSubjectValue(score, subject))
      .filter(value => Number.isFinite(value));
    const subjectClassMean = mean(classSubjectScores);
    const subjectLayerMean = mean(layerSubjectScores);
    const diff = subjectClassMean - subjectLayerMean;
    result[subject] = {
      class_mean: formatNumber(subjectClassMean, 1),
      layer_mean: formatNumber(subjectLayerMean, 1),
      diff: formatNumber(diff, 1),
      trend: diff > 1 ? 'improve' : diff < -1 ? 'decline' : 'stable',
    };
    return result;
  }, {});

  const trendExams = exams.filter(exam => getRowsForExam(exam.id).some(score => getClassId(score) === targetClassId));
  const historicalTrends = trendExams.map(exam => {
    const rows = getRowsForExam(exam.id);
    const classRows = rows.filter(score => getClassId(score) === targetClassId);
    const allTotals = rows.map(getScoreTotal).filter(value => Number.isFinite(value) && value > 0);
    const thisClassTotals = classRows.map(getScoreTotal).filter(value => Number.isFinite(value) && value > 0);
    const thisLayerMean = mean(allTotals);
    const thisClassMean = mean(thisClassTotals);
    const thisStd = std(allTotals);

    return {
      exam_name: exam.name,
      exam_date: exam.exam_date || exam.date || '',
      z_value: formatNumber(thisStd > 0 ? (thisClassMean - thisLayerMean) / thisStd : 0, 4),
      class_mean: formatNumber(thisClassMean, 1),
      layer_mean: formatNumber(thisLayerMean, 1),
      mean_diff: formatNumber(thisClassMean - thisLayerMean, 1),
    };
  });

  const weakSubject = subjectAnalysis[selectedSubject]
    ? selectedSubject
    : Object.entries(subjectAnalysis).sort((a, b) => a[1].diff - b[1].diff)[0]?.[0] || subjects[0] || '英语';
  const weakSubjectTrend = trendExams.map(exam => {
    const rows = getRowsForExam(exam.id);
    const classRows = rows.filter(score => getClassId(score) === targetClassId);
    const classSubjectScores = classRows
      .map(score => getScoreSubjectValue(score, weakSubject))
      .filter(value => Number.isFinite(value));
    const layerSubjectScores = rows
      .map(score => getScoreSubjectValue(score, weakSubject))
      .filter(value => Number.isFinite(value));
    const classSubjectMean = mean(classSubjectScores);
    const layerSubjectMean = mean(layerSubjectScores);
    const gap = classSubjectMean - layerSubjectMean;

    return {
      term: exam.term,
      exam_name: exam.name,
      class_mean: formatNumber(classSubjectMean, 1),
      layer_mean: formatNumber(layerSubjectMean, 1),
      gap: formatNumber(gap, 1),
      status: gap >= 0 ? '领先' : '落后',
    };
  });

  return {
    class_name: classInfo?.class_no || String(targetClassId),
    term: currentExam.term,
    total_students: currentClassRows.length || schoolData.getStudentsByClassId?.(targetClassId)?.length || 0,
    subjects,
    weak_subject: weakSubject,
    current_exam: {
      exam_id: currentExam.id,
      exam_name: currentExam.name,
      class_mean: formatNumber(classMean, 1),
      layer_mean: formatNumber(layerMean, 1),
      z_value: formatNumber(layerStd > 0 ? (classMean - layerMean) / layerStd : 0, 4),
      rank_in_layer: rankInLayer || '-',
      rank_change: rankChange,
    },
    previous_exam: previousExam ? {
      exam_id: previousExam.id,
      exam_name: previousExam.name,
      term: previousExam.term
    } : null,
    historical_trends: historicalTrends,
    subject_analysis: subjectAnalysis,
    student_rank_changes: buildStudentRankChanges(currentClassRows, previousScores.filter(score => getClassId(score) === targetClassId)),
    student_progress_history: buildStudentProgressHistory(targetClassId, trendExams, getRowsForExam),
    weak_subject_trend: weakSubjectTrend,
  };
};

const syncNoticeTone = (source, syncing) => {
  if (syncing) return 'border-blue-100 bg-blue-50 text-blue-700';
  return source === 'backend'
    ? 'border-green-100 bg-green-50 text-green-700'
    : 'border-amber-100 bg-amber-50 text-amber-700';
};

function HeadTeacherSyncNotice({ source, syncing, message }) {
  if (!message) return null;
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${syncNoticeTone(source, syncing)}`}>
      <span className="font-semibold">数据范围</span>
      <span className="mx-2 text-current/50">·</span>
      <span>{message}</span>
    </div>
  );
}

function HeadTeacherAccessEmptyState({ status, user, teacher, source, syncing, message }) {
  const copy = {
    'no-teacher': {
      title: '未匹配到班主任教师档案',
      description: '当前账号没有匹配到教师基础信息。班主任看板不会默认展示任意班级数据。',
      steps: ['在教师管理中确认教师姓名或工号', '确保账号用户名、姓名或手机号与教师档案一致', '在职务管理中分配班主任班级'],
    },
    'no-classes': {
      title: '暂无班主任负责班级',
      description: '已识别当前教师档案，但还没有配置班主任班级。请先完成班主任职务分配。',
      steps: ['进入职务管理', '在班主任管理中选择班级和教师', '保存后重新进入班主任看板'],
    },
  };
  const state = copy[status] || copy['no-teacher'];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">班主任学情追踪看板</h1>
        <p className="text-sm text-gray-500 mt-1">仅展示当前班主任负责班级的学情数据。</p>
      </div>
      <div className="mb-6">
        <HeadTeacherSyncNotice source={source} syncing={syncing} message={message} />
      </div>
      <div className="rounded-lg border border-slate-100 bg-white p-8 shadow-sm">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
            <AlertCircle className="h-4 w-4" />
            班主任范围未配置
          </div>
          <h2 className="mt-4 text-xl font-semibold text-slate-900">{state.title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{state.description}</p>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {state.steps.map((step, index) => (
              <div key={step} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-400">步骤 {index + 1}</p>
                <p className="mt-2 text-sm font-medium text-slate-700">{step}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs text-slate-400">
            当前账号：{user?.real_name || user?.name || user?.username || '未识别'}{teacher?.name ? `；教师档案：${teacher.name}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

// 班主任专属看板组件
const HeadTeacherView = () => {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('英语');
  const [activeTab, setActiveTab] = useState('overview');
  const [classData, setClassData] = useState(null);
  const [classOptions, setClassOptions] = useState([]);
  const [teachers, setTeachers] = useState(hasBackendToken() ? [] : (schoolData.teachers || []));
  const [classes, setClasses] = useState(hasBackendToken() ? [] : (schoolData.classes || []));
  const [exams, setExams] = useState(hasBackendToken() ? [] : (schoolData.exams || []));
  const [scoreRowsByExam, setScoreRowsByExam] = useState({});
  const [dataSource, setDataSource] = useState(hasBackendToken() ? 'backend' : 'local');
  const [syncing, setSyncing] = useState(hasBackendToken());
  const [syncMessage, setSyncMessage] = useState(hasBackendToken() ? '正在同步后端班主任范围与成绩' : '未登录后端，当前使用本地成绩缓存');
  const [accessState, setAccessState] = useState({
    status: 'no-teacher',
    fullAccess: false,
    teacher: null,
    classIds: [],
  });
  const [currentUser, setCurrentUser] = useState({});
  const scoreVisibility = useMemo(
    () => resolveScoreVisibility(currentUser, getLocalScoreVisibilitySettings()),
    [currentUser]
  );

  const getRowsForExam = useCallback((examId) => {
    if (!examId) return [];
    const cachedRows = scoreRowsByExam[Number(examId)];
    if (cachedRows) return cachedRows;
    return dataSource === 'backend' ? [] : getLocalExamScores(examId);
  }, [dataSource, scoreRowsByExam]);

  useEffect(() => {
    let alive = true;

    const loadLocalData = () => {
      setTeachers(schoolData.teachers || []);
      setClasses(schoolData.classes || []);
      setExams(schoolData.exams || []);
      setDataSource('local');
      setSyncing(false);
      setSyncMessage(hasBackendToken() ? '后端班主任数据暂不可用，当前使用本地缓存' : '未登录后端，当前使用本地成绩缓存');
    };

    const loadBackendData = async () => {
      if (!hasBackendToken()) {
        loadLocalData();
        return;
      }

      const term = getCurrentTerm();
      setSyncing(true);
      setSyncMessage(`正在同步后端班主任范围与成绩 · ${term}`);

      try {
        const classPayload = await fetchClassList({ pageSize: 200 });
        const backendClasses = classPayload.classes || [];
        const [teacherPayload, examPayload] = await Promise.all([
          fetchTeacherListWithAssignments({ pageSize: 100, term, includeInactive: false }, backendClasses),
          fetchExamListWithStatistics({ pageSize: 100 }),
        ]);
        const backendExams = examPayload.exams || [];
        const recentExams = [...backendExams]
          .map(normalizeExam)
          .sort((a, b) => b.dateValue - a.dateValue)
          .slice(0, 8);
        const scoreEntries = await Promise.all(recentExams.map(async (exam) => {
          try {
            const payload = await fetchExamScoreRows(exam.id, { includeInvalid: true });
            const rankedRows = recalculateScoreRanks(payload.scores || [])
              .map(row => ({ ...row, exam_id: row.exam_id ?? exam.id }))
              .filter(row => row.is_valid !== false && row.is_included !== false);
            return [Number(exam.id), rankedRows];
          } catch {
            return [Number(exam.id), null];
          }
        }));

        if (!alive) return;

        setTeachers(teacherPayload.teachers || []);
        setClasses(backendClasses);
        setExams(backendExams);
        setDataSource('backend');
        setScoreRowsByExam(scoreEntries.reduce((result, [examId, rows]) => {
          if (Array.isArray(rows)) result[examId] = rows;
          return result;
        }, {}));
        setSyncing(false);
        setSyncMessage(`已同步后端班主任范围 · ${term} · ${backendExams.length}场考试`);
      } catch {
        if (!alive) return;
        loadLocalData();
      }
    };

    loadBackendData();

    return () => {
      alive = false;
    };
  }, []);

  const loadClassData = useCallback(() => {
    const previewSource = {
      teachers: teachers.length ? teachers : (schoolData.teachers || []),
      classes: classes.length ? classes : (schoolData.classes || []),
      students: schoolData.students || [],
    };
    const user = getEffectiveDashboardUser(getStoredUser(), {
      ...previewSource,
    });
    const scopedTeachers = user?.is_role_preview && teachers.length === 0 ? previewSource.teachers : teachers;
    const scopedClasses = user?.is_role_preview && classes.length === 0 ? previewSource.classes : classes;
    const scopedExams = user?.is_role_preview && exams.length === 0 ? (schoolData.exams || []) : exams;
    const scopedGetRowsForExam = user?.is_role_preview && (exams.length === 0 || Object.keys(scoreRowsByExam).length === 0)
      ? getLocalExamScores
      : getRowsForExam;
    const nextAccessState = getHeadTeacherAccessState({
      teachers: scopedTeachers,
      classes: scopedClasses,
      user,
    });
    setCurrentUser(user);
    setAccessState(nextAccessState);

    const allowedClassIds = new Set((nextAccessState.classIds || []).map(Number));
    const options = (scopedClasses || [])
      .filter(cls => cls.status !== 'inactive')
      .filter(cls => allowedClassIds.has(Number(cls.id)))
      .map(cls => ({
        id: Number(cls.id),
        label: `${cls.class_no || cls.id}班`,
      }))
      .sort((a, b) => a.id - b.id);

    setClassOptions(options);

    if (nextAccessState.status !== 'ready' || options.length === 0) {
      setSelectedClass('');
      setClassData(null);
      return;
    }

    const selectedClassAllowed = selectedClass && options.some(option => String(option.id) === String(selectedClass));
    const classId = selectedClassAllowed ? String(selectedClass) : (options[0]?.id ? String(options[0].id) : '');

    if (String(selectedClass) !== String(classId)) {
      setSelectedClass(classId);
      return;
    }

    const nextData = classId ? buildClassData(classId, selectedSubject, {
      exams: scopedExams,
      classes: scopedClasses,
      getRowsForExam: scopedGetRowsForExam,
    }) : null;
    setClassData(nextData);

    if (nextData?.subjects?.length && !nextData.subjects.includes(selectedSubject)) {
      setSelectedSubject(nextData.subjects.includes('英语') ? '英语' : nextData.subjects[0]);
    }
  }, [classes, exams, getRowsForExam, scoreRowsByExam, selectedClass, selectedSubject, teachers]);

  useEffect(() => {
    loadClassData();
    window.addEventListener('schoolData:changed', loadClassData);
    window.addEventListener(ROLE_PREVIEW_CHANGED_EVENT, loadClassData);
    return () => {
      window.removeEventListener('schoolData:changed', loadClassData);
      window.removeEventListener(ROLE_PREVIEW_CHANGED_EVENT, loadClassData);
    };
  }, [loadClassData]);

  const subjectNames = (classData?.subjects || DEFAULT_SUBJECTS).reduce((result, subject) => {
    result[subject] = subject;
    return result;
  }, {});

  const getDiffColor = (diff) => {
    if (diff > 0) return 'text-green-600';
    if (diff < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const diffText = (value) => `${value > 0 ? '+' : ''}${formatNumber(value, 1)}`;
  const currentMeanDiff = (classData?.current_exam?.class_mean || 0) - (classData?.current_exam?.layer_mean || 0);
  const weakSubjectName = classData?.weak_subject || selectedSubject;
  const englishWarning = classData?.subject_analysis?.['英语'];

  if (syncing && dataSource === 'backend') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">班主任学情追踪看板</h1>
          <p className="text-sm text-gray-500 mt-1">仅展示当前班主任负责班级的学情数据。</p>
        </div>
        <div className="mb-6">
          <HeadTeacherSyncNotice source={dataSource} syncing={syncing} message={syncMessage} />
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-8 shadow-sm">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              <BookOpen className="h-4 w-4" />
              正在同步班主任范围
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">正在读取后端班主任配置与考试成绩</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              同步完成后再展示班级数据，避免在班主任范围未确认前显示其他班级信息。
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (accessState.status !== 'ready') {
    return (
      <HeadTeacherAccessEmptyState
        status={accessState.status}
        user={currentUser}
        teacher={accessState.teacher}
        source={dataSource}
        syncing={syncing}
        message={syncMessage}
      />
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">班主任学情追踪看板</h1>
          <p className="text-sm text-gray-500 mt-1">仅展示当前班主任负责班级的学情数据。</p>
        </div>
        <div className="mb-6">
          <HeadTeacherSyncNotice source={dataSource} syncing={syncing} message={syncMessage} />
        </div>
        <div className="rounded-lg border border-slate-100 bg-white p-8 shadow-sm">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
              <BookOpen className="h-4 w-4" />
              暂无可分析成绩
            </div>
            <h2 className="mt-4 text-xl font-semibold text-slate-900">负责班级暂无考试数据</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              当前账号可查看 {classOptions.length} 个负责班级，但这些班级还没有有效考试成绩。完成考试创建、成绩导入后，本页会自动展示班级趋势、学科短板和学生进退步。
            </p>
            {classOptions.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {classOptions.map(option => (
                  <span key={option.id} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                    {option.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 顶部导航 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">班主任学情追踪看板</h1>
            <p className="text-sm text-gray-500 mt-1">
              {classData.class_name}班 | {classData.term}学期 | 共{classData.total_students}人
              {!accessState.fullAccess && accessState.teacher?.name ? ` | 班主任：${accessState.teacher.name}` : ''}
            </p>
            <div className="mt-2">
              <HeadTeacherSyncNotice source={dataSource} syncing={syncing} message={syncMessage} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <select
                className="appearance-none bg-gray-50 border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedClass}
                onChange={(event) => setSelectedClass(event.target.value)}
              >
                {classOptions.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Tab切换 */}
        <div className="flex gap-2 mt-4">
          {[
            { id: 'overview', label: '班级概览', icon: TrendingUp },
            { id: 'subjects', label: '学科分析', icon: BookOpen },
            { id: 'students', label: '学生进退步', icon: Users },
            { id: 'weak', label: '薄弱学科追踪', icon: AlertCircle },
            { id: 'absence', label: '缺考上报', icon: AlertCircle },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 班级概览 Tab */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">班级综合Z值</p>
                  <p className="text-3xl font-bold text-gray-800">
                    {formatNumber(classData.current_exam.z_value, 4)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {scoreVisibility.show_layer_rank
                      ? `分层排名: 第${classData.current_exam.rank_in_layer}名`
                      : '分层排名暂未开放'}
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Award className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">班级均分</p>
                  <p className="text-3xl font-bold text-gray-800">
                    {classData.current_exam.class_mean}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    年段平均: {classData.current_exam.layer_mean}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">排名变化</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold text-gray-800">
                      {scoreVisibility.show_layer_rank
                        ? `${classData.current_exam.rank_change > 0 ? '+' : ''}${classData.current_exam.rank_change}`
                        : '暂未开放'}
                    </p>
                    {scoreVisibility.show_layer_rank && (classData.current_exam.rank_change >= 0 ? (
                      <ArrowUp className="w-6 h-6 text-green-500" />
                    ) : (
                      <ArrowDown className="w-6 h-6 text-red-500" />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {scoreVisibility.show_layer_rank ? '较上次考试' : '由教务端控制'}
                  </p>
                </div>
                <div className="bg-yellow-100 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">与年段均差</p>
                  <p className={`text-3xl font-bold ${getDiffColor(currentMeanDiff)}`}>
                    {diffText(currentMeanDiff)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {currentMeanDiff >= 0 ? '高于年段平均' : '低于年段平均'}
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">班级历史成绩趋势</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={classData.historical_trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="exam_name" />
                  <YAxis yAxisId="left" domain={['auto', 'auto']} />
                  <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="z_value" name="Z值" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                  <Line yAxisId="right" type="monotone" dataKey="class_mean" name="班级均分" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                  <Line yAxisId="right" type="monotone" dataKey="layer_mean" name="年段均分" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* 学科分析 Tab */}
      {activeTab === 'subjects' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">各学科成绩分析</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Object.entries(classData.subject_analysis).map(([key, value]) => ({
                    subject: subjectNames[key],
                    class_mean: value.class_mean,
                    layer_mean: value.layer_mean,
                    diff: value.diff,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="subject" />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="class_mean" name="班级均分" fill="#3b82f6" />
                  <Bar dataKey="layer_mean" name="年段均分" fill="#9ca3af" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">学科</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">班级均分</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">年段均分</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">差距</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(classData.subject_analysis).map(([key, value]) => (
                    <tr key={key} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{subjectNames[key]}</td>
                      <td className="px-4 py-3 text-center">{value.class_mean}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{value.layer_mean}</td>
                      <td className={`px-4 py-3 text-center font-medium ${getDiffColor(value.diff)}`}>
                        {diffText(value.diff)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {value.diff > 0 ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">领先</span>
                        ) : value.diff < -5 ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">落后</span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">持平</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {englishWarning?.diff < -10 && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-800">英语学科预警</h3>
                  <p className="text-sm text-red-700 mt-1">
                    本班英语均分({englishWarning.class_mean})与年段均分({englishWarning.layer_mean})差距较大，
                    落后{Math.abs(englishWarning.diff)}分。建议加强英语学科的教学投入，关注后进生转化。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 学生进退步 Tab */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">学生进退步名单</h2>
              <p className="text-xs text-gray-500 mt-1">
                当前考试：{classData.current_exam.exam_name}；对比考试：{classData.previous_exam?.exam_name || '暂无'}。主指标采用排名百分位变化。
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-500"></div>进步</span>
              <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-500"></div>退步</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  {scoreVisibility.show_class_rank && (
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">当前排名</th>
                  )}
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">姓名</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">学籍号</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">当前分数</th>
                  {scoreVisibility.show_class_rank && (
                    <>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">上次排名</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">名次变化</th>
                    </>
                  )}
                  {scoreVisibility.show_percentile && (
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">百分位变化</th>
                  )}
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">状态</th>
                </tr>
              </thead>
              <tbody>
                {classData.student_rank_changes.map((student) => (
                  <tr key={student.student_id} className="border-b border-gray-100 hover:bg-gray-50">
                    {scoreVisibility.show_class_rank && (
                      <td className="px-4 py-3 font-medium">{maskRankValue(student.current_rank, scoreVisibility.show_class_rank)}</td>
                    )}
                    <td className="px-4 py-3 font-medium text-gray-800">{student.student_name}</td>
                    <td className="px-4 py-3 text-gray-500">{student.student_code}</td>
                    <td className="px-4 py-3 text-center font-medium">{student.current_score}</td>
                    {scoreVisibility.show_class_rank && (
                      <>
                        <td className="px-4 py-3 text-center text-gray-500">{student.previous_rank || '不可比'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${(student.rank_change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {student.rank_change === null || Number.isNaN(student.rank_change) ? '不可比' : `${student.rank_change > 0 ? '+' : ''}${student.rank_change}`}
                          </span>
                        </td>
                      </>
                    )}
                    {scoreVisibility.show_percentile && (
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${(student.percentile_change || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {student.percentile_change === null ? '不可比' : `${student.percentile_change > 0 ? '+' : ''}${formatNumber(student.percentile_change, 1)}pct`}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      {student.change_direction === '进步' ? (
                        <span className="flex items-center justify-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                          <TrendingUp className="w-3 h-3" />
                          进步
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                          <TrendingDown className="w-3 h-3" />
                          退步
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-8">
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">进步靠前</h3>
              <div className="space-y-2">
                {scoreVisibility.show_percentile ? classData.student_rank_changes.filter(s => (s.percentile_change ?? 0) >= 0).slice(0, 8).map(student => (
                  <div key={`up-${student.student_id}`} className="flex items-center justify-between bg-green-50 rounded-lg px-4 py-3">
                    <span className="font-medium text-gray-800">{student.student_name}</span>
                    <span className="text-green-700 font-semibold">+{formatNumber(student.percentile_change, 1)}pct</span>
                  </div>
                )) : (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                    百分位变化暂未开放
                  </div>
                )}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">退步预警</h3>
              <div className="space-y-2">
                {scoreVisibility.show_percentile ? [...classData.student_rank_changes].filter(s => (s.percentile_change ?? 0) < 0).sort((a, b) => a.percentile_change - b.percentile_change).slice(0, 8).map(student => (
                  <div key={`down-${student.student_id}`} className="flex items-center justify-between bg-red-50 rounded-lg px-4 py-3">
                    <span className="font-medium text-gray-800">{student.student_name}</span>
                    <span className="text-red-600 font-semibold">{formatNumber(student.percentile_change, 1)}pct</span>
                  </div>
                )) : (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                    百分位变化暂未开放
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="font-semibold text-gray-800 mb-3">多次考试百分位轨迹</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left">学生</th>
                    {classData.student_progress_history[0]?.display.map(point => (
                      <th key={point.exam_name} className="px-4 py-3 text-center">{point.exam_name}</th>
                    ))}
                    <th className="px-4 py-3 text-center">首末变化</th>
                  </tr>
                </thead>
                <tbody>
                  {classData.student_progress_history.slice(0, 12).map(student => (
                    <tr key={student.student_id} className="border-b border-gray-100">
                      <td className="px-4 py-3 font-medium">{student.student_name}</td>
                      {student.display.map(point => (
                        <td key={`${student.student_id}-${point.exam_name}`} className="px-4 py-3 text-center">
                          {point.percentile === null ? '-' : `${formatNumber(point.percentile, 1)}%`}
                        </td>
                      ))}
                      <td className={`px-4 py-3 text-center font-semibold ${(student.delta || 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {student.delta === null ? '-' : `${student.delta > 0 ? '+' : ''}${formatNumber(student.delta, 1)}pct`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 薄弱学科追踪 Tab */}
      {activeTab === 'weak' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">选择追踪学科:</span>
              <div className="flex gap-2">
                {Object.entries(subjectNames).map(([key, name]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedSubject(key)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      selectedSubject === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {weakSubjectName}学科差距趋势
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={classData.weak_subject_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="exam_name" />
                  <YAxis domain={['auto', 'auto']} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={0} stroke="#000" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="class_mean" name="班级均分" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                  <Line type="monotone" dataKey="layer_mean" name="年段均分" stroke="#9ca3af" strokeWidth={2} dot={{ fill: '#9ca3af' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">趋势分析</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">历次考试数</p>
                <p className="text-2xl font-bold text-gray-800">{classData.weak_subject_trend.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">当前差距</p>
                <p className={`text-2xl font-bold ${getDiffColor(classData.weak_subject_trend[classData.weak_subject_trend.length - 1]?.gap || 0)}`}>
                  {diffText(classData.weak_subject_trend[classData.weak_subject_trend.length - 1]?.gap || 0)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">总体趋势</p>
                <p className="text-2xl font-bold text-gray-800">
                  {(classData.weak_subject_trend[classData.weak_subject_trend.length - 1]?.gap || 0) >=
                  (classData.weak_subject_trend[0]?.gap || 0) ? '改善' : '扩大'}
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>分析结论:</strong> 本班{weakSubjectName}学科当前差距为
                {diffText(classData.weak_subject_trend[classData.weak_subject_trend.length - 1]?.gap || 0)}分，
                请结合学生个体排名变化和缺考情况持续跟踪。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 缺考上报 Tab */}
      {activeTab === 'absence' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800">缺考上报</h2>
            <p className="text-sm text-gray-500">上报本班学生的缺考情况，提交后需教务处审核</p>
          </div>
          <AbsenceManagement mode="teacher" className={selectedClass} />
        </div>
      )}
    </div>
  );
};

export default HeadTeacherView;
