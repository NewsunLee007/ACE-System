import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  BarChart3,
  Database,
  Gauge,
  LineChart,
  Maximize2,
  Percent,
  Target,
  Users,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import SubjectThresholdAnalysis from '../SubjectThresholdAnalysis';
import SubjectScoreDistribution from '../SubjectScoreDistribution';
import SubjectScoreAnalysisBoard from '../SubjectScoreAnalysisBoard';
import ScoreRawData from './ScoreRawData';
import ThreeRatesStats from './ThreeRatesStats';
import TopStudentsTracking from './TopStudentsTracking';
import AdmissionPrediction from './AdmissionPrediction';
import ACriticalStudents from './ACriticalStudents';
import ScoreAnalysisTeachingScore from './ScoreAnalysisTeachingScore';

const DEFAULT_SUBJECTS = ['语文', '数学', '英语', '科学', '社会'];

const workspaceTools = [
  {
    value: 'raw-data',
    label: '原始数据',
    desc: '导入与核对',
    icon: Database,
    alwaysReady: true,
  },
  {
    value: 'z-value',
    label: '综合报告',
    desc: 'Z值与学科',
    icon: Gauge,
    alwaysReady: true,
  },
  {
    value: 'teaching-score',
    label: '教学积分',
    desc: '班级积分',
    icon: Award,
  },
  {
    value: 'three-rates',
    label: '三率一分',
    desc: '达标结构',
    icon: Percent,
  },
  {
    value: 'top-students',
    label: '尖子生',
    desc: '高分追踪',
    icon: Users,
  },
  {
    value: 'a-critical',
    label: 'A层临界生',
    desc: '临界名单',
    icon: Target,
  },
  {
    value: 'admission',
    label: '模拟进线',
    desc: '上线预测',
    icon: LineChart,
  },
];

const cx = (...items) => items.filter(Boolean).join(' ');

const getToolByValue = (value) => workspaceTools.find(tool => tool.value === value) || workspaceTools[1];

