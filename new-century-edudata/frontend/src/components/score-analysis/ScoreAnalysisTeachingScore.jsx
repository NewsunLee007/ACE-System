import React, { useCallback, useState } from 'react';
import { Award, BarChart3, ListChecks, Maximize2, Table2, Target } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import FlowModuleSelector from './FlowModuleSelector';

const fmt1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '0.0');
const fmt2 = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '0.00');
const cx = (...items) => items.filter(Boolean).join(' ');
const MODULE_FLOW = ['summary', 'ranking', 'details', 'benchmarks', 'all'];
const RANKING_FLOW = ['overview', 'full', 'all'];

export const buildTeachingScoreSummaryModel = (teachingScore = {}) => {
  const rows = [...(teachingScore.class_rows || [])].sort((a, b) => Number(a.rank || 9999) - Number(b.rank || 9999));
  const topRows = rows.slice(0, 5);
  const attentionRows = rows.slice(-3).reverse();
  const topScore = Number(topRows[0]?.comprehensive_score || 0);
  const secondScore = Number(topRows[1]?.comprehensive_score || 0);
  const bottomScore = Number(rows[rows.length - 1]?.comprehensive_score || 0);

  return {
    rows,
    topRows,
    attentionRows,
    topClass: teachingScore.summary?.top_class || topRows[0] || null,
    rankedCount: teachingScore.summary?.ranked_count || rows.length,
    averageScore: Number(teachingScore.summary?.average_score || 0),
    subjectCount: (teachingScore.subjects || []).length,
    topGap: topRows.length > 1 ? topScore - secondScore : 0,
    spread: rows.length > 1 ? topScore - bottomScore : 0,
  };
};

