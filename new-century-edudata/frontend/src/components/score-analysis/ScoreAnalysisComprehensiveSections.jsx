import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { BarChart3, BookOpen, Maximize2, PieChart as PieChartIcon, Users } from 'lucide-react';
import FlowModuleSelector from './FlowModuleSelector';

const fmt1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '0.0');
const fmtPercent = (n) => `${fmt1(n)}%`;
const toNumber = (value) => {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
};

const getLayerLabel = (layer) => {
  if (layer === 'A') return 'A层（实验班）';
  if (layer === 'B') return 'B层（创新班）';
  return 'C层（平行班）';
};

const getLayerCardClassName = (layer) => {
  if (layer === 'A') return 'border-green-200 bg-green-50';
  if (layer === 'B') return 'border-blue-200 bg-blue-50';
  return 'border-orange-200 bg-orange-50';
};

const getClassComparisonColor = (layer) => {
  if (layer === 'A') return '#10b981';
  if (layer === 'B') return '#3b82f6';
  return '#f59e0b';
};

const getClassLayerTone = (layer) => {
  if (layer === 'A') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (layer === 'B') return 'bg-blue-50 text-blue-700 border-blue-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
};

const getClassName = (item) => item.class || item.class_name || item.className || '-';

const getSubjectEvaluation = (mean) => {
  if (mean >= 80) return { label: '优秀', className: 'bg-green-100 text-green-700' };
  if (mean >= 70) return { label: '良好', className: 'bg-blue-100 text-blue-700' };
  if (mean >= 60) return { label: '及格', className: 'bg-yellow-100 text-yellow-700' };
  return { label: '需改进', className: 'bg-red-100 text-red-700' };
};

export const buildClassComparisonModel = (classComparison = []) => {
  const rows = classComparison
    .map(item => ({
      ...item,
      className: getClassName(item),
      layer: item.layer || 'C',
      mean: Number(item.mean || 0),
    }))
    .filter(item => item.className !== '-');
  const sortedByMean = [...rows].sort((a, b) => b.mean - a.mean);
  const topClass = sortedByMean[0] || null;
  const bottomClass = sortedByMean[sortedByMean.length - 1] || null;
  const layerGroups = ['A', 'B', 'C']
    .map(layer => {
      const layerRows = rows.filter(item => item.layer === layer);
      const mean = layerRows.length
        ? layerRows.reduce((sum, item) => sum + item.mean, 0) / layerRows.length
        : 0;
      const sortedLayerRows = [...layerRows].sort((a, b) => b.mean - a.mean);
      return {
        layer,
        label: getLayerLabel(layer),
        count: layerRows.length,
        mean,
        topClass: sortedLayerRows[0] || null,
        bottomClass: sortedLayerRows[sortedLayerRows.length - 1] || null,
      };
    })
    .filter(item => item.count > 0);

  return {
    rows,
    sortedByMean,
    topClass,
    bottomClass,
    spread: topClass && bottomClass ? topClass.mean - bottomClass.mean : 0,
    layerGroups,
    topRows: sortedByMean.slice(0, 3),
    attentionRows: [...sortedByMean].reverse().slice(0, 3),
  };
};

export const buildSubjectAnalysisModel = (subjectAnalysis = {}, keyMetrics = {}) => {
  const rows = Object.entries(subjectAnalysis.subject_statistics || {}).map(([subject, stats]) => {
    const mean = toNumber(stats.mean);
    const std = toNumber(stats.std);
    return {
      subject,
      mean,
      std,
      top20: toNumber(keyMetrics?.subjects?.[subject]?.top20_score),
      evaluation: getSubjectEvaluation(mean),
    };
  });
  const sortedByMean = [...rows].sort((a, b) => b.mean - a.mean);
  const sortedByStd = [...rows].sort((a, b) => b.std - a.std);

  return {
    rows,
    chartRows: subjectAnalysis.chart_data?.subject_scores || rows.map(({ subject, mean }) => ({ subject, mean })),
    stdRows: rows.map(({ subject, std }) => ({ subject, std })),
    subjectCount: rows.length,
    averageMean: rows.length ? rows.reduce((sum, item) => sum + item.mean, 0) / rows.length : 0,
    strongestSubject: sortedByMean[0] || null,
    weakestSubject: sortedByMean[sortedByMean.length - 1] || null,
    volatileSubject: sortedByStd[0] || null,
    topRows: sortedByMean.slice(0, 3),
  };
};