const scrollToWorkspaceContent = () => {
  if (typeof window === 'undefined') return;

  window.setTimeout(() => {
    const target = document.getElementById('score-workspace-active-content');
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, 0);
};

export default function ScoreAnalysisWorkspaceTabs({
  value,
  onValueChange,
  selectedExam,
  onImportSuccess,
  analysisResult,
  renderAnalysisResult,
  examScores,
  allScopeExamScores,
  taggedExamScores,
  classLayers,
  teachingScore,
  renderToolEmpty,
  onTeachingScoreTab,
}) {
  const [reportModule, setReportModule] = useState('summary');
  const subjects = selectedExam?.subjects || DEFAULT_SUBJECTS;
  const activeTool = getToolByValue(value);
  const examName = selectedExam?.exam_name || selectedExam?.name || '未选择考试';

  const isToolReady = (tool) => Boolean(analysisResult || tool.alwaysReady);

  const selectTool = (tool) => {
    if (!isToolReady(tool)) return;
    if (tool.value === 'teaching-score') onTeachingScoreTab?.();
    onValueChange(tool.value);
    scrollToWorkspaceContent();
  };

  const reportModules = [
    {
      value: 'summary',
      label: '综合概览',
      desc: '核心指标、分布与班级概览',
      icon: Gauge,
      ready: true,
    },
    {
      value: 'threshold',
      label: '学科临界分',
      desc: '按比例定位各科目标线',
      icon: Target,
      ready: Boolean(analysisResult && selectedExam && examScores.length > 0),
    },
    {
      value: 'distribution',
      label: '分数段统计',
      desc: '查看学科与总分区间',
      icon: Percent,
      ready: Boolean(analysisResult && selectedExam && examScores.length > 0),
    },
    {
      value: 'subject-board',
      label: '学科分析板',
      desc: '班级、层次与学科联动',
      icon: BarChart3,
      ready: Boolean(analysisResult && selectedExam && allScopeExamScores.length > 0),
    },
  ];
  const isAllReportModules = reportModule === 'all';
  const readyReportModules = reportModules.filter(module => module.ready);
  const activeReportModule = isAllReportModules ? null : (reportModules.find(module => module.value === reportModule) || reportModules[0]);
  const reportSelectorModules = [
    ...reportModules,
    {
      value: 'all',
      label: '全面铺开',
      desc: `${readyReportModules.length} 个可用板块`,
      icon: Maximize2,
      ready: readyReportModules.length > 1,
    },
  ];

  useEffect(() => {
    if (isAllReportModules) {
      if (readyReportModules.length <= 1) setReportModule('summary');
      return;
    }

    if (!activeReportModule.ready && reportModule !== 'summary') {
      setReportModule('summary');
    }
  }, [activeReportModule?.ready, isAllReportModules, readyReportModules.length, reportModule]);

  const renderToolControls = () => (
    <TabsList className="grid h-auto grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-2 xl:grid-cols-4">
      {workspaceTools.map(tool => {
        const ToolIcon = tool.icon;
        const active = tool.value === value;
        const disabled = !isToolReady(tool);

        return (
          <TabsTrigger
            key={tool.value}
            value={tool.value}
            disabled={disabled}
            onClick={() => selectTool(tool)}
            className={cx(
              'h-auto justify-start rounded-lg border bg-white px-3 py-3 text-left shadow-none',
              active
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-slate-200 text-slate-700 hover:border-blue-200 hover:bg-blue-50',
              disabled && 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-70'
            )}
          >
            <span className="flex w-full items-center gap-3">
              <span className={cx(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              )}>
                <ToolIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{tool.label}</span>
                <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{tool.desc}</span>
              </span>
            </span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );

  const renderReportControls = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {reportSelectorModules.map(module => {
          const ModuleIcon = module.icon;
          const active = module.value === reportModule;
          const disabled = module.ready === false;

          return (
            <button
              key={module.value}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && setReportModule(module.value)}
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
                <ModuleIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{module.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{module.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (!analysisResult) {
    if (value === 'raw-data') {
      return (
        <ScoreRawData
          examData={selectedExam}
          onImportSuccess={onImportSuccess}
        />
      );
    }

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-blue-50 p-2 text-blue-700">
              <Database className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">专项结果待生成</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                请在上方执行分析。分析完成后，综合报告、教学质量和学生支持结果可直接打开。
              </p>
              <p className="mt-2 text-xs text-slate-400">{examName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onValueChange('raw-data')}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            进入原始数据核对
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const renderReportModuleByValue = (moduleValue) => {
    if (moduleValue === 'summary') {
      return renderAnalysisResult();
    }

    if (moduleValue === 'threshold') {
      return (
        <SubjectThresholdAnalysis
          examData={selectedExam}
          examScores={examScores}
          subjects={subjects}
        />
      );
    }

    if (moduleValue === 'distribution') {
      return (
        <SubjectScoreDistribution
          examData={selectedExam}
          examScores={examScores}
          subjects={subjects}
        />
      );
    }

    return (
      <SubjectScoreAnalysisBoard
        examData={selectedExam}
        allExamScores={allScopeExamScores}
        classLayers={classLayers}
      />
    );
  };

  const renderReportModule = () => {
    if (isAllReportModules) {
      return (
        <div className="space-y-6">
          {readyReportModules.map(module => (
            <section key={module.value} className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{module.label}</h3>
                <p className="mt-1 text-xs text-slate-500">{module.desc}</p>
              </div>
              {renderReportModuleByValue(module.value)}
            </section>
          ))}
        </div>
      );
    }

    return renderReportModuleByValue(activeReportModule.value);
  };

  return (
    <Tabs value={value} onValueChange={onValueChange} className="w-full">
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">专项结果</h2>
            <p className="text-xs text-slate-500">
              点击控件直接显示对应结果，当前显示：{activeTool.label}。
            </p>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {examName}
          </span>
        </div>
        {renderToolControls()}
      </div>

      <div id="score-workspace-active-content" className="scroll-mt-32">
        <TabsContent value="raw-data">
          <ScoreRawData
            examData={selectedExam}
            onImportSuccess={onImportSuccess}
          />
        </TabsContent>

        <TabsContent value="z-value" className="space-y-6">
          <div id="section-analysis-result" className="scroll-mt-40 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">综合报告结果</h2>
                  <p className="mt-1 text-xs text-slate-500">点击控件切换结果板块，必要时再全面铺开。</p>
                </div>
                <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  当前：{isAllReportModules ? '全面铺开' : activeReportModule.label}
                </span>
              </div>

              <div className="mt-4">
                {renderReportControls()}
              </div>
            </div>

            <div id="score-report-module-content" className="scroll-mt-32 p-5">
              {renderReportModule()}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="teaching-score">
          {analysisResult ? (
            <ScoreAnalysisTeachingScore teachingScore={teachingScore} />
          ) : (
            renderToolEmpty('教学积分待生成')
          )}
        </TabsContent>

        <TabsContent value="three-rates">
          {analysisResult ? (
            <ThreeRatesStats
              examData={selectedExam}
              examScores={examScores}
              allScopeExamScores={allScopeExamScores}
              subjects={selectedExam?.subjects || []}
              classLayers={classLayers}
            />
          ) : (
            renderToolEmpty('三率一分待生成')
          )}
        </TabsContent>

        <TabsContent value="top-students">
          {analysisResult ? (
            <TopStudentsTracking examScores={allScopeExamScores} classLayers={classLayers} />
          ) : (
            renderToolEmpty('尖子生追踪待生成')
          )}
        </TabsContent>

        <TabsContent value="a-critical">
          {analysisResult ? (
            <ACriticalStudents examScores={taggedExamScores} classLayers={classLayers} />
          ) : (
            renderToolEmpty('A层临界生待生成')
          )}
        </TabsContent>

        <TabsContent value="admission">
          {analysisResult ? (
            <AdmissionPrediction
              examScores={allScopeExamScores}
              allScopeExamScores={allScopeExamScores}
              subjects={selectedExam?.subjects || []}
              classLayers={classLayers}
            />
          ) : (
            renderToolEmpty('模拟进线预测待生成')
          )}
        </TabsContent>
      </div>
    </Tabs>
  );
}
