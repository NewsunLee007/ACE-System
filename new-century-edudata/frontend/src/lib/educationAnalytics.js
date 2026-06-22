import schoolData from '../data/schoolData';

export const DEFAULT_SUBJECTS = ['语文', '数学', '英语', '科学', '社会'];

export const GRADE_BANDS = [
  { key: 'A', label: 'A等', name: '优秀', minRate: 0.9, color: '#16a34a', bg: 'bg-green-50', text: 'text-green-700' },
  { key: 'B', label: 'B等', name: '良好', minRate: 0.8, color: '#2563eb', bg: 'bg-blue-50', text: 'text-blue-700' },
  { key: 'C', label: 'C等', name: '合格', minRate: 0.6, color: '#d97706', bg: 'bg-amber-50', text: 'text-amber-700' },
  { key: 'D', label: 'D等', name: '不合格', minRate: 0, color: '#dc2626', bg: 'bg-red-50', text: 'text-red-700' }
];

export const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const formatNumber = (value, digits = 1) => {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(digits)) : 0;
};

export const mean = (values) => {
  const nums = (values || []).filter(value => Number.isFinite(value));
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : 0;
};

export const std = (values) => {
  const nums = (values || []).filter(value => Number.isFinite(value));
  if (!nums.length) return 0;
  const avg = mean(nums);
  return Math.sqrt(nums.reduce((sum, value) => sum + (value - avg) ** 2, 0) / nums.length);
};

