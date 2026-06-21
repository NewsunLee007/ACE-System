import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileText, Maximize2, Table2, Upload, X } from 'lucide-react';
import schoolData from '../../data/schoolData';
import FlowModuleSelector from './FlowModuleSelector';

const cx = (...items) => items.filter(Boolean).join(' ');

const parseCsvRow = (row) => {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index];
    const nextChar = row[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim().replace(/^\ufeff/, ''));
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim().replace(/^\ufeff/, ''));
  return cells;
};

export const parseLayerImportCsv = ({
  text,
  selectedGrade,
  existingLayers = [],
  classes = [],
  formatClassName,
  currentAcademicYear = '2024-2025',
  layerConfig = {},
}) => {
  const lines = String(text || '')
    .split(/\r?\n/)
    .filter(line => line.trim());
  const newClasses = [];
  const errors = [];
  const allowedCodes = Object.keys(layerConfig).length ? Object.keys(layerConfig) : ['A', 'B', 'C'];
  const expectedCodes = allowedCodes.join('、');

  if (lines.length === 0) {
    return { newClasses, uniqueNewClasses: [], errors, duplicateCount: 0 };
  }

  const headerCells = parseCsvRow(lines[0]);
  const startIndex = headerCells.some(cell => cell.includes('班级名称') || cell.includes('层次')) ? 1 : 0;

  lines.slice(startIndex).forEach((line, index) => {
    const parts = parseCsvRow(line);
    if (parts.length < 2) {
      errors.push(`第${index + 1}行：请提供班级名称和层次代码`);
      return;
    }

    const className = parts[0];
    const layerCode = String(parts[1] || '').toUpperCase();

    if (!className) {
      errors.push(`第${index + 1}行：班级名称不能为空`);
      return;
    }

    if (!allowedCodes.includes(layerCode)) {
      errors.push(`第${index + 1}行：层次代码必须是${expectedCodes}`);
      return;
    }

    const matchId = String(className).match(/\d{3,4}/);
    const classId = matchId ? Number(matchId[0]) : null;
    const cls = classId ? classes.find(item => Number(item.id) === classId) : null;
    if (!cls) {
      errors.push(`第${index + 1}行：无法匹配班级ID（请用701/701班等格式）`);
      return;
    }

    newClasses.push({
      id: Date.now() + index,
      grade_level: selectedGrade,
      class_id: Number(cls.id),
      class_name: formatClassName?.(cls.id) || cls.name || className,
      layer_code: layerCode,
      layer_name: layerConfig[layerCode]?.name || `${layerCode}层`,
      academic_year: currentAcademicYear,
      term: '第一学期',
    });
  });

  const existingIds = new Set(existingLayers.map(layer => Number(layer.class_id)).filter(Boolean));
  const uniqueNewClasses = newClasses.filter(layer => !existingIds.has(Number(layer.class_id)));

  return {
    newClasses,
    uniqueNewClasses,
    errors,
    duplicateCount: newClasses.length - uniqueNewClasses.length,
  };
};

