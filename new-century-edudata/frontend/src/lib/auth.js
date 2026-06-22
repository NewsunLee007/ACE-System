import { ApiRequestError, apiRequest } from './api';
import { ROLE_PREVIEW_STORAGE_KEY } from './rolePreview';

const DEVELOPMENT_ADMIN_USERNAME = 'dean';
const DEVELOPMENT_ADMIN_PASSWORD = '123456';

const isDevelopmentLoginEnabled = () => process.env.NODE_ENV !== 'production';

const buildDevelopmentAdminSession = (username) => ({
  token: `dev_admin_token_${Date.now()}`,
  user: {
    id: 1,
    username,
    real_name: '李主任',
    role: 'super_admin',
    legacy_role: 'dean',
    role_name: '教务处主任',
    permission_code: 'edu_admin',
    permissions: ['all_permissions', 'system_config']
  }
});

const canUseDevelopmentAdmin = (username, password) => (
  isDevelopmentLoginEnabled() &&
  username === DEVELOPMENT_ADMIN_USERNAME &&
  password === DEVELOPMENT_ADMIN_PASSWORD
);

const shouldFallbackToDevelopmentAdmin = (errorOrPayload) => {
  if (!isDevelopmentLoginEnabled()) return false;

  if (typeof errorOrPayload === 'string') return true;
  if (errorOrPayload instanceof ApiRequestError) {
    if (typeof errorOrPayload.payload === 'string') return true;
    return [404, 502, 503, 504].includes(errorOrPayload.status);
  }

  return errorOrPayload instanceof Error;
};

export const clearAuthSession = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  localStorage.removeItem(ROLE_PREVIEW_STORAGE_KEY);
};

export const storeAuthSession = ({ token, user }) => {
  if (!token || !user) {
    throw new ApiRequestError('登录响应缺少认证信息', 500, { token, user });
  }

  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  return user;
};

export const loginUser = async ({ username, password }) => {
  const normalizedUsername = String(username || '').trim();
  clearAuthSession();

  let payload;
  try {
    payload = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: normalizedUsername,
        password
      })
    });
  } catch (error) {
    if (canUseDevelopmentAdmin(normalizedUsername, password) && shouldFallbackToDevelopmentAdmin(error)) {
      return storeAuthSession(buildDevelopmentAdminSession(normalizedUsername));
    }
    throw error;
  }

  if (!payload?.success) {
    if (canUseDevelopmentAdmin(normalizedUsername, password) && shouldFallbackToDevelopmentAdmin(payload)) {
      return storeAuthSession(buildDevelopmentAdminSession(normalizedUsername));
    }
    throw new ApiRequestError(payload?.message || '用户名或密码错误', 401, payload);
  }

  return storeAuthSession({
    token: payload.token,
    user: payload.user
  });
};
