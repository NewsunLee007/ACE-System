export const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const pct = (part, total) => (total > 0 ? (part / total) * 100 : 0);

export const scopeKeyFromValue = (value) => {
  if (value === 'all') return 'all';
  const match = String(value || '').match(/layer_([a-c])/i);
  return match ? match[1].toUpperCase() : 'all';
};

export const calcBasicStats = (nums) => {
  const values = (nums || []).filter(value => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) {
    return { count: 0, mean: 0, median: 0, std: 0, min: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / count;
  const median = count % 2 === 0
    ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    : sorted[Math.floor(count / 2)];
  const std = Math.sqrt(sorted.reduce((sq, value) => sq + (value - mean) ** 2, 0) / count);
  return { count, mean, median, std, min: sorted[0], max: sorted[sorted.length - 1] };
};

export const getSubjectFullScore = (exam, subject, scores = []) => {
  const configured = safeNumber(exam?.subject_scores?.[subject]);
  if (configured && configured > 0) return configured;

  const observedMax = Math.max(
    0,
    ...scores
      .map(score => safeNumber(score?.scores?.[subject]))
      .filter(value => Number.isFinite(value))
  );

  if (observedMax > 120) return 160;
  if (observedMax > 100) return 120;
  return 100;
};

export const getTeachingSubjects = (exam, scores = []) => {
  const configured = Array.isArray(exam?.subjects) && exam.subjects.length > 0
    ? exam.subjects
    : Array.from(new Set((scores || []).flatMap(score => Object.keys(score.scores || {}))));
  return configured.filter(Boolean);
};

export const computeTeachingScore = ({ exam, scores, classLayers, formatClassName }) => {
  const validScores = (scores || []).filter(score => score.is_valid !== false);
  const subjects = getTeachingSubjects(exam, validScores);
  const layerByClassId = new Map((classLayers || []).map(layer => [Number(layer.class_id), layer]));
  const fullScores = {};
  const thresholds = {};
  const totalScores = validScores
    .map(score => safeNumber(score?.total_score))
    .filter(value => Number.isFinite(value) && value > 0);
  const overallMean = calcBasicStats(totalScores).mean;
  const totalsByLayer = new Map();

  validScores.forEach(score => {
    const classId = Number(score.class_id);
    const layer = layerByClassId.get(classId);
    const layerCode = String(layer?.layer_code || score?._layer || score?.layer_code || 'C').toUpperCase();
    const total = safeNumber(score?.total_score);
    if (!Number.isFinite(total) || total <= 0) return;
    if (!totalsByLayer.has(layerCode)) totalsByLayer.set(layerCode, []);
    totalsByLayer.get(layerCode).push(total);
  });

  const meanByLayer = new Map(
    Array.from(totalsByLayer.entries()).map(([layerCode, values]) => [layerCode, calcBasicStats(values).mean])
  );

  subjects.forEach(subject => {
    const fullScore = getSubjectFullScore(exam, subject, validScores);
    fullScores[subject] = fullScore;
    thresholds[subject] = {
      excellent: fullScore * 0.9,
      good: fullScore * 0.8,
      pass: fullScore * 0.6
    };
  });

  const classGroups = new Map();
  validScores.forEach(score => {
    const classId = Number(score.class_id);
    if (!Number.isFinite(classId)) return;
    if (!classGroups.has(classId)) classGroups.set(classId, []);
    classGroups.get(classId).push(score);
  });

  const baseRows = Array.from(classGroups.entries()).map(([classId, rows]) => {
    const layer = layerByClassId.get(Number(classId));
    const layerCode = String(layer?.layer_code || 'C').toUpperCase();
    const className = layer?.class_name || formatClassName?.(Number(classId)) || `${classId}班`;
    const subjectMetrics = {};
    const classTotals = rows
      .map(score => safeNumber(score?.total_score))
      .filter(value => Number.isFinite(value) && value > 0);
    const classMean = calcBasicStats(classTotals).mean;
    const sameLayerMean = meanByLayer.get(layerCode) ?? overallMean;

    subjects.forEach(subject => {
      const values = rows
        .map(score => safeNumber(score?.scores?.[subject]))
        .filter(value => Number.isFinite(value));
      const referenceCount = values.length;
      const mean = referenceCount ? values.reduce((sum, value) => sum + value, 0) / referenceCount : 0;
      const fullScore = fullScores[subject] || 100;
      const convertedMean = fullScore > 0 ? (mean / fullScore) * 100 : 0;
      const excellentCount = values.filter(value => value >= thresholds[subject].excellent).length;
      const goodCount = values.filter(value => value >= thresholds[subject].good).length;
      const passCount = values.filter(value => value >= thresholds[subject].pass).length;

      subjectMetrics[subject] = {
        reference_count: referenceCount,
        mean,
        converted_mean: convertedMean,
        excellent_count: excellentCount,
        good_count: goodCount,
        pass_count: passCount,
        excellent_rate: pct(excellentCount, referenceCount),
        good_rate: pct(goodCount, referenceCount),
        pass_rate: pct(passCount, referenceCount)
      };
    });

    return {
      class_id: classId,
      class_name: className,
      layer_code: layerCode,
      class_mean: classMean,
      overall_mean: overallMean,
      range_mean_diff: classMean - overallMean,
      same_layer_mean: sameLayerMean,
      same_layer_diff: classMean - sameLayerMean,
      subject_metrics: subjectMetrics,
      comprehensive_score: 0,
      valid_subject_count: 0
    };
  }).sort((a, b) => Number(a.class_id) - Number(b.class_id));

  const benchmarks = {};
  subjects.forEach(subject => {
    benchmarks[subject] = {
      max_converted_mean: Math.max(0, ...baseRows.map(row => row.subject_metrics[subject]?.converted_mean || 0)),
      max_excellent_rate: Math.max(0, ...baseRows.map(row => row.subject_metrics[subject]?.excellent_rate || 0)),
      max_good_rate: Math.max(0, ...baseRows.map(row => row.subject_metrics[subject]?.good_rate || 0)),
      max_pass_rate: Math.max(0, ...baseRows.map(row => row.subject_metrics[subject]?.pass_rate || 0))
    };
  });

  const classRows = baseRows.map(row => {
    const subjectScores = subjects.map(subject => {
      const metric = row.subject_metrics[subject];
      const benchmark = benchmarks[subject] || {};
      if (!metric || metric.reference_count === 0) {
        return { subject, total_points: 0, skipped: true };
      }

      const avgPoints = benchmark.max_converted_mean > 0
        ? (metric.converted_mean / benchmark.max_converted_mean) * 35
        : 0;
      const excellentPoints = benchmark.max_excellent_rate > 0
        ? (metric.excellent_rate / benchmark.max_excellent_rate) * 15
        : 0;
      const passPoints = benchmark.max_pass_rate > 0
        ? (metric.pass_rate / benchmark.max_pass_rate) * 15
        : 0;
      const totalPoints = avgPoints + excellentPoints + passPoints;

      row.subject_metrics[subject] = {
        ...metric,
        avg_points: avgPoints,
        excellent_points: excellentPoints,
        pass_points: passPoints,
        total_points: totalPoints
      };

      return { subject, total_points: totalPoints, skipped: false };
    }).filter(item => !item.skipped);

    const validSubjectCount = subjectScores.length;
    return {
      ...row,
      valid_subject_count: validSubjectCount,
      comprehensive_score: validSubjectCount
        ? subjectScores.reduce((sum, item) => sum + item.total_points, 0) / validSubjectCount
        : 0
    };
  }).sort((a, b) => b.comprehensive_score - a.comprehensive_score)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    subjects,
    full_scores: fullScores,
    thresholds,
    benchmarks,
    class_rows: classRows,
    summary: {
      ranked_count: classRows.length,
      top_class: classRows[0] || null,
      average_score: classRows.length
        ? classRows.reduce((sum, row) => sum + row.comprehensive_score, 0) / classRows.length
        : 0
    }
  };
};

export const computeComprehensive = ({
  exam,
  gradeLevel,
  allScores,
  layersForGrade,
  formatClassName,
}) => {
  const subjectList = (exam?.subjects || []).length > 0
    ? exam.subjects
    : Array.from(new Set((allScores || []).flatMap(score => Object.keys(score.scores || {}))));
  const fullScores = subjectList.reduce((result, subject) => {
    result[subject] = getSubjectFullScore(exam, subject, allScores || []);
    return result;
  }, {});
  const maxTotal = Number(exam?.full_score || 0);
  const totalFullScore = maxTotal > 0
    ? maxTotal
    : subjectList.reduce((sum, subject) => sum + (fullScores[subject] || 100), 0);
  const thresholds = {
    excellent: totalFullScore * 0.9,
    good: totalFullScore * 0.8,
    pass: totalFullScore * 0.6
  };

  const layerByClassId = new Map((layersForGrade || []).filter(layer => layer.class_id).map(layer => [Number(layer.class_id), String(layer.layer_code || 'C').toUpperCase()]));

  const tagged = (allScores || []).map(score => {
    const classId = Number(score.class_id);
    const layer = layerByClassId.get(classId) || 'C';
    return { ...score, _layer: layer };
  });

  const baselineTotals = tagged
    .filter(score => score.is_valid !== false)
    .map(score => Number(score.total_score || 0))
    .filter(number => Number.isFinite(number) && number > 0);
  const baselineStats = calcBasicStats(baselineTotals);
  const baselineMean = baselineStats.mean;
  const baselineStd = baselineStats.std;

  const makeScope = (scopeKey) => {
    const scopedAll = scopeKey === 'all' ? tagged : tagged.filter(score => score._layer === scopeKey);
    const scopedValid = scopedAll.filter(score => score.is_valid !== false);
    const totalScores = scopedValid.map(score => Number(score.total_score || 0)).filter(number => Number.isFinite(number) && number > 0);
    const totalStats = calcBasicStats(totalScores);
    const totalSortedDesc = [...totalScores].sort((a, b) => b - a);
    const topRatio = 0.2;
    const scoreAtRatio = (ratio) => {
      const count = totalSortedDesc.length;
      if (!count) return { rank: 0, score: 0 };
      const rank = Math.min(count, Math.max(1, Math.ceil(count * ratio)));
      return { rank, score: totalSortedDesc[rank - 1] ?? 0 };
    };
    const top20 = scoreAtRatio(0.2);
    const top40 = scoreAtRatio(0.4);
    const top80 = scoreAtRatio(0.8);
    const standardScore = baselineStd > 0 ? (15 * (totalStats.mean - baselineMean) / baselineStd + 70) : 70;
    const ratioAtLine = (lineScore) => {
      if (!totalScores.length) return 0;
      return totalScores.filter(score => score >= lineScore).length / totalScores.length;
    };
    const top20Ratio = ratioAtLine(top20.score);
    const top80Ratio = ratioAtLine(top80.score);
    const zScore = standardScore * 0.5 + top20Ratio * 20 + top80Ratio * 30;

    const dist = {
      excellent: totalScores.filter(score => score >= thresholds.excellent).length,
      good: totalScores.filter(score => score >= thresholds.good && score < thresholds.excellent).length,
      pass: totalScores.filter(score => score >= thresholds.pass && score < thresholds.good).length,
      fail: totalScores.filter(score => score < thresholds.pass).length
    };

    const subjectStatistics = {};
    const keySubjects = {};
    subjectList.forEach(subject => {
      const values = scopedValid
        .map(score => (score.scores && score.scores[subject] !== undefined ? Number(score.scores[subject]) : null))
        .filter(value => value !== null && Number.isFinite(value));
      const stats = calcBasicStats(values);
      const fullScore = fullScores[subject] || Number(exam?.subject_scores?.[subject] ?? 100) || 100;
      const passCount = values.filter(value => value >= fullScore * 0.6).length;
      const excellentCount = values.filter(value => value >= fullScore * 0.9).length;
      subjectStatistics[subject] = {
        ...stats,
        pass_rate: values.length ? (passCount / values.length * 100) : 0,
        excellent_rate: values.length ? (excellentCount / values.length * 100) : 0
      };

      const sortedDesc = [...values].sort((a, b) => b - a);
      const subjectTopRank = sortedDesc.length ? Math.ceil(sortedDesc.length * topRatio) : 0;
      const subjectTopScore = subjectTopRank ? sortedDesc[subjectTopRank - 1] : 0;
      keySubjects[subject] = {
        max: stats.max,
        mean: stats.mean,
        full_score: Number.isFinite(fullScore) ? fullScore : 100,
        top20_rank: subjectTopRank,
        top20_score: subjectTopScore
      };
    });

    const fullTotal = Number(exam?.full_score ?? totalFullScore);
    const rankPointsBase = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800];
    const rankPoints = [...rankPointsBase, totalSortedDesc.length].filter(rank => rank > 0 && rank <= totalSortedDesc.length);
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
            { range: `A等 ${Math.round(thresholds.excellent)}-${totalFullScore}`, count: dist.excellent, percentage: totalScores.length ? (dist.excellent / totalScores.length * 100) : 0 },
            { range: `B等 ${Math.round(thresholds.good)}-${Math.round(thresholds.excellent) - 1}`, count: dist.good, percentage: totalScores.length ? (dist.good / totalScores.length * 100) : 0 },
            { range: `C等 ${Math.round(thresholds.pass)}-${Math.round(thresholds.good) - 1}`, count: dist.pass, percentage: totalScores.length ? (dist.pass / totalScores.length * 100) : 0 },
            { range: `D等 0-${Math.round(thresholds.pass) - 1}`, count: dist.fail, percentage: totalScores.length ? (dist.fail / totalScores.length * 100) : 0 }
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
      teaching_score: computeTeachingScore({
        exam,
        scores: scopedValid,
        classLayers: layersForGrade,
        formatClassName,
      }),
      key_metrics: {
        top_ratio: topRatio,
        subjects: keySubjects,
        total: {
          max: totalStats.max,
          mean: totalStats.mean,
          full_score: Number.isFinite(fullTotal) ? fullTotal : totalFullScore,
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
  tagged.filter(score => score.is_valid !== false).forEach(score => {
    const layer = score._layer || 'C';
    if (layerGroups[layer]) layerGroups[layer].push(Number(score.total_score || 0));
  });
  const layerStatistics = {};
  Object.entries(layerGroups).forEach(([layer, scores]) => {
    const values = scores.filter(number => Number.isFinite(number) && number > 0);
    const stats = calcBasicStats(values);
    const passCount = values.filter(value => value >= thresholds.pass).length;
    const excellentCount = values.filter(value => value >= thresholds.excellent).length;
    layerStatistics[layer] = {
      student_count: values.length,
      mean: stats.mean,
      std: stats.std,
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
