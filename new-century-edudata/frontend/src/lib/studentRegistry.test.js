import {
  buildStudentRegistryStats,
  buildStudentRegistryTimeline,
  normalizeStudentRecordForRegistry,
  normalizeStudentStatus,
} from './studentRegistry';

describe('student registry helpers', () => {
  it('keeps valid statuses and isolates dirty source values for verification', () => {
    expect(normalizeStudentStatus('在籍')).toEqual({
      status: '在籍',
      rawStatus: '在籍',
      isAnomaly: false,
    });

    expect(normalizeStudentStatus('林川')).toEqual({
      status: '待核验',
      rawStatus: '林川',
      isAnomaly: true,
    });
  });

  it('normalizes a student record into registry-facing fields', () => {
    const student = normalizeStudentRecordForRegistry({
      id: 1,
      name: '甲',
      status: '林川',
      enrollment_year: 2025,
    });

    expect(student.status).toBe('待核验');
    expect(student.raw_status).toBe('林川');
    expect(student.registry_status).toBe('状态待核验');
    expect(student.enrollment_type).toBe('正常入学');
  });

  it('builds registry stats and a compact student timeline', () => {
    const students = [
      { id: 1, name: '甲', status: '在籍', class_id: 701, enrollment_year: 2025 },
      { id: 2, name: '乙', status: '休学', class_id: 701, enrollment_year: 2025 },
      { id: 3, name: '丙', status: '林川', class_id: 999, enrollment_year: 2025 },
    ];
    const classes = [{ id: 701, name: '2025级01班', enrollment_year: 2025 }];

    const stats = buildStudentRegistryStats(students, classes);
    expect(stats.activeCount).toBe(1);
    expect(stats.movementCount).toBe(1);
    expect(stats.anomalyCount).toBe(1);
    expect(stats.unassignedCount).toBe(1);

    const timeline = buildStudentRegistryTimeline(students[0], classes, () => '2025级01班');
    expect(timeline.map(item => item.label)).toEqual(['入学建档', '当前班级', '学籍状态']);
  });
});
