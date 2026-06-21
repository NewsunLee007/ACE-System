import React, { useMemo, useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, ClipboardList, Database, Eye, LayoutDashboard, Maximize2, Table2 } from 'lucide-react';
import schoolData from '../../data/schoolData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import FlowModuleSelector from './FlowModuleSelector';
import {
  buildScoreImport,
  commitScoreImport,
  parseScoreImportText,
  scoreImportRowsToCsv,
  uploadScoreImportFile,
} from '../../lib/scoreImport';
import { getStoredToken, hasBackendAuthToken } from '../../lib/sessionToken';

export { buildScoreImport, commitScoreImport, parseScoreImportText } from '../../lib/scoreImport';

const isExcelFile = (file) => /\.(xls|xlsx)$/i.test(file?.name || '');
const cx = (...items) => items.filter(Boolean).join(' ');

const getAuthToken = () => {
  try {
    return hasBackendAuthToken() ? getStoredToken() : null;
  } catch {
    return null;
  }
};

const buildBackendUploadPayload = ({ selectedFile, headers, parsedData, examId }) => {
  if (selectedFile && isExcelFile(selectedFile)) {
    return { file: selectedFile, filename: selectedFile.name };
  }

  if (headers.length && parsedData.length) {
    const csv = scoreImportRowsToCsv({ headers, rows: parsedData });
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    return {
      file: blob,
      filename: `scores_exam_${examId || 'draft'}.csv`,
    };
  }

  return null;
};

