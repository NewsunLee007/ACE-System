import React, { useMemo, useState } from 'react';
import { FileText, Maximize2, Share2, Table2, X } from 'lucide-react';
import FlowModuleSelector from './FlowModuleSelector';

const formatRecordDate = (value) => {
  if (!value) return '未记录';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未记录' : date.toLocaleString();
};

function RecordModuleNav({ activeView, modules, onChange, title, hint, scrollTargetId }) {
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
        title={title}
        hint={hint}
        modules={modules}
        activeValue={activeView}
        onChange={onChange}
        scrollTargetId={scrollTargetId}
      />
    </div>
  );
}

export function ScoreAnalysisPublications({ publications = [] }) {
  const [activeView, setActiveView] = useState('overview');
  const recentPublications = publications.slice(0, 3);
  const recipientTotal = useMemo(
    () => publications.reduce((sum, pub) => sum + Number(pub.recipient_count || 0), 0),
    [publications]
  );
  const latestPublication = publications[0];
  const modules = [
    { value: 'overview', label: '发布概览', desc: `${publications.length} 条发布记录`, icon: Share2 },
    { value: 'recent', label: '最近发布', desc: `${recentPublications.length} 条最近成果`, icon: FileText },
    { value: 'details', label: '明细表', desc: '完整发布清单', icon: Table2 },
    { value: 'all', label: '全面铺开', desc: '概览、最近与明细同屏', icon: Maximize2 },
  ];

  const renderPublicationTable = () => (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left">发布时间</th>
            <th className="px-4 py-3 text-left">标题</th>
            <th className="px-4 py-3 text-left">考试</th>
            <th className="px-4 py-3 text-left">发布人</th>
            <th className="px-4 py-3 text-center">接收人数</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {publications.map((pub) => (
            <tr key={pub.publication_id}>
              <td className="px-4 py-3">{formatRecordDate(pub.published_at)}</td>
              <td className="px-4 py-3 font-medium">{pub.title}</td>
              <td className="px-4 py-3">{pub.exam_name}</td>
              <td className="px-4 py-3">{pub.published_by_name}</td>
              <td className="px-4 py-3 text-center">{pub.recipient_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderOverview = () => (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm text-slate-500">发布次数</p>
        <p className="mt-1 text-2xl font-bold text-blue-700">{publications.length}</p>
        <p className="mt-1 text-xs text-slate-500">成果流转记录</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">累计接收</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{recipientTotal}</p>
        <p className="mt-1 text-xs text-slate-500">人次</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">最近发布</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-900">{latestPublication?.title || '无'}</p>
        <p className="mt-2 text-xs text-slate-500">{formatRecordDate(latestPublication?.published_at)}</p>
      </div>
    </div>
  );

  const renderRecent = () => (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-800">最近发布</h3>
      <div className="grid gap-3 lg:grid-cols-3">
        {recentPublications.map(pub => (
          <div key={pub.publication_id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-blue-100 p-2 text-blue-700">
                <Share2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{pub.title}</p>
                <p className="mt-1 text-xs text-slate-500">{pub.exam_name}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>{formatRecordDate(pub.published_at)}</span>
              <span>{pub.published_by_name} · {pub.recipient_count}人</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderActiveView = () => {
    if (activeView === 'recent') return renderRecent();
    if (activeView === 'details') return renderPublicationTable();
    if (activeView === 'all') {
      return (
        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">发布概览</h3>
            {renderOverview()}
          </section>
          <section className="space-y-3">
            {renderRecent()}
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">完整发布明细</h3>
            {renderPublicationTable()}
          </section>
        </div>
      );
    }
    return renderOverview();
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">发布记录</h2>
        <p className="mt-1 text-xs text-slate-500">默认展示发布概况，最近记录、明细表和全面铺开可直接切换。</p>
      </div>

      {publications.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Share2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>暂无发布记录</p>
        </div>
      ) : (
        <>
          <RecordModuleNav
            activeView={activeView}
            modules={modules}
            onChange={setActiveView}
            title="发布记录结果控件"
            hint="点击查看概览、最近记录、明细或全面铺开"
            scrollTargetId="score-publications-content"
          />
          <div id="score-publications-content" className="scroll-mt-32">
            {renderActiveView()}
          </div>
        </>
      )}
    </div>
  );
}

export function ScoreAnalysisLogs({ logs = [] }) {
  const [activeView, setActiveView] = useState('overview');
  const recentLogs = logs.slice(0, 3);
  const operatorCount = useMemo(
    () => new Set(logs.map(log => log.action_by_name).filter(Boolean)).size,
    [logs]
  );
  const latestLog = logs[0];
  const modules = [
    { value: 'overview', label: '审计概览', desc: `${logs.length} 条日志`, icon: FileText },
    { value: 'recent', label: '最近操作', desc: `${recentLogs.length} 条最近动作`, icon: Share2 },
    { value: 'details', label: '明细表', desc: '完整操作清单', icon: Table2 },
    { value: 'all', label: '全面铺开', desc: '概览、最近与明细同屏', icon: Maximize2 },
  ];

  const renderLogTable = () => (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left">时间</th>
            <th className="px-4 py-3 text-left">操作类型</th>
            <th className="px-4 py-3 text-left">操作人</th>
            <th className="px-4 py-3 text-left">角色</th>
            <th className="px-4 py-3 text-left">IP地址</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="px-4 py-3">{formatRecordDate(log.created_at)}</td>
              <td className="px-4 py-3">
                <span className="rounded bg-gray-100 px-2 py-1 text-xs">
                  {log.action_type}
                </span>
              </td>
              <td className="px-4 py-3">{log.action_by_name}</td>
              <td className="px-4 py-3">{log.action_by_role}</td>
              <td className="px-4 py-3 text-gray-500">{log.ip_address}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderOverview = () => (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm text-slate-500">日志总数</p>
        <p className="mt-1 text-2xl font-bold text-blue-700">{logs.length}</p>
        <p className="mt-1 text-xs text-slate-500">审计记录</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">操作人员</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{operatorCount}</p>
        <p className="mt-1 text-xs text-slate-500">账号</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">最近动作</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-900">{latestLog?.action_type || '无'}</p>
        <p className="mt-2 text-xs text-slate-500">{formatRecordDate(latestLog?.created_at)}</p>
      </div>
    </div>
  );

  const renderRecent = () => (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-800">最近操作</h3>
      <div className="grid gap-3 lg:grid-cols-3">
        {recentLogs.map(log => (
          <div key={log.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{log.action_type}</p>
                <p className="mt-1 text-xs text-slate-500">{log.action_by_name} · {log.action_by_role}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>{formatRecordDate(log.created_at)}</span>
              <span>{log.ip_address}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderActiveView = () => {
    if (activeView === 'recent') return renderRecent();
    if (activeView === 'details') return renderLogTable();
    if (activeView === 'all') {
      return (
        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">审计概览</h3>
            {renderOverview()}
          </section>
          <section className="space-y-3">
            {renderRecent()}
          </section>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">完整操作明细</h3>
            {renderLogTable()}
          </section>
        </div>
      );
    }
    return renderOverview();
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">操作日志</h2>
        <p className="mt-1 text-xs text-slate-500">默认保留审计摘要，最近操作、明细表和全面铺开可直接切换。</p>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>暂无操作日志</p>
        </div>
      ) : (
        <>
          <RecordModuleNav
            activeView={activeView}
            modules={modules}
            onChange={setActiveView}
            title="操作日志结果控件"
            hint="点击查看摘要、最近操作、明细或全面铺开"
            scrollTargetId="score-logs-content"
          />
          <div id="score-logs-content" className="scroll-mt-32">
            {renderActiveView()}
          </div>
        </>
      )}
    </div>
  );
}

export function ScoreAnalysisPublishModal({
  publishForm,
  setPublishForm,
  recipientOptions = [],
  onClose,
  onPublish,
}) {
  const toggleRecipient = (value, checked) => {
    setPublishForm({
      ...publishForm,
      recipient_types: checked
        ? [...publishForm.recipient_types, value]
        : publishForm.recipient_types.filter(type => type !== value)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">发布分析成果</h2>
          <button type="button" onClick={onClose} aria-label="关闭发布弹窗">
            <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">发布标题 *</label>
            <input
              type="text"
              value={publishForm.title}
              onChange={(event) => setPublishForm({ ...publishForm, title: event.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="请输入发布标题"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">内容摘要</label>
            <textarea
              value={publishForm.content_summary}
              onChange={(event) => setPublishForm({ ...publishForm, content_summary: event.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              rows="3"
              placeholder="请输入内容摘要（可选）"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">接收对象 *</label>
            <div className="space-y-2">
              {recipientOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={publishForm.recipient_types.includes(option.value)}
                    onChange={(event) => toggleRecipient(option.value, event.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onPublish}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            确认发布
          </button>
        </div>
      </div>
    </div>
  );
}
