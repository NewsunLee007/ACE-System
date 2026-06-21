/**
 * 各学科临界分分析组件
 * 根据Excel公式计算各学科临界分数线
 */

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Calculator, Upload, Settings2, RotateCcw, Table2, Maximize2 } from 'lucide-react';
import FlowModuleSelector from './score-analysis/FlowModuleSelector';

const DEFAULT_PERCENTAGES = [0.2, 0.4, 0.6, 0.8];
const VIEW_FLOW = ['overview', 'details', 'all'];
const SETTINGS_FLOW = ['summary', 'inputs', 'all'];

// LARGE函数实现 - 获取第k大的值
const large = (arr, k) => {
  const sorted = [...arr].sort((a, b) => b - a);
  const index = Math.round(k) - 1; // 转换为0-based索引
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
};

// COUNTIF函数实现 - 统计满足条件的数量
const countif = (arr, condition) => {
  return arr.filter(condition).length;
};

const SubjectThresholdAnalysis = ({ examData, examScores, subjects: propSubjects }) => {
  const [thresholdData, setThresholdData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detectedSubjects, setDetectedSubjects] = useState([]);
  const [activeSubject, setActiveSubject] = useState('');
  const [showSettings, setShowSettings] = useState(false); // 设置面板显示状态
  const [activeView, setActiveView] = useState('overview');
  const [activeSettingsView, setActiveSettingsView] = useState('summary');

  // 用户自定义百分比
  const [customPercentages, setCustomPercentages] = useState(DEFAULT_PERCENTAGES);
  const [tempPercentages, setTempPercentages] = useState(DEFAULT_PERCENTAGES.map(p => (p * 100).toFixed(0)));
  
  // 从成绩数据中自动检测科目
  const detectSubjects = useCallback(() => {
    if (!examScores || examScores.length === 0) {
      return propSubjects || [];
    }
    
    // 获取第一个成绩记录
    const firstScore = examScores[0];
    
    // 排除非学科字段
    const excludeFields = ['id', 'exam_id', 'student_id', 'student_name', 'student_code', 
                          'class_id', 'class_name', 'total_score', 'rank', 'class_rank',
                          'is_valid', 'additional_classes', 'created_at', 'updated_at', 'scores'];
    
    // 从scores对象中获取学科（如果存在）
    if (firstScore.scores && typeof firstScore.scores === 'object') {
      return Object.keys(firstScore.scores).filter(k => !excludeFields.includes(k));
    }
    
    // 否则从顶层字段获取学科
    return Object.keys(firstScore).filter(key => !excludeFields.includes(key));
  }, [examScores, propSubjects]);
  
  // 获取学科成绩（支持scores对象或顶层字段）
  const getSubjectScore = useCallback((scoreRecord, subject) => {
    // 如果scores对象存在且包含该学科
    if (scoreRecord.scores && scoreRecord.scores[subject] !== undefined) {
      return scoreRecord.scores[subject];
    }
    // 否则尝试从顶层字段获取
    return scoreRecord[subject];
  }, []);
  
  // 获取实际使用的科目列表
  const subjects = useMemo(
    () => (detectedSubjects.length > 0 ? detectedSubjects : (propSubjects || [])),
    [detectedSubjects, propSubjects]
  );
  const subjectTabs = useMemo(() => [...subjects, '总分'], [subjects]);
  const currentThresholdRows = useMemo(() => (
    thresholdData.map(data => ({
      percentage: data.percentage,
      ...(data.subjects[activeSubject] || {}),
    }))
  ), [activeSubject, thresholdData]);
  const currentTotalCount = currentThresholdRows[0]?.totalCount || 0;
  const headlineThreshold = currentThresholdRows[0];
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
      label: '目标线概览',
      desc: '直接查看各比例分界线',
      icon: Calculator,
    },
    {
      value: 'details',
      label: '公式明细',
      desc: `${currentThresholdRows.length} 组比例复核`,
      icon: Table2,
    },
    {
      value: 'all',
      label: '全面铺开',
      desc: '目标线与公式同屏复核',
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
      label: '比例口径',
      desc: customPercentages.map(p => `${(p * 100).toFixed(0)}%`).join(' / '),
      icon: Settings2,
    },
    {
      value: 'inputs',
      label: '比例调整',
      desc: `${tempPercentages.length} 组比例`,
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

  // 计算单个百分比段的临界分
  const calculateThreshold = useCallback((scores, percentage, totalCount) => {
    const percentCount = totalCount * percentage;
    const approxScore = large(scores, percentCount);
    const countGe = countif(scores, s => s >= approxScore); // 大于等于
    const countGt = countif(scores, s => s > approxScore);  // 大于
    
    // 分界分数线逻辑：如果 countGe + countGt < 2 * percentCount，则 approxScore，否则 approxScore + 0.5
    const thresholdScore = (countGe + countGt) < 2 * percentCount 
      ? approxScore 
      : approxScore + 0.5;

    return {
      percentage: `${(percentage * 100).toFixed(0)}%`,
      percentCount: Math.round(percentCount),
      approxScore: approxScore.toFixed(1),
      countGe, // 大于等于近似分以上人数
      countGt, // 大于近似分以上人数
      thresholdScore: thresholdScore.toFixed(1) // 分界分数线
    };
  }, []);

  // 计算所有学科的临界分
  const calculateAllThresholds = useCallback(() => {
    setLoading(true);
    
    if (!examScores || examScores.length === 0) {
      setThresholdData([]);
      setLoading(false);
      return;
    }

    const results = [];
    
    // 为每个百分比段计算（使用自定义百分比）
    customPercentages.forEach(percentage => {
      const rowData = {
        percentage: `${(percentage * 100).toFixed(0)}%`,
        subjects: {}
      };

      // 计算每个学科的临界分
      subjects.forEach(subject => {
        // 获取该学科的所有有效成绩
        const scores = examScores
          .map(s => getSubjectScore(s, subject))
          .filter(score => score !== null && score !== undefined && score !== '' && !isNaN(parseFloat(score)));
        
        const totalCount = scores.length;
        
        if (totalCount === 0) {
          rowData.subjects[subject] = {
            totalCount: 0,
            percentCount: 0,
            approxScore: '-',
            countGe: 0,
            countGt: 0,
            thresholdScore: '-'
          };
        } else {
          const threshold = calculateThreshold(scores, percentage, totalCount);
          rowData.subjects[subject] = {
            totalCount,
            ...threshold
          };
        }
      });

      // 计算总分列
      const totalScores = examScores
        .map(s => s.total_score || 0)
        .filter(score => score > 0);
      
      if (totalScores.length > 0) {
        const totalThreshold = calculateThreshold(totalScores, percentage, totalScores.length);
        rowData.subjects['总分'] = {
          totalCount: totalScores.length,
          ...totalThreshold
        };
      }

      results.push(rowData);
    });

    setThresholdData(results);
    setActiveView('overview');
    setLoading(false);
  }, [calculateThreshold, customPercentages, examScores, getSubjectScore, subjects]);

  // 导出Excel
  const exportToExcel = () => {
    if (thresholdData.length === 0) return;

    // 构建CSV内容
    const headers = ['项目', ...subjects, '总分'];
    const rows = [];

    // 各科实考人数行
    const countRow = ['各科实考人数'];
    subjects.forEach(subject => {
      countRow.push(thresholdData[0].subjects[subject]?.totalCount || 0);
    });
    countRow.push(thresholdData[0].subjects['总分']?.totalCount || 0);
    rows.push(countRow);

    // 为每个百分比段添加6行数据
    customPercentages.forEach((percentage, idx) => {
      const data = thresholdData[idx];
      
      // 输入百分比
      rows.push(['输入百分比', ...subjects.map(s => data.percentage), data.percentage]);
      
      // 百分比人数
      const percentCountRow = ['百分比人数'];
      subjects.forEach(subject => {
        percentCountRow.push(data.subjects[subject]?.percentCount || 0);
      });
      percentCountRow.push(data.subjects['总分']?.percentCount || 0);
      rows.push(percentCountRow);
      
      // 近似分
      const approxRow = ['近似分'];
      subjects.forEach(subject => {
        approxRow.push(data.subjects[subject]?.approxScore || '-');
      });
      approxRow.push(data.subjects['总分']?.approxScore || '-');
      rows.push(approxRow);
      
      // 大于等于近似分以上人数
      const countGeRow = ['大于等于近似分以上人数'];
      subjects.forEach(subject => {
        countGeRow.push(data.subjects[subject]?.countGe || 0);
      });
      countGeRow.push(data.subjects['总分']?.countGe || 0);
      rows.push(countGeRow);
      
      // 大于近似分以上人数
      const countGtRow = ['大于近似分以上人数'];
      subjects.forEach(subject => {
        countGtRow.push(data.subjects[subject]?.countGt || 0);
      });
      countGtRow.push(data.subjects['总分']?.countGt || 0);
      rows.push(countGtRow);
      
      // 分界分数线
      const thresholdRow = ['分界分数线'];
      subjects.forEach(subject => {
        thresholdRow.push(data.subjects[subject]?.thresholdScore || '-');
      });
      thresholdRow.push(data.subjects['总分']?.thresholdScore || '-');
      rows.push(thresholdRow);
      
      // 空行分隔
      rows.push(['', ...subjects.map(() => ''), '']);
    });

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `各学科临界分_${examData?.exam_name || '考试分析'}.csv`;
    link.click();
  };

  // 当成绩数据变化时，立即检测科目
  useEffect(() => {
    if (examScores && examScores.length > 0) {
      const detected = detectSubjects();
      setDetectedSubjects(detected);
    }
  }, [detectSubjects, examScores]);

  useEffect(() => {
    if (examScores && examScores.length > 0 && subjects.length > 0) {
      calculateAllThresholds();
    }
  }, [calculateAllThresholds, examScores, subjects]);

  useEffect(() => {
    if (subjectTabs.length > 0 && !subjectTabs.includes(activeSubject)) {
      setActiveSubject(subjectTabs[0]);
    }
  }, [subjectTabs, activeSubject]);

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

  const renderOverview = ({ showDetailButton = true } = {}) => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {renderMetric('实考人数', currentTotalCount, `${activeSubject || '-'} 当前统计口径`, 'blue')}
        {renderMetric('第一目标线', headlineThreshold?.thresholdScore || '-', `${headlineThreshold?.percentage || '-'} 分界线`, 'emerald')}
        {renderMetric('比例组数', currentThresholdRows.length, customPercentages.map(p => `${(p * 100).toFixed(0)}%`).join(' / '), 'indigo')}
        {renderMetric('公式状态', loading ? '计算中' : '已完成', '需要复核时展开公式明细', 'slate')}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h4 className="text-base font-semibold text-slate-900">目标线速览</h4>
              <p className="mt-1 text-xs text-slate-500">各比例最终分界线默认显示，公式明细可直接点开。</p>
            </div>
            {showDetailButton && (
              <button
                type="button"
                onClick={() => goToView('details')}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Table2 className="h-3.5 w-3.5" />
                查看公式明细
              </button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {currentThresholdRows.map(row => (
              <div key={`${activeSubject}-${row.percentage}`} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">{row.percentage} 分界线</p>
                <p className="mt-2 text-2xl font-bold text-green-700">{row.thresholdScore || '-'}</p>
                <p className="mt-2 text-xs text-slate-500">
                  比例人数 {row.percentCount || 0} · 近似分 {row.approxScore || '-'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-5">
          <h4 className="text-sm font-semibold text-blue-900">计算口径</h4>
          <div className="mt-4 space-y-3 text-sm text-blue-800">
            <div className="rounded-lg bg-white p-3">
              <p className="font-medium">百分比人数</p>
              <p className="mt-1 text-xs text-slate-500">各科实考人数 × 输入百分比。</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="font-medium">近似分</p>
              <p className="mt-1 text-xs text-slate-500">成绩中第 N 高的分数，N 为百分比人数四舍五入。</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="font-medium">分界分数线</p>
              <p className="mt-1 text-xs text-slate-500">按大于等于人数和大于人数判断是否加 0.5。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDetails = ({ showReturnButton = true } = {}) => (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">完整公式明细</h4>
          <p className="mt-1 text-xs text-slate-500">逐项复核比例人数、近似分和最终分界线。</p>
        </div>
        {showReturnButton && (
          <button
            type="button"
            onClick={() => goToView('overview')}
            className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
          >
            返回目标线概览
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-700">比例</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">实考人数</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">比例人数</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">近似分</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">大于等于人数</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">大于人数</th>
              <th className="px-4 py-2 text-center font-medium text-gray-700">分界分数线</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentThresholdRows.map(row => (
              <tr key={`${activeSubject}-${row.percentage}`} className="hover:bg-blue-50/40">
                <td className="px-4 py-3 font-medium text-gray-700">{row.percentage}</td>
                <td className="px-4 py-3 text-center">{row.totalCount || 0}</td>
                <td className="px-4 py-3 text-center">{row.percentCount || 0}</td>
                <td className="px-4 py-3 text-center font-semibold text-blue-600">{row.approxScore || '-'}</td>
                <td className="px-4 py-3 text-center">{row.countGe || 0}</td>
                <td className="px-4 py-3 text-center">{row.countGt || 0}</td>
                <td className="px-4 py-3 text-center font-bold text-green-700">{row.thresholdScore || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const resetPercentagesToDefault = () => {
    setCustomPercentages(DEFAULT_PERCENTAGES);
    setTempPercentages(DEFAULT_PERCENTAGES.map(p => (p * 100).toFixed(0)));
  };

  const renderPercentageInputs = () => (
    <div className="space-y-4">
      <div className="rounded-lg border border-purple-100 bg-white p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h5 className="text-sm font-semibold text-gray-900">比例调整</h5>
            <p className="mt-1 text-xs text-gray-500">只在需要改变目标线比例时填写；失焦后自动校验为 1%-99%。</p>
          </div>
          <span className="w-fit rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
            {tempPercentages.length} 组比例
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {tempPercentages.map((value, index) => (
            <div key={index}>
              <label className="block text-sm text-gray-600 mb-1">
                比例 {index + 1} (%)
              </label>
              <input
                type="number"
                min="1"
                max="99"
                value={value}
                onChange={(e) => {
                  const newTemp = [...tempPercentages];
                  newTemp[index] = e.target.value;
                  setTempPercentages(newTemp);
                }}
                onBlur={() => {
                  let numValue = parseFloat(tempPercentages[index]);
                  if (isNaN(numValue) || numValue < 1) numValue = 1;
                  if (numValue > 99) numValue = 99;

                  const newPercentages = [...customPercentages];
                  newPercentages[index] = numValue / 100;
                  setCustomPercentages(newPercentages);

                  const newTemp = [...tempPercentages];
                  newTemp[index] = numValue.toFixed(0);
                  setTempPercentages(newTemp);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="text-xs text-gray-500">
        提示：修改比例后点击“重新计算”按钮应用更改。
      </div>
    </div>
  );

  const renderSettingsSummary = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-purple-100 bg-white p-4">
          <p className="text-sm text-gray-500">当前比例</p>
          <p className="mt-2 text-xl font-bold text-purple-800">
            {customPercentages.map(p => `${(p * 100).toFixed(0)}%`).join(' / ')}
          </p>
          <p className="mt-2 text-xs text-gray-500">用于各学科目标线定位。</p>
        </div>
        <div className="rounded-lg border border-purple-100 bg-white p-4">
          <p className="text-sm text-gray-500">比例组数</p>
          <p className="mt-2 text-xl font-bold text-purple-800">{customPercentages.length}</p>
          <p className="mt-2 text-xs text-gray-500">默认四档，便于教务会议复核。</p>
        </div>
        <div className="rounded-lg border border-purple-100 bg-white p-4">
          <p className="text-sm text-gray-500">应用方式</p>
          <p className="mt-2 text-xl font-bold text-purple-800">重新计算</p>
          <p className="mt-2 text-xs text-gray-500">调整比例后刷新所有学科分界线。</p>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4">
        <h5 className="text-sm font-semibold text-gray-900">比例口径说明</h5>
        <p className="mt-2 text-xs leading-5 text-gray-500">
          系统按每个输入百分比计算“实考人数 × 比例”，再用第 N 高成绩和人数判断得到最终分界线。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {customPercentages.map((percentage, index) => (
            <span key={`${percentage}-${index}`} className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
              第 {index + 1} 档 {(percentage * 100).toFixed(0)}%
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-3 border-t border-purple-100 pt-4">
        <button
          type="button"
          onClick={() => goToSettingsView('inputs')}
          className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          进入比例调整
        </button>
        <span className="text-xs leading-9 text-gray-500">默认收起输入框，避免日常查看被设置项打断。</span>
      </div>
    </div>
  );

  const renderSettingsActiveView = () => {
    if (activeSettingsView === 'inputs') return renderPercentageInputs();
    if (activeSettingsView === 'all') {
      return (
        <div className="space-y-5">
          <section className="space-y-3">
            <div>
              <h5 className="text-sm font-semibold text-gray-900">比例口径</h5>
              <p className="mt-1 text-xs text-gray-500">当前百分比规则。</p>
            </div>
            {renderSettingsSummary()}
          </section>
          <section className="space-y-3">
            <div>
              <h5 className="text-sm font-semibold text-gray-900">比例调整</h5>
              <p className="mt-1 text-xs text-gray-500">需要修改时逐项输入并重新计算。</p>
            </div>
            {renderPercentageInputs()}
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
          <h4 className="font-medium text-purple-800">百分比比例设置</h4>
          <p className="mt-1 text-xs text-purple-700">默认只看比例口径，需要调整时再进入输入比例。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-purple-700">
            当前：{activeSettingsConfig.label}
          </span>
          <button
            type="button"
            onClick={resetPercentagesToDefault}
            className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800"
          >
            <RotateCcw className="w-3 h-3" />
            恢复默认
          </button>
        </div>
      </div>

      <FlowModuleSelector
        title="设置控件"
        hint="点击查看口径、输入或全面铺开"
        modules={settingsModules}
        activeValue={activeSettingsView}
        onChange={goToSettingsView}
        tone="purple"
        scrollTargetId="subject-threshold-settings-content"
      />

      <div id="subject-threshold-settings-content" className="scroll-mt-32">
        {renderSettingsActiveView()}
      </div>
    </div>
  );

  if (!examScores || examScores.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center py-8 text-gray-500">
          <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>暂无成绩数据，无法计算临界分</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-gray-800">各学科临界分</h3>
          <span className="text-sm text-gray-500">点击学科名称切换查看</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowSettings((visible) => {
              const nextVisible = !visible;
              if (nextVisible) {
                setActiveSettingsView('summary');
              }
              return nextVisible;
            })}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              showSettings ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            比例设置
          </button>
          <button
            onClick={calculateAllThresholds}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Calculator className="w-4 h-4" />
            {loading ? '计算中...' : '重新计算'}
          </button>
          <button
            onClick={exportToExcel}
            disabled={thresholdData.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            导出Excel
          </button>
        </div>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
        {subjectTabs.map(subject => (
          <button
            key={subject}
            onClick={() => setActiveSubject(subject)}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSubject === subject
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            {subject}
          </button>
        ))}
      </div>

      {/* 比例设置面板 */}
      {showSettings && renderSettingsPanel()}

      {thresholdData.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-800">{activeSubject} 临界分分析</p>
              <p className="text-sm text-slate-500">按输入比例反算该学科分界线，便于会议和学科组快速定位目标线。</p>
            </div>
            <div className="text-sm text-slate-500">
              比例：{customPercentages.map(p => `${(p * 100).toFixed(0)}%`).join(' / ')}
            </div>
          </div>
          <div className="border-t border-slate-200 bg-white p-4">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">查看方式</p>
                <p className="mt-1 text-xs text-slate-500">默认只看目标线，公式表按需展开。</p>
              </div>
              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                当前：{activeView === 'all' ? '全面铺开' : activeViewConfig.label}
              </span>
            </div>
            <FlowModuleSelector
              title="临界分结果控件"
              hint="点击查看目标线、公式或全面铺开"
              modules={viewModules}
              activeValue={activeView}
              onChange={goToView}
              scrollTargetId="subject-threshold-content"
            />
            <div id="subject-threshold-content" className="scroll-mt-32">
              {activeView === 'all' ? (
                <div className="space-y-6">
                  <section className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">目标线概览</h4>
                      <p className="mt-1 text-xs text-slate-500">直接查看各比例分界线。</p>
                    </div>
                    {renderOverview({ showDetailButton: false })}
                  </section>
                  <section className="space-y-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">公式明细</h4>
                      <p className="mt-1 text-xs text-slate-500">逐项复核比例人数、近似分和最终分界线。</p>
                    </div>
                    {renderDetails({ showReturnButton: false })}
                  </section>
                </div>
              ) : activeView === 'details' ? renderDetails() : renderOverview()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectThresholdAnalysis;
