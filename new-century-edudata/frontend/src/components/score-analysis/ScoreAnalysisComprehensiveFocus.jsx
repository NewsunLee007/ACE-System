import React, { useEffect, useMemo, useState } from 'react';
import { Award, BarChart3, Gauge, Maximize2 } from 'lucide-react';
import ScoreAnalysisTeachingScore from './ScoreAnalysisTeachingScore';
import ScoreAnalysisComprehensiveKeyMetrics from './ScoreAnalysisComprehensiveKeyMetrics';
import ScoreAnalysisComprehensiveSections from './ScoreAnalysisComprehensiveSections';
import FlowModuleSelector from './FlowModuleSelector';

export const getInitialComprehensiveFocus = (analysisType) => {
  if (analysisType === 'teaching_score') return 'teaching';
  if (['subject_analysis', 'layer_comparison'].includes(analysisType)) return 'judgement';
  return 'metrics';
};

export default function ScoreAnalysisComprehensiveFocus({
  data,
  scopeKey,
  summary,
  keyMetrics,
  examScores,
  selectedExam,
  analysisType,
  layerComparison,
  subjectAnalysis,
  overall,
  teachingScore,
}) {
  const [focus, setFocus] = useState(() => getInitialComprehensiveFocus(analysisType));
  const analysisIdentity = data?.analysis_id || data?.exam_id || data?.exam_name || '';

  useEffect(() => {
    setFocus(getInitialComprehensiveFocus(analysisType));
  }, [analysisType, analysisIdentity]);

  const modules = useMemo(() => ([
    {
      value: 'metrics',
      label: '核心指标',
      desc: '考试摘要、阈值和名次工具',
      icon: Gauge,
      ready: true,
      content: (
        <ScoreAnalysisComprehensiveKeyMetrics
          data={data}
          scopeKey={scopeKey}
          summary={summary}
          keyMetrics={keyMetrics}
          examScores={examScores}
          selectedExam={selectedExam}
        />
      ),
    },
    {
      value: 'judgement',
      label: '综合研判',
      desc: '再看分布、学科、层次和班级',
      icon: BarChart3,
      ready: Boolean(overall?.distribution || subjectAnalysis?.subject_statistics || layerComparison?.layer_statistics),
      content: (
        <ScoreAnalysisComprehensiveSections
          analysisType={analysisType}
          data={data}
          scopeKey={scopeKey}
          layerComparison={layerComparison}
          subjectAnalysis={subjectAnalysis}
          overall={overall}
          keyMetrics={keyMetrics}
        />
      ),
    },
    {
      value: 'teaching',
      label: '教学积分',
      desc: '需要班级积分时单独进入',
      icon: Award,
      ready: Boolean(teachingScore),
      content: <ScoreAnalysisTeachingScore teachingScore={teachingScore} />,
    },
  ]), [analysisType, data, examScores, keyMetrics, layerComparison, overall, scopeKey, selectedExam, subjectAnalysis, summary, teachingScore]);

  const readyModules = modules.filter(module => module.ready);
  const readyModuleCount = readyModules.length;
  const fallbackFocusValue = readyModules[0]?.value || modules[0]?.value;
  const isAllModules = focus === 'all';
  const requestedModule = modules.find(module => module.value === focus) || modules[0];
  const activeModule = isAllModules ? null : (requestedModule.ready ? requestedModule : (readyModules[0] || modules[0]));
  const selectorModules = [
    ...modules,
    {
      value: 'all',
      label: '全面铺开',
      desc: `${readyModuleCount} 个焦点同时查看`,
      icon: Maximize2,
      ready: readyModuleCount > 1,
    },
  ];

  useEffect(() => {
    if (isAllModules) {
      if (readyModuleCount <= 1) setFocus(fallbackFocusValue);
      return;
    }

    if (focus !== activeModule.value) setFocus(activeModule.value);
  }, [activeModule?.value, fallbackFocusValue, focus, isAllModules, readyModuleCount]);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">综合概览焦点</h3>
            <p className="mt-1 text-xs text-slate-500">默认只打开一个报告焦点，其他结果可在下方直接切换。</p>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            当前：{isAllModules ? '全面铺开' : activeModule.label}
          </span>
        </div>

        <FlowModuleSelector
          title="综合焦点结果控件"
          hint="点击查看核心指标、综合研判、教学积分或全面铺开"
          modules={selectorModules}
          activeValue={focus}
          onChange={setFocus}
          scrollTargetId="score-comprehensive-focus-content"
        />
      </div>

      <div id="score-comprehensive-focus-content" className="scroll-mt-32">
        {isAllModules ? (
          <div className="space-y-6">
            {readyModules.map(module => (
              <section key={module.value} className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{module.label}</h3>
                  <p className="mt-1 text-xs text-slate-500">{module.desc}</p>
                </div>
                {module.content}
              </section>
            ))}
          </div>
        ) : activeModule.content}
      </div>
    </div>
  );
}