export const getGradeNumber = (gradeLevel) => {
  const match = String(gradeLevel || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
};

export const getClassId = (score) => {
  if (score?.class_id) return Number(score.class_id);
  const text = String(score?.class_name || score?.className || '');
  const match = text.match(/\d{3,4}/);
  return match ? Number(match[0]) : null;
};

export const getScoreTotal = (score) => {
  const direct = toNumber(score?.total_score);
  if (direct && direct > 0) return direct;
  const values = Object.values(score?.scores || {}).map(toNumber).filter(value => Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) : 0;
};

export const getStudentName = (score) => {
  const student = schoolData.getStudentById?.(score?.student_id);
  return score?.student_name || student?.name || student?.student_name || `学生${score?.student_id || ''}`;
};

export const getSubjects = (exam, rows = []) => {
  if (Array.isArray(exam?.subjects) && exam.subjects.length > 0) return exam.subjects;
  const detected = Array.from(new Set(rows.flatMap(row => Object.keys(row.scores || {}))));
  return detected.length ? detected : DEFAULT_SUBJECTS;
};

export const getSubjectFullScore = (exam, subject, rows = []) => {
  const configured = toNumber(exam?.subject_scores?.[subject]);
  if (configured && configured > 0) return configured;
  const observedMax = Math.max(
    0,
    ...rows.map(row => toNumber(row?.scores?.[subject])).filter(value => Number.isFinite(value))
  );
  if (observedMax > 120) return 160;
  if (observedMax > 100) return 120;
  return 100;
};

export const getExamFullScore = (exam, subjects, rows = []) => {
  const configured = toNumber(exam?.full_score);
  if (configured && configured > 0) return configured;
  return (subjects || getSubjects(exam, rows)).reduce((sum, subject) => sum + getSubjectFullScore(exam, subject, rows), 0);
};

export const getGradeBand = (score, fullScore) => {
  const numeric = toNumber(score);
  const full = toNumber(fullScore) || 100;
  if (!Number.isFinite(numeric) || full <= 0) return null;
  const rate = numeric / full;
  return GRADE_BANDS.find(band => rate >= band.minRate) || GRADE_BANDS[GRADE_BANDS.length - 1];
};

export const getBandCounts = (values, fullScore) => {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  (values || []).forEach(value => {
    const band = getGradeBand(value, fullScore);
    if (band) counts[band.key] += 1;
  });
  return counts;
};

export const getPercentileFromRank = (rank, participantCount) => {
  const r = toNumber(rank);
  const n = toNumber(participantCount);
  if (!r || !n || n <= 1) return null;
  return 1 - ((r - 1) / (n - 1));
};

export const normalizeClassLayers = (layers = [], gradeLevel) => {
  const gradeNum = getGradeNumber(gradeLevel);
  const gradeClasses = (schoolData.classes || []).filter(cls => gradeNum && Math.floor(Number(cls.id) / 100) === gradeNum);
  const classIdSet = new Set(gradeClasses.map(cls => Number(cls.id)));
  const normalized = (layers || []).map(layer => {
    const next = { ...layer };
    if (!next.grade_level) next.grade_level = gradeLevel;
    if (!next.class_id) {
      const match = String(next.class_name || '').match(/\d{3,4}/);
      const parsed = match ? Number(match[0]) : null;
      if (parsed && classIdSet.has(parsed)) next.class_id = parsed;
    }
    if (next.class_id && !next.class_name) {
      const cls = gradeClasses.find(item => Number(item.id) === Number(next.class_id));
      next.class_name = cls ? (schoolData.formatClassName?.(cls.id) || cls.name || String(cls.id)) : String(next.class_id);
    }
    next.layer_code = String(next.layer_code || 'C').toUpperCase();
    next.layer_name = next.layer_name || (next.layer_code === 'A' ? 'A层' : next.layer_code === 'B' ? 'B层' : 'C层');
    return next;
  }).filter(layer => layer.grade_level === gradeLevel);

  const byClass = new Map(normalized.filter(layer => layer.class_id).map(layer => [Number(layer.class_id), layer]));
  gradeClasses.forEach(cls => {
    const classId = Number(cls.id);
    if (!byClass.has(classId)) {
      byClass.set(classId, {
        id: `local_${gradeLevel}_${classId}`,
        grade_level: gradeLevel,
        class_id: classId,
        class_name: schoolData.formatClassName?.(classId) || cls.name || `${classId}班`,
        layer_code: 'C',
        layer_name: 'C层'
      });
    }
  });

  return Array.from(byClass.values()).sort((a, b) => Number(a.class_id) - Number(b.class_id));
};

export const getLayerOptions = (layers = []) => {
  const codes = Array.from(new Set((layers || []).map(layer => String(layer.layer_code || '').toUpperCase()).filter(Boolean))).sort();
  return [
    { value: 'all', label: '全段' },
    ...codes.map(code => ({ value: code, label: `${code}层` }))
  ];
};

export const filterRowsByLayer = (rows, layers, layerCode) => {
  if (!layerCode || layerCode === 'all') return rows || [];
  const classIds = new Set((layers || [])
    .filter(layer => String(layer.layer_code || '').toUpperCase() === String(layerCode).toUpperCase())
    .map(layer => Number(layer.class_id)));
  return (rows || []).filter(row => classIds.has(getClassId(row)));
};

const buildLayerLookup = (layers = []) => new Map(
  (layers || [])
    .filter(layer => Number.isFinite(Number(layer.class_id)))
    .map(layer => [Number(layer.class_id), {
      ...layer,
      layer_code: String(layer.layer_code || 'C').toUpperCase()
    }])
);

export const getExamScores = (examId, { includeInvalid = false } = {}) => (
  (schoolData.examScores || [])
    .filter(score => Number(score.exam_id) === Number(examId))
    .filter(score => includeInvalid || (score.is_valid !== false && score.is_included !== false))
);

export const buildExamAnalytics = ({ exam, rows, layers = [], layerCode = 'all', subject = 'all' }) => {
  const allRows = rows || getExamScores(exam?.id, { includeInvalid: true });
  const layerByClassId = buildLayerLookup(layers);
  const getLayerForClass = (classId) => layerByClassId.get(Number(classId));
  const getMetricValue = (row) => (
    subject && subject !== 'all' ? toNumber(row?.scores?.[subject]) : getScoreTotal(row)
  );
  const validRows = filterRowsByLayer(allRows, layers, layerCode).filter(row => row.is_valid !== false && row.is_included !== false);
  const subjects = getSubjects(exam, validRows);
  const selectedSubjects = subject && subject !== 'all' ? subjects.filter(item => item === subject) : subjects;
  const totalFullScore = getExamFullScore(exam, selectedSubjects.length ? selectedSubjects : subjects, validRows);
  const totals = validRows
    .map(getMetricValue)
    .filter(value => Number.isFinite(value) && value >= 0);
  const average = mean(totals);
  const deviation = std(totals);
  const bands = getBandCounts(totals, subject && subject !== 'all' ? getSubjectFullScore(exam, subject, validRows) : totalFullScore);

  const sameLayerTotals = new Map();
  (allRows || [])
    .filter(row => row.is_valid !== false && row.is_included !== false)
    .forEach(row => {
      const classId = getClassId(row);
      const layer = getLayerForClass(classId);
      const code = String(layer?.layer_code || 'C').toUpperCase();
      const value = getMetricValue(row);
      if (!Number.isFinite(value) || value < 0) return;
      if (!sameLayerTotals.has(code)) sameLayerTotals.set(code, []);
      sameLayerTotals.get(code).push(value);
    });
  const sameLayerMeans = new Map(
    Array.from(sameLayerTotals.entries()).map(([code, values]) => [code, mean(values)])
  );

  const subjectStats = subjects.map(item => {
    const values = validRows.map(row => toNumber(row?.scores?.[item])).filter(value => Number.isFinite(value));
    const fullScore = getSubjectFullScore(exam, item, validRows);
    const counts = getBandCounts(values, fullScore);
    return {
      subject: item,
      fullScore,
      count: values.length,
      mean: mean(values),
      std: std(values),
      bands: counts,
      passRate: values.length ? ((counts.A + counts.B + counts.C) / values.length) * 100 : 0,
      failRate: values.length ? (counts.D / values.length) * 100 : 0
    };
  });

  const classMap = new Map();
  validRows.forEach(row => {
    const classId = getClassId(row);
    if (!classId) return;
    if (!classMap.has(classId)) classMap.set(classId, []);
    classMap.get(classId).push(row);
  });

  const classRows = Array.from(classMap.entries()).map(([classId, classRowsForClass]) => {
    const classTotals = classRowsForClass
      .map(getMetricValue)
      .filter(value => Number.isFinite(value) && value >= 0);
    const classMean = mean(classTotals);
    const layer = getLayerForClass(classId);
    const layerCodeForClass = String(layer?.layer_code || 'C').toUpperCase();
    const sameLayerMean = sameLayerMeans.get(layerCodeForClass) ?? average;
    const fullScore = subject && subject !== 'all' ? getSubjectFullScore(exam, subject, validRows) : totalFullScore;
    const classBands = getBandCounts(classTotals, fullScore);
    return {
      classId,
      className: layer?.class_name || schoolData.formatClassName?.(classId) || `${classId}班`,
      layerCode: layerCodeForClass,
      count: classRowsForClass.length,
      mean: classMean,
      rangeMean: average,
      rangeDiff: classMean - average,
      sameLayerMean,
      sameLayerDiff: classMean - sameLayerMean,
      zScore: deviation > 0 ? (classMean - average) / deviation : 0,
      bands: classBands,
      failRate: classTotals.length ? (classBands.D / classTotals.length) * 100 : 0
    };
  }).sort((a, b) => b.mean - a.mean).map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    exam,
    rows: validRows,
    subjects,
    fullScore: totalFullScore,
    total: {
      count: validRows.length,
      absent: filterRowsByLayer(allRows, layers, layerCode).length - validRows.length,
      mean: average,
      std: deviation,
      max: totals.length ? Math.max(...totals) : 0,
      min: totals.length ? Math.min(...totals) : 0,
      bands,
      passRate: totals.length ? ((bands.A + bands.B + bands.C) / totals.length) * 100 : 0,
      failRate: totals.length ? (bands.D / totals.length) * 100 : 0
    },
    subjectStats,
    classRows
  };
};

