import {
  buildClassPayload,
  createClassRecord,
  deactivateClassRecord,
  fetchClassList,
  normalizeClassRecord,
  updateClassRecord,
} from './classApi';

const originalFetch = global.fetch;

const mockResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

const calculateGradeLevel = (year) => ({
  grade: 7 + (2025 - Number(year)),
  isGraduated: Number(year) <= 2022,
});

describe('classApi', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes backend class records into schoolData-compatible class shape', () => {
    expect(normalizeClassRecord({
      class_code: '701',
      class_no: '1',
      enrollment_year: '2025',
      name: '',
      status: 'active',
      student_count: '42',
    })).toMatchObject({
      id: 701,
      class_code: '701',
      class_no: '01',
      name: '2025级01班',
      enrollment_year: 2025,
      student_count: 42,
    });
  });

  it('builds create/update payloads using existing class id allocation rules', () => {
    expect(buildClassPayload({
      form: {
        class_no: '01',
        enrollment_year: 2025,
        classroom_location: '教学楼A-101',
        status: 'active',
      },
      classes: [],
      currentAcademicYear: 2025,
      calculateGradeLevel,
    })).toEqual({
      class_code: '701',
      class_no: '01',
      name: '2025级01班',
      enrollment_year: 2025,
      classroom_location: '教学楼A-101',
      status: 'active',
    });
  });

  it('fetches class list with auth and normalizes rows', async () => {
    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn().mockResolvedValue(mockResponse({
      success: true,
      classes: [{ class_code: '701', class_no: '01', enrollment_year: 2025 }],
    }));

    const payload = await fetchClassList({ pageSize: 200 });

    expect(payload.classes[0]).toMatchObject({ id: 701, class_no: '01' });
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/classes/list?page=1&page_size=200', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer staff-token' }),
    }));
  });

  it('creates, updates, and deactivates classes through backend endpoints', async () => {
    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn()
      .mockResolvedValueOnce(mockResponse({ success: true }))
      .mockResolvedValueOnce(mockResponse({ success: true }))
      .mockResolvedValueOnce(mockResponse({ success: true }));

    await createClassRecord({ class_code: '701', class_no: '01', enrollment_year: 2025 });
    await updateClassRecord('701', { class_code: '701', class_no: '01', enrollment_year: 2025, status: 'inactive' });
    await deactivateClassRecord('701');

    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/v1/classes/create', expect.objectContaining({ method: 'POST' }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/v1/classes/701/update', expect.objectContaining({ method: 'PUT' }));
    expect(global.fetch).toHaveBeenNthCalledWith(3, '/api/v1/classes/701/deactivate', expect.objectContaining({ method: 'POST' }));
  });
});