export const buildDistributionSummaryModel = (overall = {}) => {
  const distribution = overall.distribution || {};
  const pieData = [
    { name: '优秀', value: toNumber(distribution.excellent), color: '#10b981' },
    { name: '良好', value: toNumber(distribution.good), color: '#3b82f6' },
    { name: '及格', value: toNumber(distribution.pass), color: '#f59e0b' },
    { name: '不及格', value: toNumber(distribution.fail), color: '#ef4444' },
  ];
  const total = pieData.reduce((sum, item) => sum + item.value, 0);
  const excellentGood = toNumber(distribution.excellent) + toNumber(distribution.good);
  const passed = excellentGood + toNumber(distribution.pass);
  const bands = (overall.chart_data?.score_distribution || []).map(item => ({
    ...item,
    range: item.range || item.name || '-',
    count: toNumber(item.count || item.value),
  }));
  const dominantBand = [...bands].sort((a, b) => b.count - a.count)[0] || null;

  return {
    pieData,
    bands,
    total,
    excellentGood,
    excellentGoodRate: total ? (excellentGood / total) * 100 : 0,
    passed,
    passRate: total ? (passed / total) * 100 : 0,
    fail: toNumber(distribution.fail),
    failRate: total ? (toNumber(distribution.fail) / total) * 100 : 0,
    dominantBand,
  };
};

function SectionModeSelector({ title, description, modes, activeMode, onChange, scrollTargetId }) {
  const flowModes = modes.map(mode => ({
    ...mode,
    ready: mode.ready ?? (mode.disabled ? false : undefined),
  }));

  return (
    <FlowModuleSelector
      title={title}
      hint={description}
      modules={flowModes}
      activeValue={activeMode}
      onChange={onChange}
      showCurrent
      scrollTargetId={scrollTargetId}
    />
  );
}

export const buildLayerMetrics = ({ data, scopeKey }) => {
  const layerKeys = ['A', 'B', 'C'].filter(layer => (scopeKey === 'all' ? true : layer === scopeKey));

  return layerKeys.map(layer => {
    const scope = data?.scopes?.[layer];
    const summary = scope?.summary || {};
    const totalMetrics = scope?.key_metrics?.total || {};

    return {
      layer,
      label: getLayerLabel(layer),
      participated: summary.participated || 0,
      absence: (summary.total_students || 0) - (summary.participated || 0),
      mean: summary.grade_mean || 0,
      std: summary.grade_std || 0,
      standardScore: totalMetrics.standard_score || 0,
      top20: totalMetrics.top20_score || 0,
      top40: totalMetrics.top40_score || 0,
      bottom20: totalMetrics.top80_score || 0,
      z: totalMetrics.z_score || 0,
    };
  });
};

