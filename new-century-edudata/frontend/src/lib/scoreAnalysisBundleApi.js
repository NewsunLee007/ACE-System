import { apiRequest, API_BASE_URL, getAuthHeaders } from './api';

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const fetchLatestScoreAnalysisBundle = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const suffix = query.toString() ? `?${query}` : '';
  return apiRequest(`/score-analysis/bundles/latest${suffix}`);
};

export const refreshScoreAnalysisBundle = ({ examId, gradeLevel }) => (
  apiRequest(`/score-analysis/bundles/${encodeURIComponent(examId)}/refresh`, {
    method: 'POST',
    body: JSON.stringify({ grade_level: gradeLevel }),
  })
);

export const exportScoreAnalysisBundle = async ({ bundleId, format = 'excel', view = 'full' }) => {
  const response = await fetch(
    `${API_BASE_URL}/score-analysis/bundles/${encodeURIComponent(bundleId)}/export?format=${encodeURIComponent(format)}&view=${encodeURIComponent(view)}`,
    { headers: getAuthHeaders({}) }
  );

  if (!response.ok) {
    let message = `导出失败(${response.status})`;
    try {
      const payload = await response.json();
      message = payload?.detail || payload?.message || message;
    } catch (error) {
      // keep default message
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const extension = format === 'pdf' ? 'pdf' : 'xlsx';
  downloadBlob(blob, `score_analysis_bundle_${bundleId}.${extension}`);
  return true;
};
