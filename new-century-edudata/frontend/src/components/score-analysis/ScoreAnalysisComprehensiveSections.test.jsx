import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ScoreAnalysisComprehensiveSections, {
  buildClassComparisonModel,
  buildDistributionSummaryModel,
  buildLayerMetrics,
  buildSubjectAnalysisModel,
} from './ScoreAnalysisComprehensiveSections';

const baseData = {
  scopes: {
    A: {
      summary: { participated: 2, total_students: 3, grade_mean: 92.4, grade_std: 4.1 },
      key_metrics: {
        total: {
          standard_score: 510,
          top20_score: 98,
          top40_score: 94,
          top80_score: 86,
          z_score: 1.2,
        },
      },
    },
    B: {
      summary: { participated: 3, total_students: 3, grade_mean: 82.1, grade_std: 5.2 },
      key_metrics: {
        total: {
          standard_score: 495,
          top20_score: 88,
          top40_score: 84,
          top80_score: 76,
          z_score: 0.1,
        },
      },
    },
    C: {
      summary: { participated: 4, total_students: 4, grade_mean: 70.8, grade_std: 6.3 },
      key_metrics: {
        total: {
          standard_score: 480,
          top20_score: 78,
          top40_score: 74,
          top80_score: 66,
          z_score: -0.8,
        },
      },
    },
  },
};

const layerComparison = {
  layer_statistics: {
    A: {},
    B: {},
    C: {},
  },
  t_test_results: {
    A_vs_B: { t_statistic: 2.34, p_value: 0.0214, significant: true },
  },
  chart_data: {
    class_comparison: [
      { class: '701班', layer: 'A', mean: 92.4 },
      { class: '702班', layer: 'B', mean: 82.1 },
    ],
  },
};

const subjectAnalysis = {
  subject_statistics: {
    语文: { mean: 84.6, std: 5.1 },
    数学: { mean: 76.3, std: 9.8 },
  },
  chart_data: {
    subject_scores: [
      { subject: '语文', mean: 84.6 },
      { subject: '数学', mean: 76.3 },
    ],
  },
};

const overall = {
  distribution: {
    excellent: 2,
    good: 3,
    pass: 4,
    fail: 1,
  },
  chart_data: {
    score_distribution: [
      { range: '90-100', count: 2 },
      { range: '80-89', count: 3 },
    ],
  },
};

const keyMetrics = {
  subjects: {
    语文: { top20_score: 92 },
    数学: { top20_score: 88 },
  },
};

const renderComponent = (props) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <ScoreAnalysisComprehensiveSections
        data={baseData}
        scopeKey="all"
        layerComparison={layerComparison}
        subjectAnalysis={subjectAnalysis}
        overall={overall}
        keyMetrics={keyMetrics}
        {...props}
      />
    );
  });

  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const findButton = (container, label, { enabledOnly = false, occurrence = 0 } = {}) => {
  const buttons = Array.from(container.querySelectorAll('button'))
    .filter(item => item.textContent.includes(label) && (!enabledOnly || !item.disabled));
  const button = buttons[occurrence];
  expect(button).toBeTruthy();
  return button;
};

const clickButton = (container, label, options = {}) => {
  const button = findButton(container, label, options);
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return button;
};

