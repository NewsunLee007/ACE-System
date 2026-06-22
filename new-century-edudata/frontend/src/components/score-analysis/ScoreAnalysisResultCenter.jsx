import React, { useState } from 'react';
import {
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  Target,
  Upload,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ACriticalStudents from './ACriticalStudents';
import ScoreRawData from './ScoreRawData';

const fmt = (value, digits = 1) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : '-';
};

const pct = (value) => `${fmt(value)}%`;

const cx = (...items) => items.filter(Boolean).join(' ');

const signed = (value, digits = 1) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return `${number >= 0 ? '+' : ''}${number.toFixed(digits)}`;
};

const diffTone = (value) => (Number(value) >= 0 ? 'text-emerald-700' : 'text-red-600');

const layerMeta = {
  all: { label: '全段', hint: '全部学生', tone: 'blue' },
  A: { label: 'A层', hint: '实验/高阶层', tone: 'emerald' },
  B: { label: 'B层', hint: '创新/中坚层', tone: 'indigo' },
  C: { label: 'C层', hint: '平行/基础层', tone: 'amber' },
};

const toneClasses = {
  blue: 'border-blue-100 bg-blue-50 text-blue-800',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-800',
  indigo: 'border-indigo-100 bg-indigo-50 text-indigo-800',
  amber: 'border-amber-100 bg-amber-50 text-amber-800',
  slate: 'border-slate-200 bg-slate-50 text-slate-800',
  red: 'border-red-100 bg-red-50 text-red-700',
};

const views = [
  { value: 'summary', label: '综合报告', desc: '全段与层次汇总', icon: FileText },
  { value: 'layers', label: '层次对比', desc: 'A/B/C结果', icon: Layers },
  { value: 'classes', label: '班级对比', desc: '班级质量排序', icon: BarChart3 },
  { value: 'subjects', label: '学科质量', desc: '均分与达标率', icon: BookOpen },
  { value: 'students', label: '学生支持', desc: '临界生与尖子生', icon: Users },
  { value: 'output', label: '输出报告', desc: 'PDF / Excel', icon: Download },
];

const scopeOptions = [
  { value: 'all', scope: 'all' },
  { value: 'layer_a', scope: 'A' },
  { value: 'layer_b', scope: 'B' },
  { value: 'layer_c', scope: 'C' },
];

const getTotal = (score) => {
  const number = Number(score?.total_score);
  return Number.isFinite(number) ? number : 0;
};

const getStudentName = (score) => (
  score?.student_name || score?.name || `学生${score?.student_id || score?.exam_number || ''}`
);

