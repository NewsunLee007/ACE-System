/**
 * 各学科分数段人数统计组件
 * 支持按学科统计不同分数段的学生人数分布
 */

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Calculator, Upload, Settings2, RotateCcw, BarChart3, Table2, Maximize2 } from 'lucide-react';
import FlowModuleSelector from './score-analysis/FlowModuleSelector';

const DEFAULT_INTERVAL = 5;
const TOTAL_SCORE_INTERVAL = 20;
const VIEW_FLOW = ['overview', 'details', 'all'];
const SETTINGS_FLOW = ['summary', 'subjects', 'all'];

const SubjectScoreDistribution = ({ examData, examScores, subjects: propSubjects }) => {
  const [distributionData, setDistributionData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detectedSubjects, setDetectedSubjects] = useState([]);
  const [activeSubject, setActiveSubject] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [activeView, setActiveView] = useState('overview');
  const [activeSettingsView, setActiveSettingsView] = useState('summary');
  
  // 用户自定义分数段间隔
  const [customIntervals, setCustomIntervals] = useState({});
  const [tempIntervals, setTempIntervals] = useState({});
  
  // 智能分数段间隔（根据学科自动调整）
  const [smartInterval, setSmartInterval] = useState(true);

  // 从成绩数据中自动检测科目
  const detectSubjects = useCallback(() => {
    if (!examScores || examScores.length === 0) {
      return propSubjects || [];
    }
    
    const firstScore = examScores[0];
    const excludeFields = ['id', 'exam_id', 'student_id', 'student_name', 'student_code', 
                          'class_id', 'class_name', 'total_score', 'rank', 'class_rank',
                          'is_valid', 'additional_classes', 'created_at', 'updated_at', 'scores'];
    
    if (firstScore.scores && typeof firstScore.scores === 'object') {
      return Object.keys(firstScore.scores).filter(k => !excludeFields.includes(k));
    }
    
    return Object.keys(firstScore).filter(key => !excludeFields.includes(key));
  }, [examScores, propSubjects]);
  
  // 获取学科成绩
  const getSubjectScore = useCallback((scoreRecord, subject) => {
    if (scoreRecord.scores && scoreRecord.scores[subject] !== undefined) {
      return scoreRecord.scores[subject];
    }
    return scoreRecord[subject];
  }, []);
  
  // 获取实际使用的科目列表
  const subjects = useMemo(
    () => (detectedSubjects.length > 0 ? detectedSubjects : (propSubjects || [])),
    [detectedSubjects, propSubjects]
  );
  const displaySubjectLabel = (subject) => (subject === '总分' ? '总分（统计维度）' : subject);
  const activeDistribution = useMemo(
    () => distributionData.find(item => item.subject === activeSubject) || distributionData[0],
    [activeSubject, distributionData]
  );
  const leadingSegments = useMemo(() => (
    [...(activeDistribution?.distribution || [])]
      .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
      .slice(0, 5)
  ), [activeDistribution]);
  const goToView = useCallback((nextView) => {
    if (!VIEW_FLOW.includes(nextView)) return;
    setActiveView(nextView);
  }, []);

  const goToSettingsView = useCallback((nextView) => {
    if (!SETTINGS_FLOW.includes(nextView)) return;
    setActiveSettingsView(nextView);
  }, []);

  const viewModules = [
    {
      value: 'overview',
      label: '分布概览',
      desc: '关键指标与高频分数段',
      icon: BarChart3,
    },
    {
      value: 'details',
      label: '完整明细',
      desc: activeDistribution ? `${activeDistribution.distribution.length} 个分数段` : '等待统计',
      icon: Table2,
    },
    {
      value: 'all',
      label: '全面铺开',
      desc: '概览与分段表同屏复核',
      icon: Maximize2,
    },
  ].map((module) => ({
    ...module,
    ready: true,
  }));
  const activeViewConfig = viewModules.find(item => item.value === activeView) || viewModules[0];
  const settingsModules = [
    {
      value: 'summary',
      label: '智能口径',
      desc: smartInterval ? '当前按系统推荐间隔' : '当前使用手动间隔',
      icon: Settings2,
    },
    {
      value: 'subjects',
      label: '单科间隔',
      desc: `${subjects.length + 1} 个统计维度`,
      icon: Table2,
    },
    {
      value: 'all',
      label: '全面铺开',
      desc: '口径与输入同屏复核',
      icon: Maximize2,
    },
  ].map((module) => ({
    ...module,
    ready: true,
  }));
  const activeSettingsConfig = settingsModules.find(item => item.value === activeSettingsView) || settingsModules[0];
  
  // 获取学科的分数段间隔
  const getIntervalForSubject = useCallback((subject) => {
    // 如果用户自定义了间隔，使用自定义值
    if (customIntervals[subject] !== undefined) {
      return customIntervals[subject];
    }
    
    // 智能模式：根据学科自动调整
    if (smartInterval) {
      if (subject === '总分') {
        return TOTAL_SCORE_INTERVAL;
      }
      // 其他学科使用默认5分间隔
      return DEFAULT_INTERVAL;
    }
    
    return DEFAULT_INTERVAL;
  }, [customIntervals, smartInterval]);
  
  // 计算分数段分布
  const calculateDistribution = useCallback((scores, interval) => {
    if (!scores || scores.length === 0) return [];
    
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    
    // 计算分数段范围
    const segments = [];
    
    // 从最高分开始向下分段
    let currentMax = Math.ceil(maxScore / interval) * interval;
    const floorMin = Math.floor(minScore / interval) * interval;
    
    while (currentMax > floorMin) {
      const segmentMin = currentMax - interval;
      const segmentMax = currentMax;
      const count = scores.filter(s => s > segmentMin && s <= segmentMax).length;
      
      if (count > 0 || segments.length === 0) {
        segments.push({
          range: `${segmentMin}-${segmentMax}`,
          min: segmentMin,
          max: segmentMax,
          count: count,
          percentage: ((count / scores.length) * 100).toFixed(1)
        });
      }
      
      currentMax = segmentMin;
    }
    
    // 处理最低分段（包含等于最低分的情况）
    const lowestCount = scores.filter(s => s === minScore).length;
    if (lowestCount > 0 && segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      if (minScore <= lastSegment.min) {
        lastSegment.count += lowestCount;
        lastSegment.percentage = ((lastSegment.count / scores.length) * 100).toFixed(1);
      }
    }
    
    return segments.reverse(); // 从低到高排序
  }, []);
  
  // 计算所有学科的分数段分布
  const calculateAllDistributions = useCallback(() => {
    setLoading(true);
    
    if (!examScores || examScores.length === 0) {
      setDistributionData([]);
      setLoading(false);
      return;
    }
    
    const results = [];
    
    // 计算每个学科的分布
    subjects.forEach(subject => {
      const scores = examScores
        .map(s => getSubjectScore(s, subject))
        .filter(score => score !== null && score !== undefined && score !== '' && !isNaN(parseFloat(score)))
        .map(score => parseFloat(score));
      
      const interval = getIntervalForSubject(subject);
      const distribution = calculateDistribution(scores, interval);
      
      results.push({
        subject,
        interval,
        totalCount: scores.length,
        maxScore: scores.length > 0 ? Math.max(...scores) : 0,
        minScore: scores.length > 0 ? Math.min(...scores) : 0,
        avgScore: scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0,
        distribution
      });
    });
    
    // 计算总分分布
    const totalScores = examScores
      .map(s => s.total_score || 0)
      .filter(score => score > 0);
    
    if (totalScores.length > 0) {
      const interval = getIntervalForSubject('总分');
      const distribution = calculateDistribution(totalScores, interval);
      
      results.push({
        subject: '总分',
        interval,
        totalCount: totalScores.length,
        maxScore: Math.max(...totalScores),
        minScore: Math.min(...totalScores),
        avgScore: (totalScores.reduce((a, b) => a + b, 0) / totalScores.length).toFixed(1),
        distribution
      });
    }
    
    setDistributionData(results);
    setActiveView('overview');
    setLoading(false);
  }, [calculateDistribution, examScores, getIntervalForSubject, getSubjectScore, subjects]);
  
  // 导出Excel
  const exportToExcel = () => {
    if (distributionData.length === 0) return;
    
    const rows = [];
    
    // 为每个学科添加数据
    distributionData.forEach(data => {
      // 学科标题行
      rows.push([`学科：${data.subject}`, `间隔：${data.interval}分`, `人数：${data.totalCount}`, '', '', '']);
      rows.push(['分数段', '人数', '占比(%)', '最高分', '最低分', '平均分']);
      
      // 分数段数据
      data.distribution.forEach(segment => {
        rows.push([
          segment.range,
          segment.count,
          segment.percentage,
          data.maxScore,
          data.minScore,
          data.avgScore
        ]);
      });
      
      // 空行分隔
      rows.push(['', '', '', '', '', '']);
    });
    
    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `分数段统计_${examData?.exam_name || '考试分析'}.csv`;
    link.click();
  };
  
  // 初始化自定义间隔
  useEffect(() => {
    if (subjects.length > 0) {
      const defaultIntervals = {};
      subjects.forEach(subject => {
        defaultIntervals[subject] = subject === '总分' ? TOTAL_SCORE_INTERVAL : DEFAULT_INTERVAL;
      });
      defaultIntervals['总分'] = TOTAL_SCORE_INTERVAL;
      setCustomIntervals(defaultIntervals);
      setTempIntervals(defaultIntervals);
    }
  }, [subjects]);
  
  // 检测科目
  useEffect(() => {
    if (examScores && examScores.length > 0) {
      const detected = detectSubjects();
      setDetectedSubjects(detected);
    }
  }, [detectSubjects, examScores]);
  
  // 自动计算
  useEffect(() => {
    if (examScores && examScores.length > 0 && detectedSubjects.length > 0) {
      calculateAllDistributions();
    }
  }, [calculateAllDistributions, detectedSubjects, examScores]);

  useEffect(() => {
    if (distributionData.length > 0 && !distributionData.some(item => item.subject === activeSubject)) {
      setActiveSubject(distributionData[0].subject);
    }
  }, [distributionData, activeSubject]);

  useEffect(() => {
    setActiveView('overview');
  }, [activeSubject]);

  const renderMetric = (label, value, detail, tone = 'blue') => {
    const tones = {
      blue: 'border-blue-100 bg-blue-50 text-blue-800',
      emerald: 'border-emerald-100 bg-emerald-50 text-emerald-800',
      indigo: 'border-indigo-100 bg-indigo-50 text-indigo-800',
      slate: 'border-slate-200 bg-slate-50 text-slate-800',
    };

    return (
      <div className={`rounded-lg border p-4 ${tones[tone] || tones.blue}`}>
        <p className="text-sm opacity-80">{label}</p>
        <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
        <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
      </div>
    );
  };

  const renderOverview = (data, { showDetailButton = true } = {}) => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {renderMetric('统计人数', data.totalCount, `间隔 ${data.interval} 分`, 'blue')}
        {renderMetric('平均分', data.avgScore, '当前学科均分', 'emerald')}
        {renderMetric('最高分', data.maxScore, `最低 ${data.minScore}`, 'indigo')}
        {renderMetric('分数段数', data.distribution.length, '需要复核时展开明细', 'slate')}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h4 className="text-base font-semibold text-slate-900">高频分数段</h4>
              <p className="mt-1 text-xs text-slate-500">按人数最多的区间排序，显示成绩主要集中带。</p>
            </div>
            {showDetailButton && (
              <button
                type="button"
                onClick={() => goToView('details')}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Table2 className="h-3.5 w-3.5" />
                查看完整明细
              </button>
            )}
          </div>
          <div className="space-y-3">
            {leadingSegments.map(segment => (
              <div key={segment.range} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-800">{segment.range}</span>
                  <span className="text-sm font-semibold text-blue-700">{segment.count} 人 · {segment.percentage}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${Math.min(parseFloat(segment.percentage), 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {leadingSegments.length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                暂无分数段数据
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
          <h4 className="text-sm font-semibold text-blue-900">统计口径</h4>
          <div className="mt-4 space-y-3 text-sm text-blue-800">
            <div className="rounded-lg bg-white p-3">
              <p className="font-medium">默认间隔</p>
              <p className="mt-1 text-xs text-slate-500">单科 5 分，总分 20 分。</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="font-medium">智能间隔</p>
              <p className="mt-1 text-xs text-slate-500">系统按学科类型自动选择分段间隔。</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="font-medium">完整明细</p>
              <p className="mt-1 text-xs text-slate-500">展开后可逐段核对人数、占比和可视化条。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDetails = (data, { showReturnButton = true } = {}) => (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">完整分数段明细</h4>
          <p className="mt-1 text-xs text-slate-500">逐段核对人数和占比，适合导出前复核。</p>
        </div>
        {showReturnButton && (
          <button
            type="button"
            onClick={() => goToView('overview')}
            className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
          >
            返回分布概览
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-center font-medium text-gray-700">分数段</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">人数</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">占比</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">可视化</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.distribution.map((segment, idx) => (
              <tr key={segment.range} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2 text-center font-medium text-gray-700">
                  {segment.range}
                </td>
                <td className="px-4 py-2 text-center">
                  <span className="font-semibold text-blue-600">{segment.count}</span>
                  <span className="ml-1 text-xs text-gray-400">人</span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className="font-medium text-green-600">{segment.percentage}%</span>
                </td>
                <td className="px-4 py-2">
                  <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${Math.min(parseFloat(segment.percentage), 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const resetIntervalsToDefault = () => {
    const defaultIntervals = {};
    subjects.forEach(subject => {
      defaultIntervals[subject] = subject === '总分' ? TOTAL_SCORE_INTERVAL : DEFAULT_INTERVAL;
    });
    defaultIntervals['总分'] = TOTAL_SCORE_INTERVAL;
    setCustomIntervals(defaultIntervals);
    setTempIntervals(defaultIntervals);
    setSmartInterval(true);
  };

  const renderIntervalInput = (subject) => (
    <div key={subject}>
      <label className="block text-sm text-gray-600 mb-1">
        {displaySubjectLabel(subject)} (分)
      </label>
      <input
        type="number"
        min="1"
        max="100"
        value={tempIntervals[subject] || (subject === '总分' ? TOTAL_SCORE_INTERVAL : DEFAULT_INTERVAL)}
        onChange={(event) => {
          const newTemp = { ...tempIntervals };
          newTemp[subject] = event.target.value;
          setTempIntervals(newTemp);
        }}
        onBlur={() => {
          let numValue = parseInt(tempIntervals[subject], 10);
          if (isNaN(numValue) || numValue < 1) numValue = 1;
          if (numValue > 100) numValue = 100;

          const newIntervals = { ...customIntervals };
          newIntervals[subject] = numValue;
          setCustomIntervals(newIntervals);

          const newTemp = { ...tempIntervals };
          newTemp[subject] = numValue;
          setTempIntervals(newTemp);
        }}
        disabled={smartInterval}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
      />
    </div>
  );

  const renderSettingsSummary = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-purple-100 bg-white p-4">
          <p className="text-sm text-gray-500">当前口径</p>
          <p className="mt-2 text-xl font-bold text-purple-800">{smartInterval ? '智能间隔' : '手动间隔'}</p>
          <p className="mt-2 text-xs text-gray-500">单科默认 5 分，总分默认 20 分。</p>
        </div>
        <div className="rounded-lg border border-purple-100 bg-white p-4">
          <p className="text-sm text-gray-500">统计维度</p>
          <p className="mt-2 text-xl font-bold text-purple-800">{subjects.length + 1}</p>
          <p className="mt-2 text-xs text-gray-500">含各学科与总分。</p>
        </div>
        <div className="rounded-lg border border-purple-100 bg-white p-4">
          <p className="text-sm text-gray-500">应用方式</p>
          <p className="mt-2 text-xl font-bold text-purple-800">重新计算</p>
          <p className="mt-2 text-xs text-gray-500">修改间隔后点击重新计算刷新分布。</p>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={smartInterval}
            onChange={(event) => setSmartInterval(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
          />
          <span>
            <span className="block text-sm font-medium text-gray-800">智能间隔</span>
            <span className="mt-1 block text-xs leading-5 text-gray-500">开启后系统按学科类型自动选择分段间隔；关闭后再进入单科间隔逐项调整。</span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap justify-between gap-3 border-t border-purple-100 pt-4">
        <button
          type="button"
          onClick={() => goToSettingsView('subjects')}
          className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          进入单科间隔
        </button>
        <span className="text-xs leading-9 text-gray-500">关闭智能间隔后可手动调整。</span>
      </div>
    </div>
  );

  const renderSettingsInputs = () => {
    const intervalSubjects = Array.from(new Set([...subjects, '总分']));

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-purple-100 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h5 className="text-sm font-semibold text-gray-900">单科间隔设置</h5>
              <p className="mt-1 text-xs text-gray-500">手动模式下逐项调整；智能间隔开启时输入框保持只读。</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={smartInterval}
                onChange={(event) => setSmartInterval(event.target.checked)}
                className="h-4 w-4 rounded text-purple-600 focus:ring-purple-500"
              />
              智能间隔
            </label>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {intervalSubjects.map(renderIntervalInput)}
          </div>
        </div>
        <div className="text-xs text-gray-500">
          提示：关闭“智能间隔”后可手动调整各学科的分数段间隔。
        </div>
      </div>
    );
  };

  const renderSettingsActiveView = () => {
    if (activeSettingsView === 'subjects') return renderSettingsInputs();
    if (activeSettingsView === 'all') {
      return (
        <div className="space-y-5">
          <section className="space-y-3">
            <div>
              <h5 className="text-sm font-semibold text-gray-900">智能口径</h5>
              <p className="mt-1 text-xs text-gray-500">当前分段口径。</p>
            </div>
            {renderSettingsSummary()}
          </section>
          <section className="space-y-3">
            <div>
              <h5 className="text-sm font-semibold text-gray-900">单科间隔</h5>
              <p className="mt-1 text-xs text-gray-500">逐项复核各统计维度的间隔。</p>
            </div>
            {renderSettingsInputs()}
          </section>
        </div>
      );
    }
    return renderSettingsSummary();
  };

  const renderSettingsPanel = () => (
    <div className="mb-6 rounded-lg border border-purple-200 bg-purple-50 p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="font-medium text-purple-800">分数段间隔设置</h4>
          <p className="mt-1 text-xs text-purple-700">默认只看口径，需要手动调整时再进入单科间隔。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-purple-700">
            当前：{activeSettingsConfig.label}
          </span>
          <button
            type="button"
            onClick={resetIntervalsToDefault}
            className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800"
          >
            <RotateCcw className="w-3 h-3" />
            恢复默认
          </button>
        </div>
      </div>

      <FlowModuleSelector
        title="设置控件"
        hint="点击查看口径、单科间隔或全面铺开"
        modules={settingsModules}
        activeValue={activeSettingsView}
        onChange={goToSettingsView}
        tone="purple"
        scrollTargetId="subject-distribution-settings-content"
      />

      <div id="subject-distribution-settings-content" className="scroll-mt-32">
        {renderSettingsActiveView()}
      </div>
    </div>
  );
  
  if (!examScores || examScores.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center py-8 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>暂无成绩数据，无法进行分数段统计</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-gray-800">各学科分数段统计</h3>
          <span className="text-sm text-gray-500">点击学科名称切换查看</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setShowSettings(prev => {
              const next = !prev;
              if (next) {
                setActiveSettingsView('summary');
              }
              return next;
              });
            }}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              showSettings ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            间隔设置
          </button>
          <button
            onClick={calculateAllDistributions}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Calculator className="w-4 h-4" />
            {loading ? '计算中...' : '重新计算'}
          </button>
          <button
            onClick={exportToExcel}
            disabled={distributionData.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            导出Excel
          </button>
        </div>
      </div>

      {distributionData.length > 0 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
          {distributionData.map(data => (
            <button
              key={data.subject}
              onClick={() => setActiveSubject(data.subject)}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeSubject === data.subject
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              {displaySubjectLabel(data.subject)}
            </button>
          ))}
        </div>
      )}

      {/* 间隔设置面板 */}
      {showSettings && renderSettingsPanel()}

      {activeDistribution && (() => {
        const data = activeDistribution;
        return (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex flex-wrap items-center gap-4">
                <span className="font-semibold text-gray-800">{displaySubjectLabel(data.subject)}</span>
                <span className="text-sm text-gray-500">
                  间隔：{data.interval}分 | 人数：{data.totalCount} | 均分：{data.avgScore} | 最高/最低：{data.maxScore}/{data.minScore}
                </span>
              </div>
              <div className="text-sm text-gray-500">共 {data.distribution.length} 个分数段</div>
            </div>
            <div className="border-t border-slate-200 bg-white p-4">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">查看方式</p>
                  <p className="mt-1 text-xs text-slate-500">默认只看概览，完整表格按需展开。</p>
                </div>
                <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  当前：{activeView === 'all' ? '全面铺开' : activeViewConfig.label}
                </span>
              </div>
              <FlowModuleSelector
                title="分数段结果控件"
                hint="点击查看概览、明细或全面铺开"
                modules={viewModules}
                activeValue={activeView}
                onChange={goToView}
                scrollTargetId="subject-distribution-content"
              />
              <div id="subject-distribution-content" className="scroll-mt-32">
                {activeView === 'all' ? (
                  <div className="space-y-6">
                    <section className="space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">分布概览</h4>
                        <p className="mt-1 text-xs text-slate-500">关键指标与高频分数段。</p>
                      </div>
                      {renderOverview(data, { showDetailButton: false })}
                    </section>
                    <section className="space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">完整明细</h4>
                        <p className="mt-1 text-xs text-slate-500">逐段核对人数和占比，适合导出前复核。</p>
                      </div>
                      {renderDetails(data, { showReturnButton: false })}
                    </section>
                  </div>
                ) : activeView === 'details' ? renderDetails(data) : renderOverview(data)}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default SubjectScoreDistribution;
