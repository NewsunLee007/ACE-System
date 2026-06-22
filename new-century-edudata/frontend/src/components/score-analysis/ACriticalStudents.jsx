import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  ClipboardCheck,
  Download,
  ListChecks,
  Maximize2,
  Target,
} from 'lucide-react';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeLayerCode = (value) => String(value || '').trim().toUpperCase();

export const A_CRITICAL_COUNT_STORAGE_KEY = 'scoreAnalysis.aCritical.targetCount';
const DEFAULT_TARGET_COUNT = 30;
const MAX_TARGET_COUNT = 500;

const clampTargetCount = (value, fallback = DEFAULT_TARGET_COUNT) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_TARGET_COUNT, Math.max(0, Math.floor(parsed)));
};

const clampUiTargetCount = (value, fallback = DEFAULT_TARGET_COUNT) => {
  const count = clampTargetCount(value, fallback);
  return count > 0 ? count : fallback;
};

const cx = (...items) => items.filter(Boolean).join(' ');

const getClassNumber = (value) => {
  const match = String(value || '').match(/\d{3,4}/);
  return match ? Number(match[0]) : null;
};

const getComparableClassId = (record) => {
  const direct = Number(record?.class_id);
  if (Number.isFinite(direct) && direct > 0) return direct;
  return getClassNumber(record?.class_name || record?.className || record?.class);
};

const getClassLayer = (score, classLayers = []) => {
  const scoreClassId = getComparableClassId(score);
  const scoreClassName = String(score.class_name || score.className || '').trim();

  return classLayers.find(layer => {
    const layerClassId = getComparableClassId(layer);
    if (scoreClassId && layerClassId && scoreClassId === layerClassId) return true;
    const layerClassName = String(layer.class_name || layer.className || '').trim();
    return Boolean(scoreClassName && layerClassName && scoreClassName === layerClassName);
  });
};

const getStudentName = (score) => (
  score.student_name || score.name || score.studentName || `学生${score.student_id || score.exam_number || ''}`
);

const formatNumber = (value, digits = 1) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : '-';
};

const getCsvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

const getStableStudentKey = (score) => String(
  score.student_id || score.exam_number || score.student_no || score.student_name || score.name || ''
);

