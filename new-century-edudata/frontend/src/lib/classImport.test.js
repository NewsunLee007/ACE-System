import {
  allocateClassId,
  buildClassImport,
  commitClassImport,
  normalizeClassNo,
  parseClassImportText,
} from './classImport';

const calculateGradeLevel = (enrollmentYear) => {
  const grade = 7 + (2025 - Number(enrollmentYear));
  return { grade, isGraduated: grade > 9 };
};

describe('class import helpers', () => {
  it('normalizes historical class numbers to the two-digit sequence used by the UI', () => {
    expect(normalizeClassNo('701')).toBe('01');
    expect(normalizeClassNo('1班')).toBe('01');
    expect(normalizeClassNo('13')).toBe('13');
  });

  it('previews an existing historical 701 class as an update instead of a duplicate new class', () => {
    const parsed = parseClassImportText([
      '班级序号,入学年份,教室位置,状态',
      '01,2025,教学楼A-201,在读',
      '02,2025,教学楼A-102,在读',
    ].join('\n'));

    const result = buildClassImport({
      parsedRows: parsed.rows,
      classes: [
        { id: 701, class_no: '701', enrollment_year: 2025, classroom_location: '教学楼A-101', status: 'active' },
        { id: 702, class_no: '02', enrollment_year: 2025, classroom_location: '教学楼A-102', status: 'active' },
      ],
      currentAcademicYear: 2025,
      calculateGradeLevel,
    });

    expect(result.insertedCount).toBe(0);
    expect(result.updatedCount).toBe(1);
    expect(result.unchangedCount).toBe(1);
    expect(result.items[0]).toMatchObject({
      type: 'update',
      changes: ['classroom_location', 'class_no'],
    });
    expect(result.items[1].type).toBe('unchanged');
  });

  it('commits new classes with stable grade-based ids and normalized class numbers', () => {
    const parsed = parseClassImportText([
      '班级序号,入学年份,教室位置,状态',
      '14,2025,教学楼A-114,在读',
      '01,2024,教学楼B-201,在读',
    ].join('\n'));
    const result = buildClassImport({
      parsedRows: parsed.rows,
      classes: [{ id: 701, class_no: '701', enrollment_year: 2025, classroom_location: '教学楼A-101', status: 'active' }],
      currentAcademicYear: 2025,
      calculateGradeLevel,
    });

    const committed = commitClassImport({
      classes: [{ id: 701, class_no: '701', enrollment_year: 2025, classroom_location: '教学楼A-101', status: 'active' }],
      importResult: result,
      currentAcademicYear: 2025,
      calculateGradeLevel,
    });

    expect(committed.find(cls => cls.id === 701).class_no).toBe('01');
    expect(committed.find(cls => cls.id === 714)).toMatchObject({
      class_no: '14',
      enrollment_year: 2025,
    });
    expect(committed.find(cls => cls.id === 801)).toMatchObject({
      class_no: '01',
      enrollment_year: 2024,
    });
  });

  it('allocates fallback ids without scanning mutable school data inside the loop', () => {
    const usedIds = new Set([701]);
    expect(allocateClassId({
      classNo: '01',
      enrollmentYear: 2025,
      usedIds,
      currentAcademicYear: 2025,
      calculateGradeLevel,
    })).toBe(7011);
    expect(usedIds.has(7011)).toBe(true);
  });
});
