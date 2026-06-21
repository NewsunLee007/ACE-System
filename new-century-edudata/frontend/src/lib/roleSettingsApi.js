import { apiRequest } from './api';

const normalizeText = (value) => String(value ?? '').trim();

export const normalizeRoleSetting = (role = {}) => ({
  ...role,
  id: normalizeText(role.id || role.permission_code),
  name: normalizeText(role.name || role.role_name),
  permission_code: normalizeText(role.permission_code || role.id),
  level: Number(role.level) || 1,
  permissions: Array.isArray(role.permissions) ? role.permissions : [],
  is_system: Boolean(role.is_system),
});

export const fetchRoleSettings = async () => {
  const payload = await apiRequest('/role-settings/list');
  return {
    ...payload,
    roles: (payload?.roles || []).map(normalizeRoleSetting),
  };
};

export const buildRoleSettingPayload = (role = {}) => ({
  id: normalizeText(role.id),
  name: normalizeText(role.name),
  level: Number(role.level) || 1,
  permissions: Array.isArray(role.permissions) && role.permissions.length > 0
    ? role.permissions
    : ['view_own_class'],
  description: normalizeText(role.description) || undefined,
});

export const createRoleSetting = (role) => (
  apiRequest('/role-settings/create', {
    method: 'POST',
    body: JSON.stringify(buildRoleSettingPayload(role)),
  })
);

export const deleteRoleSetting = (roleId) => (
  apiRequest(`/role-settings/${encodeURIComponent(roleId)}`, {
    method: 'DELETE',
  })
);

export const fetchScoreVisibilitySettings = async () => {
  const payload = await apiRequest('/score-visibility/settings');
  return payload?.settings || {};
};

export const updateScoreVisibilitySettings = (settings) => (
  apiRequest('/score-visibility/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  })
);
