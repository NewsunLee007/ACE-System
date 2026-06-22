import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, CheckCircle2, LineChart as LineChartIcon, Maximize2, Settings2, Table2 } from 'lucide-react';
import schoolData from '../../data/schoolData';
import FlowModuleSelector from './FlowModuleSelector';

const fmtTrend = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '0.0');
const cx = (...items) => items.filter(Boolean).join(' ');

export const buildHistoryTrendModel = ({
  exams = [],
  selectedGrade,
  historyCompare = {},
  sourceExamScores = schoolData.examScores || [],
  sourceClassLayers = schoolData.classLayers || [],
  normalizeClassLayers,
  computeComprehensive,
  getExamOptionLabel,
  scopeKeyFromValue,
}) => {
  const gradeExams = exams.filter(exam => exam.grade_level === selectedGrade);
  const selectedIds = historyCompare.examIds?.length
    ? historyCompare.examIds.map(id => Number(id))
    : gradeExams.slice(-5).map(exam => Number(exam.id));
  const selectedTrendExams = gradeExams.filter(exam => selectedIds.includes(Number(exam.id)));
  const activeTrendExams = selectedTrendExams.length >= 2 ? selectedTrendExams : gradeExams.slice(-5);
  const layersForTrend = normalizeClassLayers(sourceClassLayers, selectedGrade);
  const scopeKeyForTrend = scopeKeyFromValue(historyCompare.scope);
  const computeTrendForExam = (exam) => {
    const allExamScores = sourceExamScores.filter(score => score.exam_id === exam.id);
    if (allExamScores.length === 0) return null;
    const result = computeComprehensive({
      exam,
      gradeLevel: selectedGrade,
      allScores: allExamScores,
      layersForGrade: layersForTrend,
    });
    const scope = result?.scopes?.[scopeKeyForTrend] || result?.scopes?.all;
    const total = scope?.key_metrics?.total || {};
    const distribution = scope?.overall?.distribution || {};
    const summary = scope?.summary || {};
    const count = summary.participated || 0;
    return {
      exam,
      label: getExamOptionLabel(exam),
      mean: summary.grade_mean || 0,
      std: summary.grade_std || 0,
      zScore: total.z_score || 0,
      passRate: summary.pass_rate || 0,
      aRate: count ? (distribution.excellent || 0) / count * 100 : 0,
      bRate: count ? (distribution.good || 0) / count * 100 : 0,
      cRate: count ? (distribution.pass || 0) / count * 100 : 0,
      dRate: count ? (distribution.fail || 0) / count * 100 : 0,
      dCount: distribution.fail || 0,
      participated: count,
      subjects: scope?.key_metrics?.subjects || {},
    };
  };
  const trendRows = activeTrendExams.map(computeTrendForExam).filter(Boolean);
  const baseline = trendRows[0] || {};
  const latest = trendRows[trendRows.length - 1] || {};
  const previous = trendRows[trendRows.length - 2] || baseline;
  const subjectOptions = Array.from(new Set(activeTrendExams.flatMap(exam => exam.subjects || [])));
  const matrixSubjects = historyCompare.subject && historyCompare.subject !== 'all'
    ? subjectOptions.filter(subject => subject === historyCompare.subject)
    : subjectOptions;
  const subjectMatrix = matrixSubjects.map(subject => {
    const first = baseline?.subjects?.[subject]?.mean || 0;
    const last = latest?.subjects?.[subject]?.mean || 0;
    return { subject, baseline: first, latest: last, delta: last - first };
  });

  return {
    gradeExams,
    selectedIds,
    activeTrendExams,
    trendRows,
    baseline,
    latest,
    previous,
    subjectOptions,
    subjectMatrix,
  };
};

