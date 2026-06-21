import {
  buildRoleSettingPayload,
  createRoleSetting,
  deleteRoleSetting,
  fetchRoleSettings,
  normalizeRoleSetting,
} from './roleSettingsApi';

const originalFetch = global.fetch;

const mockResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

describe('roleSettingsApi', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes backend role rows for RoleSettings', () => {
    expect(normalizeRoleSetting({
      id: 'subject_teacher',
      name: '科任教师',
      permission_code: 'teacher',
      level: '1',
      permissions: ['input_scores'],
      is_system: true,
    })).toEqual({
      id: 'subject_teacher',
      name: '科任教师',
      permission_code: 'teacher',
      level: 1,
      permissions: ['input_scores'],
      is_system: true,
    });
  });

  it('fetches role settings with auth headers', async () => {
    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn().mockResolvedValue(mockResponse({
      success: true,
      roles: [{ id: 'admin', name: '系统管理员', permission_code: 'sys_admin', permissions: [] }],
    }));

    const payload = await fetchRoleSettings();

    expect(payload.roles[0]).toMatchObject({ id: 'admin', permission_code: 'sys_admin' });
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/role-settings/list', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer staff-token' }),
    }));
  });

  it('builds, creates, and deletes custom role settings', async () => {
    expect(buildRoleSettingPayload({
      id: 'mentor',
      name: '导师',
      level: '2',
      permissions: [],
    })).toEqual({
      id: 'mentor',
      name: '导师',
      level: 2,
      permissions: ['view_own_class'],
      description: undefined,
    });

    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn()
      .mockResolvedValueOnce(mockResponse({ success: true }))
      .mockResolvedValueOnce(mockResponse({ success: true }));

    await createRoleSetting({ id: 'mentor', name: '导师', permissions: ['view_own_class'] });
    await deleteRoleSetting('mentor');

    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/v1/role-settings/create', expect.objectContaining({ method: 'POST' }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/v1/role-settings/mentor', expect.objectContaining({ method: 'DELETE' }));
  });
});