export const buildACriticalStudents = ({ examScores = [], classLayers = [], targetCount = 30 }) => {
  const requestedCount = clampTargetCount(targetCount, 0);

  const sortedScores = (examScores || [])
    .map(score => {
      const totalScore = toNumber(score.total_score);
      if (!Number.isFinite(totalScore) || totalScore <= 0) return null;
      if (score.is_valid === false || score.is_included === false) return null;

      const classLayer = getClassLayer(score, classLayers);
      const className = classLayer?.class_name || score.class_name || `${score.class_id || ''}班`;

      return {
        ...score,
        totalScore,
        className,
        layerCode: normalizeLayerCode(classLayer?.layer_code || score._layer || score.layer_code)
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      const classCompare = String(a.className || '').localeCompare(String(b.className || ''), 'zh-Hans-CN');
      if (classCompare !== 0) return classCompare;
      return getStableStudentKey(a).localeCompare(getStableStudentKey(b), 'zh-Hans-CN');
    });

  let previousTotalScore = null;
  let previousRank = 0;
  const rankedScores = sortedScores.map((score, index) => {
    const gradeRank = previousTotalScore === score.totalScore ? previousRank : index + 1;
    previousTotalScore = score.totalScore;
    previousRank = gradeRank;
    return { ...score, gradeRank };
  });

  const aLayerCount = rankedScores.filter(score => score.layerCode === 'A').length;
  const effectiveAQuota = Math.min(aLayerCount, rankedScores.length);
  const aCutoffStudent = effectiveAQuota > 0 ? rankedScores[effectiveAQuota - 1] : null;
  const aCutoffScore = aCutoffStudent?.totalScore ?? null;

  const candidates = Number.isFinite(aCutoffScore)
    ? rankedScores.filter(score => score.gradeRank > effectiveAQuota && score.totalScore < aCutoffScore)
    : [];

  const selectedStudents = candidates.slice(0, requestedCount).map((score, index) => ({
    ...score,
    criticalRank: index + 1,
    gapToACutoff: aCutoffScore - score.totalScore
  }));

  const classDistribution = Object.values(selectedStudents.reduce((acc, score) => {
    const key = score.className || `${score.class_id || ''}班`;
    if (!acc[key]) {
      acc[key] = {
        className: key,
        count: 0,
        layerCode: score.layerCode || '-',
        maxScore: score.totalScore,
        minScore: score.totalScore
      };
    }
    acc[key].count += 1;
    acc[key].maxScore = Math.max(acc[key].maxScore, score.totalScore);
    acc[key].minScore = Math.min(acc[key].minScore, score.totalScore);
    return acc;
  }, {})).sort((a, b) => b.count - a.count || String(a.className).localeCompare(String(b.className), 'zh-Hans-CN'));

  const lowerBoundary = selectedStudents.length > 0
    ? selectedStudents[selectedStudents.length - 1].totalScore
    : null;
  const lowerBoundaryRank = selectedStudents.length > 0
    ? selectedStudents[selectedStudents.length - 1].gradeRank
    : 0;

  return {
    rankedScores,
    requestedCount,
    aLayerCount,
    effectiveAQuota,
    aCutoffScore,
    aCutoffRank: aCutoffStudent?.gradeRank || 0,
    candidates,
    selectedStudents,
    classDistribution,
    lowerBoundary,
    lowerBoundaryRank,
    availableCandidateCount: candidates.length,
    shortfall: Math.max(0, requestedCount - selectedStudents.length),
    scoreSpan: Number.isFinite(aCutoffScore) && Number.isFinite(lowerBoundary) ? aCutoffScore - lowerBoundary : 0
  };
};

export default function ACriticalStudents({ examScores, classLayers }) {
  const [targetCount, setTargetCount] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_TARGET_COUNT;
    const saved = window.localStorage?.getItem(A_CRITICAL_COUNT_STORAGE_KEY);
    return clampUiTargetCount(saved, DEFAULT_TARGET_COUNT);
  });
  const [activeView, setActiveView] = useState('list');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage?.setItem(A_CRITICAL_COUNT_STORAGE_KEY, String(clampUiTargetCount(targetCount, DEFAULT_TARGET_COUNT)));
  }, [targetCount]);

  const result = useMemo(() => (
    buildACriticalStudents({ examScores, classLayers, targetCount })
  ), [examScores, classLayers, targetCount]);

  const subjects = useMemo(() => (
    Array.from(new Set((examScores || []).flatMap(score => Object.keys(score.scores || {})))).filter(Boolean)
  ), [examScores]);

  const hasACutoff = Number.isFinite(result.aCutoffScore);

  useEffect(() => {
    if (!hasACutoff || result.selectedStudents.length === 0) {
      setActiveView('list');
    } else if (!['list', 'distribution', 'all'].includes(activeView)) {
      setActiveView('list');
    }
  }, [activeView, hasACutoff, result.selectedStudents.length]);

  const exportCsv = () => {
    const headers = ['序号', '年级名次', '考号', '姓名', '班级', '现层次', '总分', '距A层线'];
    const rows = result.selectedStudents.map(student => ([
      student.criticalRank,
      student.gradeRank,
      student.exam_number || student.student_id || '',
      getStudentName(student),
      student.className,
      student.layerCode || '-',
      formatNumber(student.totalScore),
      formatNumber(student.gapToACutoff)
    ]));
    const csv = [headers, ...rows].map(row => row.map(getCsvValue).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `A层临界生名单_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!examScores || examScores.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
        请选择考试并执行分析，即可生成 A 层临界生名单。
      </div>
    );
  }

  const resultViews = [
    {
      value: 'list',
      label: '名单结果',
      desc: `已选 ${result.selectedStudents.length} 人`,
      icon: ListChecks,
      ready: hasACutoff,
    },
    {
      value: 'distribution',
      label: '班级分布',
      desc: result.classDistribution.length ? `${result.classDistribution.length} 个班级` : '暂无分布',
      icon: BarChart3,
      ready: hasACutoff && result.selectedStudents.length > 0,
    },
    {
      value: 'all',
      label: '全面铺开',
      desc: '名单与分布同屏',
      icon: Maximize2,
      ready: hasACutoff,
    },
  ];
  const activeViewConfig = resultViews.find(item => item.value === activeView) || resultViews[0];
  const closestStudents = result.selectedStudents.slice(0, 6);
  const gapBands = [
    {
      label: '0-5分',
      desc: '最接近A层线',
      count: result.selectedStudents.filter(student => Number(student.gapToACutoff) <= 5).length,
    },
    {
      label: '5-10分',
      desc: '重点跟进',
      count: result.selectedStudents.filter(student => Number(student.gapToACutoff) > 5 && Number(student.gapToACutoff) <= 10).length,
    },
    {
      label: '10分以上',
      desc: '持续观察',
      count: result.selectedStudents.filter(student => Number(student.gapToACutoff) > 10).length,
    },
  ];
  const topClassDistribution = result.classDistribution.slice(0, 5);
  const leadingClass = result.classDistribution[0];
  const distributionMinScore = Math.min(...result.classDistribution.map(row => row.minScore).filter(Number.isFinite));
  const distributionMaxScore = Math.max(...result.classDistribution.map(row => row.maxScore).filter(Number.isFinite));
  const distributionScoreRange = Number.isFinite(distributionMinScore) && Number.isFinite(distributionMaxScore)
    ? `${formatNumber(distributionMinScore)}-${formatNumber(distributionMaxScore)}`
    : '-';
  const renderMetric = (label, value, detail, tone = 'slate') => {
    const toneClasses = {
      slate: 'border-slate-200 bg-slate-50 text-slate-900',
      emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      blue: 'border-blue-200 bg-blue-50 text-blue-800',
      amber: 'border-amber-200 bg-amber-50 text-amber-800',
    };

    return (
      <div className={cx('rounded-lg border p-4', toneClasses[tone] || toneClasses.slate)}>
        <p className="text-sm opacity-80">{label}</p>
        <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
        {detail && <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>}
      </div>
    );
  };

  const renderStudentTable = () => (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <div className="max-h-[520px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
            <TableRow>
              <TableHead className="w-16 text-center">序号</TableHead>
              <TableHead className="w-20 text-center">年级名次</TableHead>
              <TableHead className="w-24 text-center">考号</TableHead>
              <TableHead className="w-24 text-center">姓名</TableHead>
              <TableHead className="w-24 text-center">班级</TableHead>
              <TableHead className="w-20 text-center">现层次</TableHead>
              <TableHead className="w-24 text-center">总分</TableHead>
              <TableHead className="w-24 text-center">距A层线</TableHead>
              {subjects.slice(0, 5).map(subject => (
                <TableHead key={subject} className="w-20 text-center">{subject}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.selectedStudents.length > 0 ? result.selectedStudents.map(student => (
              <TableRow key={`${student.student_id || student.exam_number || student.gradeRank}-${student.gradeRank}`}>
                <TableCell className="text-center font-semibold">{student.criticalRank}</TableCell>
                <TableCell className="text-center">{student.gradeRank}</TableCell>
                <TableCell className="text-center text-slate-500">{student.exam_number || student.student_id || '-'}</TableCell>
                <TableCell className="text-center font-medium">{getStudentName(student)}</TableCell>
                <TableCell className="text-center">{student.className}</TableCell>
                <TableCell className="text-center">{student.layerCode || '-'}</TableCell>
                <TableCell className="text-center font-semibold text-blue-700">{formatNumber(student.totalScore)}</TableCell>
                <TableCell className="text-center text-orange-700">{formatNumber(student.gapToACutoff)}</TableCell>
                {subjects.slice(0, 5).map(subject => (
                  <TableCell key={`${student.gradeRank}-${subject}`} className="text-center">
                    {formatNumber(student.scores?.[subject])}
                  </TableCell>
                ))}
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={8 + subjects.slice(0, 5).length} className="py-8 text-center text-slate-500">
                  暂无低于 A 层线的临界生，可调大临界人数或检查成绩分布。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderListSummary = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {renderMetric('已选人数', result.selectedStudents.length, `目标 ${result.requestedCount} 人`, 'emerald')}
        {renderMetric('距线最近', closestStudents[0] ? formatNumber(closestStudents[0].gapToACutoff) : '-', closestStudents[0] ? getStudentName(closestStudents[0]) : '暂无学生', 'blue')}
        {renderMetric('名单下沿', formatNumber(result.lowerBoundary), `名次 ${result.lowerBoundaryRank || '-'}`, 'slate')}
        {renderMetric('覆盖班级', result.classDistribution.length, '用于分配跟进责任', 'amber')}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-slate-900">最接近A层线学生</p>
              <p className="mt-1 text-xs text-slate-500">最接近A层线的学生默认显示，完整名单在下方表格中同步显示。</p>
            </div>
          </div>
          <div className="space-y-2">
            {closestStudents.length > 0 ? closestStudents.map(student => (
              <div key={`${student.student_id || student.exam_number || student.gradeRank}-${student.criticalRank}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-semibold text-slate-900">{student.criticalRank}. {getStudentName(student)}</span>
                  <span className="ml-2 text-xs text-slate-500">{student.className} · 名次 {student.gradeRank}</span>
                </div>
                <span className="font-semibold text-orange-700">距线 {formatNumber(student.gapToACutoff)}</span>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                暂无可复核名单
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">分差带</p>
            <div className="mt-3 space-y-2">
              {gapBands.map(band => (
                <div key={band.label} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium text-slate-900">{band.label}</span>
                    <span className="ml-2 text-xs text-slate-500">{band.desc}</span>
                  </span>
                  <span className="font-semibold text-blue-700">{band.count} 人</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">班级集中 Top5</p>
            <div className="mt-3 space-y-2">
              {topClassDistribution.length > 0 ? topClassDistribution.map(row => (
                <div key={row.className} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-900">{row.className}</span>
                  <span className="text-slate-600">{row.count} 人</span>
                </div>
              )) : (
                <p className="text-sm text-slate-500">暂无班级分布</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderListContent = () => (
    <div className="space-y-5">
      {renderListSummary()}
      {renderStudentTable()}
    </div>
  );

  const renderDistributionChart = () => (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-blue-600" />
        <p className="font-semibold text-slate-900">班级人数分布</p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={result.classDistribution} layout="vertical" margin={{ left: 18, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="className" width={72} />
          <Tooltip />
          <Bar dataKey="count" name="临界生人数" fill="#2563eb" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const renderDistributionTable = () => (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="font-semibold text-slate-900">班级明细表</p>
        <p className="mt-1 text-xs text-slate-500">用于分派班主任、年段长和备课组跟进责任。</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>班级</TableHead>
            <TableHead className="text-center">人数</TableHead>
            <TableHead className="text-center">分数区间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.classDistribution.map(row => (
            <TableRow key={row.className}>
              <TableCell className="font-medium">{row.className}</TableCell>
              <TableCell className="text-center">{row.count}</TableCell>
              <TableCell className="text-center">{formatNumber(row.minScore)}-{formatNumber(row.maxScore)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderDistributionSummary = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {renderMetric('覆盖班级', result.classDistribution.length, '用于分派跟进责任', 'blue')}
        {renderMetric('最集中班级', leadingClass?.className || '-', leadingClass ? `${leadingClass.count} 人` : '暂无班级分布', 'amber')}
        {renderMetric('名单分数区间', distributionScoreRange, '临界名单总分范围', 'slate')}
        {renderMetric('导出状态', result.selectedStudents.length > 0 ? '可导出' : '待生成', `${result.selectedStudents.length} 条名单`, 'emerald')}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        {renderDistributionChart()}
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">班级集中 Top5</p>
          <div className="mt-3 space-y-2">
            {topClassDistribution.length > 0 ? topClassDistribution.map(row => (
              <div key={row.className} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                <span className="font-medium text-slate-900">{row.className}</span>
                <span className="text-blue-700">{row.count} 人</span>
              </div>
            )) : (
              <p className="text-sm text-blue-700">暂无班级分布</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
        班级分布用于快速分派跟进责任；导出名单会保留年级名次、班级、总分和距A层线。
      </div>
    </div>
  );

  const renderDistributionContent = () => {
    if (result.classDistribution.length === 0) {
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 py-12 text-center text-slate-500">
          暂无班级分布数据
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {renderDistributionSummary()}
        {renderDistributionTable()}
      </div>
    );
  };

  const renderTargetControl = () => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="text-xs font-semibold text-slate-500">临界人数</label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={1}
          max={MAX_TARGET_COUNT}
          value={targetCount}
          onChange={(event) => setTargetCount(clampUiTargetCount(event.target.value, 1))}
          className="w-28 bg-white"
        />
        {[20, 30, 50].map(count => (
          <Button
            key={count}
            type="button"
            variant={Number(targetCount) === count ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTargetCount(count)}
          >
            {count}
          </Button>
        ))}
      </div>
    </div>
  );

  const renderCutoffSummary = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {renderMetric('A层有效人数', result.aLayerCount, '用于定位A层线', 'slate')}
        {renderMetric('A层分数线', formatNumber(result.aCutoffScore), `对应名次 ${result.aCutoffRank || '-'}`, 'emerald')}
        {renderMetric('低于A层线候选', result.availableCandidateCount, '按年级名次排序', 'blue')}
        {renderMetric('本次目标', result.requestedCount, result.shortfall > 0 ? `候选不足 ${result.shortfall} 人` : '满足截取人数', 'amber')}
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 text-blue-600" />
          <div>
            <p className="font-semibold text-blue-900">生成口径</p>
            <p className="mt-1 text-sm leading-6 text-blue-800">
              A层线按A层有效人数在全段总分排名中定位；名单从低于该线的学生里，按年级名次截取 {result.requestedCount} 人。
            </p>
          </div>
        </div>
      </div>

      {!hasACutoff && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
          当前年级还没有可用于计算的 A 层有效学生，请先在“层次配置”中配置 A 层班级，并确认该考试已有有效成绩。
        </div>
      )}
    </div>
  );

  const renderViewControls = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <div className="grid gap-2 md:grid-cols-3">
        {resultViews.map(view => {
          const ViewIcon = view.icon;
          const active = activeView === view.value;
          const disabled = view.ready === false;

          return (
            <button
              key={view.value}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && setActiveView(view.value)}
              className={cx(
                'flex min-h-16 items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors',
                active ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-500' : 'text-slate-700 hover:bg-blue-50',
                disabled && 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-70'
              )}
            >
              <span className={cx(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              )}>
                <ViewIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{view.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{view.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderActiveResult = () => {
    if (!hasACutoff) return renderCutoffSummary();
    if (activeView === 'distribution') return renderDistributionContent();
    if (activeView === 'all') {
      return (
        <div className="space-y-8">
          {renderListContent()}
          {renderDistributionContent()}
        </div>
      );
    }
    return renderListContent();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
              <Target className="h-5 w-5 text-emerald-600" />
              A层临界生结果
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              设定人数后自动生成名单，点击结果控件查看名单、班级分布或全面铺开。
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">目标 {result.requestedCount} 人</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">已选 {result.selectedStudents.length} 人</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">候选 {result.availableCandidateCount} 人</span>
            </div>
            <Button type="button" onClick={exportCsv} disabled={result.selectedStudents.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              导出名单
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 border-b border-slate-200 bg-slate-50 px-5 py-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        {renderTargetControl()}
        {renderCutoffSummary()}
      </div>

      <section className="space-y-5 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950">{activeViewConfig.label}</h3>
            <p className="mt-1 text-xs text-slate-500">点击下方控件切换结果显示。</p>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            当前：{activeViewConfig.label}
          </span>
        </div>
        {renderViewControls()}
        {renderActiveResult()}
      </section>
    </div>
  );
}