export default function ScoreAnalysisTeachingScore({ teachingScore }) {
  const [module, setModule] = useState('summary');
  const [rankingView, setRankingView] = useState('overview');
  const subjects = teachingScore?.subjects || [];
  const rows = teachingScore?.class_rows || [];

  const goToModule = useCallback((nextModule) => {
    if (nextModule === module) return;

    const nextIndex = MODULE_FLOW.indexOf(nextModule);
    if (nextIndex === -1) return;

    if (nextModule === 'ranking') {
      setRankingView('overview');
    }
    setModule(nextModule);
  }, [module]);

  const goToRankingView = useCallback((nextView) => {
    if (nextView === rankingView) return;

    const nextIndex = RANKING_FLOW.indexOf(nextView);
    if (nextIndex === -1) return;

    setRankingView(nextView);
  }, [rankingView]);

  if (!teachingScore || rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
        暂无可计算的教学积分数据。请确认该考试已有班级成绩，且至少包含语文、数学、英语、科学等参与科目。
      </div>
    );
  }

  const summaryModel = buildTeachingScoreSummaryModel(teachingScore);
  const topRows = summaryModel.topRows;
  const modules = [
    {
      value: 'summary',
      label: '积分摘要',
      desc: '排名结论和关注班级',
      icon: Award,
    },
    {
      value: 'ranking',
      label: '排名概览',
      desc: '综合积分与前列班级',
      icon: BarChart3,
    },
    {
      value: 'details',
      label: '单科明细',
      desc: '均分、三率与积分拆解',
      icon: ListChecks,
    },
    {
      value: 'benchmarks',
      label: '基准口径',
      desc: '年级最高班折算基准',
      icon: Target,
    },
  ];
  const isAllModules = module === 'all';
  const activeModule = isAllModules ? null : (modules.find(item => item.value === module) || modules[0]);
  const selectorModules = [
    ...modules,
    {
      value: 'all',
      label: '全面铺开',
      desc: `${modules.length} 个积分板块`,
      icon: Maximize2,
    },
  ].map((item) => ({
    ...item,
    ready: true,
  }));
  const rankingViews = [
    {
      value: 'overview',
      label: '前列概览',
      desc: '只看第一梯队与图表',
      icon: BarChart3,
    },
    {
      value: 'full',
      label: '完整排名',
      desc: `${rows.length} 个班级全量复核`,
      icon: Table2,
    },
    {
      value: 'all',
      label: '全面铺开',
      desc: '概览和排名同时查看',
      icon: Maximize2,
    },
  ].map((item) => ({
    ...item,
    ready: true,
  }));
  const activeRankingView = rankingViews.find(item => item.value === rankingView) || rankingViews[0];

  const renderMetric = (label, value, detail, tone = 'slate') => {
    const toneClasses = {
      slate: 'border-slate-200 bg-slate-50 text-slate-900',
      blue: 'border-blue-200 bg-blue-50 text-blue-800',
      emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      violet: 'border-violet-200 bg-violet-50 text-violet-800',
    };

    return (
      <div className={cx('rounded-lg border p-4', toneClasses[tone] || toneClasses.slate)}>
        <p className="text-sm opacity-80">{label}</p>
        <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
        {detail && <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>}
      </div>
    );
  };

  const renderClassList = (title, listRows, tone = 'blue') => (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      <div className="mt-3 space-y-2">
        {listRows.map(row => (
          <div key={`${title}-${row.class_id}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">
                {row.rank}. {row.class_name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {row.layer_code || '-'}层 · 有效科目 {row.valid_subject_count}
              </p>
            </div>
            <span className={tone === 'attention' ? 'font-semibold text-amber-700' : 'font-semibold text-blue-700'}>
              {fmt2(row.comprehensive_score)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {renderMetric('参与班级', summaryModel.rankedCount, '按班级相对比较')}
        {renderMetric('最高综合积分', fmt2(summaryModel.topClass?.comprehensive_score || 0), summaryModel.topClass?.class_name || '-', 'blue')}
        {renderMetric('第一差距', fmt2(summaryModel.topGap), '第1名与第2名积分差', 'emerald')}
        {renderMetric('参与科目', summaryModel.subjectCount, '含考试配置科目', 'violet')}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 md:grid-cols-2">
          {renderClassList('第一梯队 Top5', summaryModel.topRows, 'top')}
          {renderClassList('需关注班级 Bottom3', summaryModel.attentionRows, 'attention')}
        </div>
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <h4 className="text-sm font-semibold text-blue-900">教务研判路径</h4>
          <div className="mt-3 space-y-3 text-sm text-blue-900">
            <div className="rounded-lg bg-white p-3">
              <p className="font-medium">先判梯队</p>
              <p className="mt-1 text-xs text-blue-700">看第一梯队和末端班级，再决定是否展开全量排名。</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="font-medium">再查成因</p>
              <p className="mt-1 text-xs text-blue-700">需要解释积分来源时，进入单科明细或基准口径。</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => goToModule('ranking')}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
            >
              进入排名概览
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRankingTable = () => (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-3 text-center">排名</th>
            <th className="px-3 py-3 text-left">班级</th>
            <th className="px-3 py-3 text-center">层次</th>
            <th className="px-3 py-3 text-center">综合积分</th>
            <th className="px-3 py-3 text-center">有效科目</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map(row => (
            <tr key={row.class_id} className={row.rank <= 3 ? 'bg-blue-50/50' : ''}>
              <td className="px-3 py-3 text-center font-semibold">{row.rank}</td>
              <td className="px-3 py-3 font-medium text-slate-800">{row.class_name}</td>
              <td className="px-3 py-3 text-center">{row.layer_code || '-'}</td>
              <td className="px-3 py-3 text-center font-bold text-blue-700">{fmt2(row.comprehensive_score)}</td>
              <td className="px-3 py-3 text-center">{row.valid_subject_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderRankingOverview = () => (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-lg border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">前五班级积分走势</h4>
            <p className="mt-1 text-xs text-slate-500">第一梯队差距默认显示，全量排名可直接点开。</p>
          </div>
          <button
            type="button"
            onClick={() => goToRankingView('full')}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Table2 className="h-3.5 w-3.5" />
            查看完整排名
          </button>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topRows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="class_name" />
            <YAxis domain={[0, 65]} />
            <Tooltip formatter={(value) => fmt2(Number(value))} />
            <Bar dataKey="comprehensive_score" name="综合积分" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
        <h4 className="text-sm font-semibold text-blue-900">第一梯队</h4>
        <p className="mt-1 text-xs text-blue-700">默认只列出前五名，减少整页表格噪音。</p>
        <div className="mt-4 space-y-3">
          {topRows.map(row => (
            <div key={row.class_id} className="rounded-lg bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {row.rank}. {row.class_name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.layer_code || '-'}层 · 有效科目 {row.valid_subject_count}
                  </p>
                </div>
                <span className="text-lg font-bold text-blue-700">{fmt2(row.comprehensive_score)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderRanking = (expandAll = false) => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {renderMetric('参与班级', teachingScore.summary.ranked_count, '按班级相对比较')}
        {renderMetric('最高综合积分', fmt2(teachingScore.summary.top_class?.comprehensive_score || 0), teachingScore.summary.top_class?.class_name || '-', 'blue')}
        {renderMetric('班级平均积分', fmt2(teachingScore.summary.average_score), '单科满分65，综合取均值', 'emerald')}
        {renderMetric('参与科目', subjects.length, '含考试配置科目', 'violet')}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">教学积分综合排名</h3>
            <p className="mt-1 text-sm text-slate-500">平均分35分、优秀率15分、合格率15分；每科相对年级最高班折算。</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              A等90% / B等80% / C等60%
            </div>
            <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              当前：{expandAll ? '全面铺开' : activeRankingView.label}
            </div>
          </div>
        </div>

        <div className="mb-5">
          <FlowModuleSelector
            title="积分排名结果控件"
            hint="点击查看前列、完整排名或全面铺开"
            modules={rankingViews}
            activeValue={expandAll ? 'all' : rankingView}
            onChange={goToRankingView}
            scrollTargetId="teaching-ranking-content"
          />
        </div>

        <div id="teaching-ranking-content" className="scroll-mt-32">
          {expandAll || rankingView === 'all' ? (
            <div className="space-y-5">
              {renderRankingOverview()}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">完整班级排名</h4>
                {renderRankingTable()}
              </div>
            </div>
          ) : rankingView === 'full' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-slate-900">完整班级排名</h4>
                <button
                  type="button"
                  onClick={() => goToRankingView('overview')}
                  className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                >
                  返回前列概览
                </button>
              </div>
              {renderRankingTable()}
            </div>
          ) : renderRankingOverview()}
        </div>
      </div>
    </div>
  );

  const renderDetails = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">单科积分明细</h3>
        <p className="mt-1 text-sm text-slate-500">按班级展开各科均分、优秀率、B等率、合格率和单科积分。</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-3 text-left">班级</th>
              {subjects.map(subject => (
                <th key={subject} className="px-3 py-3 text-center" colSpan={5}>
                  {subject}
                  <div className="mt-1 font-normal text-slate-500">
                    满分{fmt1(teachingScore.full_scores[subject])} / A≥{fmt1(teachingScore.thresholds[subject]?.excellent)} / B≥{fmt1(teachingScore.thresholds[subject]?.good)} / C≥{fmt1(teachingScore.thresholds[subject]?.pass)}
                  </div>
                </th>
              ))}
            </tr>
            <tr className="bg-slate-100">
              <th className="px-3 py-2"></th>
              {subjects.map(subject => (
                <React.Fragment key={`${subject}-subhead`}>
                  <th className="px-3 py-2 text-center">均分</th>
                  <th className="px-3 py-2 text-center">优秀率</th>
                  <th className="px-3 py-2 text-center">B等率</th>
                  <th className="px-3 py-2 text-center">合格率</th>
                  <th className="px-3 py-2 text-center">积分</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map(row => (
              <tr key={row.class_id}>
                <td className="whitespace-nowrap px-3 py-3 font-medium">{row.class_name}</td>
                {subjects.map(subject => {
                  const metric = row.subject_metrics[subject] || {};
                  return (
                    <React.Fragment key={`${row.class_id}-${subject}`}>
                      <td className="px-3 py-3 text-center">{fmt1(metric.mean)}</td>
                      <td className="px-3 py-3 text-center">{fmt1(metric.excellent_rate)}%</td>
                      <td className="px-3 py-3 text-center">{fmt1(metric.good_rate)}%</td>
                      <td className="px-3 py-3 text-center">{fmt1(metric.pass_rate)}%</td>
                      <td className="px-3 py-3 text-center font-semibold text-blue-700">{fmt2(metric.total_points)}</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderBenchmarks = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">年级最高班基准</h3>
        <p className="mt-1 text-sm text-slate-500">用于教学积分折算的各科最高参照值。</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left">学科</th>
              <th className="px-4 py-3 text-center">最高折算均分</th>
              <th className="px-4 py-3 text-center">最高优秀率</th>
              <th className="px-4 py-3 text-center">最高B等率</th>
              <th className="px-4 py-3 text-center">最高合格率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {subjects.map(subject => (
              <tr key={subject}>
                <td className="px-4 py-3 font-medium">{subject}</td>
                <td className="px-4 py-3 text-center">{fmt1(teachingScore.benchmarks[subject]?.max_converted_mean)}</td>
                <td className="px-4 py-3 text-center">{fmt1(teachingScore.benchmarks[subject]?.max_excellent_rate)}%</td>
                <td className="px-4 py-3 text-center">{fmt1(teachingScore.benchmarks[subject]?.max_good_rate)}%</td>
                <td className="px-4 py-3 text-center">{fmt1(teachingScore.benchmarks[subject]?.max_pass_rate)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderActiveModule = () => {
    if (isAllModules) {
      return (
        <div className="space-y-6">
          {modules.map(item => (
            <section key={item.value} className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
                <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
              </div>
              {item.value === 'summary'
                ? renderSummary()
                : item.value === 'details'
                  ? renderDetails()
                  : item.value === 'benchmarks'
                    ? renderBenchmarks()
                    : renderRanking(true)}
            </section>
          ))}
        </div>
      );
    }

    if (module === 'summary') return renderSummary();
    if (module === 'details') return renderDetails();
    if (module === 'benchmarks') return renderBenchmarks();
    return renderRanking();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
              <Award className="h-5 w-5 text-blue-600" />
              教学积分结果台
            </h2>
            <p className="mt-1 text-xs text-slate-500">按模块查看排名、单科拆解和折算基准，不再一次性铺开所有表格。</p>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            当前：{isAllModules ? '全面铺开' : activeModule.label}
          </span>
        </div>

        <div className="mt-4">
          <FlowModuleSelector
            title="教学积分结果控件"
            hint="点击查看摘要、排名、单科、基准或全面铺开"
            modules={selectorModules}
            activeValue={module}
            onChange={goToModule}
            scrollTargetId="teaching-score-module-content"
          />
        </div>
      </div>

      <div id="teaching-score-module-content" className="scroll-mt-32 p-5">
        {renderActiveModule()}
      </div>
    </div>
  );
}
