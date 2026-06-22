export const formatReportNumber = (value) => (
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '0.0'
);

export const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const formatDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString();
};

const reportStyle = `
  @page { margin: 14mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #111827; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; padding-bottom:10px; border-bottom:1px solid #e5e7eb; }
  .title { font-size:18px; font-weight:800; margin:0; }
  .sub { font-size:12px; color:#6b7280; margin-top:4px; }
  .meta { font-size:12px; color:#6b7280; text-align:right; }
  .grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:10px; margin:12px 0; }
  .card { border:1px solid #e5e7eb; border-radius:10px; padding:10px; }
  .k { font-size:11px; color:#6b7280; }
  .v { font-size:18px; font-weight:800; margin-top:4px; }
  .vpos { color:#047857; }
  .vneg { color:#b91c1c; }
  h2 { font-size:14px; font-weight:800; margin:18px 0 10px; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th, td { border:1px solid #e5e7eb; padding:6px 8px; text-align:center; }
  th { background:#f9fafb; color:#374151; }
  td:first-child, th:first-child { text-align:left; }
  .pagebreak { page-break-before: always; }
  .note { font-size:12px; color:#6b7280; margin-top:8px; }
`;

const getHtmlDocument = ({ title, subtitle, metaRows = [], body }) => `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>${reportStyle}</style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="title">${escapeHtml(title)}</h1>
          <div class="sub">${escapeHtml(subtitle)}</div>
        </div>
        <div class="meta">
          ${metaRows.map(row => `<div>${escapeHtml(row)}</div>`).join('')}
        </div>
      </div>
      ${body}
    </body>
  </html>
`;

