import { DEMO_SCHOOL_DATA, DEMO_DATA_VERSION } from './demoSchoolData';

describe('demoSchoolData seed', () => {
  it('contains the real base data needed by role dashboards and score analysis', () => {
    expect(DEMO_DATA_VERSION).toBe('2026-06-19.real-import-seed');
    expect(DEMO_SCHOOL_DATA.classes).toHaveLength(52);
    expect(DEMO_SCHOOL_DATA.students).toHaveLength(2253);
    expect(DEMO_SCHOOL_DATA.teachers.length).toBeGreaterThanOrEqual(130);
    expect(DEMO_SCHOOL_DATA.classLayers).toHaveLength(52);
    expect(DEMO_SCHOOL_DATA.exams).toHaveLength(2);
    expect(DEMO_SCHOOL_DATA.examScores.length).toBeGreaterThan(1600);
    expect(DEMO_SCHOOL_DATA.classes.map(item => item.id)).toEqual(expect.arrayContaining([701, 718, 801, 818, 901, 916]));
  });
});
