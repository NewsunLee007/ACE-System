export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api/v1';

export class ApiRequestError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.payload = payload;
  }
}

export const getAuthHeaders = (headers = {}) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token || headers.Authorization || headers.authorization) {
    return headers;
  }
  return { ...headers, Authorization: `Bearer ${token}` };
};

const parseResponseBody = async (response) => {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
};

export const apiRequest = async (path, options = {}) => {
  const url = /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path}`;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = getAuthHeaders({
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  });

  const response = await fetch(url, {
    ...options,
    headers
  });
  const payload = await parseResponseBody(response);

  if (!response.ok) {
    const message = payload?.detail || payload?.message || `请求失败(${response.status})`;
    throw new ApiRequestError(message, response.status, payload);
  }

  return payload;
};
