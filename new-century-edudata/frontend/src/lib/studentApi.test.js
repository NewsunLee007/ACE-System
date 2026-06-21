import {
  buildStudentPayload,
  buildStudentUpdatePayload,
  fetchStudentList,
  normalizeStudentRecord,
  studentImportItemsToCsv,
  uploadStudentImportFile,
} from './studentApi';

const originalFetch = global.fetch;

const classes = [
  { id: 701, class_no: '01', name: '2025级01班', enrollment_year: 2025 },
  { id: 702, class_no: '02', name: '2025级02班', enrollment_year: 2025 },
];

const mockResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

describe('studentApi', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes backend student records into the local class_id shape', () => {
    expect(normalizeStudentRecord({
      id: 10,
      student_code: '20250701001',
      name: '真实学生',
      gender: 0,
      enrollment_year: 2025,
      current_grade: '7年级',
      current_class: '701',
      status: '在读',
    }, classes)).toMatchObject({
      id: 10,
      class_id: 701,
      current_class: '701',
      status: '在读',
    });
  });

  it('builds create and update payloads for the backend schema', () => {
    const form = {
      student_code: '20250701001',
      name: '真实学生',
      gender: '0',
      class_id: '702',
      enrollment_year: '2025',
      status: '休学',
    };

    expect(buildStudentPayload(form, classes)).toEqual({
      student_code: '20250701001',
      name: '真实学生',
      gender: 0,
      enrollment_year: 2025,
      current_grade: '7年级',
      current_class: '702',
      id_card_last6: undefined,
    });
    expect(buildStudentUpdatePayload(form, classes)).toEqual({
      name: '真实学生',
      gender: 0,
      current_grade: '7年级',
      current_class: '702',
      id_card_last6: undefined,
      status: '休学',
    });
  });

  it('serializes selected import rows using backend-recognized headers', () => {
    const csv = studentImportItemsToCsv({
      classes,
      items: [
        {
          type: 'new',
          data: {
            student_code: '20250701001',
            name: '真实学生',
            gender: 1,
            class_id: 701,
            enrollment_year: 2025,
            status: '在读',
          },
        },
        { type: 'unchanged', data: { student_code: 'skip' } },
      ],
    });

    expect(csv).toBe('"学籍辅号","姓名","性别","入学年份","当前年级","当前班级","状态"\n"20250701001","真实学生","男","2025","7年级","701","在读"');
  });

  it('fetches and normalizes the backend student list with auth', async () => {
    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn().mockResolvedValue(mockResponse({
      success: true,
      total: 1,
      students: [{
        id: 10,
        student_code: '20250701001',
        name: '真实学生',
        gender: 1,
        enrollment_year: 2025,
        current_grade: '7年级',
        current_class: '701',
        status: '在读',
      }],
    }));

    const result = await fetchStudentList({ status: '', pageSize: 100 }, classes);

    expect(result.students[0]).toMatchObject({ id: 10, class_id: 701 });
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/students/list?status=&page=1&page_size=100', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer staff-token' }),
    }));
  });

  it('uploads student import files as FormData', async () => {
    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn().mockResolvedValue(mockResponse({
      success: true,
      message: '导入完成',
    }));
    const file = new Blob(['学籍辅号,姓名,入学年份\n20250701001,真实学生,2025'], { type: 'text/csv' });

    await uploadStudentImportFile({ file, filename: 'students.csv' });

    expect(global.fetch).toHaveBeenCalledWith('/api/v1/data/import/students', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData),
      headers: expect.objectContaining({ Authorization: 'Bearer staff-token' }),
    }));
    expect(global.fetch.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
  });
});
