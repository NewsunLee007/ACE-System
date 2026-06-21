import React, { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, FileText, Layers, LineChart as LineChartIcon, Maximize2, Table2, TrendingUp, Users } from 'lucide-react';
import FlowModuleSelector from './FlowModuleSelector';

const cx = (...items) => items.filter(Boolean).join(' ');
const fmt1 = (value) => (typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '0.0');

function ReportWorkbench({ title, subtitle, modules, defaultModule }) {
  const [activeModule, setActiveModule] = useState(defaultModule || modules[0]?.value);
  const isAllModules = activeModule === '__all__';
  const activeConfig = isAllModules ? null : (modules.find(module => module.value === activeModule) || modules[0]);
  const selectorModules = [
    ...modules,
    {
      value: '__all__',
      label: '全面铺开',
      desc: `${modules.length} 个板块同时查看`,
      icon: Maximize2,
    },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            当前：{isAllModules ? '全面铺开' : (activeConfig?.label || '-')}
          </span>
        </div>

        <FlowModuleSelector
          title="标准报告结果控件"
          hint="点击查看单项结果或全面铺开"
          modules={selectorModules}
          activeValue={activeModule}
          onChange={setActiveModule}
          scrollTargetId="standard-report-content"
        />
      </div>

      <div id="standard-report-content" className="scroll-mt-32 bg-slate-50 p-5">
        {isAllModules ? (
          <div className="space-y-6">
            {modules.map(module => (
              <section key={module.value} className="space-y-3">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{module.label}</h3>
                    <p className="text-xs text-slate-500">{module.desc}</p>
                  </div>
                </div>
                {module.content}
              </section>
            ))}
          </div>
        ) : activeConfig?.content}
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, tone = 'blue' }) {
  const toneClasses = {
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    green: 'border-green-100 bg-green-50 text-green-700',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    orange: 'border-orange-100 bg-orange-50 text-orange-700',
    red: 'border-red-100 bg-red-50 text-red-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  };

  return (
    <div className={cx('rounded-lg border p-4', toneClasses[tone] || toneClasses.blue)}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

export function OverallAnalysisReport({ data }) {
  const { basic_statistics, score_distribution, class_analysis } = data;
  const distributionData = [
    { name: '优秀', value: score_distribution.excellent, color: '#10b981' },
    { name: '良好', value: score_distribution.good, color: '#3b82f6' },
    { name: '及格', value: score_distribution.pass, color: '#f59e0b' },
    { name: '不及格', value: score_distribution.fail, color: '#ef4444' },
  ];
  const classData = Object.entries(class_analysis || {}).map(([className, stats]) => ({
    className,
    mean: stats.mean,
    median: stats.median,
  }));

  return (
    <ReportWorkbench
      title="整体分析结果台"
      subtitle="摘要、分布和班级对比可直接切换查看。"
      modules={[
        {
          value: 'summary',
          label: '概览指标',
          desc: '均分、中位数、标准差',
          icon: FileText,
          content: (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <MetricCard label="平均分" value={fmt1(basic_statistics.mean)} tone="blue" />
              <MetricCard label="中位数" value={fmt1(basic_statistics.median)} tone="green" />
              <MetricCard label="标准差" value={fmt1(basic_statistics.std)} tone="indigo" />
              <MetricCard label="总人数" value={basic_statistics.count} tone="orange" />
            </div>
          ),
        },
        {
          value: 'distribution',
          label: '成绩分布',
          desc: '等级结构占比',
          icon: BarChart3,
          content: (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-4 text-lg font-semibold">成绩分布</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ),
        },
        {
          value: 'class',
          label: '班级对比',
          desc: `${classData.length} 个班级均分`,
          icon: Users,
          content: (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-4 text-lg font-semibold">班级平均分对比</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={classData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="className" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="mean" name="平均分" fill="#3b82f6" />
                  <Bar dataKey="median" name="中位数" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ),
        },
      ]}
    />
  );
}

export function LayerComparisonReport({ data }) {
  const { layer_statistics, layer_comparisons, sample_sizes } = data;
  const layerData = Object.entries(layer_statistics || {}).map(([layerCode, stats]) => ({
    layer: layerCode,
    mean: stats.mean,
    median: stats.median,
    std: stats.std,
    count: sample_sizes[layerCode] || 0,
  }));

  return (
    <ReportWorkbench
      title="层次对比结果台"
      subtitle="各层样本、均分图表和显著性检验可直接切换查看。"
      modules={[
        {
          value: 'summary',
          label: '层次概览',
          desc: `${layerData.length} 个层次`,
          icon: Layers,
          content: (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {layerData.map((layer) => (
                <div key={layer.layer} className="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="mb-2 text-lg font-semibold">{layer.layer}层</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">平均分:</span>
                      <span className="font-medium">{fmt1(layer.mean)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">中位数:</span>
                      <span className="font-medium">{fmt1(layer.median)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">标准差:</span>
                      <span className="font-medium">{fmt1(layer.std)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">人数:</span>
                      <span className="font-medium">{layer.count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ),
        },
        {
          value: 'chart',
          label: '层次图表',
          desc: '均分与中位数',
          icon: BarChart3,
          content: (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-4 text-lg font-semibold">层次对比</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={layerData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="layer" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="mean" name="平均分" fill="#3b82f6" />
                  <Bar dataKey="median" name="中位数" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ),
        },
        {
          value: 'significance',
          label: '差异检验',
          desc: `${Object.keys(layer_comparisons || {}).length} 组对比`,
          icon: Table2,
          content: (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-4 text-lg font-semibold">层次间差异显著性检验</h3>
              {Object.keys(layer_comparisons || {}).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(layer_comparisons).map(([comparison, result]) => (
                    <div key={comparison} className="flex items-center justify-between rounded bg-gray-50 p-2">
                      <span className="font-medium">{comparison.replace('_', ' vs ')}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">p值: {result.p_value.toFixed(4)}</span>
                        <span className={`rounded px-2 py-1 text-sm ${
                          result.significant ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {result.significant ? '显著' : '不显著'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-slate-500">暂无层次间差异检验数据</div>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}

export function SubjectAnalysisReport({ data }) {
  const { subject_statistics } = data;
  const subjectData = Object.entries(subject_statistics || {}).map(([subject, stats]) => ({
    subject,
    mean: stats.mean,
    median: stats.median,
    std: stats.std,
  }));

  return (
    <ReportWorkbench
      title="学科分析结果台"
      subtitle="学科概览、明细表和均分图可直接切换查看。"
      modules={[
        {
          value: 'summary',
          label: '学科概览',
          desc: `${subjectData.length} 个学科`,
          icon: FileText,
          content: (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {subjectData.map(item => (
                <div key={item.subject} className="rounded-lg border border-slate-200 bg-white p-4">
                  <h3 className="font-semibold text-slate-900">{item.subject}</h3>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                      <p className="text-xs text-slate-400">平均分</p>
                      <p className="mt-1 font-semibold text-blue-700">{fmt1(item.mean)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">中位数</p>
                      <p className="mt-1 font-semibold text-emerald-700">{fmt1(item.median)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">标准差</p>
                      <p className="mt-1 font-semibold text-indigo-700">{fmt1(item.std)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ),
        },
        {
          value: 'table',
          label: '学科明细表',
          desc: '最高分、最低分与离散度',
          icon: Table2,
          content: (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">学科</th>
                    <th className="px-4 py-3 text-center">平均分</th>
                    <th className="px-4 py-3 text-center">中位数</th>
                    <th className="px-4 py-3 text-center">标准差</th>
                    <th className="px-4 py-3 text-center">最高分</th>
                    <th className="px-4 py-3 text-center">最低分</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {subjectData.map((item) => (
                    <tr key={item.subject}>
                      <td className="px-4 py-3 font-medium">{item.subject}</td>
                      <td className="px-4 py-3 text-center">{fmt1(item.mean)}</td>
                      <td className="px-4 py-3 text-center">{fmt1(item.median)}</td>
                      <td className="px-4 py-3 text-center">{fmt1(item.std)}</td>
                      <td className="px-4 py-3 text-center">{fmt1(subject_statistics[item.subject].max)}</td>
                      <td className="px-4 py-3 text-center">{fmt1(subject_statistics[item.subject].min)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
        {
          value: 'chart',
          label: '均分图',
          desc: '学科均分对比',
          icon: BarChart3,
          content: (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-4 text-lg font-semibold">学科平均分对比</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subjectData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="subject" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="mean" name="平均分" fill="#3b82f6" />
                  <Bar dataKey="median" name="中位数" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ),
        },
      ]}
    />
  );
}

export function StudentProgressReport({ data }) {
  const { current_exam, previous_exam, improved_count, declined_count, unchanged_count, top_improved, top_declined } = data;

  if (!current_exam) {
    return <div className="py-8 text-center text-gray-500">{data.message || '暂无数据'}</div>;
  }

  return (
    <ReportWorkbench
      title="学生进退步结果台"
      subtitle="人数变化、进步名单和关注名单可直接切换查看。"
      modules={[
        {
          value: 'summary',
          label: '变化概览',
          desc: `${current_exam} vs ${previous_exam}`,
          icon: TrendingUp,
          content: (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <MetricCard label="对比考试" value={current_exam} detail={`vs ${previous_exam}`} tone="blue" />
              <MetricCard label="进步人数" value={improved_count} tone="green" />
              <MetricCard label="退步人数" value={declined_count} tone="red" />
              <MetricCard label="持平人数" value={unchanged_count} tone="slate" />
            </div>
          ),
        },
        {
          value: 'improved',
          label: '进步名单',
          desc: '进步最大 Top 10',
          icon: Table2,
          content: (
            <StudentChangeTable
              title="进步最大（Top 10）"
              tone="green"
              rows={top_improved}
              renderChange={(student) => `+${student.score_change}`}
            />
          ),
        },
        {
          value: 'declined',
          label: '关注名单',
          desc: '退步 Top 10',
          icon: Table2,
          content: (
            <StudentChangeTable
              title="需要关注（退步Top 10）"
              tone="red"
              rows={top_declined}
              renderChange={(student) => student.score_change}
            />
          ),
        },
      ]}
    />
  );
}

function StudentChangeTable({ title, tone, rows = [], renderChange }) {
  const titleClass = tone === 'green' ? 'text-green-700' : 'text-red-700';
  const changeClass = tone === 'green' ? 'text-green-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className={`text-lg font-semibold mb-4 ${titleClass}`}>{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">排名</th>
              <th className="px-4 py-2 text-left">姓名</th>
              <th className="px-4 py-2 text-center">上次成绩</th>
              <th className="px-4 py-2 text-center">本次成绩</th>
              <th className="px-4 py-2 text-center">变化</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((student, index) => (
              <tr key={student.student_id}>
                <td className="px-4 py-2">{index + 1}</td>
                <td className="px-4 py-2 font-medium">{student.student_name}</td>
                <td className="px-4 py-2 text-center">{student.previous_score}</td>
                <td className="px-4 py-2 text-center">{student.current_score}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`${changeClass} font-medium`}>{renderChange(student)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ClassContrastReport({ data }) {
  const { class_statistics, class_z_scores, class_ranking, grade_mean, grade_std } = data;
  const classData = Object.entries(class_statistics || {}).map(([className, stats]) => ({
    className,
    mean: stats.mean,
    zScore: class_z_scores[className] || 0,
    rank: class_ranking.findIndex(row => row.class_name === className) + 1,
  }));

  return (
    <ReportWorkbench
      title="班级对比结果台"
      subtitle="年级基准、班级排名和Z值分布可直接切换查看。"
      modules={[
        {
          value: 'summary',
          label: '年级基准',
          desc: '均分与标准差',
          icon: FileText,
          content: (
            <div className="grid gap-4 md:grid-cols-2">
              <MetricCard label="年级平均分" value={fmt1(grade_mean)} tone="blue" />
              <MetricCard label="年级标准差" value={fmt1(grade_std)} tone="indigo" />
            </div>
          ),
        },
        {
          value: 'ranking',
          label: '班级排名',
          desc: `${class_ranking.length} 个班级`,
          icon: Table2,
          content: (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-4 text-lg font-semibold">班级排名（按Z值）</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-center">排名</th>
                      <th className="px-4 py-3 text-left">班级</th>
                      <th className="px-4 py-3 text-center">平均分</th>
                      <th className="px-4 py-3 text-center">Z值</th>
                      <th className="px-4 py-3 text-center">评价</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {class_ranking.map((item, index) => (
                      <tr key={item.class_name}>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                            index < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{item.class_name}</td>
                        <td className="px-4 py-3 text-center">
                          {fmt1(class_statistics[item.class_name]?.mean)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={item.z_score > 0 ? 'text-green-600' : 'text-red-600'}>
                            {item.z_score > 0 ? '+' : ''}{item.z_score.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.z_score > 0.5 ? '优秀' : item.z_score > 0 ? '良好' : item.z_score > -0.5 ? '一般' : '需努力'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ),
        },
        {
          value: 'z-chart',
          label: 'Z值分布',
          desc: '班级标准化对比',
          icon: LineChartIcon,
          content: (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-4 text-lg font-semibold">班级Z值分布</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={classData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="className" />
                  <YAxis />
                  <Tooltip />
                  <ReferenceLine y={0} stroke="#000" />
                  <Bar dataKey="zScore" name="Z值">
                    {classData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.zScore > 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ),
        },
      ]}
    />
  );
}

export default function ScoreAnalysisStandardReport({ analysisType, data }) {
  switch (analysisType) {
    case 'overall':
      return <OverallAnalysisReport data={data} />;
    case 'layer_comparison':
      return <LayerComparisonReport data={data} />;
    case 'subject_analysis':
      return <SubjectAnalysisReport data={data} />;
    case 'student_progress':
      return <StudentProgressReport data={data} />;
    case 'class_contrast':
      return <ClassContrastReport data={data} />;
    default:
      return <div>未知的分析类型</div>;
  }
}
