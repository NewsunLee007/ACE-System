import React, { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';

const sampleStd = (arr) => {
  const values = (arr || []).filter(v => typeof v === 'number' && Number.isFinite(v));
  if (values.length <= 1) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
};

const meanOf = (arr) => {
  const values = (arr || []).filter(v => typeof v === 'number' && Number.isFinite(v));
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const excelRound = (n) => Math.round(n);

const scoreStep = (values) => {
  const hasDecimal = (values || []).some(v => Number.isFinite(v) && Math.abs(v % 1) > 1e-9);
  return hasDecimal ? 0.5 : 1;
};

const thresholdExcelLike = (values, ratio) => {
  const nums = (values || []).filter(v => typeof v === 'number' && Number.isFinite(v) && v > 0);
  const n = nums.length;
  if (!n) return 0;
  const target = Math.max(1, Math.min(n, excelRound(n * ratio)));
  const sorted = [...nums].sort((a, b) => b - a);
  const approx = sorted[target - 1] ?? 0;
  const ge = nums.filter(v => v >= approx).length;
  const gt = nums.filter(v => v > approx).length;
  const step = scoreStep(nums);
  return (gt + ge < 2 * target) ? approx : (approx + step);
};

const rankDesc = (values) => {
  const sorted = [...values].sort((a, b) => b - a);
  const firstIndex = new Map();
  sorted.forEach((v, i) => {
    if (!firstIndex.has(v)) firstIndex.set(v, i + 1);
  });
  return (v) => firstIndex.get(v) || 0;
};

const SubjectScoreAnalysisBoard = ({ examData, allExamScores, classLayers }) => {
  const subjects = useMemo(() => {
    const base = (examData?.subjects || []).filter(Boolean);
    return [...base, '总分'];
  }, [examData]);

  const [activeSubject, setActiveSubject] = useState(subjects[0] || '总分');
  const [sortKey, setSortKey] = useState('z');
  const [sortDir, setSortDir] = useState('desc');
  const [showQuantiles, setShowQuantiles] = useState(false);

  const getScore = (record, subject) => {
    if (subject === '总分') return Number(record?.total_score || 0);
    const v = record?.scores?.[subject];
    return Number(v ?? 0);
  };

  const layerByClassId = useMemo(() => {
    const map = new Map();
    (classLayers || []).forEach(l => {
      if (l?.class_id) map.set(Number(l.class_id), l);
    });
    return map;
  }, [classLayers]);

  const analysis = useMemo(() => {
    const records = Array.isArray(allExamScores) ? allExamScores : [];
    const perClass = new Map();
    records.forEach(r => {
      const classId = Number(r.class_id || 0);
      if (!classId) return;
      if (!perClass.has(classId)) perClass.set(classId, []);
      perClass.get(classId).push(r);
    });

    const allScores = records
      .map(r => getScore(r, activeSubject))
      .filter(v => Number.isFinite(v) && v > 0);

    const overallMean = meanOf(allScores);
    const overallStd = sampleStd(allScores);
    const n = allScores.length;

    const thresholds = {
      0.2: thresholdExcelLike(allScores, 0.2),
      0.4: thresholdExcelLike(allScores, 0.4),
      0.6: thresholdExcelLike(allScores, 0.6),
      0.8: thresholdExcelLike(allScores, 0.8)
    };

    const rows = Array.from(perClass.entries()).map(([classId, list]) => {
      const shouldCount = list.length;
      const actualScores = list
        .map(r => getScore(r, activeSubject))
        .filter(v => Number.isFinite(v) && v > 0);
      const actualCount = actualScores.length;
      const mean = meanOf(actualScores);
      const std = sampleStd(actualScores);
      const cv = mean > 0 ? std / mean : 0;
      const standardScore = overallStd > 0 ? (15 * (mean - overallMean) / overallStd + 70) : 70;

      const topCounts = {
        0.2: actualScores.filter(s => s >= thresholds[0.2]).length,
        0.4: actualScores.filter(s => s >= thresholds[0.4]).length,
        0.6: actualScores.filter(s => s >= thresholds[0.6]).length,
        0.8: actualScores.filter(s => s >= thresholds[0.8]).length
      };
      const topRatios = {
        0.2: actualCount ? topCounts[0.2] / actualCount : 0,
        0.4: actualCount ? topCounts[0.4] / actualCount : 0,
        0.6: actualCount ? topCounts[0.6] / actualCount : 0,
        0.8: actualCount ? topCounts[0.8] / actualCount : 0
      };
      const bottomCount = actualCount - topCounts[0.8];
      const bottomRatio = actualCount ? bottomCount / actualCount : 0;

      const zComposite = standardScore * 0.5 + topRatios[0.2] * 20 + topRatios[0.8] * 30;

      const layer = layerByClassId.get(Number(classId));
      return {
        class_id: classId,
        class_name: layer?.class_name || String(classId),
        layer_code: layer?.layer_code || 'C',
        teacher: '',
        shouldCount,
        actualCount,
        mean,
        meanDiff: mean - overallMean,
        std,
        standardScore,
        cv,
        topCounts,
        topRatios,
        bottomCount,
        bottomRatio,
        zComposite
      };
    });

    const meanRank = rankDesc(rows.map(r => r.mean));
    const stdScoreRank = rankDesc(rows.map(r => r.standardScore));
    const zRank = rankDesc(rows.map(r => r.zComposite));

    const enrichedRows = rows.map(r => ({
      ...r,
      meanRank: meanRank(r.mean),
      standardScoreRank: stdScoreRank(r.standardScore),
      zRank: zRank(r.zComposite)
    }));

    const overallRow = (() => {
      const shouldCount = records.length;
      const actualCount = n;
      const std = overallStd;
      const cv = overallMean > 0 ? std / overallMean : 0;
      const standardScore = 70;
      const topCounts = {
        0.2: allScores.filter(s => s >= thresholds[0.2]).length,
        0.4: allScores.filter(s => s >= thresholds[0.4]).length,
        0.6: allScores.filter(s => s >= thresholds[0.6]).length,
        0.8: allScores.filter(s => s >= thresholds[0.8]).length
      };
      const topRatios = {
        0.2: actualCount ? topCounts[0.2] / actualCount : 0,
        0.4: actualCount ? topCounts[0.4] / actualCount : 0,
        0.6: actualCount ? topCounts[0.6] / actualCount : 0,
        0.8: actualCount ? topCounts[0.8] / actualCount : 0
      };
      const bottomCount = actualCount - topCounts[0.8];
      const bottomRatio = actualCount ? bottomCount / actualCount : 0;
      const zComposite = standardScore * 0.5 + topRatios[0.2] * 20 + topRatios[0.8] * 30;
      return {
        class_id: 0,
        class_name: '全段',
        layer_code: '',
        teacher: '',
        shouldCount,
        actualCount,
        mean: overallMean,
        meanDiff: 0,
        std,
        standardScore,
        cv,
        topCounts,
        topRatios,
        bottomCount,
        bottomRatio,
        zComposite,
        meanRank: 0,
        standardScoreRank: 0,
        zRank: 0
      };
    })();

    const sortedRows = (() => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const get = (r) => {
        if (sortKey === 'mean') return r.mean;
        if (sortKey === 'std') return r.std;
        if (sortKey === 'ss') return r.standardScore;
        return r.zComposite;
      };
      return [...enrichedRows].sort((a, b) => (get(a) - get(b)) * dir);
    })();

    return { thresholds, overallMean, overallStd, rows: sortedRows, overallRow, n };
  }, [activeSubject, allExamScores, layerByClassId, sortDir, sortKey]);

  const fmt1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) : '0.0');
  const fmtPct = (n) => (typeof n === 'number' && Number.isFinite(n) ? (n * 100).toFixed(1) : '0.0');

  const toggleSort = (nextKey) => {
    if (sortKey === nextKey) {
      setSortDir(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(nextKey);
      setSortDir('desc');
    }
  };

  const exportCsv = () => {
    const cols = [
      '班级',
      '层次',
      '应考',
      '实考',
      '均分',
      '均差',
      '均序',
      '标准差',
      '标准分',
      '变差系数',
      '前20%人数',
      '前20%比例',
      '前40%人数',
      '前40%比例',
      '前60%人数',
      '前60%比例',
      '前80%人数',
      '前80%比例',
      '后20%人数',
      '后20%比例',
      'Z分',
      'Z序'
    ];

    const rows = [analysis.overallRow, ...analysis.rows].map(r => ([
      r.class_name,
      r.layer_code || '',
      r.shouldCount,
      r.actualCount,
      fmt1(r.mean),
      typeof r.meanDiff === 'number' ? fmt1(r.meanDiff) : '',
      r.meanRank || '',
      fmt1(r.std),
      fmt1(r.standardScore),
      typeof r.cv === 'number' ? r.cv.toFixed(3) : '',
      r.topCounts[0.2],
      fmtPct(r.topRatios[0.2]),
      r.topCounts[0.4],
      fmtPct(r.topRatios[0.4]),
      r.topCounts[0.6],
      fmtPct(r.topRatios[0.6]),
      r.topCounts[0.8],
      fmtPct(r.topRatios[0.8]),
      r.bottomCount,
      fmtPct(r.bottomRatio),
      fmt1(r.zComposite),
      r.zRank || ''
    ]));

    const escape = (v) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
      return s;
    };

    const csv = [cols, ...rows].map(line => line.map(escape).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const examName = String(examData?.exam_name || '考试').replaceAll('/', '-');
    const subjectName = String(activeSubject === '总分' ? '总分' : activeSubject);
    a.href = url;
    a.download = `${examName}-${subjectName}-学科成绩分析.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const printPdf = () => {
    const subjectLabel = activeSubject === '总分' ? '总分（统计维度）' : activeSubject;
    const examName = examData?.exam_name || '';
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) return;

    const head = `
      <style>
        @page { margin: 14mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; padding: 0; color: #111827; }
        .header { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; padding: 0 0 10px; border-bottom:1px solid #e5e7eb; }
        h1 { font-size: 18px; margin: 0 0 4px; font-weight: 800; }
        h2 { font-size: 12px; margin: 0; color: #6b7280; font-weight: 600; }
        .meta { font-size: 12px; color: #6b7280; margin-bottom: 12px; }
        .chips { margin: 8px 0 12px; display:flex; flex-wrap:wrap; gap:6px; }
        .chip { font-size:12px; border:1px solid #e5e7eb; padding:4px 8px; border-radius:999px; }
        .grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:10px; margin: 12px 0; }
        .card { border:1px solid #e5e7eb; border-radius:10px; padding:10px; }
        .k { font-size:11px; color:#6b7280; }
        .v { font-size:18px; font-weight:800; margin-top:4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: center; }
        th { background: #f9fafb; color: #374151; }
        td:first-child, th:first-child { text-align: left; }
        .note { margin-top: 10px; font-size: 12px; color: #6b7280; }
      </style>
    `;

    const extraHead = showQuantiles ? `<th>前40%</th><th>前60%</th>` : '';
    const extraCells = (r) => showQuantiles
      ? `<td>${r.topCounts[0.4]} (${fmtPct(r.topRatios[0.4])}%)</td><td>${r.topCounts[0.6]} (${fmtPct(r.topRatios[0.6])}%)</td>`
      : '';

    const rows = [analysis.overallRow, ...analysis.rows].map(r => `
      <tr>
        <td>${String(r.class_name || '')}</td>
        <td>${String(r.layer_code || '-')}</td>
        <td>${r.shouldCount}</td>
        <td>${r.actualCount}</td>
        <td>${fmt1(r.mean)}</td>
        <td>${typeof r.meanDiff === 'number' ? fmt1(r.meanDiff) : '-'}</td>
        <td>${r.meanRank || '-'}</td>
        <td>${fmt1(r.std)}</td>
        <td>${fmt1(r.standardScore)}</td>
        <td>${typeof r.cv === 'number' ? r.cv.toFixed(3) : '-'}</td>
        <td>${r.topCounts[0.2]} (${fmtPct(r.topRatios[0.2])}%)</td>
        ${extraCells(r)}
        <td>${r.topCounts[0.8]} (${fmtPct(r.topRatios[0.8])}%)</td>
        <td>${r.bottomCount} (${fmtPct(r.bottomRatio)}%)</td>
        <td>${fmt1(r.zComposite)}</td>
        <td>${r.zRank || '-'}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>${head}</head>
        <body>
          <div class="header">
            <div>
              <h1>学科成绩分析</h1>
              <h2>${escapeHtml(examName)} · ${escapeHtml(subjectLabel)}</h2>
            </div>
            <div class="meta">${escapeHtml(new Date().toLocaleString())}</div>
          </div>

          <div class="grid">
            <div class="card"><div class="k">实考人数</div><div class="v">${analysis.n}</div></div>
            <div class="card"><div class="k">全段均分</div><div class="v">${fmt1(analysis.overallMean)}</div></div>
            <div class="card"><div class="k">全段标准差</div><div class="v">${fmt1(analysis.overallStd)}</div></div>
            <div class="card"><div class="k">全段Z分</div><div class="v">${fmt1(analysis.overallRow?.zComposite || 0)}</div></div>
            <div class="card"><div class="k">前20%分数线</div><div class="v">${fmt1(analysis.thresholds[0.2])}</div></div>
            <div class="card"><div class="k">前40%分数线</div><div class="v">${fmt1(analysis.thresholds[0.4])}</div></div>
            <div class="card"><div class="k">后20%分数线</div><div class="v">${fmt1(analysis.thresholds[0.8])}</div></div>
            <div class="card"><div class="k">优秀分口径</div><div class="v" style="font-size:14px;">前20%分数线</div></div>
          </div>

          <div class="chips">
            <span class="chip">前20% ≥ ${fmt1(analysis.thresholds[0.2])}</span>
            <span class="chip">前40% ≥ ${fmt1(analysis.thresholds[0.4])}</span>
            <span class="chip">前60% ≥ ${fmt1(analysis.thresholds[0.6])}</span>
            <span class="chip">前80% ≥ ${fmt1(analysis.thresholds[0.8])}</span>
            <span class="chip">后20% &lt; ${fmt1(analysis.thresholds[0.8])}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>班级</th>
                <th>层次</th>
                <th>应考</th>
                <th>实考</th>
                <th>均分</th>
                <th>均差</th>
                <th>均序</th>
                <th>标准差</th>
                <th>标准分</th>
                <th>变差系数</th>
                <th>前20%</th>
                ${extraHead}
                <th>前80%</th>
                <th>后20%</th>
                <th>Z分</th>
                <th>Z序</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="note">Z分 = 标准分×0.5 + 前20%占比×20 + 前80%占比×30</div>
        </body>
      </html>
    `;

    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-800">学科成绩分析</h3>
          <span className="text-sm text-gray-500">优秀分 = 前20%分数线</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={printPdf}
            className="px-3 py-1.5 text-sm rounded-lg bg-green-50 text-green-700 hover:bg-green-100"
          >
            导出PDF
          </button>
          <button
            onClick={exportCsv}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            导出CSV
          </button>
          <button
            onClick={() => setShowQuantiles(v => !v)}
            className={`px-3 py-1.5 text-sm rounded-lg ${showQuantiles ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {showQuantiles ? '隐藏分位' : '显示分位'}
          </button>
          <button
            onClick={() => toggleSort('z')}
            className={`px-3 py-1.5 text-sm rounded-lg ${sortKey === 'z' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            按Z分
          </button>
          <button
            onClick={() => toggleSort('mean')}
            className={`px-3 py-1.5 text-sm rounded-lg ${sortKey === 'mean' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            按均分
          </button>
          <button
            onClick={() => toggleSort('ss')}
            className={`px-3 py-1.5 text-sm rounded-lg ${sortKey === 'ss' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            按标准分
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-wrap gap-2">
          {subjects.map(s => (
            <button
              key={s}
              onClick={() => setActiveSubject(s)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeSubject === s ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              {s === '总分' ? '总分（统计维度）' : s}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">实考人数</div>
            <div className="text-lg font-bold text-gray-800">{analysis.n}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">全段均分</div>
            <div className="text-lg font-bold text-blue-700">{fmt1(analysis.overallMean)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">全段标准差</div>
            <div className="text-lg font-bold text-purple-700">{fmt1(analysis.overallStd)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500">前20%分数线</div>
            <div className="text-lg font-bold text-indigo-700">{fmt1(analysis.thresholds[0.2])}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg">前20% ≥ {fmt1(analysis.thresholds[0.2])}</span>
          <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg">前40% ≥ {fmt1(analysis.thresholds[0.4])}</span>
          <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg">前60% ≥ {fmt1(analysis.thresholds[0.6])}</span>
          <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg">前80% ≥ {fmt1(analysis.thresholds[0.8])}</span>
          <span className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg">后20% &lt; {fmt1(analysis.thresholds[0.8])}</span>
        </div>
      </div>

      {analysis.n === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-600">
          当前范围下没有可统计的有效成绩（分数需大于0）。
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">班级</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">层次</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">应考</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">实考</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">均分</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">均差</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">均序</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">标准差</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">标准分</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">变差系数</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">前20%</th>
              {showQuantiles && <th className="px-3 py-2 text-center font-medium text-gray-600">前40%</th>}
              {showQuantiles && <th className="px-3 py-2 text-center font-medium text-gray-600">前60%</th>}
              <th className="px-3 py-2 text-center font-medium text-gray-600">前80%</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">后20%</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Z分</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Z序</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr className="bg-indigo-50/50">
              <td className="px-3 py-2 font-semibold text-gray-800">{analysis.overallRow.class_name}</td>
              <td className="px-3 py-2 text-center text-gray-500">-</td>
              <td className="px-3 py-2 text-center">{analysis.overallRow.shouldCount}</td>
              <td className="px-3 py-2 text-center">{analysis.overallRow.actualCount}</td>
              <td className="px-3 py-2 text-center font-semibold text-blue-700">{fmt1(analysis.overallRow.mean)}</td>
              <td className="px-3 py-2 text-center text-gray-500">-</td>
              <td className="px-3 py-2 text-center text-gray-500">-</td>
              <td className="px-3 py-2 text-center">{fmt1(analysis.overallRow.std)}</td>
              <td className="px-3 py-2 text-center">{fmt1(analysis.overallRow.standardScore)}</td>
              <td className="px-3 py-2 text-center">{analysis.overallRow.cv.toFixed(3)}</td>
              <td className="px-3 py-2 text-center">{analysis.overallRow.topCounts[0.2]} ({fmtPct(analysis.overallRow.topRatios[0.2])}%)</td>
              {showQuantiles && <td className="px-3 py-2 text-center">{analysis.overallRow.topCounts[0.4]} ({fmtPct(analysis.overallRow.topRatios[0.4])}%)</td>}
              {showQuantiles && <td className="px-3 py-2 text-center">{analysis.overallRow.topCounts[0.6]} ({fmtPct(analysis.overallRow.topRatios[0.6])}%)</td>}
              <td className="px-3 py-2 text-center">{analysis.overallRow.topCounts[0.8]} ({fmtPct(analysis.overallRow.topRatios[0.8])}%)</td>
              <td className="px-3 py-2 text-center">{analysis.overallRow.bottomCount} ({fmtPct(analysis.overallRow.bottomRatio)}%)</td>
              <td className="px-3 py-2 text-center font-semibold">{fmt1(analysis.overallRow.zComposite)}</td>
              <td className="px-3 py-2 text-center text-gray-500">-</td>
            </tr>
            {analysis.rows.map(r => (
              <tr key={r.class_id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{r.class_name}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    r.layer_code === 'A' ? 'bg-green-100 text-green-700' :
                    r.layer_code === 'B' ? 'bg-blue-100 text-blue-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {r.layer_code || '-'}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">{r.shouldCount}</td>
                <td className="px-3 py-2 text-center">{r.actualCount}</td>
                <td className="px-3 py-2 text-center font-semibold text-blue-700">{fmt1(r.mean)}</td>
                <td className={`px-3 py-2 text-center ${r.meanDiff >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt1(r.meanDiff)}</td>
                <td className="px-3 py-2 text-center">{r.meanRank}</td>
                <td className="px-3 py-2 text-center">{fmt1(r.std)}</td>
                <td className="px-3 py-2 text-center">{fmt1(r.standardScore)}</td>
                <td className="px-3 py-2 text-center">{r.cv.toFixed(3)}</td>
                <td className="px-3 py-2 text-center">{r.topCounts[0.2]} ({fmtPct(r.topRatios[0.2])}%)</td>
                {showQuantiles && <td className="px-3 py-2 text-center">{r.topCounts[0.4]} ({fmtPct(r.topRatios[0.4])}%)</td>}
                {showQuantiles && <td className="px-3 py-2 text-center">{r.topCounts[0.6]} ({fmtPct(r.topRatios[0.6])}%)</td>}
                <td className="px-3 py-2 text-center">{r.topCounts[0.8]} ({fmtPct(r.topRatios[0.8])}%)</td>
                <td className="px-3 py-2 text-center">{r.bottomCount} ({fmtPct(r.bottomRatio)}%)</td>
                <td className="px-3 py-2 text-center font-semibold">{fmt1(r.zComposite)}</td>
                <td className="px-3 py-2 text-center">{r.zRank}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        Z分 = 标准分×0.5 + 前20%占比×20 + 前80%占比×30（与Excel一致）
      </div>
    </div>
  );
};

export default SubjectScoreAnalysisBoard;

const escapeHtml = (s) => String(s ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');
