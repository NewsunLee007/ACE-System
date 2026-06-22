import React, { useMemo, useState } from 'react';
import { Eye, FileText, Maximize2, Table2, X } from 'lucide-react';
import FlowModuleSelector from './FlowModuleSelector';

const formatHistoryDate = (value) => {
  if (!value) return '未记录';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未记录' : date.toLocaleString();
};

function HistoryModuleNav({ activeView, modules, onChange }) {
  const activeConfig = modules.find(module => module.value === activeView) || modules[0];

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-semibold text-slate-900">当前板块</p>
        <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          当前：{activeConfig.label}
        </span>
      </div>
      <FlowModuleSelector
        title="历史记录结果控件"
        hint="点击查看概览、最近记录、明细或全面铺开"
        modules={modules}
        activeValue={activeView}
        onChange={onChange}
        scrollTargetId="score-history-content"
      />
    </div>
  );
}

export default function ScoreAnalysisHistory({
  analysisHistory = [],
  analysisTypes = [],
  onOpenAnalysis,
  onClose,
}) {
  const [activeView, setActiveView] = useState('overview');
  const typeLabelByValue = useMemo(
    () => new Map(analysisTypes.map(type => [type.value, type.label])),
    [analysisTypes]
  );
  const recentHistory = analysisHistory.slice(0, 3);
  const publishedCount = analysisHistory.filter(item => item.status === 'published').length;
  const draftCount = analysisHistory.length - publishedCount;
  const latestHistory = analysisHistory[0];
  const modules = [
    { value: 'overview', label: '历史概览', desc: `${analysisHistory.length} 条归档`, icon: FileText },
    { value: 'recent', label: '最近记录', desc: `${recentHistory.length} 条最近成果`, icon: Eye },
    { value: 'details', label: '明细表', desc: '完整历史清单', icon: Table2 },
    { value: 'all', label: '全面铺开', desc: '概览、最近与明细同屏', icon: Maximize2 },
  ];

  const getTypeLabel = (item) => typeLabelByValue.get(item.analysis_type) || item.analysis_type;
  const getStatusLabel = (item) => item.status === 'published' ? '已发布' : '草稿';
  const getStatusClass = (item) => item.status === 'published'
    ? 'bg-green-100 text-green-700'
    : 'bg-gray-100 text-gray-700';

  const renderHistoryTable = () => (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left">分析时间</th>
            <th className="px-4 py-3 text-left">考试</th>
            <th className="px-4 py-3 text-left">分析类型</th>
            <th className="px-4 py-3 text-left">分析人</th>
            <th className="px-4 py-3 text-center">状态</th>
            <th className="px-4 py-3 text-center">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {analysisHistory.map((item) => (
            <tr key={item.analysis_id}>
              <td className="px-4 py-3">{formatHistoryDate(item.created_at)}</td>
              <td className="px-4 py-3">{item.exam_name}</td>
              <td className="px-4 py-3">{getTypeLabel(item)}</td>
              <td className="px-4 py-3">{item.created_by_name}</td>
              <td className="px-4 py-3 text-center">
                <span className={`rounded px-2 py-1 text-xs ${getStatusClass(item)}`}>
                  {getStatusLabel(item)}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  type="button"
                  onClick={() => onOpenAnalysis?.(item)}
                  className="rounded p-1.5 text-blue-600 hover:bg-blue-50"
                  aria-label={`打开${item.exam_name || ''}分析结果`}
                >
                  <Eye className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderOverview = () => (
    <div className="grid gap-3 md:grid-cols-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm text-slate-500">历史总数</p>
        <p className="mt-1 text-2xl font-bold text-blue-700">{analysisHistory.length}</p>
        <p className="mt-1 text-xs text-slate-500">可追溯分析记录</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">已发布</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{publishedCount}</p>
        <p className="mt-1 text-xs text-slate-500">正式成果</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">草稿</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{draftCount}</p>
        <p className="mt-1 text-xs text-slate-500">待确认成果</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">最近分析</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-900">{latestHistory?.exam_name || '无'}</p>
        <p className="mt-2 text-xs text-slate-500">{formatHistoryDate(latestHistory?.created_at)}</p>
      </div>
    </div>
  );

  const renderRecent = () => (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-800">最近记录</h3>
      <div className="grid gap-3 lg:grid-cols-3">
        {recentHistory.map(item => (
          <div key={item.analysis_id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{item.exam_name}</p>
                <p className="mt-1 text-xs text-slate-500">{getTypeLabel(item)} · {item.created_by_name}</p>
              </div>
              <span className={`shrink-0 rounded px-2 py-1 text-xs ${getStatusClass(item)}`}>
                {getStatusLabel(item)}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">{formatHistoryDate(item.created_at)}</span>
              <button
                type="button"
                onClick={() => onOpenAnalysis?.(item)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                aria-label={`打开${item.exam_name || ''}分析结果`}
              >
                <Eye className="h-3.5 w-3.5" />
                打开
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderActiveView = () => {
    if (activeView === 'recent') return renderRecent();
    if (activeView === 'details') return renderHistoryTable();
    if (activeView === 'all') {
      return (
        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">历史概览</h3>
            {renderOverview()}
          </section>
          <section className="space-y-3">
            {renderRecent()}
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">完整历史明细</h3>
            {renderHistoryTable()}
          </section>
        </div>
      );
    }
    return renderOverview();
  };

  return (
    <div id="section-analysis-history" className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm scroll-mt-28">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">分析历史</h2>
          <p className="mt-1 text-xs text-slate-500">默认只看历史概览，需要追溯时再进入最近记录、明细表或全面铺开。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
              收起归档
            </button>
          )}
        </div>
      </div>

      {analysisHistory.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-500">
          <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm">暂无分析历史。执行分析后，系统会在这里保留结果入口。</p>
        </div>
      ) : (
        <>
          <HistoryModuleNav activeView={activeView} modules={modules} onChange={setActiveView} />
          <div id="score-history-content" className="scroll-mt-32">
            {renderActiveView()}
          </div>
        </>
      )}
    </div>
  );
}
