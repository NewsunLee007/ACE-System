/**
 * 各学科分数段人数统计组件
 * 支持按学科统计不同分数段的学生人数分布
 */

import React, { useState, useEffect } from 'react';
import { Calculator, Download, ChevronDown, ChevronUp, Settings2, RotateCcw, BarChart3 } from 'lucide-react';

const SubjectScoreDistribution = ({ examData, examScores, subjects: propSubjects }) => {
  const [distributionData, setDistributionData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detectedSubjects, setDetectedSubjects] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // 默认分数段间隔配置
  const DEFAULT_INTERVAL = 5;
  const TOTAL_SCORE_INTERVAL = 20; // 总分使用更大的间隔
  
  // 用户自定义分数段间隔
  const [customIntervals, setCustomIntervals] = useState({});
  const [tempIntervals, setTempIntervals] = useState({});
  
  // 智能分数段间隔（根据学科自动调整）
  const [smartInterval, setSmartInterval] = useState(true);

  // 从成绩数据中自动检测科目
  const detectSubjects = () => {
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
  };
  
  // 获取学科成绩
  const getSubjectScore = (scoreRecord, subject) => {
    if (scoreRecord.scores && scoreRecord.scores[subject] !== undefined) {
      return scoreRecord.scores[subject];
    }
    return scoreRecord[subject];
  };
  
  // 获取实际使用的科目列表
  const subjects = detectedSubjects.length > 0 ? detectedSubjects : (propSubjects || []);
  const displaySubjectLabel = (subject) => (subject === '总分' ? '总分（统计维度）' : subject);
  
  // 获取学科的分数段间隔
  const getIntervalForSubject = (subject) => {
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
  };
  
  // 计算分数段分布
  const calculateDistribution = (scores, interval) => {
    if (!scores || scores.length === 0) return [];
    
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    
    // 计算分数段范围
    const range = maxScore - minScore;
    const segments = [];
    
    // 从最高分开始向下分段
    let currentMax = Math.ceil(maxScore / interval) * interval;
    const floorMin = Math.floor(minScore / interval) * interval;
    
    while (currentMax > floorMin) {
      const segmentMin = currentMax - interval;
      const count = scores.filter(s => s > segmentMin && s <= currentMax).length;
      
      if (count > 0 || segments.length === 0) {
        segments.push({
          range: `${segmentMin}-${currentMax}`,
          min: segmentMin,
          max: currentMax,
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
  };
  
  // 计算所有学科的分数段分布
  const calculateAllDistributions = () => {
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
    setLoading(false);
  };
  
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
  }, [examScores]);
  
  // 自动计算
  useEffect(() => {
    if (examScores && examScores.length > 0 && detectedSubjects.length > 0) {
      calculateAllDistributions();
    }
  }, [examScores, detectedSubjects, customIntervals, smartInterval]);
  
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-gray-800">各学科分数段统计</h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" />
                收起
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                展开
              </>
            )}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
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
            <Download className="w-4 h-4" />
            导出Excel
          </button>
        </div>
      </div>
      
      {/* 间隔设置面板 */}
      {showSettings && (
        <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-purple-800">分数段间隔设置</h4>
            <button
              onClick={() => {
                const defaultIntervals = {};
                subjects.forEach(subject => {
                  defaultIntervals[subject] = subject === '总分' ? TOTAL_SCORE_INTERVAL : DEFAULT_INTERVAL;
                });
                defaultIntervals['总分'] = TOTAL_SCORE_INTERVAL;
                setCustomIntervals(defaultIntervals);
                setTempIntervals(defaultIntervals);
                setSmartInterval(true);
              }}
              className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              恢复默认
            </button>
          </div>
          
          {/* 智能间隔开关 */}
          <div className="mb-4 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={smartInterval}
                onChange={(e) => setSmartInterval(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700">智能间隔（总分自动使用20分间隔，其他学科5分间隔）</span>
            </label>
          </div>
          
          {/* 自定义间隔输入 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {subjects.map(subject => (
              <div key={subject}>
                <label className="block text-sm text-gray-600 mb-1">
                  {subject} (分)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={tempIntervals[subject] || DEFAULT_INTERVAL}
                  onChange={(e) => {
                    const newTemp = { ...tempIntervals };
                    newTemp[subject] = e.target.value;
                    setTempIntervals(newTemp);
                  }}
                  onBlur={() => {
                    let numValue = parseInt(tempIntervals[subject]);
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
            ))}
            <div key="总分">
              <label className="block text-sm text-gray-600 mb-1">
                总分 (分)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={tempIntervals['总分'] || TOTAL_SCORE_INTERVAL}
                onChange={(e) => {
                  const newTemp = { ...tempIntervals };
                  newTemp['总分'] = e.target.value;
                  setTempIntervals(newTemp);
                }}
                onBlur={() => {
                  let numValue = parseInt(tempIntervals['总分']);
                  if (isNaN(numValue) || numValue < 1) numValue = 1;
                  if (numValue > 100) numValue = 100;
                  
                  const newIntervals = { ...customIntervals };
                  newIntervals['总分'] = numValue;
                  setCustomIntervals(newIntervals);
                  
                  const newTemp = { ...tempIntervals };
                  newTemp['总分'] = numValue;
                  setTempIntervals(newTemp);
                }}
                disabled={smartInterval}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>
          </div>
          
          <div className="mt-3 text-xs text-gray-500">
            提示：关闭"智能间隔"后可手动调整各学科的分数段间隔
          </div>
        </div>
      )}
      
      {/* 折叠时显示简要信息 */}
      {!isExpanded && distributionData.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setIsExpanded(true)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">统计学科：</span>
              <span className="text-sm font-medium text-blue-700">
                {distributionData.filter(d => d.subject !== '总分').map(d => d.subject).join('、')}
              </span>
              {distributionData.some(d => d.subject === '总分') && (
                <span className="text-sm text-gray-500">
                  统计维度：总分
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              共 {distributionData.filter(d => d.subject !== '总分').length} 个学科
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            点击展开查看详细分数段分布
          </div>
        </div>
      )}
      
      {/* 展开时显示详细内容 */}
      {isExpanded && distributionData.length > 0 && (
        <div className="space-y-6">
          {distributionData.map((data) => (
            <div key={data.subject} className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-medium text-gray-700">{displaySubjectLabel(data.subject)}</span>
                  <span className="text-sm text-gray-500">
                    间隔：{data.interval}分 | 
                    人数：{data.totalCount} | 
                    均分：{data.avgScore}
                  </span>
                </div>
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
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2 text-center font-medium text-gray-700">
                          {segment.range}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="font-semibold text-blue-600">{segment.count}</span>
                          <span className="text-xs text-gray-400 ml-1">人</span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="font-medium text-green-600">{segment.percentage}%</span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                            <div 
                              className="bg-blue-500 h-full rounded-full transition-all duration-500"
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
          ))}
        </div>
      )}
      
      {/* 说明 */}
      {isExpanded && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-700 mb-2">功能说明</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• <strong>默认间隔</strong>：单科5分，总分20分</li>
            <li>• <strong>智能间隔</strong>：自动根据学科类型调整间隔大小</li>
            <li>• <strong>自定义间隔</strong>：可针对每个学科单独设置分数段间隔</li>
            <li>• <strong>可视化条形图</strong>：直观展示各分数段人数占比</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SubjectScoreDistribution;