export const buildMultiExamTrend = ({ exams, gradeLevel, layerCode = 'all', subject = 'all' }) => {
  const layers = normalizeClassLayers(schoolData.classLayers || [], gradeLevel);
  return (exams || []).map(exam => {
    const analytics = buildExamAnalytics({ exam, layers, layerCode, subject });
    return {
      examId: exam.id,
      examName: exam.term ? `${exam.term} ${exam.exam_name || exam.name || ''}`.trim() : (exam.exam_name || exam.name || `考试${exam.id}`),
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
      analytics
    };
  });
};

export const buildPercentileProgress = (currentRows, previousRows) => {
  const rankRows = (rows) => (rows || [])
    .map(row => ({ row, total: getScoreTotal(row) }))
    .filter(item => Number.isFinite(item.total) && item.total > 0 && item.row.is_valid !== false)
    .sort((a, b) => b.total - a.total);

  const previousRanked = rankRows(previousRows);
  const currentRanked = rankRows(currentRows);
  const previousByStudent = new Map();
  previousRanked.forEach((item, index) => {
    previousByStudent.set(String(item.row.student_id), {
      rank: index + 1,
      percentile: getPercentileFromRank(index + 1, previousRanked.length),
      score: item.total,
      count: previousRanked.length
    });
  });

  return currentRanked.map((item, index) => {
    const currentRank = index + 1;
    const currentPercentile = getPercentileFromRank(currentRank, currentRanked.length);
    const previous = previousByStudent.get(String(item.row.student_id));
    const comparable = previous && currentPercentile !== null && previous.percentile !== null;
    const percentileDelta = comparable ? (currentPercentile - previous.percentile) * 100 : null;
    const rankDelta = previous ? previous.rank - currentRank : null;
    return {
      studentId: item.row.student_id,
      studentName: getStudentName(item.row),
      currentRank,
      previousRank: previous?.rank || null,
      currentScore: item.total,
      previousScore: previous?.score || null,
      currentPercentile,
      previousPercentile: previous?.percentile || null,
      percentileDelta,
      rankDelta,
      comparable
    };
  }).sort((a, b) => (b.percentileDelta ?? -999) - (a.percentileDelta ?? -999));
};