export default function ScoreAnalysisHistoryTrend({
  exams,
  selectedGrade,
  historyCompare,
  setHistoryCompare,
  normalizeClassLayers,
  computeComprehensive,
  getExamOptionLabel,
  scopeKeyFromValue,
}) {
  const {
    gradeExams,
    selectedIds,
    trendRows,
    baseline,
    latest,
    previous,
    subjectOptions,
    subjectMatrix,
  } = buildHistoryTrendModel({
    exams,
    selectedGrade,
    historyCompare,
    normalizeClassLayers,
    computeComprehensive,
    getExamOptionLabel,
    scopeKeyFromValue,
  });
  const [activeModule, setActiveModule] = useState('overview');
  const [chartMode, setChartMode] = useState('core');
  const hasTrend = trendRows.length >= 2;
  const modules = [
    {
      value: 'setup',
      label: '筛选设置',
      desc: '选择考试、范围与学科',
      icon: Settings2,
      ready: true,
    },
    {
      value: 'overview',
      label: '趋势概览',
      desc: hasTrend ? `${trendRows.length} 次考试概览` : '至少两次考试',
      icon: CheckCircle2,
      ready: hasTrend,
    },
    {
      value: 'charts',
      label: '图表分析',
      desc: '核心指标与等级结构',
      icon: LineChartIcon,
      ready: hasTrend,
    },
    {
      value: 'matrix',
      label: '学科矩阵',
      desc: subjectMatrix.length ? `${subjectMatrix.length} 个学科变化` : '暂无学科数据',
      icon: Table2,
      ready: hasTrend && subjectMatrix.length > 0,
    },
  ];
  const isAllModules = activeModule === 'all';
  const readyModules = modules.filter(module => module.ready);
  const activeConfig = isAllModules ? null : (modules.find(module => module.value === activeModule) || modules[0]);
  const selectorModules = [
    ...modules,
    {
      value: 'all',
      label: '全面铺开',
      desc: `${readyModules.length} 个趋势板块`,
      icon: Maximize2,
      ready: readyModules.length > 1,
    },
  ];

  useEffect(() => {
    if (isAllModules) {
      if (readyModules.length <= 1) setActiveModule('setup');
      return;
    }

    if (!activeConfig.ready) {
      setActiveModule('setup');
    }
  }, [activeConfig?.ready, isAllModules, readyModules.length]);

  const renderSetup = () => (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_220px_180px]">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {gradeExams.map(exam => (
              <label key={exam.id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(Number(exam.id))}
                  onChange={(event) => {
                    setHistoryCompare(prev => {
                      const current = new Set((prev.examIds?.length ? prev.examIds : gradeExams.slice(-5).map(item => item.id)).map(Number));
                      if (event.target.checked) current.add(Number(exam.id));
                      else current.delete(Number(exam.id));
                      return { ...prev, examIds: Array.from(current) };
                    });
                  }}
                />
                <span>{getExamOptionLabel(exam)}</span>
              </label>
            ))}
          </div>
          <select
            value={historyCompare.scope}
            onChange={(event) => setHistoryCompare(prev => ({ ...prev, scope: event.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全段</option>
            <option value="layer_a">A层</option>
            <option value="layer_b">B层</option>
            <option value="layer_c">C层</option>
          </select>
          <select
            value={historyCompare.subject}
            onChange={(event) => setHistoryCompare(prev => ({ ...prev, subject: event.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部学科</option>
            {subjectOptions.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
        </div>
      </div>

      {!hasTrend && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          至少需要两次有成绩数据的考试；建议选择3次以上考试以查看稳定趋势。
        </div>
      )}
    </div>
  );

  const renderMetric = (label, value, detail, positive = true) => (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-1 text-sm text-gray-500">{label}</p>
      <p className={cx('text-2xl font-bold', positive ? 'text-green-700' : 'text-red-600')}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
  );

  const renderOverview = () => (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
      {renderMetric('考试次数', trendRows.length, '动态对比', true)}
      {renderMetric(
        '均分较基准',
        fmtTrend(latest.mean - baseline.mean),
        `${fmtTrend(baseline.mean)} → ${fmtTrend(latest.mean)}`,
        (latest.mean - baseline.mean) >= 0
      )}
      {renderMetric(
        '最近环比均分',
        fmtTrend(latest.mean - previous.mean),
        `${fmtTrend(previous.mean)} → ${fmtTrend(latest.mean)}`,
        (latest.mean - previous.mean) >= 0
      )}
      {renderMetric(
        'D等率较基准',
        `${fmtTrend(latest.dRate - baseline.dRate)}%`,
        `${fmtTrend(baseline.dRate)}% → ${fmtTrend(latest.dRate)}%`,
        (latest.dRate - baseline.dRate) <= 0
      )}
      {renderMetric(
        'Z分较基准',
        fmtTrend(latest.zScore - baseline.zScore),
        `${fmtTrend(baseline.zScore)} → ${fmtTrend(latest.zScore)}`,
        (latest.zScore - baseline.zScore) >= 0
      )}
      {renderMetric('参考人数', latest.participated, '最新考试', true)}
    </div>
  );

  const chartModes = [
    { value: 'core', label: '核心指标趋势', desc: '均分、及格率、D等率', icon: LineChartIcon },
    { value: 'levels', label: '等级结构变化', desc: 'A/B/C/D 等级比例', icon: BarChart3 },
    { value: 'all', label: '全面铺开', desc: '两类趋势同屏复核', icon: Maximize2 },
  ];
  const activeChartMode = chartModes.find(item => item.value === chartMode) || chartModes[0];

  const renderCoreTrendChart = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">多考试核心指标趋势</h3>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={trendRows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip formatter={(v) => fmtTrend(Number(v))} />
          <Legend />
          <Line type="monotone" dataKey="mean" name="均分" stroke="#2563eb" strokeWidth={2} />
          <Line type="monotone" dataKey="passRate" name="及格率" stroke="#16a34a" strokeWidth={2} />
          <Line type="monotone" dataKey="dRate" name="D等率" stroke="#dc2626" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const renderLevelTrendChart = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">等级结构变化</h3>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={trendRows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip formatter={(v) => `${fmtTrend(Number(v))}%`} />
          <Legend />
          <Bar dataKey="aRate" name="A等" stackId="grade" fill="#16a34a" />
          <Bar dataKey="bRate" name="B等" stackId="grade" fill="#2563eb" />
          <Bar dataKey="cRate" name="C等" stackId="grade" fill="#d97706" />
          <Bar dataKey="dRate" name="D等" stackId="grade" fill="#dc2626" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const renderCharts = () => (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">图表分析</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">默认显示核心指标，等级结构和全面铺开可直接切换。</p>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            当前：{activeChartMode.label}
          </span>
        </div>
        <div className="mt-4">
          <FlowModuleSelector
            title="趋势图表结果控件"
            hint="点击查看核心指标、等级结构或全面铺开"
            modules={chartModes}
            activeValue={chartMode}
            onChange={setChartMode}
            scrollTargetId="history-trend-chart-content"
          />
        </div>
      </div>

      <div id="history-trend-chart-content" className="scroll-mt-32">
        {chartMode === 'all' ? (
          <div className="space-y-5">
            <section className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">核心指标趋势</h4>
                <p className="mt-1 text-xs text-slate-500">均分、及格率、D等率</p>
              </div>
              {renderCoreTrendChart()}
            </section>
            <section className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">等级结构变化</h4>
                <p className="mt-1 text-xs text-slate-500">A/B/C/D 等级比例</p>
              </div>
              {renderLevelTrendChart()}
            </section>
          </div>
        ) : chartMode === 'levels' ? renderLevelTrendChart() : renderCoreTrendChart()}
      </div>
    </div>
  );

  const renderMatrix = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">学科均分变化矩阵（最新 - 基准）</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-3 text-left">学科</th>
              <th className="px-4 py-3 text-center">基准均分</th>
              <th className="px-4 py-3 text-center">最新均分</th>
              <th className="px-4 py-3 text-center">变化</th>
            </tr>
          </thead>
          <tbody>
            {subjectMatrix.map(row => (
              <tr key={row.subject} className="border-b border-gray-100">
                <td className="px-4 py-3 font-medium">{row.subject}</td>
                <td className="px-4 py-3 text-center">{fmtTrend(row.baseline)}</td>
                <td className="px-4 py-3 text-center">{fmtTrend(row.latest)}</td>
                <td className={`px-4 py-3 text-center font-semibold ${row.delta >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {row.delta > 0 ? '+' : ''}{fmtTrend(row.delta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderModuleContent = (moduleValue) => {
    if (moduleValue === 'charts') return renderCharts();
    if (moduleValue === 'matrix') return renderMatrix();
    if (moduleValue === 'setup') return renderSetup();
    return hasTrend ? renderOverview() : renderSetup();
  };

  const renderActiveModule = () => {
    if (isAllModules) {
      return (
        <div className="space-y-6">
          {readyModules.map(module => (
            <section key={module.value} className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{module.label}</h3>
                <p className="mt-1 text-xs text-slate-500">{module.desc}</p>
              </div>
              {renderModuleContent(module.value)}
            </section>
          ))}
        </div>
      );
    }

    return renderModuleContent(activeConfig.value);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">历史趋势工作台</h2>
            <p className="mt-1 text-sm text-gray-500">支持3次以上考试动态对比，按模块查看均分、等级结构和学科变化。</p>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            当前：{isAllModules ? '全面铺开' : activeConfig.label}
          </span>
        </div>
        <div className="mt-4">
          <FlowModuleSelector
            title="历史趋势结果控件"
            hint="点击查看概览、图表、矩阵或筛选设置"
            modules={selectorModules}
            activeValue={activeModule}
            onChange={setActiveModule}
            scrollTargetId="history-trend-module-content"
          />
        </div>
      </div>

      <div id="history-trend-module-content" className="scroll-mt-32 bg-slate-50 p-5">
        {renderActiveModule()}
      </div>
    </div>
  );
}