function LayerComparisonSection({ data, scopeKey, layerComparison }) {
  const [mode, setMode] = useState('overview');
  if (!layerComparison?.layer_statistics) return null;

  const layerMetrics = buildLayerMetrics({ data, scopeKey });
  const hasTTest = Boolean(layerComparison.t_test_results);
  const modes = [
    { value: 'overview', label: '层次概览', desc: 'A/B/C 层核心指标', icon: Users },
    { value: 'mean', label: '均分对比', desc: '单独查看各层平均分', icon: BarChart3 },
    { value: 'z', label: 'Z分对比', desc: '查看层次标准化差异', icon: BarChart3 },
    { value: 'ttest', label: '差异检验', desc: '复核层次间显著性', icon: BookOpen, disabled: !hasTTest },
  ];
  const readyModes = modes.filter(item => !item.disabled);
  const selectorModes = [
    ...modes,
    {
      value: 'all',
      label: '全面铺开',
      desc: `${readyModes.length} 个层次视图`,
      icon: Maximize2,
      disabled: readyModes.length <= 1,
    },
  ];

  const renderLayerMode = (modeValue) => {
    if (modeValue === 'overview') {
      return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {layerMetrics.map(metric => (
            <div key={metric.layer} className={`rounded-lg p-5 border-2 ${getLayerCardClassName(metric.layer)}`}>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-lg">{metric.label}</h4>
                <span className="text-sm text-gray-500">{metric.participated}人</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">平均分</span>
                  <span className="font-semibold">{fmt1(metric.mean)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">标准差</span>
                  <span className="font-semibold">{fmt1(metric.std)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">标准分</span>
                  <span className="font-semibold">{fmt1(metric.standardScore)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">前20%</span>
                  <span className="font-semibold">{fmt1(metric.top20)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">前40%</span>
                  <span className="font-semibold">{fmt1(metric.top40)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">后20%</span>
                  <span className="font-semibold">{fmt1(metric.bottom20)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">Z分</span>
                  <span className="font-semibold">{fmt1(metric.z)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">缺考</span>
                  <span className="font-semibold text-red-600">{metric.absence}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (modeValue === 'mean') {
      return (
        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="font-semibold mb-3">各层次平均分对比</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={layerMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="layer" />
              <YAxis />
              <Tooltip formatter={(value) => fmt1(Number(value))} />
              <Bar dataKey="mean" fill="#3b82f6" name="平均分" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (modeValue === 'z') {
      return (
        <div className="rounded-lg border border-slate-200 p-4">
          <h4 className="font-semibold mb-3">各层次Z分对比</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={layerMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="layer" />
              <YAxis />
              <Tooltip formatter={(value) => fmt1(Number(value))} />
              <Bar dataKey="z" fill="#10b981" name="Z分" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (modeValue === 'ttest' && hasTTest) {
      return (
        <div className="rounded-lg bg-gray-50 p-4">
          <h4 className="font-semibold mb-3">层次间差异显著性检验（T检验）</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(layerComparison.t_test_results).map(([comparison, result]) => (
              <div key={comparison} className="bg-white rounded p-3 text-sm">
                <p className="font-medium mb-1">
                  {comparison === 'A_vs_B' ? 'A层 vs B层' : comparison === 'B_vs_C' ? 'B层 vs C层' : 'A层 vs C层'}
                </p>
                <p className="text-gray-600">t值: {fmt1(result.t_statistic)}</p>
                <p className="text-gray-600">p值: {Number(result.p_value || 0).toFixed(4)}</p>
                <p className={result.significant ? 'text-green-600 font-medium' : 'text-gray-500'}>
                  {result.significant ? '差异显著' : '差异不显著'}
                </p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <Users className="w-6 h-6 text-blue-600" />
        层次对比分析
      </h3>
      <SectionModeSelector
        title="层次分析结果"
        description="点击控件查看层次概览、均分、Z分或差异检验。"
        modes={selectorModes}
        activeMode={mode}
        onChange={setMode}
        scrollTargetId="score-layer-comparison-content"
      />

      <div id="score-layer-comparison-content" className="scroll-mt-32">
        {mode === 'all' ? (
          <div className="space-y-5">
            {readyModes.map(item => (
              <section key={item.value} className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{item.label}</h4>
                  <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
                </div>
                {renderLayerMode(item.value)}
              </section>
            ))}
          </div>
        ) : renderLayerMode(mode)}
      </div>
    </div>
  );
}

function SubjectAnalysisSection({ subjectAnalysis, keyMetrics }) {
  const [mode, setMode] = useState('summary');
  if (!subjectAnalysis?.subject_statistics) return null;
  const model = buildSubjectAnalysisModel(subjectAnalysis, keyMetrics);
  const modes = [
    { value: 'summary', label: '学科摘要', desc: '强弱项和波动点', icon: BookOpen },
    { value: 'mean', label: '均分对比', desc: '查看各学科平均水平', icon: BarChart3 },
    { value: 'std', label: '离散度', desc: '查看学科波动情况', icon: BarChart3 },
    { value: 'table', label: '明细表', desc: '复核均分、标准差和目标线', icon: BookOpen },
  ];
  const selectorModes = [
    ...modes,
    {
      value: 'all',
      label: '全面铺开',
      desc: `${modes.length} 个学科视图`,
      icon: Maximize2,
    },
  ];

  const renderSubjectMetric = (label, value, hint, tone = 'slate') => {
    const toneClass = tone === 'blue'
      ? 'border-blue-100 bg-blue-50 text-blue-800'
      : tone === 'emerald'
        ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
        : tone === 'amber'
          ? 'border-amber-100 bg-amber-50 text-amber-800'
          : 'border-slate-200 bg-white text-slate-800';

    return (
      <div className={`rounded-lg border p-4 ${toneClass}`}>
        <p className="text-xs opacity-75">{label}</p>
        <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
        <p className="mt-2 text-xs opacity-75">{hint}</p>
      </div>
    );
  };

  const renderSummary = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {renderSubjectMetric('统计学科', model.subjectCount, '纳入本次综合研判', 'blue')}
        {renderSubjectMetric('学科均分', fmt1(model.averageMean), '所有学科平均水平', 'slate')}
        {renderSubjectMetric('优势学科', model.strongestSubject?.subject || '-', fmt1(model.strongestSubject?.mean), 'emerald')}
        {renderSubjectMetric('波动最大', model.volatileSubject?.subject || '-', `标准差 ${fmt1(model.volatileSubject?.std)}`, 'amber')}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-900">学科研判提示</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-xs text-slate-500">优势保持</p>
              <p className="mt-1 font-semibold text-slate-900">{model.strongestSubject?.subject || '-'}</p>
              <p className="mt-1 text-xs text-slate-500">均分 {fmt1(model.strongestSubject?.mean)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-xs text-slate-500">重点补强</p>
              <p className="mt-1 font-semibold text-slate-900">{model.weakestSubject?.subject || '-'}</p>
              <p className="mt-1 text-xs text-slate-500">均分 {fmt1(model.weakestSubject?.mean)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="text-xs text-slate-500">分层追踪</p>
              <p className="mt-1 font-semibold text-slate-900">{model.volatileSubject?.subject || '-'}</p>
              <p className="mt-1 text-xs text-slate-500">标准差 {fmt1(model.volatileSubject?.std)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <h4 className="text-sm font-semibold text-blue-900">学科速览</h4>
          <div className="mt-3 space-y-2">
            {model.topRows.map(row => (
              <div key={row.subject} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">{row.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-500">标准差 {fmt1(row.std)}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${row.evaluation.className}`}>
                  {row.evaluation.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('mean')}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
            >
              查看均分图
            </button>
            <button
              type="button"
              onClick={() => setMode('table')}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
            >
              查看明细表
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSubjectMode = (modeValue) => {
    if (modeValue === 'summary') {
      return renderSummary();
    }

    if (modeValue === 'mean') {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="font-semibold mb-3">各学科平均分</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={model.chartRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => fmt1(Number(value))} />
                <Bar dataKey="mean" fill="#8b5cf6" name="平均分" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (modeValue === 'std') {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="font-semibold mb-3">各学科标准差</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={model.stdRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" />
                <YAxis />
                <Tooltip formatter={(value) => fmt1(Number(value))} />
                <Bar dataKey="std" fill="#3b82f6" name="标准差" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (modeValue === 'table') {
      return (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
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
              {model.rows.map(row => (
                <tr key={row.subject}>
                  <td className="px-4 py-3 font-medium">{row.subject}</td>
                  <td className="px-4 py-3 text-center">{fmt1(row.mean)}</td>
                  <td className="px-4 py-3 text-center">{fmt1(row.std)}</td>
                  <td className="px-4 py-3 text-center font-semibold text-blue-700">
                    {fmt1(row.top20)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${row.evaluation.className}`}>
                      {row.evaluation.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-blue-600" />
        学科分析
      </h3>
      <SectionModeSelector
        title="学科分析结果"
        description="点击控件查看摘要、均分、离散度或明细表。"
        modes={selectorModes}
        activeMode={mode}
        onChange={setMode}
        scrollTargetId="score-subject-analysis-content"
      />

      <div id="score-subject-analysis-content" className="scroll-mt-32">
        {mode === 'all' ? (
          <div className="space-y-5">
            {modes.map(item => (
              <section key={item.value} className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{item.label}</h4>
                  <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
                </div>
                {renderSubjectMode(item.value)}
              </section>
            ))}
          </div>
        ) : renderSubjectMode(mode)}
      </div>
    </div>
  );
}

function OverallDistributionSection({ overall }) {
  const [mode, setMode] = useState('summary');
  if (!overall?.distribution) return null;
  const model = buildDistributionSummaryModel(overall);
  const modes = [
    { value: 'summary', label: '分布摘要', desc: '人数结构和关键比例', icon: BookOpen },
    { value: 'level', label: '等级结构', desc: '查看优秀、良好、及格结构', icon: PieChartIcon },
    { value: 'bands', label: '分数段统计', desc: '复核各分数段人数', icon: BarChart3 },
  ];
  const selectorModes = [
    ...modes,
    {
      value: 'all',
      label: '全面铺开',
      desc: `${modes.length} 个分布视图`,
      icon: Maximize2,
    },
  ];

  const renderDistributionMetric = (label, value, hint, tone = 'slate') => {
    const toneClass = tone === 'blue'
      ? 'border-blue-100 bg-blue-50 text-blue-800'
      : tone === 'emerald'
        ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
        : tone === 'red'
          ? 'border-red-100 bg-red-50 text-red-800'
          : 'border-slate-200 bg-white text-slate-800';

    return (
      <div className={`rounded-lg border p-4 ${toneClass}`}>
        <p className="text-xs opacity-75">{label}</p>
        <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
        <p className="mt-2 text-xs opacity-75">{hint}</p>
      </div>
    );
  };

  const renderSummary = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {renderDistributionMetric('参考人数', model.total, '本次分布统计口径', 'blue')}
        {renderDistributionMetric('优良率', fmtPercent(model.excellentGoodRate), `${model.excellentGood} 人`, 'emerald')}
        {renderDistributionMetric('及格率', fmtPercent(model.passRate), `${model.passed} 人`, 'slate')}
        {renderDistributionMetric('不及格', `${model.fail} 人`, fmtPercent(model.failRate), 'red')}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-900">等级结构速览</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            {model.pieData.map(item => {
              const rate = model.total ? (item.value / model.total) * 100 : 0;
              return (
                <div key={item.name} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-medium text-slate-900">{item.name}</span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{item.value} 人</p>
                  <p className="mt-1 text-xs text-slate-500">{fmtPercent(rate)}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <h4 className="text-sm font-semibold text-blue-900">高频分数段</h4>
          <div className="mt-3 rounded-lg bg-white p-4">
            <p className="text-xs text-slate-500">人数最多</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{model.dominantBand?.range || '-'}</p>
            <p className="mt-2 text-sm text-blue-700">{model.dominantBand ? `${model.dominantBand.count} 人` : '暂无分数段数据'}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('level')}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
            >
              查看等级结构
            </button>
            <button
              type="button"
              onClick={() => setMode('bands')}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
            >
              查看分数段
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDistributionMode = (modeValue) => {
    if (modeValue === 'summary') {
      return renderSummary();
    }

    if (modeValue === 'level') {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h4 className="font-semibold mb-3">等级结构图</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={model.pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {model.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (modeValue === 'bands') {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="font-semibold mb-3">分数段人数</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={model.bands}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" name="人数" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <PieChartIcon className="w-6 h-6 text-blue-600" />
        成绩分布
      </h3>
      <SectionModeSelector
        title="成绩分布结果"
        description="点击控件查看摘要、等级结构或分数段人数。"
        modes={selectorModes}
        activeMode={mode}
        onChange={setMode}
        scrollTargetId="score-distribution-section-content"
      />

      <div id="score-distribution-section-content" className="scroll-mt-32">
        {mode === 'all' ? (
          <div className="space-y-5">
            {modes.map(item => (
              <section key={item.value} className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">{item.label}</h4>
                  <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
                </div>
                {renderDistributionMode(item.value)}
              </section>
            ))}
          </div>
        ) : renderDistributionMode(mode)}
      </div>
    </div>
  );
}

function ClassComparisonSection({ layerComparison }) {
  const [mode, setMode] = useState('summary');
  const classComparison = layerComparison?.chart_data?.class_comparison;
  if (!classComparison) return null;
  const model = buildClassComparisonModel(classComparison);
  const modes = [
    { value: 'summary', label: '班级摘要', desc: '最高、最低和差距', icon: BookOpen },
    { value: 'chart', label: '均分图', desc: '横向查看所有班级', icon: BarChart3 },
    { value: 'layers', label: '层次分组', desc: '按A/B/C层汇总班级', icon: Users },
    { value: 'all', label: '全面铺开', desc: '摘要、图表和分组同屏', icon: Maximize2 },
  ];

  const renderClassBadge = (row) => (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getClassLayerTone(row.layer)}`}>
      {getLayerLabel(row.layer)}
    </span>
  );

  const renderMetric = (label, value, hint, tone = 'slate') => {
    const toneClass = tone === 'blue'
      ? 'border-blue-100 bg-blue-50 text-blue-800'
      : tone === 'emerald'
        ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
        : tone === 'amber'
          ? 'border-amber-100 bg-amber-50 text-amber-800'
          : 'border-slate-200 bg-white text-slate-800';

    return (
      <div className={`rounded-lg border p-4 ${toneClass}`}>
        <p className="text-xs opacity-75">{label}</p>
        <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
        <p className="mt-2 text-xs opacity-75">{hint}</p>
      </div>
    );
  };

  const renderClassList = (title, rows, tone) => (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <div className="mt-3 space-y-2">
        {rows.length > 0 ? rows.map(row => (
          <div key={`${title}-${row.className}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{row.className}</p>
              <p className="mt-0.5 text-xs text-slate-500">{getLayerLabel(row.layer)}</p>
            </div>
            <span className={tone === 'attention' ? 'font-semibold text-amber-700' : 'font-semibold text-blue-700'}>
              {fmt1(row.mean)}
            </span>
          </div>
        )) : (
          <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">暂无班级数据</p>
        )}
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {renderMetric('参与班级', model.rows.length, '本次横向对比范围', 'blue')}
        {renderMetric('最高均分', fmt1(model.topClass?.mean), model.topClass?.className || '-', 'emerald')}
        {renderMetric('最低均分', fmt1(model.bottomClass?.mean), model.bottomClass?.className || '-', 'amber')}
        {renderMetric('班级差距', fmt1(model.spread), '最高与最低均分差', 'slate')}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 md:grid-cols-2">
          {renderClassList('高位班级 Top3', model.topRows, 'top')}
          {renderClassList('需关注班级 Bottom3', model.attentionRows, 'attention')}
        </div>
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <h4 className="text-sm font-semibold text-blue-900">层次覆盖</h4>
          <div className="mt-3 space-y-2">
            {model.layerGroups.map(group => (
              <div key={group.layer} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                <span className="font-medium text-slate-900">{group.label}</span>
                <span className="text-blue-700">{group.count} 班 · 均分 {fmt1(group.mean)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode('chart')}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
            >
              查看均分图
            </button>
            <button
              type="button"
              onClick={() => setMode('layers')}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
            >
              查看层次分组
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderChart = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">各班平均分横向对比</h4>
          <p className="mt-1 text-xs text-slate-500">颜色对应班级层次，适合教研会横向查看。</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={classComparison}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="class" />
          <YAxis />
          <Tooltip formatter={(value) => fmt1(Number(value))} />
          <Legend />
          <Bar dataKey="mean" name="平均分" fill="#3b82f6">
            {classComparison.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getClassComparisonColor(entry.layer)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-green-500" /> A层（实验班）
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-blue-500" /> B层（创新班）
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-yellow-500" /> C层（平行班）
        </span>
      </div>
    </div>
  );

  const renderLayerGroups = () => (
    <div className="grid gap-4 md:grid-cols-3">
      {model.layerGroups.map(group => (
        <div key={group.layer} className={`rounded-lg border p-4 ${getLayerCardClassName(group.layer)}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-slate-900">{group.label}</h4>
              <p className="mt-1 text-xs text-slate-500">{group.count} 个班级</p>
            </div>
            {renderClassBadge(group)}
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600">层内均分</span>
              <span className="font-semibold text-slate-900">{fmt1(group.mean)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600">最高班级</span>
              <span className="font-semibold text-slate-900">{group.topClass?.className || '-'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600">最低班级</span>
              <span className="font-semibold text-slate-900">{group.bottomClass?.className || '-'}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActiveMode = () => {
    if (mode === 'chart') return renderChart();
    if (mode === 'layers') return renderLayerGroups();
    if (mode === 'all') {
      return (
        <div className="space-y-5">
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">班级摘要</h4>
            {renderSummary()}
          </section>
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">均分图</h4>
            {renderChart()}
          </section>
          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-900">层次分组</h4>
            {renderLayerGroups()}
          </section>
        </div>
      );
    }
    return renderSummary();
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h3 className="mb-6 flex items-center gap-2 text-xl font-bold">
        <BarChart3 className="h-6 w-6 text-blue-600" />
        班级对比
      </h3>
      <SectionModeSelector
        title="班级对比结果"
        description="点击控件查看摘要、均分图或层次分组。"
        modes={modes}
        activeMode={mode}
        onChange={setMode}
        scrollTargetId="score-class-comparison-content"
      />

      <div id="score-class-comparison-content" className="scroll-mt-32">
        {renderActiveMode()}
      </div>
    </div>
  );
}

export default function ScoreAnalysisComprehensiveSections({
  analysisType,
  data,
  scopeKey,
  layerComparison,
  subjectAnalysis,
  overall,
  keyMetrics,
}) {
  const defaultModule = useMemo(() => {
    if (analysisType === 'layer_comparison') return 'layers';
    if (analysisType === 'subject_analysis') return 'subjects';
    if (analysisType === 'overall') return 'distribution';
    return 'class-comparison';
  }, [analysisType]);
  const [activeModule, setActiveModule] = useState(defaultModule);
  const modules = useMemo(() => ([
    {
      value: 'distribution',
      label: '成绩分布',
      desc: '等级结构与分数段',
      icon: PieChartIcon,
      ready: Boolean(overall?.distribution),
    },
    {
      value: 'subjects',
      label: '学科分析',
      desc: '均分、离散度与目标线',
      icon: BookOpen,
      ready: Boolean(subjectAnalysis?.subject_statistics),
    },
    {
      value: 'layers',
      label: '层次对比',
      desc: 'A/B/C层结构对照',
      icon: Users,
      ready: Boolean(layerComparison?.layer_statistics),
    },
    {
      value: 'class-comparison',
      label: '班级对比',
      desc: '各班均分横向查看',
      icon: BarChart3,
      ready: Boolean(layerComparison?.chart_data?.class_comparison),
    },
  ]), [layerComparison, overall, subjectAnalysis]);
  const isAllModules = activeModule === 'all';
  const readyModules = modules.filter(module => module.ready);
  const readyModuleCount = readyModules.length;
  const preferredReadyModule = modules.find(module => module.value === defaultModule && module.ready);
  const fallbackModuleValue = preferredReadyModule?.value || readyModules[0]?.value || defaultModule;
  const selectedModule = isAllModules ? null : (modules.find(module => module.value === activeModule) || modules[0]);
  const selectorModules = [
    ...modules,
    {
      value: 'all',
      label: '全面铺开',
      desc: `${readyModuleCount} 个研判主题`,
      icon: Maximize2,
      ready: readyModuleCount > 1,
    },
  ];

  useEffect(() => {
    if (isAllModules) {
      if (readyModuleCount <= 1) setActiveModule(fallbackModuleValue);
      return;
    }

    if (!selectedModule?.ready) {
      setActiveModule(fallbackModuleValue);
    }
  }, [fallbackModuleValue, isAllModules, readyModuleCount, selectedModule?.ready]);

  const renderModuleContent = (moduleValue) => {
    if (moduleValue === 'layers') {
      return (
        <LayerComparisonSection
          data={data}
          scopeKey={scopeKey}
          layerComparison={layerComparison}
        />
      );
    }

    if (moduleValue === 'subjects') {
      return <SubjectAnalysisSection subjectAnalysis={subjectAnalysis} keyMetrics={keyMetrics} />;
    }

    if (moduleValue === 'distribution') {
      return <OverallDistributionSection overall={overall} />;
    }

    return <ClassComparisonSection layerComparison={layerComparison} />;
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

    return renderModuleContent(selectedModule.value);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">综合研判结果显示</h2>
            <p className="mt-1 text-xs text-slate-500">点击主题控件显示对应结果，必要时再全面铺开。</p>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            当前：{isAllModules ? '全面铺开' : (selectedModule?.label || '-')}
          </span>
        </div>
        <div className="mt-4">
          <FlowModuleSelector
            title="综合研判结果控件"
            hint="点选主题显示结果"
            modules={selectorModules}
            activeValue={activeModule}
            onChange={setActiveModule}
            scrollTargetId="score-comprehensive-sections-content"
          />
        </div>
      </div>

      <div id="score-comprehensive-sections-content" className="scroll-mt-32 bg-slate-50 p-5">
        {renderActiveModule()}
      </div>
    </div>
  );
}