export default function ScoreAnalysisLayerImportModal({
  selectedGrade,
  editedClassLayers = [],
  setEditedClassLayers,
  normalizeClassLayers,
  layerConfig,
  notify,
  onClose,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [activeStep, setActiveStep] = useState('template');
  const [importResult, setImportResult] = useState(null);

  const buildImportResult = (text) => (
    parseLayerImportCsv({
      text,
      selectedGrade,
      existingLayers: editedClassLayers,
      classes: schoolData.classes || [],
      formatClassName: schoolData.formatClassName,
      currentAcademicYear: schoolData.getCurrentAcademicYearDisplay?.() || '2024-2025',
      layerConfig,
    })
  );

  const applyImportResult = (result = importResult) => {
    if (!result) return;

    if (result.errors.length > 0) {
      notify(`导入校验存在 ${result.errors.length} 行需要检查`, 'warning');
      console.warn('层次导入错误:', result.errors);
    }

    if (result.uniqueNewClasses.length > 0) {
      const updatedLayers = normalizeClassLayers([...editedClassLayers, ...result.uniqueNewClasses], selectedGrade);
      setEditedClassLayers(updatedLayers);
      const others = (schoolData.classLayers || []).filter(layer => layer.grade_level !== selectedGrade);
      schoolData.classLayers = [...others, ...updatedLayers];
      notify(`成功导入 ${result.uniqueNewClasses.length} 个班级`, 'success');
      onClose();
      return;
    }

    if (result.newClasses.length > 0 && result.duplicateCount > 0) {
      notify('导入文件中的班级已在当前配置中', 'warning');
      return;
    }

    if (result.errors.length === 0) {
      notify('没有可导入的数据', 'warning');
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      notify('请上传 CSV 格式文件', 'warning');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = buildImportResult(event.target.result);
      setImportResult(result);
      setActiveStep('review');

      if (result.errors.length > 0) notify(`导入校验存在 ${result.errors.length} 行需要检查`, 'warning');
      else if (result.uniqueNewClasses.length > 0) notify(`已识别 ${result.uniqueNewClasses.length} 个可导入班级，请确认应用`, 'info');
      else if (result.newClasses.length > 0 && result.duplicateCount > 0) notify('导入文件中的班级已在当前配置中', 'warning');
      else notify('没有可导入的数据', 'warning');
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csvContent = '班级名称,层次代码\n701班,A\n702班,A\n703班,B\n704班,C\n705班,C';
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '班级层次导入模板.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const steps = [
    {
      value: 'template',
      label: '模板说明',
      desc: '字段与层次代码',
      icon: FileText,
      ready: true,
    },
    {
      value: 'upload',
      label: '上传文件',
      desc: fileName || '选择CSV文件',
      icon: Upload,
      ready: true,
    },
    {
      value: 'review',
      label: '导入校验',
      desc: importResult ? `${importResult.uniqueNewClasses.length} 个可导入` : '等待文件解析',
      icon: Table2,
      ready: Boolean(importResult),
    },
    {
      value: 'all',
      label: '全面铺开',
      desc: '说明、上传与校验同屏',
      icon: Maximize2,
      ready: Boolean(importResult),
    },
  ];
  const activeConfig = steps.find(step => step.value === activeStep) || steps[0];

  const renderTemplateStep = () => (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <h3 className="font-medium text-blue-900">导入说明</h3>
        <ul className="mt-2 space-y-1 text-sm text-blue-700">
          <li>支持 CSV 格式文件</li>
          <li>表头必须包含：班级名称、层次代码</li>
          <li>层次代码：A=实验班，B=创新班，C=平行班</li>
          <li>已存在班级会自动跳过，避免重复配置</li>
        </ul>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          ['班级名称', '701班 / 701'],
          ['层次代码', 'A / B / C'],
          ['适用年级', selectedGrade],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={downloadTemplate}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
        >
          <Download className="h-4 w-4" />
          下载模板
        </button>
        <button
          type="button"
          onClick={() => setActiveStep('upload')}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          选择文件
        </button>
      </div>
    </div>
  );

  const renderUploadStep = () => (
    <div className="space-y-4">
      <button
        type="button"
        className={cx(
          'w-full rounded-lg border-2 border-dashed p-8 text-center transition-colors',
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
        )}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFile(event.dataTransfer.files?.[0]);
        }}
      >
        <Upload className="mx-auto mb-3 h-9 w-9 text-gray-400" />
        <span className="block text-sm font-medium text-gray-700">点击选择文件或拖拽到此处</span>
        <span className="mt-1 block text-xs text-gray-500">仅支持 .csv 文件，选择后进入校验，不会立即应用</span>
        {fileName && (
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
            <FileText className="h-3.5 w-3.5" />
            {fileName}
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
      </button>

      <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => setActiveStep('template')}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          返回模板说明
        </button>
        {importResult && (
          <button
            type="button"
            onClick={() => setActiveStep('review')}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            查看导入校验
          </button>
        )}
      </div>
    </div>
  );

  const renderReviewStep = () => {
    if (!importResult) {
      return (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-sm text-slate-500">
          上传 CSV 文件后，系统会校验并显示可应用配置。
        </div>
      );
    }

    const summaryCards = [
      ['解析班级', importResult.newClasses.length, '文件中识别到的班级'],
      ['可导入', importResult.uniqueNewClasses.length, '不在当前配置中的班级'],
      ['重复跳过', importResult.duplicateCount, '已存在班级'],
      ['错误行', importResult.errors.length, '需要检查的行'],
    ];

    return (
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          {summaryCards.map(([label, value, detail]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
              <p className="mt-1 text-xs text-slate-500">{detail}</p>
            </div>
          ))}
        </div>

        {importResult.errors.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              需要检查的行
            </div>
            <ul className="space-y-1 text-sm text-amber-800">
              {importResult.errors.slice(0, 5).map(error => (
                <li key={error}>{error}</li>
              ))}
              {importResult.errors.length > 5 && <li>还有 {importResult.errors.length - 5} 行错误未显示</li>}
            </ul>
          </div>
        )}

        {importResult.uniqueNewClasses.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">班级</th>
                  <th className="px-4 py-3 text-left">层次代码</th>
                  <th className="px-4 py-3 text-left">层次名称</th>
                  <th className="px-4 py-3 text-left">学年</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {importResult.uniqueNewClasses.slice(0, 8).map(layer => (
                  <tr key={`${layer.class_id}-${layer.layer_code}`}>
                    <td className="px-4 py-3 font-medium">{layer.class_name}</td>
                    <td className="px-4 py-3">{layer.layer_code}</td>
                    <td className="px-4 py-3">{layer.layer_name}</td>
                    <td className="px-4 py-3">{layer.academic_year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-8 text-center text-sm text-slate-500">
            暂无可应用的新班级，请检查重复或错误提示。
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => setActiveStep('upload')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            重新上传
          </button>
          <button
            type="button"
            onClick={() => applyImportResult()}
            disabled={importResult.uniqueNewClasses.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <CheckCircle2 className="h-4 w-4" />
            应用导入
          </button>
        </div>
      </div>
    );
  };

  const renderActiveStep = () => {
    if (activeStep === 'upload') return renderUploadStep();
    if (activeStep === 'review') return renderReviewStep();
    if (activeStep === 'all') {
      return (
        <div className="space-y-5">
          {renderTemplateStep()}
          {renderUploadStep()}
          {renderReviewStep()}
        </div>
      );
    }
    return renderTemplateStep();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-800">导入班级层次配置</h2>
            <p className="mt-1 text-sm text-gray-500">模板、上传和校验结果可直接切换，确认无误后应用到当前年级配置</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            aria-label="关闭导入弹窗"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4">
          <FlowModuleSelector
            title="层次导入结果控件"
            hint="点击查看模板、上传、校验结果或全面铺开"
            modules={steps}
            activeValue={activeStep}
            onChange={setActiveStep}
            scrollTargetId="score-layer-import-content"
          />
        </div>

        <div className="mb-4 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
          <span className="text-xs font-medium text-blue-700">当前：{activeConfig.label}</span>
          <span className="text-xs text-slate-500">{selectedGrade}</span>
        </div>

        <div id="score-layer-import-content" className="scroll-mt-32 rounded-lg border border-slate-200 bg-white p-4">
          {renderActiveStep()}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
