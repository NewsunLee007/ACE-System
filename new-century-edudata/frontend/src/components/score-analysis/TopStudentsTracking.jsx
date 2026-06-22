import React, { useMemo, useState } from 'react';
import { BarChart3, Eye, ListChecks, Maximize2, Table2, Trophy } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import FlowModuleSelector from './FlowModuleSelector';

const cx = (...items) => items.filter(Boolean).join(' ');

export const buildTopStudentsTrackingModel = ({ examScores = [], classLayers = [] }) => {
  if (!examScores || examScores.length === 0) {
    return { topStudents: [], distributionData: [] };
  }

  const validScores = examScores
    .filter(score => score.is_valid !== false && Number.isFinite(Number(score.total_score)))
    .sort((a, b) => Number(b.total_score) - Number(a.total_score));

  const classDist = {};
  const studentsWithRank = validScores.map((score, index) => {
    const clsLayer = classLayers?.find(layer => layer.class_id === Number(score.class_id));
    const className = clsLayer ? clsLayer.class_name : String(score.class_id);
    const rank = index + 1;
    const student = { ...score, rank, className };

    if (!classDist[className]) {
      classDist[className] = { top50: 0, top100: 0, top200: 0 };
    }
    if (rank <= 50) classDist[className].top50 += 1;
    if (rank <= 100) classDist[className].top100 += 1;
    if (rank <= 200) classDist[className].top200 += 1;

    return student;
  });

  const distributionData = Object.keys(classDist).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  }).map(className => ({
    className,
    ...classDist[className],
  }));

  return {
    topStudents: studentsWithRank.slice(0, 200),
    distributionData,
  };
};

export const buildTopStudentsSummaryModel = ({ topStudents = [], distributionData = [] }) => {
  const leadingClasses = [...distributionData]
    .sort((a, b) => (
      b.top50 - a.top50
      || b.top100 - a.top100
      || b.top200 - a.top200
      || a.className.localeCompare(b.className, 'zh-CN')
    ))
    .slice(0, 5);

  return {
    top50Total: distributionData.reduce((sum, row) => sum + row.top50, 0),
    top100Total: distributionData.reduce((sum, row) => sum + row.top100, 0),
    top200Total: distributionData.reduce((sum, row) => sum + row.top200, 0),
    classCount: distributionData.length,
    leadingClasses,
    topStudents: topStudents.slice(0, 5),
    topStudent: topStudents[0] || null,
  };
};

