import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ClipboardList,
  Database,
  FileText,
  HelpCircle,
  Layers,
  Sparkles,
} from 'lucide-react';

const cx = (...items) => items.filter(Boolean).join(' ');

export function ScoreToolEmptyState({
  title,
  detail,
  readiness,
  buttonClass = 'bg-blue-600 hover:bg-blue-700',
}) {
  const PrimaryActionIcon = readiness?.primaryIcon;

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <BarChart3 className="mx-auto mb-4 h-12 w-12 text-slate-300" />
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {detail && <p className="mt-2 text-sm text-slate-500">{detail}</p>}
      {readiness && (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            onClick={readiness.primaryAction}
            disabled={readiness.primaryDisabled}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50 ${buttonClass}`}
          >
            {PrimaryActionIcon && (
              <PrimaryActionIcon className={`h-4 w-4 ${readiness.primaryLoading ? 'animate-spin' : ''}`} />
            )}
            {readiness.primaryLabel}
          </button>
          {readiness.secondaryLabel && (
            <button
              onClick={readiness.secondaryAction}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {readiness.secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ScoreAnalysisWorkflow({
  selectedGrade,
  selectedExamLabel,
  scopeLabel,
  syncMessage,
  isBackendSynced,
  isScoreLoading,
  gradeExamCount,
  validScoreCount,
  invalidScoreCount,
  participantCount,
  analysisDone,
  workflowSteps,
  analysisTypes,
  analysisType,
  setAnalysisType,
  historyCompare,
  setHistoryCompare,
  analysisScope,
  analysisResult,
  onJumpToResult,
  gradeOptions,
  selectedGradeValue,
  setSelectedGrade,
  hasGradeExamOptions,
  selectedExamId,
  setSelectedExamById,
  analysisScopeValue,
  setAnalysisScope,
  gradeExamOptions,
  getExamOptionLabel,
  readiness,
  readinessToneClasses,
  readinessButtonClasses,
  quickActionGroups,
  insightCards = [],
  onShowHelp,
}) {
  const [activePanel, setActivePanel] = useState('prepare');
  const [activeQuickActionGroup, setActiveQuickActionGroup] = useState('');
  const [quickActionsExpanded, setQuickActionsExpanded] = useState(false);
  const previousAnalysisDoneRef = useRef(false);
  const ReadinessIcon = readiness.icon;
  const PrimaryActionIcon = readiness.primaryIcon;
  const metricCards = [
    { label: '考试', value: gradeExamCount, icon: ClipboardList },
    { label: '有效成绩', value: validScoreCount, icon: Database },
    { label: '缺考/无效', value: invalidScoreCount, icon: Circle },
    { label: '分析状态', value: analysisDone ? '完成' : '待算', icon: Sparkles },
  ];
  const focusAreas = [
    ...analysisTypes.map(item => ({
      ...item,
      description: item.value === 'overall'
        ? '总览指标'
        : item.value === 'subject_analysis'
          ? '学科短板'
          : item.value === 'teaching_score'
            ? '班级积分'
            : '学生变化',
    })),
    { value: 'layer_comparison', label: '层次对比', description: 'A/B/C层', icon: Layers },
    { value: 'class_contrast', label: '班级对比', description: '班级差异', icon: BarChart3 },
    { value: 'history_compare', label: '历史对比', description: '多考趋势', icon: FileText },
  ];
  const activeFocusArea = focusAreas.find(item => item.value === analysisType);
  const completedStepCount = workflowSteps.filter(step => step.done).length;
  const headlineInsight = insightCards[0];
  const commandPanels = [
    {
      value: 'prepare',
      label: '数据设置',
      desc: `${selectedGrade} · ${selectedExamLabel}`,
      icon: ClipboardList,
    },
    {
      value: 'focus',
      label: '分析视角',
      desc: activeFocusArea?.label || '选择研判口径',
      icon: BarChart3,
    },
    {
      value: 'progress',
      label: '数据状态',
      desc: `${completedStepCount}/${workflowSteps.length || 0} 已就绪`,
      icon: CheckCircle2,
    },
    ...(analysisDone ? [
      {
        value: 'insights',
        label: '核心洞察',
        desc: headlineInsight ? `${headlineInsight.label} ${headlineInsight.value}` : '等待分析结果',
        icon: Sparkles,
      },
      {
        value: 'all',
        label: '全面铺开',
      desc: '常用板块同屏显示',
        icon: Layers,
      },
    ] : []),
  ];
  const activePanelConfig = commandPanels.find(panel => panel.value === activePanel) || commandPanels[0];
  const quickActionAllValue = '__all__';
  const quickActionGroupOptions = [
    ...quickActionGroups.map(group => ({
      value: group.title,
      label: group.title,
      desc: group.hint,
      icon: group.title === '数据' ? Database : group.title === '研判' ? BarChart3 : group.title === '输出' ? FileText : ClipboardList,
    })),
    ...(quickActionGroups.length > 1 ? [{
      value: quickActionAllValue,
      label: '全面铺开',
      desc: `${quickActionGroups.length} 组入口同屏`,
      icon: Layers,
    }] : []),
  ];
  const isAllQuickActions = activeQuickActionGroup === quickActionAllValue;
  const activeQuickGroup = quickActionGroups.find(group => group.title === activeQuickActionGroup) || quickActionGroups[0];
  const activeQuickConfig = isAllQuickActions
    ? quickActionGroupOptions.find(group => group.value === quickActionAllValue)
    : quickActionGroupOptions.find(group => group.value === activeQuickGroup?.title);

  useEffect(() => {
    if (activeQuickActionGroup === quickActionAllValue) return;
    if (quickActionGroups.length === 0) {
      if (activeQuickActionGroup) setActiveQuickActionGroup('');
      return;
    }
    if (!quickActionGroups.some(group => group.title === activeQuickActionGroup)) {
      setActiveQuickActionGroup(quickActionGroups[0].title);
    }
  }, [activeQuickActionGroup, quickActionAllValue, quickActionGroups]);

  useEffect(() => {
    const wasDone = previousAnalysisDoneRef.current;
    previousAnalysisDoneRef.current = analysisDone;
    if (!analysisDone || wasDone) return;

    if (activePanel === 'prepare') {
      setActivePanel('insights');
    }

    const reviewGroup = quickActionGroups.find(group => group.title === '研判');
    const firstGroupTitle = quickActionGroups[0]?.title;
    if (reviewGroup && (!activeQuickActionGroup || activeQuickActionGroup === firstGroupTitle)) {
      setActiveQuickActionGroup(reviewGroup.title);
    }
  }, [activePanel, activeQuickActionGroup, analysisDone, quickActionGroups]);

  useEffect(() => {
    if (analysisDone) return;
    if (activePanel === 'insights' || activePanel === 'all') {
      setActivePanel('prepare');
    }
    if (quickActionsExpanded) setQuickActionsExpanded(false);
  }, [activePanel, analysisDone, quickActionsExpanded]);

  const handleFocusAreaClick = (item) => {
    setAnalysisType(item.value);
    if (item.value === 'history_compare') {
      setHistoryCompare({
        ...historyCompare,
        scope: historyCompare.scope || analysisScope || 'all',
      });
    }
    if (analysisResult) onJumpToResult();
  };

  const renderPreparePanel = () => (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">数据设置</h3>
        <p className="mt-1 text-xs text-slate-500">选择年级、考试和分析范围，执行一次统一口径计算。</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[150px_minmax(220px,1fr)_150px]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">年级</span>
          <select
            value={selectedGradeValue}
            onChange={(event) => setSelectedGrade(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            {gradeOptions.map(grade => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">考试</span>
          <select
            value={selectedExamId || ''}
            onChange={(event) => setSelectedExamById(event.target.value)}
            disabled={!hasGradeExamOptions}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">{hasGradeExamOptions ? '请选择考试' : '当前年级暂无考试'}</option>
            {gradeExamOptions.map(exam => (
              <option key={exam.id} value={exam.id}>{getExamOptionLabel(exam)}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">范围</span>
          <select
            value={analysisScopeValue}
            onChange={(event) => setAnalysisScope(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全段</option>
            <option value="layer_a">A层</option>
            <option value="layer_b">B层</option>
            <option value="layer_c">C层</option>
          </select>
        </label>
      </div>
    </section>
  );

  const renderFocusPanel = () => (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">分析视角</h3>
          <p className="mt-1 text-xs text-slate-500">只选择当前要研判的一类问题，完成后结果区会自动跟随。</p>
        </div>
        <button
          type="button"
          onClick={onShowHelp}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          指引
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
        {focusAreas.map(item => {
          const Icon = item.icon;
          const active = analysisType === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => handleFocusAreaClick(item)}
              className={cx(
                'min-h-20 rounded-lg border px-3 py-3 text-left transition-colors',
                active
                  ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon className={cx('h-4 w-4', active ? 'text-blue-700' : 'text-slate-400')} />
                {active && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
              </div>
              <p className="mt-2 text-sm font-semibold">{item.label}</p>
              <p className="mt-1 text-xs text-slate-500">{item.description}</p>
            </button>
          );
        })}
      </div>
    </section>
  );

  const renderProgressPanel = () => (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">数据状态</h3>
        <p className="mt-1 text-xs text-slate-500">查看数据、计算、专项结果和发布输出是否可用。</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {workflowSteps.map(step => (
          <div
            key={step.title}
            className={cx(
              'min-h-24 rounded-lg border p-3',
              step.done ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500">{step.done ? '已就绪' : '待就绪'}</span>
              {step.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-slate-300" />}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{step.title}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{step.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );

  const renderInsightsPanel = () => (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">核心洞察</h3>
        <p className="mt-1 text-xs text-slate-500">重点显示最需要教务处决策或追踪的指标。</p>
      </div>
      {insightCards.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {insightCards.map(card => (
            <div key={card.label} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">{card.label}</p>
              <p className={cx('mt-2 text-2xl font-bold leading-none', card.tone || 'text-slate-950')}>{card.value}</p>
              {card.detail && <p className="mt-2 text-xs leading-5 text-slate-500">{card.detail}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
          暂无可用洞察。完成分析后会在这里显示关键结论。
        </div>
      )}
    </section>
  );

  const renderActivePanel = () => {
    if (activePanel === 'focus') return renderFocusPanel();
    if (activePanel === 'progress') return renderProgressPanel();
    if (activePanel === 'insights') return renderInsightsPanel();
    if (activePanel === 'all') {
      return (
        <div className="space-y-5">
          {renderPreparePanel()}
          {renderFocusPanel()}
          {renderProgressPanel()}
          {renderInsightsPanel()}
        </div>
      );
    }
    return renderPreparePanel();
  };

  const renderQuickActionGroup = (group) => (
    <div key={group.title} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div>
        <p className="text-xs font-semibold text-blue-600">当前分组：{group.title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{group.hint}</p>
      </div>
      <div className="mt-3 space-y-2">
        {group.actions.map(action => {
          const ActionIcon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={action.action}
              disabled={action.disabled}
              className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                action.primary
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <ActionIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{action.label}</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderQuickActionWorkspace = () => {
    if (!analysisDone) return null;
    if (quickActionGroups.length === 0) return null;

    const recommendedAction = activeQuickGroup?.actions?.find(action => action.primary && !action.disabled) ||
      activeQuickGroup?.actions?.find(action => !action.disabled) ||
      activeQuickGroup?.actions?.[0];
    const RecommendedIcon = recommendedAction?.icon;

    if (!quickActionsExpanded) {
      return (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">当前建议动作</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {activeQuickGroup?.hint || '选择需要打开的结果或输出。'}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              {activeQuickGroup?.title || '专项'}
            </span>
          </div>

          {recommendedAction && (
            <button
              type="button"
              onClick={recommendedAction.action}
              disabled={recommendedAction.disabled}
              className={cx(
                'mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                recommendedAction.primary
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                {RecommendedIcon && <RecommendedIcon className="h-4 w-4 shrink-0" />}
                <span className="truncate">{recommendedAction.label}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setQuickActionsExpanded(true)}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            更多专项结果
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">专项结果入口</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">按分组打开常用结果、名单和输出工具。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              当前：{activeQuickConfig?.label || activeQuickGroup?.title || '快捷操作'}
            </span>
            <button
              type="button"
              onClick={() => setQuickActionsExpanded(false)}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              收起
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mb-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {quickActionGroupOptions.map((group, index) => {
            const OptionIcon = group.icon;
            const active = group.value === (isAllQuickActions ? quickActionAllValue : activeQuickGroup?.title);
            const isLast = index === quickActionGroupOptions.length - 1;

            return (
              <button
                key={group.value}
                type="button"
                onClick={() => setActiveQuickActionGroup(group.value)}
                className={cx(
                  'flex min-h-16 w-full items-start gap-3 px-3 py-3 text-left transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-900'
                    : 'bg-white text-slate-700 hover:bg-blue-50',
                  !isLast && 'border-b border-slate-200'
                )}
              >
                <span className={cx(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                )}>
                  <OptionIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-semibold">{group.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{group.desc}</span>
                </span>
                {active && <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-600" />}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {isAllQuickActions
            ? quickActionGroups.map(renderQuickActionGroup)
            : activeQuickGroup && renderQuickActionGroup(activeQuickGroup)}
        </div>
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-slate-950">成绩分析指挥台</h2>
              <span className={cx(
                'rounded-full px-2.5 py-1 text-xs font-medium',
                isBackendSynced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              )}>
                {isScoreLoading ? '成绩同步中' : syncMessage}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-md border border-slate-200 px-2 py-1">{selectedGrade}</span>
              <span className="rounded-md border border-slate-200 px-2 py-1">{selectedExamLabel}</span>
              <span className="rounded-md border border-slate-200 px-2 py-1">{scopeLabel}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[500px]">
            {metricCards.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="min-h-20 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <Icon className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-2 text-2xl font-bold leading-none text-slate-950">{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5 p-5">
          <div>
            <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">分析控件</h3>
                <p className="mt-1 text-xs text-slate-500">点击控件查看对应内容，结果生成后可直接进入专项。</p>
              </div>
              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                当前：{activePanelConfig.label}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="flex flex-col gap-2 xl:flex-row">
              {commandPanels.map(panel => {
                const PanelIcon = panel.icon;
                const active = panel.value === activePanel;
                return (
                  <button
                    key={panel.value}
                    type="button"
                    onClick={() => setActivePanel(panel.value)}
                    className={cx(
                      'flex min-h-16 flex-1 items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors',
                      active
                        ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                        : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <span className={cx(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                    )}>
                      <PanelIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {panel.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{panel.desc}</span>
                    </span>
                  </button>
                );
              })}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            {renderActivePanel()}
          </div>
        </div>

        <aside className="border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0">
          <div className={`rounded-lg border p-4 ${readinessToneClasses[readiness.tone] || readinessToneClasses.blue}`}>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-white/75 p-2">
                <ReadinessIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{readiness.title}</p>
                <p className="mt-1 text-xs leading-5 opacity-90">{readiness.description}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <button
              onClick={readiness.primaryAction}
              disabled={readiness.primaryDisabled}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${readinessButtonClasses[readiness.tone] || readinessButtonClasses.blue}`}
            >
              <PrimaryActionIcon className={`h-4 w-4 ${readiness.primaryLoading ? 'animate-spin' : ''}`} />
              {readiness.primaryLabel}
            </button>
            {readiness.secondaryLabel && (
              <button
                onClick={readiness.secondaryAction}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                {readiness.secondaryLabel}
              </button>
            )}
          </div>

          {renderQuickActionWorkspace()}

          <button
            type="button"
            onClick={onJumpToResult}
            disabled={!analysisResult}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            进入结果区
            <ArrowRight className="h-4 w-4" />
          </button>
        </aside>
      </div>
    </div>
  );
}