export default function ScoreAnalysisResultCenter({
  selectedGrade,
  setSelectedGrade,
  gradeOptions,
  selectedExam,
  selectedExamId,
  setSelectedExamById,
  gradeExamOptions,
  getExamOptionLabel,
  analysisScope,
  setAnalysisScope,
  analysisResult,
  examScores,
  allScopeExamScores,
  taggedExamScores,
  classLayers,
  loading,
  scoreDataLoading,
  dataSyncMessage,
  onRefresh,
  onExportPdf,
  onExportExcel,
  onPublish,
  onImportSuccess,
  canPublish,
  canExport,
}) {
  const [activeView, setActiveView] = useState('summary');
  const scopeKey = scopeOptions.find(item => item.value === analysisScope)?.scope || 'all';
  const scopeData = analysisResult?.scopes?.[scopeKey] || analysisResult?.scopes?.all || {};
  const summary = scopeData.summary || {};
  const overall = scopeData.overall || {};
  const keyMetrics = scopeData.key_metrics || {};
  const subjectStats = scopeData.subject_analysis?.subject_statistics || {};
  const classRows = scopeData.teaching_score?.class_rows || [];
  const layerStats = analysisResult?.layer_comparison?.layer_statistics || {};
  const activeLayer = layerMeta[scopeKey] || layerMeta.all;

  const subjectRows = Object.entries(subjectStats)
    .map(([subject, stats]) => ({ subject, ...stats }))
    .sort((a, b) => Number(a.pass_rate || 0) - Number(b.pass_rate || 0));

  const layerRows = ['A', 'B', 'C'].map(layer => {
    const stats = layerStats[layer] || {};
    return {
      layer,
      label: layerMeta[layer].label,
      student_count: stats.student_count || 0,
      mean: stats.mean || 0,
      pass_rate: stats.pass_rate || 0,
      excellent_rate: stats.excellent_rate || 0,
    };
  });

  const topStudents = [...(examScores || [])]
    .filter(score => score?.is_valid !== false && score?.is_included !== false)
    .sort((a, b) => getTotal(b) - getTotal(a))
    .slice(0, 10);

  const distributionRows = overall.chart_data?.score_distribution || [];
  const selectedExamLabel = selectedExam ? getExamOptionLabel(selectedExam) : '未选择考试';

  const renderControlBar = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-600">成绩分析结果中心</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">{selectedExamLabel}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {selectedGrade} · {activeLayer.label} · {analysisResult ? `结果生成于 ${new Date(analysisResult.created_at).toLocaleString()}` : '等待生成结果'}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[120px_260px_120px_auto_auto]">
          <select
            value={selectedGrade}
            onChange={(event) => setSelectedGrade(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            {gradeOptions.map(grade => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>

          <select
            value={selectedExamId || ''}
            onChange={(event) => setSelectedExamById(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{gradeExamOptions.length ? '请选择考试' : '当前年级暂无考试'}</option>
            {gradeExamOptions.map(exam => (
              <option key={exam.id} value={exam.id}>{getExamOptionLabel(exam)}</option>
            ))}
          </select>

          <select
            value={analysisScope}
            onChange={(event) => setAnalysisScope(event.target.value)}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全段</option>
            <option value="layer_a">A层</option>
            <option value="layer_b">B层</option>
            <option value="layer_c">C层</option>
          </select>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || scoreDataLoading || !selectedExam}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading || scoreDataLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            更新结果
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onExportPdf}
              disabled={!analysisResult || !canExport}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button
              type="button"
              onClick={onExportExcel}
              disabled={!analysisResult || !canExport}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {dataSyncMessage}
        </span>
        {scopeOptions.map(option => {
          const meta = layerMeta[option.scope] || layerMeta.all;
          const active = analysisScope === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setAnalysisScope(option.value)}
              className={cx(
                'rounded-full border px-3 py-1 font-medium',
                active ? toneClasses[meta.tone] : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderMetricCard = ({ label, value, detail, tone = 'blue', icon: Icon = BarChart3 }) => (
    <div className={cx('rounded-lg border p-4', toneClasses[tone] || toneClasses.blue)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm opacity-80">{label}</p>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
      <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );

  const renderNoResult = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        <Database className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950">结果尚未生成</h3>
      <p className="mt-2 text-sm text-slate-500">
        选择考试后点击“更新结果”，系统会一次完成全段、层次、班级、学科和学生支持计算。
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading || scoreDataLoading || !selectedExam}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-slate-300"
        >
          {loading || scoreDataLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          更新结果
        </button>
        <button
          type="button"
          onClick={() => setActiveView('raw-data')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <Upload className="h-4 w-4" />
          导入/核对成绩
        </button>
      </div>
    </div>
  );

  const renderViewNav = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {views.map(view => {
          const Icon = view.icon;
          const active = activeView === view.value;
          return (
            <button
              key={view.value}
              type="button"
              onClick={() => setActiveView(view.value)}
              className={cx(
                'flex min-h-16 items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors',
                active ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-500' : 'text-slate-700 hover:bg-blue-50'
              )}
            >
              <span className={cx(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              )}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{view.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{view.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderDistribution = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-blue-600" />
        <h3 className="font-semibold text-slate-950">成绩分布</h3>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={distributionRows}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="range" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" name="人数" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const renderLayerTable = () => (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="font-semibold text-slate-950">层次汇总</h3>
        <p className="mt-1 text-xs text-slate-500">A/B/C层以同一口径查看人数、均分、优秀率和达标率。</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">层次</th>
              <th className="px-4 py-3 text-center">人数</th>
              <th className="px-4 py-3 text-center">均分</th>
              <th className="px-4 py-3 text-center">优秀率</th>
              <th className="px-4 py-3 text-center">达标率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {layerRows.map(row => (
              <tr key={row.layer} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{row.label}</td>
                <td className="px-4 py-3 text-center">{row.student_count}</td>
                <td className="px-4 py-3 text-center font-semibold text-blue-700">{fmt(row.mean)}</td>
                <td className="px-4 py-3 text-center">{pct(row.excellent_rate)}</td>
                <td className="px-4 py-3 text-center">{pct(row.pass_rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSubjectTable = () => (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="font-semibold text-slate-950">学科质量</h3>
        <p className="mt-1 text-xs text-slate-500">按达标率从低到高排序，便于先看薄弱学科。</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">学科</th>
              <th className="px-4 py-3 text-center">均分</th>
              <th className="px-4 py-3 text-center">最高分</th>
              <th className="px-4 py-3 text-center">最低分</th>
              <th className="px-4 py-3 text-center">优秀率</th>
              <th className="px-4 py-3 text-center">达标率</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subjectRows.map(row => (
              <tr key={row.subject} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{row.subject}</td>
                <td className="px-4 py-3 text-center font-semibold text-blue-700">{fmt(row.mean)}</td>
                <td className="px-4 py-3 text-center">{fmt(row.max)}</td>
                <td className="px-4 py-3 text-center">{fmt(row.min)}</td>
                <td className="px-4 py-3 text-center">{pct(row.excellent_rate)}</td>
                <td className={cx('px-4 py-3 text-center font-semibold', Number(row.pass_rate || 0) >= 80 ? 'text-emerald-700' : 'text-amber-700')}>
                  {pct(row.pass_rate)}
                </td>
              </tr>
            ))}
            {subjectRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">暂无学科统计</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderClassTable = () => (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="font-semibold text-slate-950">班级质量排序</h3>
        <p className="mt-1 text-xs text-slate-500">当前范围内按教学积分排序，先展示前12个班级。</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-white text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 text-center">排名</th>
              <th className="px-4 py-3 text-left">班级</th>
              <th className="px-4 py-3 text-center">层次</th>
              <th className="px-4 py-3 text-center">班级均分</th>
              <th className="px-4 py-3 text-center">与同层次差</th>
              <th className="px-4 py-3 text-center">参考学科</th>
              <th className="px-4 py-3 text-center">综合积分</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {classRows.slice(0, 12).map(row => (
              <tr key={row.class_id || row.class_name} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-center font-semibold">{row.rank || '-'}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{row.class_name}</td>
                <td className="px-4 py-3 text-center">{row.layer_code || '-'}</td>
                <td className="px-4 py-3 text-center">{fmt(row.class_mean)}</td>
                <td className={cx('px-4 py-3 text-center font-semibold', diffTone(row.same_layer_diff))}>
                  {signed(row.same_layer_diff)}
                </td>
                <td className="px-4 py-3 text-center">{row.valid_subject_count || 0}</td>
                <td className="px-4 py-3 text-center font-semibold text-blue-700">{fmt(row.comprehensive_score, 2)}</td>
              </tr>
            ))}
            {classRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">暂无班级统计</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {renderMetricCard({
          label: '参与人数',
          value: summary.participated || 0,
          detail: `总人数 ${summary.total_students || 0} · 参考范围 ${activeLayer.label}`,
          tone: 'blue',
          icon: Users,
        })}
        {renderMetricCard({
          label: '范围均分',
          value: fmt(summary.grade_mean),
          detail: `标准差 ${fmt(summary.grade_std)}`,
          tone: 'emerald',
          icon: Award,
        })}
        {renderMetricCard({
          label: '综合Z分',
          value: fmt(keyMetrics.total?.z_score, 2),
          detail: `前20%线 ${fmt(keyMetrics.total?.top20_score)}`,
          tone: Number(keyMetrics.total?.z_score || 0) >= 70 ? 'indigo' : 'amber',
          icon: Target,
        })}
        {renderMetricCard({
          label: '达标率',
          value: pct(summary.pass_rate),
          detail: `优秀率 ${pct(summary.excellent_rate)}`,
          tone: Number(summary.pass_rate || 0) >= 80 ? 'emerald' : 'amber',
          icon: CheckCircle2,
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        {renderDistribution()}
        {renderLayerTable()}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {renderSubjectTable()}
        {renderClassTable()}
      </div>
    </div>
  );

  const renderStudentSupport = () => (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ACriticalStudents examScores={allScopeExamScores?.length ? allScopeExamScores : taggedExamScores} classLayers={classLayers} />
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="flex items-center gap-2 font-semibold text-slate-950">
            <Award className="h-4 w-4 text-blue-600" />
            当前范围高分学生
          </h3>
          <p className="mt-1 text-xs text-slate-500">用于快速定位优秀学生与经验样本。</p>
          <div className="mt-4 space-y-2">
            {topStudents.map((student, index) => (
              <div key={`${student.student_id || student.exam_number || index}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="min-w-0 font-medium text-slate-900">
                  {index + 1}. {getStudentName(student)}
                  <span className="ml-2 text-xs text-slate-500">{student.class_name || student.class_id || '-'}</span>
                </span>
                <span className="font-semibold text-blue-700">{fmt(student.total_score)}</span>
              </div>
            ))}
            {topStudents.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                暂无学生名单
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderOutput = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">一键输出当前报告</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            输出内容以当前考试和当前范围为准，包含综合指标、层次汇总、学科质量、班级排序和学生支持名单。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onExportPdf}
              disabled={!canExport}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              <Download className="h-4 w-4" />
              导出PDF
            </button>
            <button
              type="button"
              onClick={onExportExcel}
              disabled={!canExport}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
            >
              <FileSpreadsheet className="h-4 w-4" />
              导出Excel
            </button>
            <button
              type="button"
              onClick={onPublish}
              disabled={!canPublish}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-100 disabled:text-slate-400"
            >
              <FileText className="h-4 w-4" />
              发布结果
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-semibold">输出检查</p>
          <div className="mt-3 space-y-2">
            <p>考试：{selectedExamLabel}</p>
            <p>范围：{activeLayer.label}</p>
            <p>人数：{summary.participated || 0}</p>
            <p>导出权限：{canExport ? '已开放' : '当前角色未开放'}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderActiveView = () => {
    if (activeView === 'raw-data') {
      return <ScoreRawData examData={selectedExam} onImportSuccess={onImportSuccess} />;
    }

    if (!analysisResult) return renderNoResult();
    if (activeView === 'layers') return renderLayerTable();
    if (activeView === 'classes') return renderClassTable();
    if (activeView === 'subjects') return renderSubjectTable();
    if (activeView === 'students') return renderStudentSupport();
    if (activeView === 'output') return renderOutput();
    return renderSummary();
  };

  return (
    <div className="space-y-5">
      {renderControlBar()}
      {renderViewNav()}
      {renderActiveView()}
    </div>
  );
}