const scrollToRawContent = (targetId = 'score-raw-module-content') => {
  if (typeof window === 'undefined') return;

  window.setTimeout(() => {
    const target = document.getElementById(targetId);
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, 0);
};

export default function ScoreRawData({ examData, onImportSuccess }) {
  const fileInputRef = useRef(null);
  const [pasteData, setPasteData] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [backendResult, setBackendResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [activeModule, setActiveModule] = useState('source');
  const [sourceMode, setSourceMode] = useState('paste');
  const [previewView, setPreviewView] = useState('summary');

  const moveToModule = (nextModule) => {
    setActiveModule(nextModule);
    scrollToRawContent();
  };

  const moveToPreviewView = (nextView) => {
    setPreviewView(nextView);
    scrollToRawContent('score-raw-preview-content');
  };

  const existingExamScores = useMemo(() => (
    examData?.id ? (schoolData.examScores || []).filter(score => Number(score.exam_id) === Number(examData.id)) : []
  ), [examData?.id]);

  const parseText = (text) => {
    if (!text) {
      setParsedData([]);
      setHeaders([]);
      setError('');
      setNotice('');
      setImportResult(null);
      setBackendResult(null);
      return;
    }

    try {
      const parsed = parseScoreImportText(text);
      setHeaders(parsed.headers);
      setParsedData(parsed.rows);
      setError('');
      setNotice('');
      setImportResult(null);
      setBackendResult(null);
      setPreviewView('summary');
      moveToModule(parsed.rows.length > 0 ? 'preview' : 'source');
    } catch (err) {
      setError(err.message);
      moveToModule('result');
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text');
    setSelectedFile(null);
    setSourceMode('paste');
    setPasteData(text);
    parseText(text);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setSourceMode('file');
    setBackendResult(null);
    setImportResult(null);

    if (isExcelFile(file)) {
      setPasteData('');
      setParsedData([]);
      setHeaders([]);
      setError('');
      setNotice('已选择 Excel 文件，将直接写入后端数据库；如需预览，请另存为 CSV 或从 Excel 复制粘贴。');
      moveToModule('confirm');
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const text = readerEvent.target?.result || '';
      setPasteData(text);
      parseText(text);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!examData?.id) {
      setError('请选择考试后导入成绩');
      moveToModule('result');
      return;
    }

    setImporting(true);
    setError('');
    setNotice('');

    try {
      const uploadPayload = buildBackendUploadPayload({
        selectedFile,
        headers,
        parsedData,
        examId: examData.id,
      });
      const hasBackendSession = Boolean(getAuthToken());
      let localResult = null;
      let syncedBackendResult = null;

      if (parsedData.length > 0) {
        localResult = buildScoreImport({
          parsedRows: parsedData,
          headers,
          examData,
          existingExamScores,
        });
        if (localResult.importedScores.length === 0) {
          setError(localResult.errors[0] || '没有可导入的数据');
          moveToModule('result');
          return;
        }
      } else if (!uploadPayload) {
        setError('请先粘贴成绩数据或选择成绩文件');
        moveToModule('result');
        return;
      }

      if (hasBackendSession && uploadPayload) {
        syncedBackendResult = await uploadScoreImportFile({
          examId: examData.id,
          file: uploadPayload.file,
          filename: uploadPayload.filename,
        });
        setBackendResult(syncedBackendResult);
      } else if (uploadPayload && isExcelFile(selectedFile)) {
        setError('Excel 文件需要在登录后写入后端数据库；当前会话未检测到登录 token。');
        moveToModule('result');
        return;
      }

      if (localResult) {
        commitScoreImport({ examData, importResult: localResult });
        setImportResult(localResult);
        setError(localResult.errors.length ? `已导入有效数据，但有 ${localResult.errors.length} 行需要检查。` : '');
        if (onImportSuccess) onImportSuccess({ ...localResult, backendResult: syncedBackendResult });
        moveToModule('result');
      } else if (syncedBackendResult) {
        setNotice(syncedBackendResult.message || '后端导入完成。请刷新考试数据后继续分析。');
        moveToModule('result');
      }
    } catch (err) {
      setError(err.message || '导入失败');
      moveToModule('result');
    } finally {
      setImporting(false);
    }
  };

  const subjectCount = examData?.subjects?.length || 0;
  const hasPreview = parsedData.length > 0;
  const hasResult = Boolean(importResult || backendResult || error || notice);
  const hasExcelSelection = Boolean(selectedFile && isExcelFile(selectedFile));
  const canConfirmWrite = hasPreview || hasExcelSelection;
  const baseModules = [
    {
      value: 'source',
      label: '数据来源',
      desc: '粘贴或上传成绩表',
      icon: ClipboardList,
      ready: true,
    },
    {
      value: 'preview',
      label: '解析预览',
      desc: hasPreview ? `${parsedData.length} 行待核对` : '导入数据后显示',
      icon: Eye,
      ready: hasPreview,
    },
    {
      value: 'confirm',
      label: '写入确认',
      desc: canConfirmWrite ? '确认考试与覆盖策略' : '解析后显示',
      icon: CheckCircle,
      ready: canConfirmWrite,
    },
    {
      value: 'result',
      label: '导入结果',
      desc: hasResult ? '查看状态和统计' : '导入后显示',
      icon: Database,
      ready: hasResult,
    },
    {
      value: 'all',
      label: '全面铺开',
      desc: canConfirmWrite || hasResult ? '导入内容同屏核对' : '录入后显示',
      icon: Maximize2,
      ready: canConfirmWrite || hasResult,
    },
  ];
  const modules = baseModules.filter(module => (
    module.value === 'source' || module.ready || module.value === activeModule
  ));
  const activeConfig = modules.find(module => module.value === activeModule && module.ready) || modules[0];

  const renderStatusAlerts = () => (
    <>
      {error && (
        <div className={`flex items-center gap-2 rounded-lg p-4 ${importResult ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {notice && !error && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-4 text-blue-700">
          <FileText className="h-5 w-5" />
          {notice}
        </div>
      )}
    </>
  );

  const renderPastePanel = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-blue-500" />
          智能粘贴
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            从 Excel 复制成绩区域后直接粘贴。已识别 {subjectCount} 个考试科目。
          </p>
          <textarea
            className="h-44 w-full resize-none rounded-lg border border-gray-300 p-3 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="示例表头：学籍辅号\t姓名\t班级\t语文\t数学\t英语\t总分\t参与统计"
            value={pasteData}
            onChange={(event) => {
              setSelectedFile(null);
              setSourceMode('paste');
              setPasteData(event.target.value);
              parseText(event.target.value);
            }}
            onPaste={handlePaste}
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderFilePanel = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="h-5 w-5 text-green-500" />
          文件导入
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            支持 CSV/TSV 预览导入；Excel 文件会直接交给后端校验并写入数据库。
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:bg-gray-50"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
            <p className="text-sm font-medium text-gray-600">选择成绩文件</p>
            <p className="mt-1 text-xs text-gray-400">CSV/TSV 先预览，Excel 直接写入后端</p>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,.tsv,.txt,.xls,.xlsx"
            onChange={handleFileChange}
          />

          {selectedFile && isExcelFile(selectedFile) && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="mt-1 text-slate-500">
                    Excel 文件将由后端直接校验并写入数据库；当前页面不会读取表格内容做本地预览。
                  </p>
                </div>
                <Button
                  onClick={() => moveToModule('confirm')}
                  className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  进入写入确认
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderSourcePanel = () => {
    const sourceOptions = [
      {
        value: 'paste',
        label: '智能粘贴',
        desc: '适合从 Excel 直接复制成绩区域',
        icon: FileText,
      },
      {
        value: 'file',
        label: '文件导入',
        desc: '适合 CSV/TSV 预览或 Excel 后端写入',
        icon: Upload,
      },
    ];

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="grid gap-2 md:grid-cols-2">
            {sourceOptions.map(option => {
              const SourceIcon = option.icon;
              const active = sourceMode === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSourceMode(option.value)}
                  className={cx(
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors',
                    active
                      ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                      : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span className={cx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  )}>
                    <SourceIcon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">{option.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {sourceMode === 'file' ? renderFilePanel() : renderPastePanel()}
      </div>
    );
  };

  const renderPreviewPanel = () => {
    const examSubjects = examData?.subjects || [];
    const matchedSubjects = headers.filter(header => examSubjects.includes(header));
    const firstRow = parsedData[0] || {};
    const sampleFields = headers.slice(0, 8).map(header => [header, firstRow[header]]);
    const previewViewModules = [
      {
        value: 'summary',
        label: '预览摘要',
        desc: '字段和行数摘要',
        icon: LayoutDashboard,
      },
      {
        value: 'details',
        label: '行级明细',
        desc: '逐行核对前50行',
        icon: Table2,
      },
      {
        value: 'all',
        label: '全面铺开',
        desc: '摘要和明细同时看',
        icon: Maximize2,
      },
    ];
    const activePreviewConfig = previewViewModules.find(item => item.value === previewView) || previewViewModules[0];

    const renderPreviewSummary = () => (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-blue-800">
            <p className="text-xs opacity-80">解析行数</p>
            <p className="mt-2 text-2xl font-bold leading-none">{parsedData.length}</p>
            <p className="mt-2 text-xs opacity-80">准备写入当前考试</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-800">
            <p className="text-xs opacity-80">识别字段</p>
            <p className="mt-2 text-2xl font-bold leading-none">{headers.length}</p>
            <p className="mt-2 text-xs opacity-80">包含身份、班级与成绩列</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
            <p className="text-xs opacity-80">匹配科目</p>
            <p className="mt-2 text-2xl font-bold leading-none">{matchedSubjects.length}/{subjectCount}</p>
            <p className="mt-2 text-xs opacity-80">{matchedSubjects.join(' / ') || '未匹配考试科目'}</p>
          </div>
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-indigo-800">
            <p className="text-xs opacity-80">写入状态</p>
            <p className="mt-2 text-2xl font-bold leading-none">{examData?.id ? '就绪' : '待选'}</p>
            <p className="mt-2 text-xs opacity-80">{examData?.id ? '可写入当前考试' : '请选择考试'}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">字段识别</h3>
                <p className="mt-1 text-xs text-slate-500">确认表头和考试科目匹配，可直接点开行级明细。</p>
              </div>
              <Button type="button" variant="outline" onClick={() => moveToPreviewView('details')}>
                查看行级明细
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {headers.map(header => (
                <span
                  key={header}
                  className={cx(
                    'rounded-full px-3 py-1 text-xs font-medium',
                    matchedSubjects.includes(header)
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {header}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <h3 className="text-sm font-semibold text-blue-900">首行样例</h3>
            <div className="mt-3 space-y-2 text-sm">
              {sampleFields.map(([header, value]) => (
                <div key={header} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                  <span className="text-slate-500">{header}</span>
                  <span className="truncate font-medium text-slate-900">{value || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );

    const renderPreviewDetails = () => (
      <div className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">行级明细</h3>
            <p className="mt-1 text-xs text-slate-500">仅显示前 50 行，完整数据会在写入时统一校验。</p>
          </div>
          <Button type="button" variant="outline" onClick={() => moveToPreviewView('summary')}>
            返回预览摘要
          </Button>
        </div>

        <div className="max-h-[420px] overflow-x-auto rounded-lg border border-slate-200">
          <Table>
            <TableHeader className="sticky top-0 bg-white">
              <TableRow>
                {Object.keys(parsedData[0] || {}).map((header, index) => (
                  <TableHead key={index} className="whitespace-nowrap">{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsedData.slice(0, 50).map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {Object.values(row).map((value, valueIndex) => (
                    <TableCell key={valueIndex} className="whitespace-nowrap">{value || '-'}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {parsedData.length > 50 && (
            <p className="border-t py-4 text-center text-sm text-gray-500">
              仅显示前 50 行预览
            </p>
          )}
        </div>
      </div>
    );

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="h-5 w-5 text-green-500" />
              解析预览（共 {parsedData.length} 行）
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">当前：{activePreviewConfig.label}</p>
          </div>
          <Button
            onClick={() => moveToModule('confirm')}
            disabled={!hasPreview}
            className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            进入写入确认
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <FlowModuleSelector
              title="预览核对结果控件"
              hint="点击查看摘要、行级明细或全面铺开"
              modules={previewViewModules}
              activeValue={previewView}
              onChange={setPreviewView}
              scrollTargetId="score-raw-preview-content"
            />
          </div>

          <div id="score-raw-preview-content" className="scroll-mt-32">
            {previewView === 'all' ? (
              <div className="space-y-5">
                {renderPreviewSummary()}
                {renderPreviewDetails()}
              </div>
            ) : previewView === 'details' ? renderPreviewDetails() : renderPreviewSummary()}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderConfirmPanel = () => {
    const examSubjects = examData?.subjects || [];
    const matchedSubjects = headers.filter(header => examSubjects.includes(header));
    const writeTarget = hasExcelSelection
      ? '后端数据库'
      : getAuthToken()
        ? '后端数据库 + 本地缓存'
        : '本地缓存';
    const sourceLabel = hasExcelSelection ? selectedFile?.name : '已解析成绩数据';

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CheckCircle className="h-5 w-5 text-blue-500" />
            写入确认
          </CardTitle>
          <p className="text-xs text-slate-500">确认考试对象、数据来源和覆盖策略后再写入。</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {renderStatusAlerts()}

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-blue-800">
                <p className="text-xs opacity-80">当前考试</p>
                <p className="mt-2 text-sm font-semibold leading-5">{examData?.exam_name || examData?.name || '未选择考试'}</p>
                <p className="mt-2 text-xs opacity-80">{examData?.id ? '考试已锁定' : '请选择考试'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-800">
                <p className="text-xs opacity-80">数据来源</p>
                <p className="mt-2 truncate text-sm font-semibold leading-5">{sourceLabel}</p>
                <p className="mt-2 text-xs opacity-80">{hasExcelSelection ? 'Excel 文件后端校验' : `${parsedData.length} 行待写入`}</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
                <p className="text-xs opacity-80">匹配科目</p>
                <p className="mt-2 text-2xl font-bold leading-none">{hasExcelSelection ? '-' : `${matchedSubjects.length}/${subjectCount}`}</p>
                <p className="mt-2 text-xs opacity-80">
                  {hasExcelSelection ? '由后端读取表格' : (matchedSubjects.join(' / ') || '未匹配考试科目')}
                </p>
              </div>
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 text-indigo-800">
                <p className="text-xs opacity-80">写入去向</p>
                <p className="mt-2 text-sm font-semibold leading-5">{writeTarget}</p>
                <p className="mt-2 text-xs opacity-80">同一考试旧成绩按学生覆盖</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">写入规则</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs text-slate-500">覆盖口径</p>
                  <p className="mt-1 font-medium">同一考试、同一学生更新原成绩</p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs text-slate-500">统计口径</p>
                  <p className="mt-1 font-medium">按参与统计字段重算排名</p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs text-slate-500">结果留痕</p>
                  <p className="mt-1 font-medium">写入后查看新增、覆盖、有效与需检查行</p>
                </div>
              </div>
            </div>

            {hasExcelSelection && !getAuthToken() && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Excel 文件需要登录后写入后端数据库；当前会话未检测到登录 token。
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (hasExcelSelection) {
                    setSourceMode('file');
                    moveToModule('source');
                    return;
                  }
                  moveToModule('preview');
                }}
              >
                {hasExcelSelection ? '返回文件选择' : '返回解析预览'}
              </Button>
              <Button
                onClick={handleImport}
                disabled={!examData?.id || importing || !canConfirmWrite}
                className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? '写入中...' : hasExcelSelection ? '写入后端数据库' : '写入当前考试'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderResultPanel = () => (
    <div className="space-y-4">
      {renderStatusAlerts()}

      {backendResult && (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle className="h-5 w-5" />
            已同步后端数据库
          </div>
          <p className="mt-2">
            {backendResult.message || `成功 ${backendResult.stats?.success || 0} 条，失败 ${backendResult.stats?.failed || 0} 条`}
          </p>
          {backendResult.stats?.errors?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {backendResult.stats.errors.slice(0, 5).map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {importResult && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['新增', importResult.insertedCount],
            ['覆盖', importResult.updatedCount],
            ['有效', importResult.validCount],
            ['需检查', importResult.errors.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs text-emerald-700">{label}</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      {importResult?.errors?.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">需检查行：</p>
          <ul className="mt-2 space-y-1">
            {importResult.errors.slice(0, 8).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {!hasResult && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          完成解析或导入后，在这里查看导入结果。
        </div>
      )}
    </div>
  );

  const renderActiveModule = () => {
    if (activeModule === 'preview') return renderPreviewPanel();
    if (activeModule === 'confirm') return renderConfirmPanel();
    if (activeModule === 'result') return renderResultPanel();
    if (activeModule === 'all') {
      return (
        <div className="space-y-6">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">录入来源</h3>
              <p className="mt-1 text-xs text-slate-500">粘贴成绩或选择成绩文件。</p>
            </div>
            {renderPastePanel()}
            {renderFilePanel()}
          </section>

          {hasPreview && (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">解析预览</h3>
                <p className="mt-1 text-xs text-slate-500">摘要和行级明细可同屏核对。</p>
              </div>
              {renderPreviewPanel()}
            </section>
          )}

          {canConfirmWrite && (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">写入确认</h3>
                <p className="mt-1 text-xs text-slate-500">确认考试、来源、去向与覆盖规则。</p>
              </div>
              {renderConfirmPanel()}
            </section>
          )}

          {hasResult && (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">导入结果</h3>
                <p className="mt-1 text-xs text-slate-500">查看写入统计与需检查行。</p>
              </div>
              {renderResultPanel()}
            </section>
          )}
        </div>
      );
    }
    return renderSourcePanel();
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-0.5 h-5 w-5" />
          <div>
            <p className="font-semibold">当前导入对象：{examData?.exam_name || examData?.name || '未选择考试'}</p>
            <p className="mt-1 leading-6">
              表头至少包含学籍辅号或姓名、班级，以及考试科目列。导入会按学生覆盖同一考试的旧成绩，并自动重算年级排名和班级排名。
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">数据核对工作台</h2>
              <p className="mt-1 text-xs text-slate-500">选择导入方式后，可查看解析预览、写入确认和导入结果。</p>
            </div>
            <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              当前：{activeConfig.label}
            </span>
          </div>

          <div className="mt-4">
            <FlowModuleSelector
              title="数据导入结果控件"
              hint="点击查看录入、预览、确认、结果或全面铺开"
              modules={modules}
              activeValue={activeConfig.value}
              onChange={setActiveModule}
              scrollTargetId="score-raw-module-content"
            />
          </div>
        </div>

        <div id="score-raw-module-content" className="scroll-mt-32 bg-slate-50 p-5">
          {renderActiveModule()}
        </div>
      </div>
    </div>
  );
}
