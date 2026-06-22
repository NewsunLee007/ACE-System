import {
  findParentForUser,
  getBoundStudents,
  getParentAccessState,
  parentMatchesUser,
} from './parentAccess';

const parents = [
  { id: 1, name: '王女士', phone: '13800138001', student_ids: [101] },
  { id: 2, name: '李先生', phone: '13900139001', student_ids: [102] },
];

const students = [
  { id: 101, name: '王同学' },
  { id: 102, name: '李同学' },
];

const getStudentById = (id) => students.find((student) => Number(student.id) === Number(id));

describe('parent access helpers', () => {
  it('matches parent accounts by phone or explicit parent profile id', () => {
    expect(parentMatchesUser(parents[0], { username: '13800138001' })).toBe(true);
    expect(parentMatchesUser(parents[1], { parent_id: 2 })).toBe(true);
    expect(parentMatchesUser(parents[0], { username: '13900139001' })).toBe(false);
  });

  it('does not match by parent name alone to avoid same-name data leakage', () => {
    expect(parentMatchesUser(parents[1], { real_name: '李先生' })).toBe(false);
    expect(findParentForUser(parents, { real_name: '王女士' })).toBeNull();
  });

  it('does not fall back to the first parent when the current user has no matching parent profile', () => {
    expect(findParentForUser(parents, { username: '17000000000', real_name: '陌生家长' })).toBeNull();
    expect(getParentAccessState({ parents, user: { username: '17000000000' }, getStudentById })).toMatchObject({
      status: 'no-parent',
      children: [],
    });
  });

  it('returns only students explicitly bound to the matched parent', () => {
    expect(getBoundStudents(parents[0], getStudentById)).toEqual([{ id: 101, name: '王同学' }]);
    expect(getParentAccessState({ parents, user: { username: '13900139001' }, getStudentById })).toMatchObject({
      status: 'ready',
      children: [{ id: 102, name: '李同学' }],
    });
  });

  it('treats a parent without valid bound students as an empty state', () => {
    const state = getParentAccessState({
      parents: [{ id: 3, name: '空绑定', phone: '13700137001', student_ids: [999] }],
      user: { username: '13700137001' },
      getStudentById,
    });

    expect(state).toMatchObject({
      status: 'no-children',
      children: [],
    });
  });
});
