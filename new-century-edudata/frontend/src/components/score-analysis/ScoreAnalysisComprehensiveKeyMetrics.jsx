import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, FileText, Gauge, ListChecks, Maximize2, Table2 } from 'lucide-react';
import FlowModuleSelector from './FlowModuleSelector';

const fmt1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '0.0');
const fmtPct = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '0.0');
const cx = (...items) => items.filter(Boolean).join(' ');
const MODULE_FLOW = ['snapshot', 'thresholds', 'subjects', 'ranks', 'all'];
const RANK_FLOW = ['locator', 'curve', 'bands', 'all'];

export const buildRankCurveData = (validTotalsSorted = []) => {
  const n = validTotalsSorted.length;
  if (!n) return [];

  const step = Math.max(1, Math.ceil(n / 200));
  const rows = [];
  for (let index = 0; index < n; index += step) {
    rows.push({ rank: index + 1, score: validTotalsSorted[index] });
  }

  if (rows.length === 0 || rows[rows.length - 1].rank !== n) {
    rows.push({ rank: n, score: validTotalsSorted[n - 1] });
  }

  return rows;
};

export default function ScoreAnalysisComprehensiveKeyMetrics({
  data,
  scopeKey,
  summary = {},
  keyMetrics = {},
  examScores = [],
  selectedExam,
}) {
  const [activeModule, setActiveModule] = useState('snapshot');
  const [rankView, setRankView] = useState('locator');
  const [rankFocus, setRankFocus] = useState(0);
  const [unlockedModuleIndex, setUnlockedModuleIndex] = useState(0);
  const [unlockedRankViewIndex, setUnlockedRankViewIndex] = useState(0);
  const validTotalsSorted = useMemo(() => (
    (examScores || [])
      .map(score => Number(score.total_score || 0))
      .filter(score => Number.isFinite(score) && score > 0)
      .sort((a, b) => b - a)
  ), [examScores]);
  const participated = validTotalsSorted.length;
  const safeRank = participated ? Math.min(Math.max(Number(rankFocus || 0) || 0, 1), participated) : 0;
  const scoreAtRank = safeRank ? (validTotalsSorted[safeRank - 1] ?? 0) : 0;
  const percentAtRank = participated ? (safeRank / participated * 100) : 0;
  const top20Rank = keyMetrics?.total?.top20_rank || (participated ? Math.ceil(participated * 0.2) : 0);
  const top20Score = keyMetrics?.total?.top20_score || (top20Rank ? (validTotalsSorted[top20Rank - 1] ?? 0) : 0);
  const subjectsForTable = (selectedExam?.subjects || []).filter(Boolean);
  const rankCurveData = buildRankCurveData(validTotalsSorted);
  const absentCount = Math.max(0, (summary.total_students || 0) - (summary.participated || 0));
  const scopeLabel = scopeKey === 'all'
    ? '全部'
    : `${scopeKey}层（${scopeKey === 'A' ? '实验班' : scopeKey === 'B' ? '创新班' : '平行班'}）`;
  const goToModule = useCallback((nextModule) => {
    if (nextModule === activeModule) return;

    const nextIndex = MODULE_FLOW.indexOf(nextModule);
    if (nextIndex === -1 || nextIndex > unlockedModuleIndex + 1) return;

    if (nextModule !== 'all') {
      setUnlockedModuleIndex(current => Math.max(current, nextIndex));
    }
    if (nextModule === 'ranks') {
      setRankView('locator');
      setUnlockedRankViewIndex(0);
    }
    setActiveModule(nextModule);
  }, [activeModule, unlockedModuleIndex]);

  const goToRankView = useCallback((nextView) => {
    if (nextView === rankView) return;

    const nextIndex = RANK_FLOW.indexOf(nextView);
    if (nextIndex === -1 || nextIndex > unlockedRankViewIndex + 1) return;

    if (nextView !== 'all') {
      setUnlockedRankViewIndex(current => Math.max(current, nextIndex));
    }
    setRankView(nextView);
  }, [rankView, unlockedRankViewIndex]);

  const modules = [
    {
      value: 'snapshot',
      label: '报告摘要',
      desc: '考试、范围与关键结论',
      icon: FileText,
    },
    {
      value: 'thresholds',
      label: '阈值定位',
      desc: '前20%、前40%、后20%',
      icon: Gauge,
    },
    {
      value: 'subjects',
      label: '学科数值表',
      desc: `${subjectsForTable.length || 0} 个学科明细`,
      icon: Table2,
    },
    {
      value: 'ranks',
      label: '总分名次分数段',
      desc: participated ? `${participated} 人排名曲线` : '暂无排名数据',
      icon: BarChart3,
    },
  ];
  const isAllModules = activeModule === 'all';
  const activeConfig = isAllModules ? null : (modules.find(module => module.value === activeModule) || modules[0]);
  const selectorModules = [
    ...modules,
    {
      value: 'all',
      label: '全面铺开',
      desc: `${modules.length} 个指标板块`,
      icon: Maximize2,
    },
  ].map((module, index) => ({
    ...module,
    ready: index <= unlockedModuleIndex + 1,
  }));
  const rankViews = [
    {
      value: 'locator',
      label: '名次定位',
      desc: '先拖动名次，确认对应总分',
      icon: Gauge,
    },
    {
      value: 'curve',
      label: '曲线图',
      desc: '查看总分随名次的变化',
      icon: BarChart3,
    },
    {
      value: 'bands',
      label: '分数段表',
      desc: '按名次段核对分数',
      icon: Table2,
    },
    {
      value: 'all',
      label: '全面铺开',
      desc: '定位、曲线和表格同屏',
      icon: Maximize2,
    },
  ].map((view, index) => ({
    ...view,
    ready: index <= unlockedRankViewIndex + 1,
  }));
  const activeRankView = rankViews.find(view => view.value === rankView) || rankViews[0];

  useEffect(() => {
    setRankFocus(prev => (prev > 0 ? Math.min(prev, summary?.participated || prev) : top20Rank));
  }, [summary?.participated, top20Rank]);

  const valueTone = {
    blue: 'text-blue-700 bg-blue-50 border-blue-100',
    indigo: 'text-indigo-700 bg-indigo-50 border-indigo-100',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    orange: 'text-orange-700 bg-orange-50 border-orange-100',
    red: 'text-red-700 bg-red-50 border-red-100',
    slate: 'text-slate-700 bg-slate-50 border-slate-200',
  };

  const renderValueCard = ({ label, value, detail, tone = 'blue' }) => (
    <div className={cx('rounded-lg border p-4', valueTone[tone] || valueTone.blue)}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );

  const renderSnapshot = () => (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold text-blue-600">综合分析报告</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">{data.exam_name} - 综合分析报告</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">年级</p>
              <p className="mt-1 font-medium text-slate-800">{data.grade_level}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">范围</p>
              <p className="mt-1 font-medium text-slate-800">{scopeLabel}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">分析时间</p>
              <p className="mt-1 font-medium text-slate-800">{new Date(data.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">参与人数</p>
              <p className="mt-1 font-medium text-slate-800">{summary.participated}/{summary.total_students}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-center gap-2 text-blue-800">
            <ListChecks className="h-4 w-4" />
            <h3 className="font-semibold">结果提示</h3>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            摘要默认显示，阈值、学科数值表和名次分数段可按需点开。
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {renderValueCard({ label: '年级平均分', value: fmt1(summary.grade_mean), detail: `标准差 ${fmt1(summary.grade_std)}`, tone: 'blue' })}
        {renderValueCard({ label: 'Z分', value: fmt1(keyMetrics?.total?.z_score), detail: `标准分 ${fmt1(keyMetrics?.total?.standard_score)}`, tone: 'emerald' })}
        {renderValueCard({ label: '前20%分数线', value: fmt1(keyMetrics?.total?.top20_score), detail: `名次 ${top20Rank || '-'}`, tone: 'indigo' })}
        {renderValueCard({ label: '缺考人数', value: absentCount, detail: `应考 ${summary.total_students || 0} 人`, tone: absentCount > 0 ? 'red' : 'slate' })}
      </div>
    </div>
  );

  const renderThresholds = () => (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {renderValueCard({ label: '标准分', value: fmt1(keyMetrics?.total?.standard_score), detail: '综合换算结果', tone: 'indigo' })}
      {renderValueCard({ label: '优秀分', value: fmt1(keyMetrics?.total?.top20_score), detail: '前20%分数线', tone: 'blue' })}
      {renderValueCard({ label: '前40%分数线', value: fmt1(keyMetrics?.total?.top40_score), detail: '用于中上段定位', tone: 'emerald' })}
      {renderValueCard({ label: '后20%分数线', value: fmt1(keyMetrics?.total?.top80_score), detail: '薄弱学生识别线', tone: 'orange' })}
    </div>
  );

  const renderSubjectTable = () => (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left">指标</th>
            {subjectsForTable.map(subject => (
              <th key={subject} className="px-4 py-3 text-center">{subject}</th>
            ))}
            <th className="px-4 py-3 text-center">总分（统计维度）</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          <tr>
            <td className="px-4 py-3 font-medium text-gray-700">最高分</td>
            {subjectsForTable.map(subject => (
              <td key={subject} className="px-4 py-3 text-center">{fmt1(keyMetrics?.subjects?.[subject]?.max)}</td>
            ))}
            <td className="px-4 py-3 text-center">{fmt1(keyMetrics?.total?.max)}</td>
          </tr>
          <tr className="bg-blue-50/40">
            <td className="px-4 py-3 font-medium text-gray-700">优秀分（前20%分数线）</td>
            {subjectsForTable.map(subject => (
              <td key={subject} className="px-4 py-3 text-center font-semibold text-blue-700">{fmt1(keyMetrics?.subjects?.[subject]?.top20_score)}</td>
            ))}
            <td className="px-4 py-3 text-center font-semibold text-blue-700">{fmt1(keyMetrics?.total?.top20_score)}</td>
          </tr>
          <tr>
            <td className="px-4 py-3 font-medium text-gray-700">平均分</td>
            {subjectsForTable.map(subject => (
              <td key={subject} className="px-4 py-3 text-center">{fmt1(keyMetrics?.subjects?.[subject]?.mean)}</td>
            ))}
            <td className="px-4 py-3 text-center">{fmt1(keyMetrics?.total?.mean)}</td>
          </tr>
          <tr>
            <td className="px-4 py-3 font-medium text-gray-700">卷面分</td>
            {subjectsForTable.map(subject => (
              <td key={subject} className="px-4 py-3 text-center">{fmt1(keyMetrics?.subjects?.[subject]?.full_score)}</td>
            ))}
            <td className="px-4 py-3 text-center">{fmt1(keyMetrics?.total?.full_score)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const renderRankPanel = ({ forceExpanded = false } = {}) => {
    const effectiveRankView = forceExpanded ? 'all' : rankView;
    const effectiveActiveView = forceExpanded ? rankViews[rankViews.length - 1] : activeRankView;

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">名次工具</h3>
              <p className="mt-1 text-xs text-slate-500">输入名次即可定位分数，曲线和分数段表可直接点开。</p>
            </div>
            <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              当前：{effectiveActiveView.label}
            </span>
          </div>
          <div className="mt-4">
            <FlowModuleSelector
              title="名次工具结果控件"
              hint="点击查看定位、曲线、分数段或全面铺开"
              modules={rankViews}
              activeValue={effectiveRankView}
              onChange={goToRankView}
              scrollTargetId="score-rank-tool-content"
            />
          </div>
        </div>

        <div id="score-rank-tool-content" className="scroll-mt-32 space-y-4">
          {(effectiveRankView === 'locator' || effectiveRankView === 'all') && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {renderValueCard({ label: '名次', value: safeRank || '-', detail: `实考人数 ${participated || 0}`, tone: 'slate' })}
                {renderValueCard({ label: '对应总分', value: safeRank ? fmt1(scoreAtRank) : '-', detail: `约前 ${fmtPct(percentAtRank)}%`, tone: 'blue' })}
                {renderValueCard({ label: '优秀分（前20%）', value: top20Rank ? fmt1(top20Score) : '-', detail: `名次 ${top20Rank || '-'}`, tone: 'indigo' })}
              </div>

              {participated > 0 && (
                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 md:flex-row md:items-center">
                  <input
                    type="range"
                    min={1}
                    max={participated}
                    value={safeRank || 1}
                    onChange={(event) => setRankFocus(parseInt(event.target.value, 10))}
                    className="w-full"
                  />
                  <div className="flex flex-wrap gap-2">
                    {[50, 100, 150, 200, 250, 300, 350, 400].filter(rank => rank <= participated).map(rank => (
                      <button
                        key={rank}
                        type="button"
                        onClick={() => setRankFocus(rank)}
                        className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200"
                      >
                        {rank}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setRankFocus(participated)}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200"
                    >
                      {participated}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(effectiveRankView === 'curve' || effectiveRankView === 'bands' || effectiveRankView === 'all') && (
            <div className={cx('grid grid-cols-1 gap-6', effectiveRankView === 'all' && 'md:grid-cols-2')}>
              {(effectiveRankView === 'curve' || effectiveRankView === 'all') && (
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <h4 className="mb-3 font-semibold">总分名次-分数曲线</h4>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={rankCurveData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="rank" />
                      <YAxis />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const value = payload[0]?.value;
                          return (
                            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
                              <div className="text-sm font-semibold text-gray-900">名次：{label}</div>
                              <div className="mt-1 text-sm font-semibold text-blue-600">总分：{fmt1(Number(value))}</div>
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
              )}

              {(effectiveRankView === 'bands' || effectiveRankView === 'all') && (
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-4">
                  <h4 className="mb-3 font-semibold">总分排名分数段</h4>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-200">
                      {(() => {
                        const bands = keyMetrics?.rank_bands?.total || [];
                        const rows = [];
                        for (let index = 0; index < bands.length; index += 8) {
                          rows.push(bands.slice(index, index + 8));
                        }
                        return rows.map((row, index) => (
                          <React.Fragment key={index}>
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
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderModuleContent = (moduleValue, options = {}) => {
    if (moduleValue === 'thresholds') return renderThresholds();
    if (moduleValue === 'subjects') return renderSubjectTable();
    if (moduleValue === 'ranks') return renderRankPanel(options);
    return renderSnapshot();
  };

  const renderActiveModule = () => {
    if (isAllModules) {
      return (
        <div className="space-y-6">
          {modules.map(module => (
            <section key={module.value} className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{module.label}</h3>
                <p className="mt-1 text-xs text-slate-500">{module.desc}</p>
              </div>
              {renderModuleContent(module.value, { forceExpanded: true })}
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
            <h2 className="text-lg font-semibold text-slate-900">核心指标结果台</h2>
            <p className="mt-1 text-xs text-slate-500">默认显示摘要，阈值、学科明细和名次工具可直接点开。</p>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            当前：{isAllModules ? '全面铺开' : activeConfig.label}
          </span>
        </div>
        <div className="mt-4">
          <FlowModuleSelector
            title="核心指标结果控件"
            hint="点击查看摘要、阈值、学科明细或名次工具"
            modules={selectorModules}
            activeValue={activeModule}
            onChange={goToModule}
            scrollTargetId="score-key-metrics-content"
          />
        </div>
      </div>

      <div id="score-key-metrics-content" className="scroll-mt-32 bg-slate-50 p-5">
        {renderActiveModule()}
      </div>
    </div>
  );
}
