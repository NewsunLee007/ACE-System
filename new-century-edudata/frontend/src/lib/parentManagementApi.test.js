import {
  bindParentStudent,
  buildParentPayload,
  createParentRecord,
  fetchParentList,
  normalizeParentRecord,
  unbindParentStudent,
  updateParentRecord,
} from './parentManagementApi';

const originalFetch = global.fetch;

const mockResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

describe('parentManagementApi', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes backend parent records into the local parent shape', () => {
    expect(normalizeParentRecord({
      id: 9,
      username: '13800138001',
      name: '张大明',
      relation: '父亲',
      status: 'active',
      students: [{
        student_id: 101,
        student_code: '20250701001',
        name: '张三',
        class_id: '701',
      }],
    })).toMatchObject({
      id: 9,
      phone: '13800138001',
      relation: '父亲',
      student_ids: [101],
      students: [{ id: 101, student_code: '20250701001', class_name: '701' }],
    });
  });

  it('fetches parent lists with auth and list filters', async () => {
    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn().mockResolvedValue(mockResponse({
      success: true,
      parents: [{ id: 9, phone: '13800138001', name: '张大明', students: [] }],
    }));

    const payload = await fetchParentList({ keyword: '张', status: 'active', pageSize: 50 });

    expect(payload.parents[0]).toMatchObject({ id: 9, phone: '13800138001' });
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/parent-management/list?keyword=%E5%BC%A0&status=active&page=1&page_size=50', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer staff-token' }),
    }));
  });

  it('builds create and update payloads for parent accounts', async () => {
    expect(buildParentPayload({
      name: ' 李女士 ',
      phone: ' 13800138002 ',
      email: '',
      relation: '母亲',
      status: 'inactive',
    })).toEqual({
      name: '李女士',
      phone: '13800138002',
      email: undefined,
      relation: '母亲',
      status: 'inactive',
    });

    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn()
      .mockResolvedValueOnce(mockResponse({ success: true, parent_id: 10 }))
      .mockResolvedValueOnce(mockResponse({ success: true }))
      .mockResolvedValueOnce(mockResponse({ success: true }))
      .mockResolvedValueOnce(mockResponse({ success: true }));

    await createParentRecord({
      name: '李女士',
      phone: '13800138002',
      relation: '母亲',
      initial_password: 'secret123',
    });
    await updateParentRecord(10, {
      name: '李女士',
      phone: '13800138002',
      relation: '母亲',
      status: 'active',
    });
    await bindParentStudent({ parentId: 10, studentId: 101, relation: '母亲' });
    await unbindParentStudent({ parentId: 10, studentId: 101 });

    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/v1/parent-management/create', expect.objectContaining({ method: 'POST' }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/v1/parent-management/10/update', expect.objectContaining({ method: 'PUT' }));
    expect(global.fetch).toHaveBeenNthCalledWith(3, '/api/v1/parent-management/10/bind', expect.objectContaining({ method: 'POST' }));
    expect(global.fetch).toHaveBeenNthCalledWith(4, '/api/v1/parent-management/10/bindings/101', expect.objectContaining({ method: 'DELETE' }));
  });
});
