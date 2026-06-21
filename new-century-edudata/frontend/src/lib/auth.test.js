import { ApiRequestError } from './api';
import { clearAuthSession, loginUser, storeAuthSession } from './auth';

const mockResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body)
});

describe('auth helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores backend token and user from a successful login', async () => {
    const user = {
      id: 1,
      username: 'edu',
      real_name: '李主任',
      role_name: '教务处主任',
      permission_code: 'edu_admin'
    };
    global.fetch.mockResolvedValueOnce(mockResponse({
      success: true,
      message: '登录成功',
      token: 'jwt-token',
      user
    }));

    const result = await loginUser({ username: ' edu ', password: 'secret' });

    expect(result).toEqual(user);
    expect(localStorage.getItem('token')).toBe('jwt-token');
    expect(JSON.parse(localStorage.getItem('user'))).toEqual(user);
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ username: 'edu', password: 'secret' })
    }));
  });

  it('rejects failed backend login responses without storing a session', async () => {
    localStorage.setItem('token', 'old-token');
    localStorage.setItem('user', JSON.stringify({ username: 'old' }));
    global.fetch.mockResolvedValueOnce(mockResponse({
      success: false,
      message: '用户名或密码错误'
    }));

    await expect(loginUser({ username: 'wrong', password: 'bad' })).rejects.toThrow(ApiRequestError);
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('allows the development dean account when the backend is unavailable', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await loginUser({ username: 'dean', password: '123456' });

    expect(result).toMatchObject({
      username: 'dean',
      role: 'super_admin',
      legacy_role: 'dean',
      role_name: '教务处主任',
      permission_code: 'edu_admin',
      permissions: ['all_permissions', 'system_config']
    });
    expect(localStorage.getItem('token')).toMatch(/^dev_admin_token_/);
  });

  it('does not use the development dean account for backend credential failures', async () => {
    global.fetch.mockResolvedValueOnce(mockResponse({
      success: false,
      message: '用户名或密码错误'
    }));

    await expect(loginUser({ username: 'dean', password: '123456' })).rejects.toThrow(ApiRequestError);
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('clears and validates stored sessions', () => {
    storeAuthSession({
      token: 'jwt-token',
      user: { username: 'teacher', permission_code: 'teacher' }
    });

    clearAuthSession();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