export const printHtmlReport = (html, title) => {
  if (typeof window === 'undefined' || typeof window.open !== 'function') return false;
  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(`<title>${escapeHtml(title || '导出')}</title>${html}`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
};

export const buildComprehensiveReportHtml = ({
  analysisResult,
  selectedExam,
  scopeKey,
  scopeLabel,
  generatedAt = new Date(),
}) => {
  const scopeData = analysisResult?.scopes?.[scopeKey] || analysisResult?.scopes?.all;
  const summary = scopeData?.summary || {};
  const key = scopeData?.key_metrics?.total || {};
  const subjects = (selectedExam?.subjects || []).filter(Boolean);
  const subjectKey = scopeData?.key_metrics?.subjects || {};
  const subjectStats = scopeData?.subject_analysis?.subject_statistics || {};
  const rankBands = scopeData?.key_metrics?.rank_bands?.total || [];
  const scoreDist = scopeData?.overall?.chart_data?.score_distribution || [];
  const absence = (summary.total_students || 0) - (summary.participated || 0);
  const rankRows = [];
  for (let i = 0; i < rankBands.length; i += 8) rankRows.push(rankBands.slice(i, i + 8));

  const body = `
    <div class="grid">
      ${[
        { k: '平均分', v: formatReportNumber(summary.grade_mean) },
        { k: '标准差', v: formatReportNumber(summary.grade_std) },
        { k: '标准分', v: formatReportNumber(key.standard_score) },
        { k: '前20%分数线', v: formatReportNumber(key.top20_score) },
        { k: '前40%分数线', v: formatReportNumber(key.top40_score) },
        { k: '后20%分数线', v: formatReportNumber(key.top80_score) },
        { k: 'Z分', v: formatReportNumber(key.z_score) },
        { k: '缺考人数', v: String(absence) },
      ].map(item => `
        <div class="card">
          <div class="k">${escapeHtml(item.k)}</div>
          <div class="v">${escapeHtml(item.v)}</div>
        </div>
      `).join('')}
    </div>

    <h2>总分分布（分数段）</h2>
    <table>
      <thead>
        <tr><th>分数段</th><th>人数</th><th>占比</th></tr>
      </thead>
      <tbody>
        ${scoreDist.map(row => `
          <tr>
            <td>${escapeHtml(row.range)}</td>
            <td>${row.count}</td>
            <td>${formatReportNumber(row.percentage)}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>关键数值表</h2>
    <table>
      <thead>
        <tr>
          <th>指标</th>
          ${subjects.map(subject => `<th>${escapeHtml(subject)}</th>`).join('')}
          <th>总分（统计维度）</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>最高分</td>
          ${subjects.map(subject => `<td>${formatReportNumber(subjectKey?.[subject]?.max)}</td>`).join('')}
          <td>${formatReportNumber(key.max)}</td>
        </tr>
        <tr>
          <td>优秀分（前20%分数线）</td>
          ${subjects.map(subject => `<td>${formatReportNumber(subjectKey?.[subject]?.top20_score)}</td>`).join('')}
          <td>${formatReportNumber(key.top20_score)}</td>
        </tr>
        <tr>
          <td>平均分</td>
          ${subjects.map(subject => `<td>${formatReportNumber(subjectKey?.[subject]?.mean)}</td>`).join('')}
          <td>${formatReportNumber(key.mean)}</td>
        </tr>
        <tr>
          <td>卷面分</td>
          ${subjects.map(subject => `<td>${formatReportNumber(subjectKey?.[subject]?.full_score)}</td>`).join('')}
          <td>${formatReportNumber(key.full_score)}</td>
        </tr>
      </tbody>
    </table>

    <div class="pagebreak"></div>
    <h2>总分排名分数段</h2>
    <table>
      <tbody>
        ${rankRows.map(row => `
          <tr>
            <td style="font-weight:700;background:#f9fafb;">名次</td>
            ${row.map(item => `<td style="font-weight:700;">${item.rank}</td>`).join('')}
          </tr>
          <tr>
            <td style="font-weight:700;">分数</td>
            ${row.map(item => `<td>${formatReportNumber(item.score)}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>学科统计（均分 / 与全段差 / 标准差 / 前20%分数线）</h2>
    <table>
      <thead>
        <tr><th>学科</th><th>平均分</th><th>与全段差</th><th>标准差</th><th>前20%分数线</th></tr>
      </thead>
      <tbody>
        ${subjects.map(subject => `
          <tr>
            <td>${escapeHtml(subject)}</td>
            <td>${formatReportNumber(subjectStats?.[subject]?.mean)}</td>
            <td>${formatReportNumber(subjectStats?.[subject]?.range_diff)}</td>
            <td>${formatReportNumber(subjectStats?.[subject]?.std)}</td>
            <td>${formatReportNumber(subjectKey?.[subject]?.top20_score)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="note">Z分 = 标准分×0.5 + 前20%占比×20 + 前80%占比×30</div>
  `;

  return getHtmlDocument({
    title: `${analysisResult?.exam_name || ''} · 成绩分析报告`,
    subtitle: `${analysisResult?.grade_level || ''} · 范围：${scopeLabel || scopeKey}`,
    metaRows: [
      `参与人数 ${summary.participated || 0}/${summary.total_students || 0}`,
      formatDateTime(analysisResult?.created_at || generatedAt),
    ],
    body,
  });
};

export const buildHistoryTrendReportHtml = ({
  trendModel,
  selectedGrade,
  scopeLabel,
  generatedAt = new Date(),
}) => {
  const trendRows = trendModel?.trendRows || [];
  const baseline = trendModel?.baseline || trendRows[0] || {};
  const latest = trendModel?.latest || trendRows[trendRows.length - 1] || {};
  const previous = trendModel?.previous || trendRows[trendRows.length - 2] || baseline;
  const subjectMatrix = trendModel?.subjectMatrix || [];
  const examLabels = trendRows.map(row => row.label).filter(Boolean);

  const metricCards = [
    { k: '考试次数', v: String(trendRows.length) },
    { k: '均分较基准', v: formatReportNumber((latest.mean || 0) - (baseline.mean || 0)), tone: (latest.mean || 0) - (baseline.mean || 0) },
    { k: '最近环比均分', v: formatReportNumber((latest.mean || 0) - (previous.mean || 0)), tone: (latest.mean || 0) - (previous.mean || 0) },
    { k: 'D等率较基准', v: `${formatReportNumber((latest.dRate || 0) - (baseline.dRate || 0))}%`, tone: -((latest.dRate || 0) - (baseline.dRate || 0)) },
    { k: 'Z分较基准', v: formatReportNumber((latest.zScore || 0) - (baseline.zScore || 0)), tone: (latest.zScore || 0) - (baseline.zScore || 0) },
    { k: '最新参考人数', v: String(latest.participated || 0) },
  ];

  const body = `
    <div class="grid">
      ${metricCards.map(item => `
        <div class="card">
          <div class="k">${escapeHtml(item.k)}</div>
          <div class="v ${typeof item.tone === 'number' ? (item.tone >= 0 ? 'vpos' : 'vneg') : ''}">${escapeHtml(item.v)}</div>
        </div>
      `).join('')}
    </div>

    <h2>多考试核心指标趋势</h2>
    <table>
      <thead>
        <tr>
          <th>考试</th>
          <th>参考人数</th>
          <th>均分</th>
          <th>标准差</th>
          <th>Z分</th>
          <th>及格率</th>
          <th>A等率</th>
          <th>B等率</th>
          <th>C等率</th>
          <th>D等率</th>
          <th>D等人数</th>
        </tr>
      </thead>
      <tbody>
        ${trendRows.map(row => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${row.participated || 0}</td>
            <td>${formatReportNumber(row.mean)}</td>
            <td>${formatReportNumber(row.std)}</td>
            <td>${formatReportNumber(row.zScore)}</td>
            <td>${formatReportNumber(row.passRate)}%</td>
            <td>${formatReportNumber(row.aRate)}%</td>
            <td>${formatReportNumber(row.bRate)}%</td>
            <td>${formatReportNumber(row.cRate)}%</td>
            <td>${formatReportNumber(row.dRate)}%</td>
            <td>${row.dCount || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="pagebreak"></div>
    <h2>学科均分变化矩阵（最新 - 基准）</h2>
    <table>
      <thead>
        <tr>
          <th>学科</th>
          <th>基准均分</th>
          <th>最新均分</th>
          <th>变化</th>
        </tr>
      </thead>
      <tbody>
        ${subjectMatrix.map(row => `
          <tr>
            <td>${escapeHtml(row.subject)}</td>
            <td>${formatReportNumber(row.baseline)}</td>
            <td>${formatReportNumber(row.latest)}</td>
            <td style="color:${row.delta >= 0 ? '#047857' : '#b91c1c'}; font-weight:700;">${row.delta > 0 ? '+' : ''}${formatReportNumber(row.delta)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="note">已纳入考试：${escapeHtml(examLabels.join(' / '))}</div>
  `;

  return getHtmlDocument({
    title: '历史趋势报告',
    subtitle: `${selectedGrade || ''} · 范围：${scopeLabel || '全段'}`,
    metaRows: [
      `${trendRows[0]?.label || '基准考试'} → ${latest?.label || '最新考试'}`,
      formatDateTime(generatedAt),
    ],
    body,
  });
};
