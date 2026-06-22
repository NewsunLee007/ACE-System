import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Eye, History, LineChart, Maximize2, Settings2, Table2, Users } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '../ui/table';
import HistoricalDiffDrawer from './HistoricalDiffDrawer';
import FlowModuleSelector from './FlowModuleSelector';

const cx = (...items) => items.filter(Boolean).join(' ');

export default function AdmissionPrediction({ examScores = [], subjects = [], classLayers = [] }) {
  const [keyHighLine, setKeyHighLine] = useState('');
  const [regHighLine, setRegHighLine] = useState('');
  const [activeLine, setActiveLine] = useState('key');
  const [module, setModule] = useState('setup');
  const [classStatsView, setClassStatsView] = useState('summary');

  const currentLineScore = activeLine === 'key' ? Number(keyHighLine) : Number(regHighLine);
  const lineReady = Number.isFinite(currentLineScore) && currentLineScore > 0;
  const activeLineLabel = activeLine === 'key' ? '重高' : '普高';

  const { classData, summary, radarData } = useMemo(() => {
    if (!examScores || examScores.length === 0 || !subjects) return { classData: [], summary: {}, radarData: [] };

    const validScores = examScores.filter(score => score.is_valid !== false);
    const classIds = Array.from(new Set(validScores.map(score => score.class_id))).sort((a, b) => Number(a) - Number(b));
    let totalParticipants = 0;
    let totalAdmitted = 0;

    const cData = classIds.map(classId => {
      const cScores = validScores.filter(score => score.class_id === classId);
      const clsLayer = classLayers?.find(layer => layer.class_id === Number(classId));
      const className = clsLayer ? clsLayer.class_name : String(classId);

      const participants = cScores.length;
      const admitted = lineReady
        ? cScores.filter(score => Number(score.total_score) >= currentLineScore).length
        : 0;
      const rate = participants > 0 ? (admitted / participants * 100).toFixed(2) : '0.00';

      totalParticipants += participants;
      totalAdmitted += admitted;

      return { classId, className, participants, admitted, rate };
    });

    const sum = {
      participants: totalParticipants,
      admitted: totalAdmitted,
      rate: totalParticipants > 0 ? (totalAdmitted / totalParticipants * 100).toFixed(2) : '0.00',
    };

    const admittedStudents = validScores.filter(score => lineReady && Number(score.total_score) >= currentLineScore);
    const rData = subjects.map(subject => {
      const allSubScores = validScores.map(score => Number(score.scores?.[subject])).filter(value => Number.isFinite(value));
      const admittedSubScores = admittedStudents.map(score => Number(score.scores?.[subject])).filter(value => Number.isFinite(value));

      const allMean = allSubScores.length > 0 ? allSubScores.reduce((a, b) => a + b, 0) / allSubScores.length : 0;
      const admittedMean = admittedSubScores.length > 0 ? admittedSubScores.reduce((a, b) => a + b, 0) / admittedSubScores.length : 0;
      const contribution = allMean > 0 ? ((admittedMean / allMean) * 100).toFixed(1) : 0;

      return {
        subject,
        全体均分: Number(allMean.toFixed(1)),
        上线生均分: Number(admittedMean.toFixed(1)),
        贡献度指数: Number(contribution),
      };
    });

    return { classData: cData, summary: sum, radarData: rData };
  }, [examScores, subjects, classLayers, currentLineScore, lineReady]);

  const modules = [
    {
      value: 'setup',
      label: '配置分数线',
      desc: '先设定重高或普高线',
      icon: Settings2,
      ready: true,
    },
    {
      value: 'class-stats',
      label: '班级统计',
      desc: '复核各班上线率',
      icon: Users,
      ready: lineReady,
    },
    {
      value: 'contribution',
      label: '学科贡献',
      desc: '查看上线生学科拉动',
      icon: BarChart3,
      ready: lineReady,
    },
    {
      value: 'history',
      label: '历史对比',
      desc: '粘贴历次上线率对照',
      icon: History,
      ready: lineReady,
    },
  ];
  const isAllModules = module === 'all';
  const activeModule = isAllModules ? null : (modules.find(item => item.value === module) || modules[0]);
  const readyModules = modules.filter(item => item.ready);
  const selectorModules = [
    ...modules.map((item) => ({
      ...item,
      ready: item.ready,
    })),
    {
      value: 'all',
      label: '全面铺开',
      desc: '四个板块同屏显示',
      icon: Maximize2,
      ready: readyModules.length === modules.length,
    },
  ];
  const classStatsViewModules = [
    {
      value: 'summary',
      label: '班级摘要',
      desc: '上线概况与重点班级',
      icon: Eye,
    },
    {
      value: 'table',
      label: '完整班级表',
      desc: `${classData.length} 个班级`,
      icon: Table2,
    },
    {
      value: 'all',
      label: '班级全览',
      desc: '摘要与表格同屏复核',
      icon: Maximize2,
    },
  ];
  const activeClassStatsViewConfig = classStatsViewModules.find(item => item.value === classStatsView) || classStatsViewModules[0];
  const topAdmissionClasses = [...classData]
    .sort((a, b) => Number(b.admitted) - Number(a.admitted) || Number(b.rate) - Number(a.rate))
    .slice(0, 5);
  const noAdmissionClassCount = classData.filter(row => Number(row.admitted) === 0).length;

  const lineIdentity = `${activeLine}:${lineReady ? currentLineScore : 'pending'}`;

  const goToModule = (nextModule) => {
    if (nextModule === 'all') {
      if (readyModules.length !== modules.length) return;
      setModule('all');
      return;
    }

    const nextModuleIndex = modules.findIndex(item => item.value === nextModule);
    const nextModuleConfig = modules[nextModuleIndex];
    if (!nextModuleConfig?.ready) return;

    if (nextModule === 'class-stats') {
      setClassStatsView('summary');
    }
    setModule(nextModule);
  };

  useEffect(() => {
    setClassStatsView('summary');
    setModule('setup');
  }, [lineIdentity]);

  useEffect(() => {
    if (isAllModules) {
      if (readyModules.length !== modules.length) setModule('setup');
      return;
    }

    if (!activeModule.ready && module !== 'setup') {
      setModule('setup');
    }
  }, [activeModule?.ready, isAllModules, module, modules.length, readyModules.length]);

  const renderMetric = (label, value, detail, tone = 'slate') => {
    const tones = {
      slate: 'border-slate-200 bg-slate-50 text-slate-900',
      blue: 'border-blue-200 bg-blue-50 text-blue-800',
      emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800',
      amber: 'border-amber-200 bg-amber-50 text-amber-800',
    };

    return (
      <div className={cx('rounded-lg border p-4', tones[tone] || tones.slate)}>
        <p className="text-sm opacity-80">{label}</p>
        <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
        <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
      </div>
    );
  };

  const renderSetup = () => (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="key-high-line">重高模拟分数线</label>
            <Input
              id="key-high-line"
              type="number"
              placeholder="例如: 580"
              value={keyHighLine}
              onChange={event => setKeyHighLine(event.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="reg-high-line">普高模拟分数线</label>
            <Input
              id="reg-high-line"
              type="number"
              placeholder="例如: 520"
              value={regHighLine}
              onChange={event => setRegHighLine(event.target.value)}
              className="mt-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={activeLine === 'key' ? 'default' : 'outline'}
              onClick={() => setActiveLine('key')}
              className={activeLine === 'key' ? 'bg-red-600 text-white hover:bg-red-700' : 'border-red-200 text-red-600 hover:bg-red-50'}
            >
              重高线
            </Button>
            <Button
              type="button"
              variant={activeLine === 'reg' ? 'default' : 'outline'}
              onClick={() => setActiveLine('reg')}
              className={activeLine === 'reg' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border-blue-200 text-blue-600 hover:bg-blue-50'}
            >
              普高线
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {renderMetric('当前口径', activeLineLabel, lineReady ? `分数线 ${currentLineScore}` : '请先填写分数线', 'blue')}
        {renderMetric('参考人数', summary.participants || 0, '参与当前模拟范围', 'slate')}
        {renderMetric('预计进线', lineReady ? summary.admitted || 0 : '-', '达到当前分数线人数', 'emerald')}
        {renderMetric('上线率', lineReady ? `${summary.rate || '0.00'}%` : '-', '全年级汇总口径', 'indigo')}
      </div>

      <div className="flex justify-end border-t border-slate-200 pt-4">
        <Button type="button" disabled={!lineReady} onClick={() => goToModule('class-stats')}>
          查看班级统计
        </Button>
      </div>
    </div>
  );

  const renderClassStatsSelector = () => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">当前班级视图</p>
          <p className="mt-1 text-xs text-slate-500">默认显示班级摘要，完整表格可直接点开。</p>
        </div>
        <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          当前：{activeClassStatsViewConfig.label}
        </span>
      </div>
      <FlowModuleSelector
        title="班级统计结果控件"
        hint="点击查看摘要、表格或班级全览"
        modules={classStatsViewModules}
        activeValue={classStatsView}
        onChange={setClassStatsView}
        scrollTargetId="admission-class-stats-content"
      />
    </div>
  );

  const renderClassStatsTable = () => (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="max-h-[460px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-white">
            <TableRow>
              <TableHead className="text-center">班级</TableHead>
              <TableHead className="text-center">参考人数</TableHead>
              <TableHead className="text-center text-green-600">进线人数</TableHead>
              <TableHead className="text-center text-indigo-600">上线率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {classData.map(row => (
              <TableRow key={row.classId}>
                <TableCell className="text-center font-medium">{row.className}</TableCell>
                <TableCell className="text-center">{row.participants}</TableCell>
                <TableCell className="text-center font-bold text-green-600">{row.admitted}</TableCell>
                <TableCell className="text-center font-bold text-indigo-600">{row.rate}%</TableCell>
              </TableRow>
            ))}
            {classData.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-slate-500">暂无数据，请先配置分数线</TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter className="sticky bottom-0 bg-slate-50 font-bold">
            <TableRow>
              <TableCell className="text-center">全年级汇总</TableCell>
              <TableCell className="text-center">{summary.participants}</TableCell>
              <TableCell className="text-center text-green-700">{summary.admitted}</TableCell>
              <TableCell className="text-center text-indigo-700">{summary.rate}%</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );

  const renderClassStatsSummary = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {renderMetric(`${activeLineLabel}线`, currentLineScore, '当前模拟口径', 'blue')}
        {renderMetric('预计进线', summary.admitted || 0, `参考 ${summary.participants || 0} 人`, 'emerald')}
        {renderMetric('上线率', `${summary.rate || '0.00'}%`, '全年级汇总', 'indigo')}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-slate-900">进线班级概览</p>
              <p className="mt-1 text-xs text-slate-500">主要贡献班级默认显示，完整班级表可直接点开。</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setClassStatsView('table')}>
              查看完整班级表
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {renderMetric('覆盖班级', classData.length, '当前模拟范围', 'slate')}
            {renderMetric('暂无进线班级', noAdmissionClassCount, '需重点复核线位', 'amber')}
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">进线贡献 Top5</p>
          <div className="mt-3 space-y-2">
            {topAdmissionClasses.length > 0 ? topAdmissionClasses.map(row => (
              <div key={row.classId} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                <span className="font-medium text-slate-900">{row.className}</span>
                <span className="text-blue-700">{row.admitted} 人 · {row.rate}%</span>
              </div>
            )) : (
              <p className="text-sm text-blue-700">暂无班级数据</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderClassStatsContent = ({ forceAll = false } = {}) => {
    const view = forceAll ? 'all' : classStatsView;
    if (view === 'table') return renderClassStatsTable();
    if (view === 'all') {
      return (
        <div className="space-y-5">
          {renderClassStatsSummary()}
          {renderClassStatsTable()}
        </div>
      );
    }
    return renderClassStatsSummary();
  };

  const renderClassStats = ({ forceAll = false } = {}) => (
    <div className="space-y-4">
      {!forceAll && renderClassStatsSelector()}
      <div id="admission-class-stats-content" className="scroll-mt-32">
        {renderClassStatsContent({ forceAll })}
      </div>

      {!forceAll && (
        <div className="flex justify-end border-t border-slate-200 pt-4">
          <Button type="button" onClick={() => goToModule('contribution')}>
            查看学科贡献
          </Button>
        </div>
      )}
    </div>
  );

  const renderContribution = () => (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-base font-semibold text-slate-900">学科贡献度分析</h3>
        <p className="mt-1 text-xs text-slate-500">对比上线学生与全体学生的学科均分，判断上线群体主要由哪些学科拉动。</p>
      </div>

      {summary.admitted > 0 ? (
        <div className="h-[420px] w-full rounded-lg border border-slate-200 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={30} domain={[0, 'auto']} />
              <Radar name="上线生均分" dataKey="上线生均分" stroke="#ef4444" fill="#ef4444" fillOpacity={0.5} />
              <Radar name="全体均分" dataKey="全体均分" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-[300px] items-center justify-center rounded-lg border border-slate-200 text-slate-500">
          当前分数线暂无上线学生，请回到配置分数线调整。
        </div>
      )}

      <div className="flex justify-end border-t border-slate-200 pt-4">
        <Button type="button" onClick={() => goToModule('history')}>
          查看历史对比
        </Button>
      </div>
    </div>
  );

  const renderModuleContent = (moduleValue, options = {}) => {
    if (moduleValue === 'class-stats') return renderClassStats({ forceAll: options.forceClassStatsFull });
    if (moduleValue === 'contribution') return renderContribution();
    if (moduleValue === 'history') return <HistoricalDiffDrawer currentAdmissionData={classData} />;
    return renderSetup();
  };

  const renderActiveModule = () => {
    if (isAllModules) {
      return (
        <div className="space-y-6">
          {readyModules.map(item => (
            <section key={item.value} className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
                <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
              </div>
              {renderModuleContent(item.value, { forceClassStatsFull: true })}
            </section>
          ))}
        </div>
      );
    }

    return renderModuleContent(activeModule.value);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
              <LineChart className="h-5 w-5 text-blue-600" />
              模拟进线结果台
            </h2>
            <p className="mt-1 text-xs text-slate-500">配置分数线后，点击控件查看班级、学科和历史对比。</p>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            当前：{isAllModules ? '全面铺开' : activeModule.label}
          </span>
        </div>

        <div className="mt-4">
          <FlowModuleSelector
            title="模拟进线结果控件"
            hint="点击查看配置、班级统计、学科贡献、历史或全面铺开"
            modules={selectorModules}
            activeValue={module}
            onChange={goToModule}
            showCurrent
            scrollTargetId="admission-module-content"
          />
        </div>
      </div>

      <div id="admission-module-content" className="scroll-mt-32 p-5">
        {renderActiveModule()}
      </div>
    </div>
  );
}