describe('ScoreAnalysisComprehensiveSections', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('builds layer cards from the selected scope', () => {
    const metrics = buildLayerMetrics({ data: baseData, scopeKey: 'B' });

    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({
      layer: 'B',
      label: 'B层（创新班）',
      participated: 3,
      mean: 82.1,
    });
  });

  it('builds a class comparison model for summary-first reading', () => {
    const model = buildClassComparisonModel(layerComparison.chart_data.class_comparison);

    expect(model.rows).toHaveLength(2);
    expect(model.topClass).toMatchObject({ className: '701班', layer: 'A', mean: 92.4 });
    expect(model.bottomClass).toMatchObject({ className: '702班', layer: 'B', mean: 82.1 });
    expect(model.spread).toBeCloseTo(10.3);
    expect(model.layerGroups.map(group => group.label)).toEqual(['A层（实验班）', 'B层（创新班）']);
  });

  it('builds subject and distribution summary models', () => {
    const subjectModel = buildSubjectAnalysisModel(subjectAnalysis, keyMetrics);
    const distributionModel = buildDistributionSummaryModel(overall);

    expect(subjectModel.subjectCount).toBe(2);
    expect(subjectModel.averageMean).toBeCloseTo(80.45);
    expect(subjectModel.strongestSubject).toMatchObject({ subject: '语文', mean: 84.6 });
    expect(subjectModel.weakestSubject).toMatchObject({ subject: '数学', mean: 76.3 });
    expect(subjectModel.volatileSubject).toMatchObject({ subject: '数学', std: 9.8 });
    expect(subjectModel.rows[0].top20).toBe(92);

    expect(distributionModel.total).toBe(10);
    expect(distributionModel.excellentGoodRate).toBeCloseTo(50);
    expect(distributionModel.passRate).toBeCloseTo(90);
    expect(distributionModel.dominantBand).toMatchObject({ range: '80-89', count: 3 });
  });

  it('renders layer comparison separately from class comparison', () => {
    const { container, cleanup } = renderComponent({ analysisType: 'layer_comparison' });

    expect(container.textContent).toContain('综合研判结果显示');
    expect(container.textContent).toContain('综合研判结果控件');
    expect(container.textContent).toContain('层次分析结果');
    expect(container.textContent).toContain('当前：层次对比');
    expect(container.textContent).toContain('层次对比分析');
    expect(container.textContent).toContain('A层（实验班）');
    expect(container.textContent).not.toContain('层次间差异显著性检验');

    clickButton(container, '均分对比', { enabledOnly: true });
    expect(container.textContent).toContain('当前：均分对比');
    expect(container.textContent).toContain('各层次平均分对比');

    clickButton(container, 'Z分对比', { enabledOnly: true });
    expect(container.textContent).toContain('当前：Z分对比');
    expect(container.textContent).toContain('各层次Z分对比');

    clickButton(container, '差异检验', { enabledOnly: true });

    expect(container.textContent).toContain('层次间差异显著性检验');
    expect(container.textContent).toContain('A层 vs B层');
    expect(container.textContent).toContain('差异显著');
    expect(Array.from(container.querySelectorAll('h3')).map(node => node.textContent)).not.toContain('班级对比');

    clickButton(container, '4 个层次视图', { enabledOnly: true });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(Array.from(container.querySelectorAll('h4')).map(node => node.textContent)).toEqual(
      expect.arrayContaining(['层次概览', '均分对比', 'Z分对比', '差异检验'])
    );

    clickButton(container, '班级对比', { enabledOnly: true });

    expect(container.textContent).toContain('当前：班级对比');
    expect(container.textContent).toContain('班级对比');
    expect(container.textContent).toContain('班级对比结果');
    expect(container.textContent).toContain('当前：班级摘要');
    expect(container.textContent).toContain('高位班级 Top3');
    expect(container.textContent).toContain('需关注班级 Bottom3');
    expect(container.textContent).not.toContain('各班平均分横向对比');
    expect(Array.from(container.querySelectorAll('h4')).map(node => node.textContent)).not.toContain('层次间差异显著性检验');

    clickButton(container, '均分图', { enabledOnly: true });
    expect(container.textContent).toContain('当前：均分图');
    expect(container.textContent).toContain('各班平均分横向对比');

    clickButton(container, '层次分组', { enabledOnly: true });
    expect(container.textContent).toContain('当前：层次分组');
    expect(container.textContent).toContain('层内均分');

    expect(findButton(container, '研判主题').disabled).toBe(false);
    clickButton(container, '研判主题', { enabledOnly: true });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(Array.from(container.querySelectorAll('h3')).map(node => node.textContent)).toEqual(
      expect.arrayContaining(['成绩分布', '学科分析', '层次对比分析', '班级对比'])
    );

    cleanup();
  });

  it('renders the subject analysis table with top20 score lines', () => {
    const { container, cleanup } = renderComponent({ analysisType: 'subject_analysis' });

    expect(container.textContent).toContain('综合研判结果控件');
    expect(container.textContent).toContain('学科分析结果');
    expect(container.textContent).toContain('当前：学科分析');
    expect(container.textContent).toContain('学科分析');
    expect(container.textContent).toContain('当前：学科摘要');
    expect(container.textContent).toContain('学科研判提示');
    expect(container.textContent).toContain('优势学科');
    expect(container.textContent).not.toContain('各学科平均分');
    expect(container.textContent).not.toContain('前20%分数线');

    clickButton(container, '均分对比', { enabledOnly: true });
    expect(container.textContent).toContain('当前：均分对比');
    expect(container.textContent).toContain('各学科平均分');

    clickButton(container, '查看学科波动情况', { enabledOnly: true });
    expect(container.textContent).toContain('当前：离散度');
    expect(container.textContent).toContain('各学科标准差');

    clickButton(container, '明细表', { enabledOnly: true });

    expect(container.textContent).toContain('语文');
    expect(container.textContent).toContain('84.6');
    expect(container.textContent).toContain('92.0');
    expect(container.textContent).toContain('前20%分数线');
    expect(Array.from(container.querySelectorAll('h3')).map(node => node.textContent)).not.toContain('班级对比');

    clickButton(container, '4 个学科视图', { enabledOnly: true });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(Array.from(container.querySelectorAll('h4')).map(node => node.textContent)).toEqual(
      expect.arrayContaining(['学科摘要', '均分对比', '离散度', '明细表'])
    );

    cleanup();
  });

  it('renders overall distribution while keeping class comparison as a separate module', () => {
    const { container, cleanup } = renderComponent({ analysisType: 'overall' });

    expect(container.textContent).toContain('综合研判结果控件');
    expect(container.textContent).toContain('成绩分布结果');
    expect(container.textContent).toContain('当前：成绩分布');
    expect(container.textContent).toContain('成绩分布');
    expect(container.textContent).toContain('当前：分布摘要');
    expect(container.textContent).toContain('参考人数');
    expect(container.textContent).toContain('优良率');
    expect(container.textContent).toContain('高频分数段');
    expect(container.textContent).not.toContain('等级结构图');
    expect(Array.from(container.querySelectorAll('h3')).map(node => node.textContent)).not.toContain('班级对比');

    clickButton(container, '查看优秀、良好、及格结构', { enabledOnly: true });
    expect(container.textContent).toContain('当前：等级结构');
    expect(container.textContent).toContain('等级结构图');

    clickButton(container, '分数段统计', { enabledOnly: true });
    expect(container.textContent).toContain('当前：分数段统计');
    expect(container.textContent).toContain('分数段人数');

    clickButton(container, '3 个分布视图', { enabledOnly: true });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(Array.from(container.querySelectorAll('h4')).map(node => node.textContent)).toEqual(
      expect.arrayContaining(['分布摘要', '等级结构', '分数段统计'])
    );

    clickButton(container, '学科分析', { enabledOnly: true });
    expect(container.textContent).toContain('当前：学科分析');

    clickButton(container, '层次对比', { enabledOnly: true });
    expect(container.textContent).toContain('当前：层次对比');

    clickButton(container, '班级对比', { enabledOnly: true });

    expect(container.textContent).toContain('当前：班级对比');
    expect(container.textContent).toContain('A层（实验班）');
    expect(container.textContent).toContain('班级对比结果');
    expect(container.textContent).toContain('当前：班级摘要');
    expect(container.textContent).toContain('班级差距');
    expect(container.textContent).not.toContain('各班平均分横向对比');

    clickButton(container, '均分图', { enabledOnly: true });
    expect(container.textContent).toContain('当前：均分图');
    expect(container.textContent).toContain('各班平均分横向对比');

    clickButton(container, '层次分组', { enabledOnly: true });
    expect(container.textContent).toContain('当前：层次分组');

    clickButton(container, '摘要、图表和分组同屏', { enabledOnly: true });

    expect(container.textContent).toContain('当前：全面铺开');
    expect(Array.from(container.querySelectorAll('h4')).map(node => node.textContent)).toEqual(
      expect.arrayContaining(['班级摘要', '均分图', '层次分组'])
    );

    cleanup();
  });
});
