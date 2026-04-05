/**
 * 各学科临界分分析组件
 * 根据Excel公式计算各学科临界分数线
 */

import React, { useState, useEffect } from 'react';
import { Calculator, Download, ChevronDown, ChevronUp, Settings2, RotateCcw } from 'lucide-react';

const SubjectThresholdAnalysis = ({ examData, examScores, subjects: propSubjects }) => {
  const [thresholdData, setThresholdData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detectedSubjects, setDetectedSubjects] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false); // 折叠状态
  const [showSettings, setShowSettings] = useState(false); // 设置面板显示状态
  
  // 默认百分比配置
  const DEFAULT_PERCENTAGES = [0.2, 0.4, 0.6, 0.8];
  
  // 用户自定义百分比
  const [customPercentages, setCustomPercentages] = useState(DEFAULT_PERCENTAGES);
  const [tempPercentages, setTempPercentages] = useState(DEFAULT_PERCENTAGES.map(p => (p * 100).toFixed(0)));
  
  // 从成绩数据中自动检测科目
  const detectSubjects = () => {
    if (!examScores || examScores.length === 0) {
      console.log('No exam scores available');
      return propSubjects || [];
    }
    
    // 获取第一个成绩记录
    const firstScore = examScores[0];
    console.log('First score record:', firstScore);
    
    // 排除非学科字段
    const excludeFields = ['id', 'exam_id', 'student_id', 'student_name', 'student_code', 
                          'class_id', 'class_name', 'total_score', 'rank', 'class_rank',
                          'is_valid', 'additional_classes', 'created_at', 'updated_at', 'scores'];
    
    // 从scores对象中获取学科（如果存在）
    if (firstScore.scores && typeof firstScore.scores === 'object') {
      const subjectsFromScores = Object.keys(firstScore.scores).filter(k => !excludeFields.includes(k));
      console.log('Subjects from scores object:', subjectsFromScores);
      return subjectsFromScores;
    }
    
    // 否则从顶层字段获取学科
    const allKeys = Object.keys(firstScore);
    const subjectsFromTop = allKeys.filter(key => !excludeFields.includes(key));
    console.log('Subjects from top level:', subjectsFromTop);
    return subjectsFromTop;
  };
  
  // 获取学科成绩（支持scores对象或顶层字段）
  const getSubjectScore = (scoreRecord, subject) => {
    // 如果scores对象存在且包含该学科
    if (scoreRecord.scores && scoreRecord.scores[subject] !== undefined) {
      return scoreRecord.scores[subject];
    }
    // 否则尝试从顶层字段获取
    return scoreRecord[subject];
  };
  
  // 获取实际使用的科目列表
  const subjects = detectedSubjects.length > 0 ? detectedSubjects : (propSubjects || []);

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

  // 计算单个百分比段的临界分
  const calculateThreshold = (scores, percentage, totalCount) => {
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
  };

  // 计算所有学科的临界分
  const calculateAllThresholds = () => {
    setLoading(true);
    
    if (!examScores || examScores.length === 0) {
      setThresholdData([]);
      setLoading(false);
      return;
    }

    // 调试：检查成绩数据结构
    console.log('Exam Scores Sample:', examScores[0]);
    console.log('Prop Subjects:', propSubjects);
    console.log('Using detected subjects:', detectedSubjects);

    const results = [];
    
    // 为每个百分比段计算（使用自定义百分比）
    customPercentages.forEach(percentage => {
      const rowData = {
        percentage: `${(percentage * 100).toFixed(0)}%`,
        subjects: {}
      };

      // 计算每个学科的临界分
      detectedSubjects.forEach(subject => {
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
    setLoading(false);
  };

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
  }, [examScores]);

  useEffect(() => {
    if (examScores && examScores.length > 0 && detectedSubjects.length > 0) {
      calculateAllThresholds();
    }
  }, [examScores, detectedSubjects]);

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-gray-800">各学科临界分</h3>
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
            <Download className="w-4 h-4" />
            导出Excel
          </button>
        </div>
      </div>

      {/* 比例设置面板 */}
      {showSettings && (
        <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-purple-800">自定义百分比比例</h4>
            <button
              onClick={() => {
                setCustomPercentages(DEFAULT_PERCENTAGES);
                setTempPercentages(DEFAULT_PERCENTAGES.map(p => (p * 100).toFixed(0)));
              }}
              className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              恢复默认
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    // 验证并应用更改
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
          <div className="mt-3 text-xs text-gray-500">
            提示：修改比例后点击"重新计算"按钮应用更改
          </div>
        </div>
      )}

      {/* 折叠时显示简要信息 */}
      {!isExpanded && thresholdData.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => setIsExpanded(true)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">检测到的学科：</span>
              <span className="text-sm font-medium text-blue-700">
                {subjects.join('、')}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              共 {customPercentages.length} 个百分比段 ({customPercentages.map(p => `${(p * 100).toFixed(0)}%`).join('、')})
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            点击展开查看详细临界分数据
          </div>
        </div>
      )}

      {/* 展开时显示详细内容 */}
      {isExpanded && thresholdData.length > 0 && (
        <div className="space-y-8">
          {customPercentages.map((percentage, idx) => {
            const data = thresholdData[idx];
            if (!data) return null;

            return (
              <div key={percentage} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 font-medium text-gray-700">
                  {data.percentage} 临界分分析
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700 w-48">项目</th>
                        {subjects.map(subject => (
                          <th key={subject} className="px-4 py-2 text-center font-medium text-gray-700">
                            {subject}
                          </th>
                        ))}
                        <th className="px-4 py-2 text-center font-medium text-gray-700">总分</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {/* 各科实考人数 */}
                      <tr className="bg-blue-50">
                        <td className="px-4 py-2 font-medium text-gray-700">各科实考人数</td>
                        {subjects.map(subject => (
                          <td key={subject} className="px-4 py-2 text-center">
                            {data.subjects[subject]?.totalCount || 0}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-center font-medium">
                          {data.subjects['总分']?.totalCount || 0}
                        </td>
                      </tr>
                      
                      {/* 输入百分比 */}
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700">输入百分比</td>
                        {subjects.map(subject => (
                          <td key={subject} className="px-4 py-2 text-center text-gray-600">
                            {data.percentage}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-center text-gray-600">{data.percentage}</td>
                      </tr>
                      
                      {/* 百分比人数 */}
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700">百分比人数</td>
                        {subjects.map(subject => (
                          <td key={subject} className="px-4 py-2 text-center">
                            {data.subjects[subject]?.percentCount || 0}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-center font-medium">
                          {data.subjects['总分']?.percentCount || 0}
                        </td>
                      </tr>
                      
                      {/* 近似分 */}
                      <tr className="bg-yellow-50">
                        <td className="px-4 py-2 font-medium text-gray-700">近似分</td>
                        {subjects.map(subject => (
                          <td key={subject} className="px-4 py-2 text-center font-semibold text-blue-600">
                            {data.subjects[subject]?.approxScore || '-'}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-center font-semibold text-blue-600">
                          {data.subjects['总分']?.approxScore || '-'}
                        </td>
                      </tr>
                      
                      {/* 大于等于近似分以上人数 */}
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700">大于等于近似分以上人数</td>
                        {subjects.map(subject => (
                          <td key={subject} className="px-4 py-2 text-center">
                            {data.subjects[subject]?.countGe || 0}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-center font-medium">
                          {data.subjects['总分']?.countGe || 0}
                        </td>
                      </tr>
                      
                      {/* 大于近似分以上人数 */}
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-700">大于近似分以上人数</td>
                        {subjects.map(subject => (
                          <td key={subject} className="px-4 py-2 text-center">
                            {data.subjects[subject]?.countGt || 0}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-center font-medium">
                          {data.subjects['总分']?.countGt || 0}
                        </td>
                      </tr>
                      
                      {/* 分界分数线 */}
                      <tr className="bg-green-50">
                        <td className="px-4 py-2 font-medium text-gray-700">分界分数线</td>
                        {subjects.map(subject => (
                          <td key={subject} className="px-4 py-2 text-center font-bold text-green-700">
                            {data.subjects[subject]?.thresholdScore || '-'}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-center font-bold text-green-700">
                          {data.subjects['总分']?.thresholdScore || '-'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 计算说明 - 仅在展开时显示 */}
      {isExpanded && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-700 mb-2">计算说明</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• <strong>百分比人数</strong> = 各科实考人数 × 输入百分比</li>
            <li>• <strong>近似分</strong> = 该科成绩中第N高的分数（N=百分比人数四舍五入）</li>
            <li>• <strong>大于等于近似分以上人数</strong> = 分数 ≥ 近似分的学生人数</li>
            <li>• <strong>大于近似分以上人数</strong> = 分数 &gt; 近似分的学生人数</li>
            <li>• <strong>分界分数线</strong> = 如果(大于等于人数 + 大于人数) &lt; 2×百分比人数，则取近似分，否则近似分+0.5</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SubjectThresholdAnalysis;
