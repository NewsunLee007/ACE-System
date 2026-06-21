import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, ListChecks, Maximize2, Percent, Table2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import FlowModuleSelector from './FlowModuleSelector';

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const fmt1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '0.0');
const cx = (...items) => items.filter(Boolean).join(' ');
const VIEW_FLOW = ['summary', 'details', 'all'];

const getFullScore = (examData, subject, scores) => {
  const configured = toNumber(examData?.subject_scores?.[subject]);
  if (configured && configured > 0) return configured;
  const observedMax = Math.max(0, ...scores.map(s => toNumber(s.scores?.[subject])).filter(v => Number.isFinite(v)));
  if (observedMax > 120) return 160;
  if (observedMax > 100) return 120;
  return 100;
};

export default function ThreeRatesStats({
  examData,
  examScores = [],
  allScopeExamScores = [],
  subjects = [],
  classLayers = [],
}) {
  const availableSubjects = useMemo(() => subjects.filter(Boolean), [subjects]);
  const [selectedSubject, setSelectedSubject] = useState(availableSubjects[0] || '');
  const [activeView, setActiveView] = useState('summary');

  useEffect(() => {
    if (!availableSubjects.includes(selectedSubject)) {
      setSelectedSubject(availableSubjects[0] || '');
      setActiveView('summary');
    }
  }, [availableSubjects, selectedSubject]);

  const handleSubjectChange = (subject) => {
    setSelectedSubject(subject);
    setActiveView('summary');
  };

  const goToView = useCallback((nextView) => {
    if (nextView === activeView) return;

    const nextIndex = VIEW_FLOW.indexOf(nextView);
    if (nextIndex === -1) return;

    setActiveView(nextView);
  }, [activeView]);

  const { stats, topRanks, thresholds } = useMemo(() => {
    if (!examScores || examScores.length === 0 || !availableSubjects.length) {
      return { stats: [], topRanks: {}, thresholds: {} };
    }

    const gradeScores = allScopeExamScores.filter(s => s.is_valid !== false);
    const nextThresholds = {};

    availableSubjects.forEach(sub => {
      const scores = gradeScores.map(s => Number(s.scores?.[sub])).filter(v => Number.isFinite(v)).sort((a, b) => b - a);
      const count = scores.length;
      if (count > 0) {
        const fullScore = getFullScore(examData, sub, gradeScores);
        nextThresholds[sub] = {
          fullScore,
          excLine: fullScore * 0.9,
          goodLine: fullScore * 0.8,
          passLine: fullScore * 0.6,
          failLine: fullScore * 0.6
        };
      }
    });

    const classIds = Array.from(new Set(examScores.map(s => s.class_id))).sort((a, b) => Number(a) - Number(b));
    const result = classIds.map(classId => {
      const classScores = examScores.filter(s => s.class_id === classId && s.is_valid !== false);
      const clsLayer = classLayers?.find(l => l.class_id === Number(classId));
      const className = clsLayer ? clsLayer.class_name : String(classId);

      const subjectStats = {};
      availableSubjects.forEach(sub => {
        const scores = classScores.map(s => Number(s.scores?.[sub])).filter(v => Number.isFinite(v));
        const count = scores.length;
        if (count === 0) {
          subjectStats[sub] = { mean: 0, excRate: 0, goodRate: 0, passRate: 0, failRate: 0 };
          return;
        }

        const mean = scores.reduce((a, b) => a + b, 0) / count;
        const th = nextThresholds[sub];

        const excRate = th ? scores.filter(s => s >= th.excLine).length / count * 100 : 0;
        const goodRate = th ? scores.filter(s => s >= th.goodLine).length / count * 100 : 0;
        const passRate = th ? scores.filter(s => s >= th.passLine).length / count * 100 : 0;
        const failRate = th ? scores.filter(s => s < th.passLine).length / count * 100 : 0;

        subjectStats[sub] = { mean, excRate, goodRate, passRate, failRate };
      });

      return { classId, className, subjectStats };
    });

    const topRanksObj = {};
    availableSubjects.forEach(sub => {
      topRanksObj[sub] = {
        mean: Math.max(...result.map(r => r.subjectStats[sub].mean)),
        excRate: Math.max(...result.map(r => r.subjectStats[sub].excRate)),
        goodRate: Math.max(...result.map(r => r.subjectStats[sub].goodRate)),
        passRate: Math.max(...result.map(r => r.subjectStats[sub].passRate)),
        failRate: Math.min(...result.map(r => r.subjectStats[sub].failRate))
      };
    });

    return { stats: result, topRanks: topRanksObj, thresholds: nextThresholds };
  }, [examData, examScores, allScopeExamScores, availableSubjects, classLayers]);

  if (!stats || stats.length === 0) {
    return <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">暂无数据</div>;
  }

  const subjectThreshold = thresholds[selectedSubject] || {};
  const selectedTops = topRanks[selectedSubject] || {};
  const selectedRows = stats
    .map(row => ({ ...row, current: row.subjectStats[selectedSubject] || {} }))
    .sort((a, b) => Number(b.current.mean || 0) - Number(a.current.mean || 0));
  const bestMeanRow = selectedRows[0];
  const bestPassRow = selectedRows.reduce((best, row) => (
    Number(row.current.passRate || 0) > Number(best?.current?.passRate || -1) ? row : best
  ), null);
  const bestFailRow = selectedRows.reduce((best, row) => (
    Number(row.current.failRate || 1000) < Number(best?.current?.failRate ?? 1000) ? row : best
  ), null);
  const watchRows = selectedRows.slice(-3).reverse();
  const viewModules = [
    {
      value: 'summary',
      label: '结构摘要',
      desc: '看线值与关键班级',
      icon: BarChart3,
    },
    {
      value: 'details',
      label: '班级明细',
      desc: '展开完整三率表',
      icon: Table2,
    },
    {
      value: 'all',
      label: '全面铺开',
      desc: '当前学科摘要与明细同屏',
      icon: Maximize2,
    },
  ].map((module) => ({
    ...module,
    ready: true,
  }));
  const activeViewConfig = viewModules.find(item => item.value === activeView) || viewModules[0];

  const highlightClass = (condition, positive = true) => (
    condition
      ? positive
        ? 'bg-red-50 font-bold text-red-600'
        : 'bg-emerald-50 font-bold text-emerald-700'
      : ''
  );

  const renderMetricCards = () => (
    <div className="mb-4 grid gap-3 md:grid-cols-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-500">满分</p>
        <p className="mt-2 text-2xl font-bold text-slate-900">{fmt1(subjectThreshold.fullScore)}</p>
        <p className="mt-2 text-xs text-slate-500">按考试配置或成绩范围识别</p>
      </div>
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        <p className="text-sm opacity-80">最高均分</p>
        <p className="mt-2 text-2xl font-bold">{fmt1(selectedTops.mean)}</p>
        <p className="mt-2 text-xs opacity-80">{bestMeanRow?.className || '-'} · 红色标记为最优</p>
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800">
        <p className="text-sm opacity-80">最高及格率</p>
        <p className="mt-2 text-2xl font-bold">{fmt1(selectedTops.passRate)}%</p>
        <p className="mt-2 text-xs opacity-80">{bestPassRow?.className || '-'} · C等线及以上</p>
      </div>
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
        <p className="text-sm opacity-80">最低D等率</p>
        <p className="mt-2 text-2xl font-bold">{fmt1(selectedTops.failRate)}%</p>
        <p className="mt-2 text-xs opacity-80">{bestFailRow?.className || '-'} · 越低越好</p>
      </div>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-4">
      {renderMetricCards()}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{selectedSubject}关键班级提示</h3>
              <p className="mt-1 text-xs text-slate-500">最优班级和需关注班级默认显示，完整表格可直接点开。</p>
            </div>
            <button
              type="button"
              onClick={() => goToView('details')}
              className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <ListChecks className="h-4 w-4" />
              查看班级明细
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-white bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">均分最高</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{bestMeanRow?.className || '-'}</p>
              <p className="mt-1 text-sm text-red-600">{fmt1(bestMeanRow?.current?.mean)} 分</p>
            </div>
            <div className="rounded-lg border border-white bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">及格率最高</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{bestPassRow?.className || '-'}</p>
              <p className="mt-1 text-sm text-blue-600">{fmt1(bestPassRow?.current?.passRate)}%</p>
            </div>
            <div className="rounded-lg border border-white bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">D等率最低</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{bestFailRow?.className || '-'}</p>
              <p className="mt-1 text-sm text-emerald-600">{fmt1(bestFailRow?.current?.failRate)}%</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <h3 className="text-base font-semibold">需关注班级</h3>
          <p className="mt-1 text-xs opacity-80">按当前学科均分倒序取末三项。</p>
          <div className="mt-4 space-y-3">
            {watchRows.map(row => (
              <div key={row.classId} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-sm">
                <span className="font-medium">{row.className}</span>
                <span>{fmt1(row.current.mean)} 分 · D {fmt1(row.current.failRate)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderDetails = () => (
    <div>
      {renderMetricCards()}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">班级</TableHead>
              <TableHead className="text-center">平均分</TableHead>
              <TableHead className="text-center">A等率</TableHead>
              <TableHead className="text-center">B等率</TableHead>
              <TableHead className="text-center">及格率</TableHead>
              <TableHead className="text-center">D等率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectedRows.map(row => {
              const st = row.current;
              return (
                <TableRow key={row.classId}>
                  <TableCell className="text-center font-medium">{row.className}</TableCell>
                  <TableCell className={cx('text-center', highlightClass(st.mean === selectedTops.mean && st.mean > 0))}>
                    {fmt1(st.mean)}
                  </TableCell>
                  <TableCell className={cx('text-center', highlightClass(st.excRate === selectedTops.excRate && st.excRate > 0))}>
                    {fmt1(st.excRate)}%
                  </TableCell>
                  <TableCell className={cx('text-center', highlightClass(st.goodRate === selectedTops.goodRate && st.goodRate > 0))}>
                    {fmt1(st.goodRate)}%
                  </TableCell>
                  <TableCell className={cx('text-center', highlightClass(st.passRate === selectedTops.passRate && st.passRate > 0))}>
                    {fmt1(st.passRate)}%
                  </TableCell>
                  <TableCell className={cx('text-center', highlightClass(st.failRate === selectedTops.failRate && st.failRate < 100, false))}>
                    {fmt1(st.failRate)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
              <Percent className="h-5 w-5 text-blue-600" />
              三率一分结果台
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              选择学科即可查看该学科的班级均分、A等率、B等率、及格率和D等率。
            </p>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            当前：{selectedSubject || '-'} · {activeView === 'all' ? '全面铺开' : activeViewConfig.label}
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {availableSubjects.map(subject => {
            const active = subject === selectedSubject;
            const th = thresholds[subject] || {};
            return (
              <button
                key={subject}
                type="button"
                onClick={() => handleSubjectChange(subject)}
                className={cx(
                  'min-h-20 rounded-lg border px-3 py-3 text-left transition-colors',
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50'
                )}
              >
                <span className="flex items-start gap-3">
                  <span className={cx('rounded-lg p-2', active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500')}>
                    <BarChart3 className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{subject}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      A≥{fmt1(th.excLine)} / C≥{fmt1(th.passLine)}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <FlowModuleSelector
            title="三率一分结果控件"
            hint="点击查看摘要、明细或全面铺开"
            modules={viewModules}
            activeValue={activeView}
            onChange={goToView}
            scrollTargetId="three-rates-content"
          />
        </div>
      </div>

      <div id="three-rates-content" className="scroll-mt-32 p-5">
        {activeView === 'all' ? (
          <div className="space-y-6">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">结构摘要</h3>
                <p className="mt-1 text-xs text-slate-500">看线值与关键班级</p>
              </div>
              {renderOverview()}
            </section>
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">班级明细</h3>
                <p className="mt-1 text-xs text-slate-500">展开完整三率表</p>
              </div>
              {renderDetails()}
            </section>
          </div>
        ) : activeView === 'details' ? renderDetails() : renderOverview()}
      </div>
    </div>
  );
}
