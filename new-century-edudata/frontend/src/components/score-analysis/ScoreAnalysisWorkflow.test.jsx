import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Eye, RefreshCw } from 'lucide-react';
import ScoreAnalysisWorkflow, { ScoreToolEmptyState } from './ScoreAnalysisWorkflow';

describe('ScoreToolEmptyState', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders readiness actions and dispatches clicks', () => {
    const primaryAction = jest.fn();
    const secondaryAction = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreToolEmptyState
          title="教学积分待生成"
          detail="期中考试 · 120 条成绩"
          readiness={{
            primaryIcon: RefreshCw,
            primaryLabel: '执行分析',
            primaryAction,
            secondaryLabel: '查看原始数据',
            secondaryAction,
          }}
        />
      );
    });

    expect(container.textContent).toContain('教学积分待生成');
    expect(container.textContent).toContain('期中考试 · 120 条成绩');

    const buttons = container.querySelectorAll('button');
    act(() => {
      buttons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      buttons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(primaryAction).toHaveBeenCalledTimes(1);
    expect(secondaryAction).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps analysis controls wired to caller state handlers', () => {
    const setSelectedGrade = jest.fn();
    const setSelectedExamById = jest.fn();
    const setAnalysisScope = jest.fn();
    const setAnalysisType = jest.fn();
    const setHistoryCompare = jest.fn();
    const onJumpToResult = jest.fn();
    const onShowHelp = jest.fn();
    const primaryAction = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisWorkflow
          selectedGrade="7年级"
          selectedExamLabel="2026 期中"
          scopeLabel="全段"
          syncMessage="已同步后端成绩行"
          isBackendSynced
          isScoreLoading={false}
          gradeExamCount={2}
          validScoreCount={120}
          invalidScoreCount={3}
          participantCount={118}
          analysisDone={false}
          workflowSteps={[{ title: '数据状态', detail: '120 条成绩', done: true }]}
          analysisTypes={[{ value: 'overall', label: '整体分析', icon: Eye }]}
          analysisType="overall"
          setAnalysisType={setAnalysisType}
          historyCompare={{ scope: '' }}
          setHistoryCompare={setHistoryCompare}
          selectedExam={{ id: 8 }}
          analysisScope="all"
          analysisResult={{ id: 'result' }}
          onJumpToResult={onJumpToResult}
          gradeOptions={['7年级', '8年级']}
          selectedGradeValue="7年级"
          setSelectedGrade={setSelectedGrade}
          hasGradeExamOptions
          selectedExamId={8}
          setSelectedExamById={setSelectedExamById}
          analysisScopeValue="all"
          setAnalysisScope={setAnalysisScope}
          gradeExamOptions={[{ id: 8, exam_name: '期中' }, { id: 9, exam_name: '期末' }]}
          getExamOptionLabel={(exam) => exam.exam_name}
          readiness={{
            tone: 'emerald',
            icon: Eye,
            title: '数据已就绪',
            description: '可以执行分析',
            primaryIcon: RefreshCw,
            primaryLabel: '执行分析',
            primaryAction,
          }}
          readinessToneClasses={{
            emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
            blue: 'border-blue-200 bg-blue-50 text-blue-800',
          }}
          readinessButtonClasses={{
            emerald: 'bg-emerald-600 hover:bg-emerald-700',
            blue: 'bg-blue-600 hover:bg-blue-700',
          }}
          quickActionGroups={[]}
          onShowHelp={onShowHelp}
        />
      );
    });

    const selects = container.querySelectorAll('select');
    act(() => {
      selects[0].value = '8年级';
      selects[0].dispatchEvent(new Event('change', { bubbles: true }));
      selects[1].value = '9';
      selects[1].dispatchEvent(new Event('change', { bubbles: true }));
      selects[2].value = 'layer_a';
      selects[2].dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setSelectedGrade).toHaveBeenCalledWith('8年级');
    expect(setSelectedExamById).toHaveBeenCalledWith('9');
    expect(setAnalysisScope).toHaveBeenCalledWith('layer_a');
    expect(container.textContent).toContain('当前：数据设置');
    expect(container.textContent).not.toContain('多考趋势');
    expect(container.textContent).not.toContain('暂无可用洞察');

    const focusPanelButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('分析视角'));
    act(() => {
      focusPanelButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：分析视角');
    const historyButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('历史对比'));
    act(() => {
      historyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(setAnalysisType).toHaveBeenCalledWith('history_compare');
    expect(setHistoryCompare).toHaveBeenCalledWith({ scope: 'all' });
    expect(onJumpToResult).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('核心洞察');
    expect(container.textContent).not.toContain('全面铺开');
    expect(container.textContent).not.toContain('暂无可用洞察');

    const helpButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('指引'));
    act(() => {
      helpButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onShowHelp).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps quick result actions hidden before analysis is generated', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisWorkflow
          selectedGrade="7年级"
          selectedExamLabel="2026 期中"
          scopeLabel="全段"
          syncMessage="已同步后端成绩行"
          isBackendSynced
          isScoreLoading={false}
          gradeExamCount={2}
          validScoreCount={120}
          invalidScoreCount={3}
          participantCount={118}
          analysisDone={false}
          workflowSteps={[{ title: '数据状态', detail: '120 条成绩', done: true }]}
          analysisTypes={[{ value: 'overall', label: '整体分析', icon: Eye }]}
          analysisType="overall"
          setAnalysisType={jest.fn()}
          historyCompare={{ scope: '' }}
          setHistoryCompare={jest.fn()}
          selectedExam={{ id: 8 }}
          analysisScope="all"
          analysisResult={null}
          onJumpToResult={jest.fn()}
          gradeOptions={['7年级', '8年级']}
          selectedGradeValue="7年级"
          setSelectedGrade={jest.fn()}
          hasGradeExamOptions
          selectedExamId={8}
          setSelectedExamById={jest.fn()}
          analysisScopeValue="all"
          setAnalysisScope={jest.fn()}
          gradeExamOptions={[{ id: 8, exam_name: '期中' }]}
          getExamOptionLabel={(exam) => exam.exam_name}
          readiness={{
            tone: 'emerald',
            icon: Eye,
            title: '数据已就绪',
            description: '可以执行分析',
            primaryIcon: RefreshCw,
            primaryLabel: '执行分析',
            primaryAction: jest.fn(),
            secondaryLabel: '查看原始数据',
            secondaryAction: jest.fn(),
          }}
          readinessToneClasses={{
            emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
            blue: 'border-blue-200 bg-blue-50 text-blue-800',
          }}
          readinessButtonClasses={{
            emerald: 'bg-emerald-600 hover:bg-emerald-700',
            blue: 'bg-blue-600 hover:bg-blue-700',
          }}
          quickActionGroups={[
            {
              title: '数据',
              hint: '原始成绩与有效状态',
              actions: [{ label: '原始数据', icon: Eye, action: jest.fn() }],
            },
            {
              title: '研判',
              hint: '执行分析后显示专项工具',
              actions: [{ label: 'A层临界生', icon: Eye, action: jest.fn(), disabled: true }],
            },
          ]}
          onShowHelp={jest.fn()}
        />
      );
    });

    expect(container.textContent).toContain('数据已就绪');
    expect(container.textContent).toContain('执行分析');
    expect(container.textContent).toContain('查看原始数据');
    expect(container.textContent).not.toContain('专项结果入口');
    expect(container.textContent).not.toContain('执行分析后显示专项工具');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps quick action groups compact and expands result entries after analysis is done', () => {
    const rawAction = jest.fn();
    const resetAction = jest.fn();
    const publishAction = jest.fn();
    const pdfAction = jest.fn();
    const jsonAction = jest.fn();
    const historyAction = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisWorkflow
          selectedGrade="7年级"
          selectedExamLabel="2026 期中"
          scopeLabel="全段"
          syncMessage="已同步后端成绩行"
          isBackendSynced
          isScoreLoading={false}
          gradeExamCount={2}
          validScoreCount={120}
          invalidScoreCount={3}
          participantCount={118}
          analysisDone
          workflowSteps={[{ title: '数据状态', detail: '120 条成绩', done: true }]}
          analysisTypes={[{ value: 'overall', label: '整体分析', icon: Eye }]}
          analysisType="overall"
          setAnalysisType={jest.fn()}
          historyCompare={{ scope: '' }}
          setHistoryCompare={jest.fn()}
          selectedExam={{ id: 8 }}
          analysisScope="all"
          analysisResult={{ id: 'result' }}
          onJumpToResult={jest.fn()}
          gradeOptions={['7年级', '8年级']}
          selectedGradeValue="7年级"
          setSelectedGrade={jest.fn()}
          hasGradeExamOptions
          selectedExamId={8}
          setSelectedExamById={jest.fn()}
          analysisScopeValue="all"
          setAnalysisScope={jest.fn()}
          gradeExamOptions={[{ id: 8, exam_name: '期中' }]}
          getExamOptionLabel={(exam) => exam.exam_name}
          readiness={{
            tone: 'emerald',
            icon: Eye,
            title: '数据已就绪',
            description: '可以执行分析',
            primaryIcon: RefreshCw,
            primaryLabel: '执行分析',
            primaryAction: jest.fn(),
          }}
          readinessToneClasses={{
            emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
            blue: 'border-blue-200 bg-blue-50 text-blue-800',
          }}
          readinessButtonClasses={{
            emerald: 'bg-emerald-600 hover:bg-emerald-700',
            blue: 'bg-blue-600 hover:bg-blue-700',
          }}
          quickActionGroups={[
            {
              title: '数据',
              hint: '原始成绩与有效状态',
              actions: [
                { label: '原始数据', icon: Eye, action: rawAction },
                { label: '重置', icon: RefreshCw, action: resetAction },
              ],
            },
            {
              title: '输出',
              hint: '发布给角色看板、导出或追溯归档',
              actions: [
                { label: '发布', icon: Eye, action: publishAction, primary: true },
                { label: 'PDF', icon: RefreshCw, action: pdfAction },
                { label: 'JSON', icon: RefreshCw, action: jsonAction },
                { label: '历史', icon: Eye, action: historyAction },
              ],
            },
          ]}
          onShowHelp={jest.fn()}
        />
      );
    });

    expect(container.textContent).toContain('当前建议动作');
    expect(container.textContent).toContain('数据');
    expect(container.textContent).toContain('原始数据');
    expect(container.textContent).not.toContain('重置');
    expect(container.textContent).not.toContain('PDF');
    expect(container.textContent).not.toContain('JSON');

    const expandButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('更多专项结果'));
    act(() => {
      expandButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('专项结果入口');
    expect(container.textContent).toContain('当前：数据');
    expect(container.textContent).toContain('重置');

    const dataButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('原始成绩与有效状态'));
    expect(dataButton.className).toContain('bg-blue-50');

    const outputButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('发布给角色看板'));
    act(() => {
      outputButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：输出');
    expect(container.textContent).toContain('发布');
    expect(container.textContent).toContain('PDF');
    expect(container.textContent).toContain('JSON');

    const spreadButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('组入口同屏'));
    act(() => {
      spreadButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('原始数据');
    expect(container.textContent).toContain('JSON');

    const jsonButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('JSON'));
    act(() => {
      jsonButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(jsonAction).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('advances to insights and review actions once analysis is done', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisWorkflow
          selectedGrade="7年级"
          selectedExamLabel="2026 期中"
          scopeLabel="全段"
          syncMessage="已同步后端成绩行"
          isBackendSynced
          isScoreLoading={false}
          gradeExamCount={2}
          validScoreCount={120}
          invalidScoreCount={3}
          participantCount={118}
          analysisDone
          workflowSteps={[
            { title: '数据状态', detail: '120 条成绩', done: true },
            { title: '生成分析', detail: '已完成', done: true },
          ]}
          analysisTypes={[{ value: 'overall', label: '整体分析', icon: Eye }]}
          analysisType="overall"
          setAnalysisType={jest.fn()}
          historyCompare={{ scope: '' }}
          setHistoryCompare={jest.fn()}
          selectedExam={{ id: 8 }}
          analysisScope="all"
          analysisResult={{ id: 'result' }}
          onJumpToResult={jest.fn()}
          gradeOptions={['7年级', '8年级']}
          selectedGradeValue="7年级"
          setSelectedGrade={jest.fn()}
          hasGradeExamOptions
          selectedExamId={8}
          setSelectedExamById={jest.fn()}
          analysisScopeValue="all"
          setAnalysisScope={jest.fn()}
          gradeExamOptions={[{ id: 8, exam_name: '期中' }]}
          getExamOptionLabel={(exam) => exam.exam_name}
          readiness={{
            tone: 'emerald',
            icon: Eye,
            title: '分析已完成',
            description: '可以进入研判',
            primaryIcon: Eye,
            primaryLabel: '查看报告',
            primaryAction: jest.fn(),
          }}
          readinessToneClasses={{
            emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
            blue: 'border-blue-200 bg-blue-50 text-blue-800',
          }}
          readinessButtonClasses={{
            emerald: 'bg-emerald-600 hover:bg-emerald-700',
            blue: 'bg-blue-600 hover:bg-blue-700',
          }}
          quickActionGroups={[
            {
              title: '数据',
              hint: '原始成绩与有效状态',
              actions: [{ label: '原始数据', icon: Eye, action: jest.fn() }],
            },
            {
              title: '研判',
              hint: '选择专项后直接进入工作区',
              actions: [{ label: 'A层临界生', icon: Eye, action: jest.fn(), primary: true }],
            },
            {
              title: '输出',
              hint: '发布给角色看板、导出或追溯归档',
              actions: [{ label: '发布', icon: Eye, action: jest.fn() }],
            },
          ]}
          insightCards={[{
            label: '范围均分',
            value: '412.5',
            detail: '全段',
            tone: 'text-blue-700',
          }]}
          onShowHelp={jest.fn()}
        />
      );
    });

    expect(container.textContent).toContain('当前：核心洞察');
    expect(container.textContent).toContain('范围均分');
    expect(container.textContent).toContain('当前建议动作');
    expect(container.textContent).toContain('研判');
    expect(container.textContent).toContain('A层临界生');
    expect(container.textContent).not.toContain('当前：数据设置');

    const allPanelButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('常用板块同屏显示'));
    act(() => {
      allPanelButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('数据设置');
    expect(container.textContent).toContain('数据状态');
    expect(container.textContent).toContain('范围均分');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