export default function TopStudentsTracking({ examScores = [], classLayers = [] }) {
  const [module, setModule] = useState('summary');
  const [distributionView, setDistributionView] = useState('overview');
  const [topN, setTopN] = useState(50);
  const [filterClass, setFilterClass] = useState('all');

  const { topStudents, distributionData } = useMemo(() => {
    return buildTopStudentsTrackingModel({ examScores, classLayers });
  }, [examScores, classLayers]);

  const filteredStudents = topStudents.filter(student => (
    student.rank <= topN && (filterClass === 'all' || student.className === filterClass)
  ));
  const classOptions = Array.from(new Set(topStudents.map(student => student.className))).sort();
  const summaryModel = useMemo(() => (
    buildTopStudentsSummaryModel({ topStudents, distributionData })
  ), [topStudents, distributionData]);

  const modules = [
    {
      value: 'summary',
      label: '追踪摘要',
      desc: '覆盖人数与重点班级',
      icon: Eye,
    },
    {
      value: 'distribution',
      label: '分布概览',
      desc: '各班高分段结构',
      icon: BarChart3,
    },
    {
      value: 'list',
      label: '名单复核',
      desc: '筛选具体学生名单',
      icon: ListChecks,
    },
  ];
  const isAllModules = module === 'all';
  const activeModule = isAllModules ? null : (modules.find(item => item.value === module) || modules[0]);
  const selectorModules = [
    ...modules,
    {
      value: 'all',
      label: '全面铺开',
      desc: `${modules.length} 个追踪板块`,
      icon: Maximize2,
    },
  ];
  const distributionViews = [
    {
      value: 'overview',
      label: '图表概览',
      desc: '覆盖指标与重点班级',
      icon: BarChart3,
    },
    {
      value: 'classes',
      label: '班级明细',
      desc: `${distributionData.length} 个班级高分段`,
      icon: Table2,
    },
    {
      value: 'all',
      label: '全面铺开',
      desc: '图表和班级明细同屏复核',
      icon: Maximize2,
    },
  ];
  const activeDistributionView = distributionViews.find(item => item.value === distributionView) || distributionViews[0];
  const { top50Total, top100Total, top200Total, leadingClasses } = summaryModel;

  const renderMetric = (label, value, detail, tone) => {
    const tones = {
      red: 'border-red-200 bg-red-50 text-red-800',
      amber: 'border-amber-200 bg-amber-50 text-amber-800',
      blue: 'border-blue-200 bg-blue-50 text-blue-800',
      slate: 'border-slate-200 bg-slate-50 text-slate-900',
    };

    return (
      <div className={cx('rounded-lg border p-4', tones[tone] || tones.slate)}>
        <p className="text-sm opacity-80">{label}</p>
        <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
        <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
      </div>
    );
  };

  const renderDistributionTable = () => (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center font-semibold">班级</TableHead>
            <TableHead className="text-center font-semibold text-red-600">前50名</TableHead>
            <TableHead className="text-center font-semibold text-amber-600">前100名</TableHead>
            <TableHead className="text-center font-semibold text-blue-600">前200名</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {distributionData.map(row => (
            <TableRow key={row.className}>
              <TableCell className="text-center font-medium">{row.className}</TableCell>
              <TableCell className="text-center">{row.top50}</TableCell>
              <TableCell className="text-center">{row.top100}</TableCell>
              <TableCell className="text-center">{row.top200}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderDistributionOverview = () => (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="rounded-lg border border-slate-200 p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">高分段班级分布</h3>
            <p className="mt-1 text-xs text-slate-500">整体覆盖结构默认显示，明细表可直接点开。</p>
          </div>
          <button
            type="button"
            onClick={() => setDistributionView('classes')}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Table2 className="h-3.5 w-3.5" />
            查看班级明细
          </button>
        </div>
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distributionData} margin={{ top: 20, right: 24, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="className" />
              <YAxis />
              <Tooltip cursor={{ fill: '#f3f4f6' }} />
              <Legend />
              <Bar dataKey="top50" name="前50名" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="top100" name="前100名" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="top200" name="前200名" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
        <h3 className="text-sm font-semibold text-blue-900">重点班级摘要</h3>
        <p className="mt-1 text-xs text-blue-700">按前50名优先排序，帮助定位高分段集中班级。</p>
        <div className="mt-4 space-y-3">
          {leadingClasses.map(row => (
            <div key={row.className} className="rounded-lg bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.className}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    前100名 {row.top100} 人 · 前200名 {row.top200} 人
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-600">{row.top50}</p>
                  <p className="text-[11px] text-slate-400">前50名</p>
                </div>
              </div>
            </div>
          ))}
          {leadingClasses.length === 0 && (
            <div className="rounded-lg bg-white p-5 text-center text-sm text-slate-500">
              暂无班级分布数据
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderDistribution = (expandAll = false) => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {renderMetric('前50名覆盖', top50Total, '用于识别头部竞争力', 'red')}
        {renderMetric('前100名覆盖', top100Total, '用于观察优秀面', 'amber')}
        {renderMetric('前200名覆盖', top200Total, '用于判断潜力梯队', 'blue')}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">分布查看方式</h3>
            <p className="mt-1 text-xs text-slate-500">默认显示图表摘要，班级明细可直接点开。</p>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            当前：{expandAll || distributionView === 'all' ? '全面铺开' : activeDistributionView.label}
          </span>
        </div>
        <FlowModuleSelector
          title="分布结果控件"
          hint="点击查看图表、班级明细或全面铺开"
          modules={distributionViews}
          activeValue={distributionView}
          onChange={setDistributionView}
          scrollTargetId="top-students-distribution-content"
        />
      </div>

      <div id="top-students-distribution-content" className="scroll-mt-32">
        {expandAll || distributionView === 'all' ? (
          <div className="space-y-5">
            {renderDistributionOverview()}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">高分段班级明细</h3>
              {renderDistributionTable()}
            </div>
          </div>
        ) : distributionView === 'classes' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">高分段班级明细</h3>
              <button
                type="button"
                onClick={() => setDistributionView('overview')}
                className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
              >
                返回图表概览
              </button>
            </div>
            {renderDistributionTable()}
          </div>
        ) : renderDistributionOverview()}
      </div>
    </div>
  );

  const goToDistribution = () => {
    setDistributionView('overview');
    setModule('distribution');
  };

  const goToList = () => {
    setModule('list');
  };

  const renderSummaryStudentList = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">头部学生 Top5</h3>
      <p className="mt-1 text-xs text-slate-500">默认只展示前五名，完整名单在复核视图打开。</p>
      <div className="mt-3 space-y-2">
        {summaryModel.topStudents.map(student => (
          <div key={student.student_id || student.rank} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">
                {student.rank}. {student.student_name || student.student_id || '-'}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{student.className} · 考号 {student.student_id || '-'}</p>
            </div>
            <span className="font-semibold text-blue-700">{student.total_score}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        {renderMetric('前50名覆盖', summaryModel.top50Total, '头部竞争力', 'red')}
        {renderMetric('前100名覆盖', summaryModel.top100Total, '优秀面观察', 'amber')}
        {renderMetric('前200名覆盖', summaryModel.top200Total, '潜力梯队', 'blue')}
        {renderMetric('覆盖班级', summaryModel.classCount, '高分段涉及班级', 'slate')}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 md:grid-cols-2">
          {renderSummaryStudentList()}
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <h3 className="text-sm font-semibold text-blue-900">重点班级摘要</h3>
            <p className="mt-1 text-xs text-blue-700">按前50名优先排序，定位高分段集中班级。</p>
            <div className="mt-3 space-y-2">
              {leadingClasses.map(row => (
                <div key={row.className} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{row.className}</p>
                    <p className="mt-0.5 text-xs text-slate-500">前100名 {row.top100} · 前200名 {row.top200}</p>
                  </div>
                  <span className="font-semibold text-red-600">{row.top50}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">追踪动作</h3>
          <div className="mt-3 space-y-3 text-sm">
            <div className="rounded-lg bg-white p-3">
              <p className="font-medium text-slate-900">先判分布</p>
              <p className="mt-1 text-xs text-slate-500">需要看各班前50/100/200结构时，进入分布图。</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="font-medium text-slate-900">再核名单</p>
              <p className="mt-1 text-xs text-slate-500">需要逐名核对时，进入名单复核并筛选名次或班级。</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={goToDistribution}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
            >
              查看分布图
            </button>
            <button
              type="button"
              onClick={goToList}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
            >
              复核名单
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderList = () => (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">尖子生名单复核</h3>
          <p className="mt-1 text-xs text-slate-500">按名次范围和班级筛选，不与分布图同时挤在一屏。</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={topN}
            onChange={event => setTopN(Number(event.target.value))}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={50}>前 50 名</option>
            <option value={100}>前 100 名</option>
            <option value={200}>前 200 名</option>
          </select>
          <select
            value={filterClass}
            onChange={event => setFilterClass(event.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">所有班级</option>
            {classOptions.map(className => <option key={className} value={className}>{className}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="max-h-[520px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
              <TableRow>
                <TableHead className="w-20 text-center">年级排名</TableHead>
                <TableHead className="w-24 text-center">考号</TableHead>
                <TableHead className="w-24 text-center">姓名</TableHead>
                <TableHead className="w-24 text-center">班级</TableHead>
                <TableHead className="w-24 text-center">总分</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length > 0 ? filteredStudents.map(student => (
                <TableRow key={student.student_id || student.rank}>
                  <TableCell className="text-center font-bold text-slate-700">{student.rank}</TableCell>
                  <TableCell className="text-center text-slate-500">{student.student_id || '-'}</TableCell>
                  <TableCell className="text-center font-medium">{student.student_name}</TableCell>
                  <TableCell className="text-center">{student.className}</TableCell>
                  <TableCell className="text-center font-semibold text-blue-600">{student.total_score}</TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-slate-500">暂无符合条件的学生数据</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );

  if (topStudents.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
        暂无可追踪的尖子生数据，请确认成绩已导入并参与分析。
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
              <Trophy className="h-5 w-5 text-blue-600" />
              尖子生追踪结果台
            </h2>
            <p className="mt-1 text-xs text-slate-500">追踪摘要、分布图和名单可直接切换查看。</p>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            当前：{isAllModules ? '全面铺开' : activeModule.label}
          </span>
        </div>

        <div className="mt-4">
          <FlowModuleSelector
            title="尖子生结果控件"
            hint="点击查看摘要、分布、名单或全面铺开"
            modules={selectorModules}
            activeValue={module}
            onChange={setModule}
            scrollTargetId="top-students-module-content"
          />
        </div>
      </div>

      <div id="top-students-module-content" className="scroll-mt-32 p-5">
        {isAllModules ? (
          <div className="space-y-6">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">追踪摘要</h3>
                <p className="mt-1 text-xs text-slate-500">覆盖人数与重点班级</p>
              </div>
              {renderSummary()}
            </section>
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">分布概览</h3>
                <p className="mt-1 text-xs text-slate-500">各班高分段结构</p>
              </div>
              {renderDistribution(true)}
            </section>
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">名单复核</h3>
                <p className="mt-1 text-xs text-slate-500">再筛选具体学生名单</p>
              </div>
              {renderList()}
            </section>
          </div>
        ) : module === 'list' ? renderList() : module === 'distribution' ? renderDistribution() : renderSummary()}
      </div>
    </div>
  );
}
