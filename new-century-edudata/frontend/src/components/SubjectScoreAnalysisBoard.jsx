import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Download,
  FileText,
  Info,
  LayoutDashboard,
  Maximize2,
  Table2,
  TrendingUp,
} from 'lucide-react';

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
  const [activeView, setActiveView] = useState('overview');
  const [activeDetailView, setActiveDetailView] = useState('ranking');

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
  const rowsByZDesc = useMemo(
    () => [...analysis.rows].sort((a, b) => b.zComposite - a.zComposite),
    [analysis.rows]
  );
  const rowsByZAsc = useMemo(
    () => [...analysis.rows].sort((a, b) => a.zComposite - b.zComposite),
    [analysis.rows]
  );
  const leadingRows = rowsByZDesc.slice(0, 3);
  const attentionRows = rowsByZAsc.slice(0, 3);
  const activeSortLabel = {
    z: 'Z分',
    mean: '均分',
    std: '标准差',
    ss: '标准分',
  }[sortKey] || 'Z分';
  const baseViewModules = [
    {
      value: 'overview',
      label: '分析概览',
      desc: '关键结论',
      icon: LayoutDashboard,
    },
    {
      value: 'details',
      label: '班级明细',
      desc: `${analysis.rows.length} 个班级完整表`,
      icon: Table2,
    },
    {
      value: 'method',
      label: '计算口径',
      desc: 'Z分与分位说明',
      icon: Info,
    },
  ];
  const viewModules = [
    ...baseViewModules.map((item) => ({
      ...item,
      ready: true,
    })),
    {
      value: 'all',
      label: '全面铺开',
      desc: '概览、明细与口径同屏',
      icon: Maximize2,
      ready: true,
    },
  ];
  const activeViewConfig = viewModules.find(item => item.value === activeView) || viewModules[0];
  const baseDetailModules = [
    {
      value: 'ranking',
      label: '班级排行',
      desc: '位次和均差',
      icon: BarChart3,
    },
    {
      value: 'quantiles',
      label: '分位结构',
      desc: '复核头部与后段',
      icon: TrendingUp,
    },
    {
      value: 'full',
      label: '完整长表',
      desc: '全部指标列',
      icon: Table2,
    },
  ];
  const detailModules = [
    ...baseDetailModules.map((item) => ({
      ...item,
      ready: true,
    })),
    {
      value: 'all',
      label: '全面铺开',
      desc: '明细全部同屏',
      icon: Maximize2,
      ready: true,
    },
  ];
  const activeDetailConfig = detailModules.find(item => item.value === activeDetailView) || detailModules[0];

  const selectSubject = (subject) => {
    setActiveSubject(subject);
    setActiveView('overview');
    setActiveDetailView('ranking');
  };

  const goToView = (nextView) => {
    if (nextView === 'all') {
      setActiveDetailView('all');
      setActiveView('all');
      return;
    }

    const nextIndex = baseViewModules.findIndex(item => item.value === nextView);
    if (nextIndex < 0) return;

    if (nextView === 'details') {
      setActiveDetailView('ranking');
    }
    setActiveView(nextView);
  };

  const goToDetailView = (nextDetailView) => {
    if (nextDetailView === 'all') {
      setActiveDetailView('all');
      return;
    }

    const nextIndex = baseDetailModules.findIndex(item => item.value === nextDetailView);
    if (nextIndex < 0) return;
    setActiveDetailView(nextDetailView);
  };

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

  const renderMetric = (label, value, detail, tone = 'blue') => {
    const tones = {
      blue: 'border-blue-100 bg-blue-50 text-blue-800',
      emerald: 'border-emerald-100 bg-emerald-50 text-emerald-800',
      indigo: 'border-indigo-100 bg-indigo-50 text-indigo-800',
      amber: 'border-amber-100 bg-amber-50 text-amber-800',
      slate: 'border-slate-200 bg-slate-50 text-slate-800',
    };

    return (
      <div className={`rounded-lg border p-4 ${tones[tone] || tones.blue}`}>
        <p className="text-xs font-medium opacity-80">{label}</p>
        <p className="mt-2 text-2xl font-bold leading-none">{value}</p>
        <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
      </div>
    );
  };

  const renderLayerBadge = (layerCode) => (
    <span className={`px-2 py-0.5 rounded text-xs ${
      layerCode === 'A' ? 'bg-green-100 text-green-700' :
      layerCode === 'B' ? 'bg-blue-100 text-blue-700' :
      'bg-orange-100 text-orange-700'
    }`}>
      {layerCode || '-'}
    </span>
  );

  const renderThresholdCards = () => (
    <div className="grid gap-3 md:grid-cols-5">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
        <p className="text-xs text-blue-700">前20%分数线</p>
        <p className="mt-1 text-xl font-bold text-blue-900">{fmt1(analysis.thresholds[0.2])}</p>
      </div>
      <div className="rounded-lg border border-blue-100 bg-white p-3">
        <p className="text-xs text-slate-500">前40%分数线</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{fmt1(analysis.thresholds[0.4])}</p>
      </div>
      <div className="rounded-lg border border-blue-100 bg-white p-3">
        <p className="text-xs text-slate-500">前60%分数线</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{fmt1(analysis.thresholds[0.6])}</p>
      </div>
      <div className="rounded-lg border border-blue-100 bg-white p-3">
        <p className="text-xs text-slate-500">前80%分数线</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{fmt1(analysis.thresholds[0.8])}</p>
      </div>
      <div className="rounded-lg border border-orange-100 bg-orange-50 p-3">
        <p className="text-xs text-orange-700">后20%口径</p>
        <p className="mt-1 text-xl font-bold text-orange-900">&lt; {fmt1(analysis.thresholds[0.8])}</p>
      </div>
    </div>
  );

  const renderClassSummary = (title, rows, tone) => (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
          tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}>
          Z分排序
        </span>
      </div>
      <div className="space-y-3">
        {rows.length > 0 ? rows.map(row => (
          <div key={`${title}-${row.class_id}`} className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-semibold text-slate-900">{row.class_name}</span>
                {renderLayerBadge(row.layer_code)}
              </div>
              <span className="text-sm font-bold text-blue-700">{fmt1(row.zComposite)}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
              <span>均分 {fmt1(row.mean)}</span>
              <span className={row.meanDiff >= 0 ? 'text-green-700' : 'text-red-600'}>均差 {fmt1(row.meanDiff)}</span>
              <span>前20% {fmtPct(row.topRatios[0.2])}%</span>
            </div>
          </div>
        )) : (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">暂无班级数据</p>
        )}
      </div>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        {renderMetric('实考人数', analysis.n, `${activeSubject === '总分' ? '总分' : activeSubject} 当前统计口径`, 'blue')}
        {renderMetric('全段均分', fmt1(analysis.overallMean), `标准差 ${fmt1(analysis.overallStd)}`, 'emerald')}
        {renderMetric('前20%线', fmt1(analysis.thresholds[0.2]), '优秀分参考线', 'indigo')}
        {renderMetric('班级数', analysis.rows.length, `当前按${activeSortLabel}${sortDir === 'desc' ? '降序' : '升序'}准备明细`, 'slate')}
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-blue-900">分位线速览</h4>
            <p className="mt-1 text-xs text-blue-700">目标线默认显示，班级明细可直接点开。</p>
          </div>
          <button
            type="button"
            onClick={() => {
              goToView('details');
            }}
            className="inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Table2 className="h-3.5 w-3.5" />
            查看班级明细
          </button>
        </div>
        {renderThresholdCards()}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {renderClassSummary('领先班级', leadingRows, 'green')}
        {renderClassSummary('需要关注', attentionRows, 'amber')}
      </div>
    </div>
  );

  const renderClassTable = () => (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
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
              <td className="px-3 py-2 text-center">{renderLayerBadge(r.layer_code)}</td>
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
  );

  const renderRankingTable = () => (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">班级</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">层次</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">均分</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">均差</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">标准分</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">Z分</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">Z序</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {analysis.rows.map(row => (
            <tr key={`ranking-${row.class_id}`} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{row.class_name}</td>
              <td className="px-3 py-2 text-center">{renderLayerBadge(row.layer_code)}</td>
              <td className="px-3 py-2 text-center font-semibold text-blue-700">{fmt1(row.mean)}</td>
              <td className={`px-3 py-2 text-center ${row.meanDiff >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmt1(row.meanDiff)}
              </td>
              <td className="px-3 py-2 text-center">{fmt1(row.standardScore)}</td>
              <td className="px-3 py-2 text-center font-semibold">{fmt1(row.zComposite)}</td>
              <td className="px-3 py-2 text-center">{row.zRank}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderQuantileTable = () => (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">班级</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">层次</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">前20%</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">前40%</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">前60%</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">前80%</th>
            <th className="px-3 py-2 text-center font-medium text-gray-600">后20%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {[analysis.overallRow, ...analysis.rows].map(row => (
            <tr key={`quantile-${row.class_id}`} className={row.class_id === 0 ? 'bg-indigo-50/50' : 'hover:bg-gray-50'}>
              <td className="px-3 py-2 font-medium">{row.class_name}</td>
              <td className="px-3 py-2 text-center">{row.class_id === 0 ? '-' : renderLayerBadge(row.layer_code)}</td>
              <td className="px-3 py-2 text-center">{row.topCounts[0.2]} ({fmtPct(row.topRatios[0.2])}%)</td>
              <td className="px-3 py-2 text-center">{row.topCounts[0.4]} ({fmtPct(row.topRatios[0.4])}%)</td>
              <td className="px-3 py-2 text-center">{row.topCounts[0.6]} ({fmtPct(row.topRatios[0.6])}%)</td>
              <td className="px-3 py-2 text-center">{row.topCounts[0.8]} ({fmtPct(row.topRatios[0.8])}%)</td>
              <td className="px-3 py-2 text-center">{row.bottomCount} ({fmtPct(row.bottomRatio)}%)</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderDetailView = () => {
    if (activeDetailView === 'quantiles') {
      return (
        <div className="space-y-3">
          <div>
            <h5 className="text-sm font-semibold text-slate-900">分位结构</h5>
            <p className="mt-1 text-xs text-slate-500">按前20%、前40%、前60%、前80%和后20%复核班级结构。</p>
          </div>
          {renderQuantileTable()}
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => goToDetailView('full')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              查看完整长表
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      );
    }

    if (activeDetailView === 'full') {
      return (
        <div className="space-y-3">
          <div>
            <h5 className="text-sm font-semibold text-slate-900">完整长表</h5>
            <p className="mt-1 text-xs text-slate-500">用于导出前复核全部指标列，默认不在概览页展示。</p>
          </div>
          {renderClassTable()}
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => goToDetailView('all')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              明细全面铺开
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      );
    }

    if (activeDetailView === 'all') {
      return (
        <div className="space-y-6">
          <section className="space-y-3">
            <div>
              <h5 className="text-sm font-semibold text-slate-900">班级排行</h5>
              <p className="mt-1 text-xs text-slate-500">位次和均差结果。</p>
            </div>
            {renderRankingTable()}
          </section>
          <section className="space-y-3">
            <div>
              <h5 className="text-sm font-semibold text-slate-900">分位结构</h5>
              <p className="mt-1 text-xs text-slate-500">复核头部与后段分布。</p>
            </div>
            {renderQuantileTable()}
          </section>
          <section className="space-y-3">
            <div>
              <h5 className="text-sm font-semibold text-slate-900">完整长表</h5>
              <p className="mt-1 text-xs text-slate-500">全部指标列同屏复核。</p>
            </div>
            {renderClassTable()}
          </section>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div>
          <h5 className="text-sm font-semibold text-slate-900">班级排行</h5>
          <p className="mt-1 text-xs text-slate-500">默认只看班级、均分、均差、标准分和Z序，避免一上来横向长表。</p>
        </div>
        {renderRankingTable()}
        <div className="flex justify-end border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => goToDetailView('quantiles')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
          >
            查看分位结构
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderDetails = () => (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">班级明细工作区</h4>
          <p className="mt-1 text-xs text-slate-500">排行、分位结构和完整长表可直接切换。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowQuantiles(v => !v)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ${showQuantiles ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            {showQuantiles ? '隐藏分位' : '显示分位'}
          </button>
          <button
            type="button"
            onClick={() => toggleSort('z')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${sortKey === 'z' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            按Z分
          </button>
          <button
            type="button"
            onClick={() => toggleSort('mean')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${sortKey === 'mean' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            按均分
          </button>
          <button
            type="button"
            onClick={() => toggleSort('ss')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${sortKey === 'ss' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            按标准分
          </button>
          <button
            type="button"
            onClick={() => goToView('overview')}
            className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
          >
            返回分析概览
          </button>
          <button
            type="button"
            onClick={() => goToView('method')}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            查看计算口径
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">当前明细</p>
            <h5 className="mt-1 text-base font-semibold text-slate-900">{activeDetailConfig.label}</h5>
          </div>
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            {activeDetailConfig.desc}
          </span>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-500">明细结果控件</p>
            <p className="text-xs text-slate-400">点击查看排行、分位或完整长表</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="flex flex-col gap-2 xl:flex-row">
              {detailModules.map((item) => {
                const DetailIcon = item.icon;
                const active = item.value === activeDetailView;
                const disabled = item.ready === false;

                return (
                  <button
                    key={item.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => !disabled && goToDetailView(item.value)}
                    className={`flex min-h-16 flex-1 items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                        : 'text-slate-700 hover:bg-blue-50'
                    } ${disabled ? 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-70' : ''
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <DetailIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        {item.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{item.desc}</span>
                    </span>
                    {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {renderDetailView()}
      <p className="text-xs text-slate-500">Z分 = 标准分×0.5 + 前20%占比×20 + 前80%占比×30（与Excel一致）</p>
    </div>
  );

  const renderMethod = () => (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-900">计算口径</h4>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="font-medium text-slate-900">优秀分</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">优秀分使用当前学科前20%分数线，来自全段有效成绩排序。</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="font-medium text-slate-900">标准分</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">标准分 = 15 ×（班级均分 - 全段均分）/ 全段标准差 + 70。</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="font-medium text-slate-900">Z分</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Z分 = 标准分×0.5 + 前20%占比×20 + 前80%占比×30。</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="font-medium text-slate-900">后20%</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">后20%为低于前80%分数线的学生人数，用于定位薄弱群体。</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <h4 className="text-sm font-semibold text-blue-900">结果查看建议</h4>
          <div className="mt-4 space-y-3 text-sm text-blue-800">
            <p className="rounded-lg bg-white p-3">分析概览用于确认均分、目标线和领先/关注班级。</p>
            <p className="rounded-lg bg-white p-3">班级明细支持按Z分、均分或标准分排序查看。</p>
            <p className="rounded-lg bg-white p-3">全面铺开、PDF 和 CSV 适合会议材料或导出前确认。</p>
          </div>
        </div>
      </div>
      <div className="flex justify-end border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => goToView('all')}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
        >
          全面铺开复核
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  const renderActiveView = () => {
    if (activeView === 'details') return renderDetails();
    if (activeView === 'method') return renderMethod();
    if (activeView === 'all') {
      return (
        <div className="space-y-6">
          {renderOverview()}
          {renderDetails()}
          {renderMethod()}
        </div>
      );
    }
    return renderOverview();
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
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-green-50 text-green-700 hover:bg-green-100"
          >
            <FileText className="h-4 w-4" />
            导出PDF
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            <Download className="h-4 w-4" />
            导出CSV
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {subjects.map(s => (
            <button
              key={s}
              onClick={() => selectSubject(s)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                activeSubject === s ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              {s === '总分' ? '总分（统计维度）' : s}
            </button>
          ))}
        </div>
      </div>

      {analysis.n === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-600">
          当前范围下没有可统计的有效成绩（分数需大于0）。
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">查看方式</p>
                <p className="mt-1 text-xs text-slate-500">默认显示分析概览，明细、口径和全面铺开可直接切换。</p>
              </div>
              <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                当前：{activeViewConfig.label}
              </span>
            </div>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-slate-500">分析结果控件</p>
                <p className="text-xs text-slate-400">点击查看概览、明细、口径或全面铺开</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2">
                <div className="flex flex-col gap-2 xl:flex-row">
                  {viewModules.map((item) => {
                    const ViewIcon = item.icon;
                    const active = item.value === activeView;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        disabled={item.ready === false}
                        onClick={() => {
                          if (item.ready === false) return;
                          goToView(item.value);
                        }}
                        className={`flex min-h-16 flex-1 items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                          active
                            ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-500'
                            : 'text-slate-700 hover:bg-blue-50'
                        } ${item.ready === false ? 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-70' : ''}`}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <ViewIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-sm font-semibold">
                            {item.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">{item.desc}</span>
                        </span>
                        {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white p-4">
            {renderActiveView()}
          </div>
        </div>
      )}
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
