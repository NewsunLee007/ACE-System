import React from 'react';
import { BarChart3, CheckCircle2, ClipboardList, Database, Share2, Target, X } from 'lucide-react';

const resultEntries = [
  {
    title: '数据入口',
    detail: '锁定年级、考试和范围后，可查看原始成绩与有效状态。',
    icon: Database,
  },
  {
    title: '报告结果',
    detail: '默认只看综合概览，再按需打开临界分、分数段或学科分析板。',
    icon: BarChart3,
  },
  {
    title: '专项结果',
    detail: '三率一分、教学积分、尖子生、A层临界生和模拟进线独立进入。',
    icon: Target,
  },
  {
    title: '输出归档',
    detail: '报告确认后可发布、导出或查看历史记录。',
    icon: Share2,
  },
];

const focusGuides = [
  {
    title: '单板块优先',
    detail: '每个结果台默认只打开一个板块，避免一屏出现过多图表和表格。',
  },
  {
    title: '明细按需点开',
    detail: '需要核对名单、班级明细或公式时，切换到对应结果视图。',
  },
  {
    title: '全面铺开兜底',
    detail: '会议复核或导出前，才使用“全面铺开”把同组内容同屏展开。',
  },
];

export default function ScoreAnalysisHelpModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
      <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">成绩分析结果指引</h2>
            <p className="mt-1 text-xs text-slate-500">点击板块查看结果，默认单板块显示，需要全貌时再全面铺开。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭结果指引" className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-6 w-6 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <div className="max-h-[calc(86vh-132px)] overflow-y-auto px-6 py-5">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <ClipboardList className="mt-0.5 h-5 w-5 text-blue-700" />
              <div>
                <div className="font-semibold text-blue-950">结果入口</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-blue-800">
                  <span className="rounded-full bg-white px-3 py-1">数据入口</span>
                  <span className="rounded-full bg-white px-3 py-1">报告结果</span>
                  <span className="rounded-full bg-white px-3 py-1">专项结果</span>
                  <span className="rounded-full bg-white px-3 py-1">输出归档</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {resultEntries.map(entry => {
              const EntryIcon = entry.icon;
              return (
                <div key={entry.title} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                      <EntryIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        {entry.title}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{entry.detail}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 font-semibold text-slate-900">结果显示规则</div>
            <div className="grid gap-3 md:grid-cols-3">
              {focusGuides.map(item => (
                <div key={item.title} className="rounded-lg bg-white p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    {item.title}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
