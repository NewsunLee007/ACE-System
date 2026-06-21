import {
  buildTeacherAssignmentPayload,
  buildTeacherUserPayload,
  fetchTeacherListWithAssignments,
  normalizeTeacherRecord,
  resolveBackendRoleId,
  resolveTeacherClass,
  syncTeacherAssignments,
} from './teacherApi';

const originalFetch = global.fetch;

const classes = [
  { id: 701, class_no: '01', name: '2025级01班', enrollment_year: 2025 },
  { id: 702, class_no: '02', name: '2025级02班', enrollment_year: 2025 },
];

const roles = [
  { id: 8, role_name: '教师', permission_code: 'teacher' },
  { id: 9, role_name: '班主任', permission_code: 'headmaster' },
  { id: 10, role_name: '年段长', permission_code: 'grade_leader' },
];

const mockResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

describe('teacherApi', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('resolves backend class names and normalizes teacher directory records', () => {
    expect(resolveTeacherClass({ className: '2025级01班', classes })?.id).toBe(701);

    const teacher = normalizeTeacherRecord({
      id: 3,
      username: 'T001',
      real_name: '林老师',
      is_active: true,
      permission_code: 'headmaster',
    }, [{
      id: 20,
      class_name: '701',
      grade_name: '7年级',
      subject_name: '语文',
      is_headmaster: 1,
    }], classes);

    expect(teacher).toMatchObject({
      id: 3,
      code: 'T001',
      name: '林老师',
      status: 'active',
      roles: ['head_teacher'],
      subjects: ['语文'],
      teaching_classes: [{
        assignment_id: 20,
        class_id: 701,
        subject: '语文',
        is_headmaster: true,
      }],
    });
  });

  it('builds teacher user payloads from frontend roles', () => {
    expect(resolveBackendRoleId(['grade_leader', 'subject_teacher'], roles)).toBe(10);
    expect(buildTeacherUserPayload({
      code: 'T002',
      name: '王老师',
      phone: '13800138001',
      initial_password: 'secret123',
      roles: ['head_teacher'],
    }, roles)).toEqual({
      username: 'T002',
      password: 'secret123',
      real_name: '王老师',
      role_id: 9,
      phone: '13800138001',
      email: undefined,
    });
  });

  it('fetches active and disabled teachers with assignments', async () => {
    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn()
      .mockResolvedValueOnce(mockResponse({
        success: true,
        teachers: [{
          id: 3,
          username: 'T001',
          real_name: '林老师',
          is_active: true,
          permission_code: 'teacher',
        }],
      }))
      .mockResolvedValueOnce(mockResponse({
        success: true,
        teachers: [{
          id: 4,
          username: 'T002',
          real_name: '王老师',
          is_active: false,
          permission_code: 'teacher',
        }],
      }))
      .mockResolvedValueOnce(mockResponse({
        success: true,
        assignments: [{
          id: 20,
          class_name: '701',
          subject_name: '数学',
          is_headmaster: 0,
        }],
      }))
      .mockResolvedValueOnce(mockResponse({
        success: true,
        assignments: [],
      }));

    const payload = await fetchTeacherListWithAssignments({ pageSize: 100, term: '2025-2' }, classes);

    expect(payload.teachers).toHaveLength(2);
    expect(payload.teachers[0]).toMatchObject({
      code: 'T001',
      teaching_classes: [{ assignment_id: 20, class_id: 701, subject: '数学' }],
    });
    expect(payload.teachers[1]).toMatchObject({ code: 'T002', status: 'suspended' });
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/v1/teachers/list?is_active=true&page=1&page_size=100', expect.any(Object));
    expect(global.fetch).toHaveBeenNthCalledWith(3, '/api/v1/teachers/3/assignments?term=2025-2', expect.any(Object));
  });

  it('builds and syncs assignment diffs against backend relation ids', async () => {
    expect(buildTeacherAssignmentPayload({
      teacherId: 3,
      teachingClass: { class_id: 702, subject: '英语' },
      classes,
      term: '2025-2',
    })).toEqual({
      teacher_id: 3,
      term: '2025-2',
      grade_name: '7年级',
      class_name: '702',
      subject_name: '英语',
      is_headmaster: false,
    });

    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn()
      .mockResolvedValueOnce(mockResponse({ success: true, message: '任课安排已删除' }))
      .mockResolvedValueOnce(mockResponse({ success: true, message: '任课分配成功' }));

    const result = await syncTeacherAssignments({
      teacher: {
        id: 3,
        teaching_classes: [{ assignment_id: 20, class_id: 701, subject: '语文' }],
      },
      form: {
        subjects: ['数学'],
        teaching_classes: [{ class_id: 702, subject: '数学' }],
      },
      classes,
      term: '2025-2',
    });

    expect(result).toMatchObject({ removedCount: 1, createdCount: 1 });
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/v1/teachers/assignments/20', expect.objectContaining({ method: 'DELETE' }));
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/v1/teachers/assign', expect.objectContaining({ method: 'POST' }));
  });
});
