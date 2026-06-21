export const getStoredToken = () => (
  typeof localStorage === 'undefined' ? '' : String(localStorage.getItem('token') || '')
);

export const isDevelopmentToken = (token = getStoredToken()) => (
  String(token || '').startsWith('dev_admin_token_')
);

export const hasBackendAuthToken = () => {
  const token = getStoredToken();
  return Boolean(token) && !isDevelopmentToken(token);
};
