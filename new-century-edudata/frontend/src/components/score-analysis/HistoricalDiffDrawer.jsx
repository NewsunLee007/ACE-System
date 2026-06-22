import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ArrowUp, ArrowDown, BarChart3, ClipboardPaste, History, Maximize2, Table2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { notify } from '../../lib/notify';
import FlowModuleSelector from './FlowModuleSelector';

const cx = (...items) => items.filter(Boolean).join(' ');

const parseHistoryRows = (text) => {
  const rows = text
    .trim()
    .split('\n')
    .map(row => row.split('\t'))
    .filter(row => row[0]?.trim());

  return rows.map(row => ({
    className: row[0]?.trim(),
    rate: parseFloat(row[1]?.replace('%', '')) || 0
  }));
};

const formatRate = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '-';
};

export default function HistoricalDiffDrawer({ currentAdmissionData }) {
  const [pasteData, setPasteData] = useState('');
  const [historyData, setHistoryData] = useState([]);
  const [activeView, setActiveView] = useState('input');

  // Expected format for pasting: ClassName\tRate
  // e.g. 701班\t 45.5%
  
  const handleCalculate = () => {
    try {
      const parsed = parseHistoryRows(pasteData);
      if (parsed.length < 1 || !parsed[0].className) return;
      setHistoryData(parsed);
      setActiveView('summary');
    } catch (err) {
      notify('解析失败，请检查格式');
    }
  };

  const diffData = useMemo(() => {
    if (!currentAdmissionData || historyData.length === 0) return [];
    
    return currentAdmissionData.map(curr => {
      const hist = historyData.find(h => h.className === curr.className || h.className.includes(curr.className));
      const histRate = hist ? hist.rate : null;
      const currRate = parseFloat(curr.rate);
      const diff = histRate !== null ? (currRate - histRate).toFixed(2) : null;

      return {
        className: curr.className,
        currRate: currRate.toFixed(2),
        histRate: histRate !== null ? histRate.toFixed(2) : '-',
        diff: diff !== null ? diff : '-'
      };
    });
  }, [currentAdmissionData, historyData]);

  const matchedRows = diffData.filter(row => row.diff !== '-');
  const improvedRows = matchedRows.filter(row => Number(row.diff) > 0);
  const declinedRows = matchedRows.filter(row => Number(row.diff) < 0);
  const averageDiff = matchedRows.length
    ? matchedRows.reduce((sum, row) => sum + Number(row.diff || 0), 0) / matchedRows.length
    : null;
  const topChanges = [...matchedRows]
    .sort((a, b) => Math.abs(Number(b.diff || 0)) - Math.abs(Number(a.diff || 0)))
    .slice(0, 5);
  const hasComparison = historyData.length > 0 && diffData.length > 0;
  const modules = [
    {
      value: 'input',
      label: '录入历史率',
      desc: historyData.length ? `已录入 ${historyData.length} 行` : '粘贴班级上线率',
      icon: ClipboardPaste,
      ready: true,
    },
    {
      value: 'summary',
      label: '对比摘要',
      desc: hasComparison ? `${matchedRows.length} 个班级匹配` : '计算后查看',
      icon: BarChart3,
      ready: hasComparison,
    },
    {
      value: 'details',
      label: '班级明细',
      desc: hasComparison ? `${diffData.length} 行对比` : '等待历史率',
      icon: Table2,
      ready: hasComparison,
    },
    {
      value: 'all',
      label: '全面铺开',
      desc: '录入、摘要与明细同屏',
      icon: Maximize2,
      ready: hasComparison,
    },
  ];
  const activeConfig = modules.find(module => module.value === activeView) || modules[0];

  const renderMetric = (label, value, detail, tone = 'slate') => {
    const tones = {
      slate: 'border-slate-200 bg-white text-slate-900',
      indigo: 'border-indigo-200 bg-white text-indigo-800',
      red: 'border-red-200 bg-red-50 text-red-800',
      emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };

    return (
      <div className={cx('rounded-lg border p-4', tones[tone] || tones.slate)}>
        <p className="text-sm opacity-80">{label}</p>
        <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
        {detail && <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>}
      </div>
    );
  };

  const renderInput = () => (
    <div className="space-y-4">
      <textarea
        className="h-28 w-full resize-none rounded-lg border border-indigo-200 bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="粘贴历次上线率数据（格式：班级名 Tab 上线率%）&#10;例如：&#10;701班&#9;45.5%&#10;702班&#9;42.0%"
        value={pasteData}
        onChange={event => setPasteData(event.target.value)}
      />
      <div className="flex flex-col gap-3 rounded-lg border border-indigo-100 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">录入口径</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">每行一班，班级名与上线率之间使用 Tab。系统会按班级名匹配当前模拟进线结果。</p>
        </div>
        <Button
          type="button"
          onClick={handleCalculate}
          className="bg-indigo-600 text-white hover:bg-indigo-700"
          disabled={!pasteData.trim()}
        >
          生成对比摘要
        </Button>
      </div>
    </div>
  );

  const renderSummary = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {renderMetric('匹配班级', matchedRows.length, `历史录入 ${historyData.length} 行`, 'indigo')}
        {renderMetric('平均变化', averageDiff === null ? '-' : `${formatRate(averageDiff)}%`, '最新率 - 历史率', Number(averageDiff || 0) >= 0 ? 'red' : 'emerald')}
        {renderMetric('上线率提升', improvedRows.length, '较历史有提升的班级', 'red')}
        {renderMetric('上线率下降', declinedRows.length, '需要重点复盘的班级', 'emerald')}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-slate-900">变化幅度 Top5</p>
              <p className="mt-1 text-xs text-slate-500">变化最大的班级默认显示，完整明细可直接点开。</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setActiveView('details')}>
              查看班级明细
            </Button>
          </div>
          <div className="space-y-2">
            {topChanges.length > 0 ? topChanges.map(row => {
              const diffVal = Number(row.diff);
              const positive = diffVal > 0;
              const negative = diffVal < 0;

              return (
                <div key={row.className} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-900">{row.className}</span>
                  <span className={cx('font-semibold', positive ? 'text-red-600' : negative ? 'text-emerald-600' : 'text-slate-500')}>
                    {positive ? '+' : ''}{formatRate(diffVal)}%
                  </span>
                </div>
              );
            }) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                暂无匹配班级，请回到录入板块检查班级名称。
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-indigo-100 bg-white p-4">
          <p className="text-sm font-semibold text-indigo-900">结果提示</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p className="rounded-lg bg-indigo-50 p-3">平均变化用于判断当前分数线与历史口径是否接近。</p>
            <p className="rounded-lg bg-indigo-50 p-3">变化幅度 Top5 用于定位需要复盘的班级。</p>
            <p className="rounded-lg bg-indigo-50 p-3">完整明细和全面铺开适合会议核对或导出前确认。</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDetails = () => (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center font-bold">班级</TableHead>
            <TableHead className="text-center font-bold text-gray-500">历史率(%)</TableHead>
            <TableHead className="text-center font-bold text-indigo-600">最新率(%)</TableHead>
            <TableHead className="text-center font-bold">差值(%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {diffData.map((row, idx) => {
            const diffVal = parseFloat(row.diff);
            const isPositive = diffVal > 0;
            const isNegative = diffVal < 0;

            return (
              <TableRow key={`${row.className}-${idx}`}>
                <TableCell className="text-center font-medium">{row.className}</TableCell>
                <TableCell className="text-center text-gray-500">{row.histRate}</TableCell>
                <TableCell className="text-center font-bold text-indigo-600">{row.currRate}</TableCell>
                <TableCell className="text-center font-bold">
                  {row.diff !== '-' ? (
                    <div className={cx('flex items-center justify-center gap-1', isPositive ? 'text-red-600' : isNegative ? 'text-green-600' : 'text-gray-500')}>
                      {isPositive && <ArrowUp className="h-4 w-4" />}
                      {isNegative && <ArrowDown className="h-4 w-4" />}
                      {!isPositive && !isNegative && <span className="text-lg">-</span>}
                      {isPositive || isNegative ? Math.abs(diffVal).toFixed(2) : ''}
                    </div>
                  ) : '-'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const renderActiveView = () => {
    if (activeView === 'summary') return hasComparison ? renderSummary() : renderInput();
    if (activeView === 'details') return hasComparison ? renderDetails() : renderInput();
    if (activeView === 'all') {
      return (
        <div className="space-y-5">
          {renderInput()}
          {renderSummary()}
          {renderDetails()}
        </div>
      );
    }
    return renderInput();
  };

  return (
    <Card className="mt-6 border-indigo-100 bg-indigo-50/50 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg text-indigo-800">
            <History className="h-5 w-5" />
            历史上线率对比工作台
          </CardTitle>
          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-700">
            当前：{activeConfig.label}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">默认显示历史率录入，生成后可直接查看摘要、班级明细或全面铺开。</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <FlowModuleSelector
            title="历史上线率结果控件"
            hint="点击查看录入、摘要、班级明细或全面铺开"
            modules={modules}
            activeValue={activeView}
            onChange={setActiveView}
            tone="indigo"
            scrollTargetId="historical-diff-content"
          />

          <div id="historical-diff-content" className="scroll-mt-32 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4">
            {renderActiveView()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
