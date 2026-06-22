import {
  assignTeacherDuty,
  buildTeacherDutyPayload,
  deactivateTeacherDuty,
  fetchTeacherDuties,
  normalizeTeacherDuty,
} from './teacherDutiesApi';

const originalFetch = global.fetch;

const mockResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

describe('teacherDutiesApi', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes backend duty rows into frontend role details', () => {
    expect(normalizeTeacherDuty({
      id: '8',
      teacher_id: '3',
      teacher_name: '林老师',
      teacher_code: 'T001',
      duty_type: 'head_teacher',
      term: '2025-2',
      grade_name: '7年级',
      class_name: '701',
      is_active: true,
    })).toMatchObject({
      id: 8,
      teacher_id: 3,
      teacher_name: '林老师',
      teacher_code: 'T001',
      duty_type: 'head_teacher',
      role_type: 'head_teacher',
      grade: '7年级',
      class_name: '701',
      is_active: true,
    });
  });

  it('fetches duty list with auth headers and query params', async () => {
    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn().mockResolvedValue(mockResponse({
      success: true,
      duties: [{ id: 1, teacher_id: 3, duty_type: 'grade_leader', term: '2025-2' }],
    }));

    const payload = await fetchTeacherDuties({ term: '2025-2', includeInactive: true });

    expect(payload.duties[0]).toMatchObject({ role_type: 'grade_leader', term: '2025-2' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/teacher-duties/list?term=2025-2&include_inactive=true',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer staff-token' }),
      })
    );
  });

  it('builds, assigns, and deactivates teacher duties', async () => {
    expect(buildTeacherDutyPayload({
      teacherId: 3,
      dutyType: 'lesson_leader',
      term: '2025-2',
      gradeName: '7年级',
      subjectName: '语文',
      className: '',
    })).toEqual({
      teacher_id: 3,
      duty_type: 'lesson_leader',
      term: '2025-2',
      grade_name: '7年级',
      subject_name: '语文',
      class_name: undefined,
      scope_label: undefined,
    });

    global.fetch = jest.fn()
      .mockResolvedValueOnce(mockResponse({ success: true, duty_id: 9 }))
      .mockResolvedValueOnce(mockResponse({ success: true }));

    await assignTeacherDuty(buildTeacherDutyPayload({
      teacherId: 3,
      dutyType: 'lesson_leader',
      term: '2025-2',
      gradeName: '7年级',
    }));
    await deactivateTeacherDuty(9);

    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/v1/teacher-duties/assign', expect.objectContaining({ method: 'POST' }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/v1/teacher-duties/9', expect.objectContaining({ method: 'DELETE' }));
  });
});
