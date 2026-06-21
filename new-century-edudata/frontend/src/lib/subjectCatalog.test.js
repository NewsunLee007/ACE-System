import schoolData from '../data/schoolData';
import {
  addLocalSubject,
  deleteLocalSubjects,
  loadSubjectCatalog,
  normalizeSubjectList,
  subjectNamesToRows,
  updateLocalSubject,
} from './subjectCatalog';

const originalFetch = global.fetch;

describe('subject catalog helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    schoolData.subjects = ['语文', '数学'];
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes local subject names into editable rows', () => {
    expect(subjectNamesToRows(['语文', '', '科学'])).toEqual([
      expect.objectContaining({ id: 1, name: '语文', code: '语文' }),
      expect.objectContaining({ id: 3, name: '科学', code: '科学' }),
    ]);
  });

  it('loads subjects from the backend and syncs schoolData names', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({
        subjects: [
          { id: 9, name: '科学', code: 'KX', description: '综合科学', sort_order: 1 },
          { id: 8, name: '社会', code: 'SH', description: '社会学科', sort_order: 2 },
        ],
      })),
    });

    const result = await loadSubjectCatalog();

    expect(result.source).toBe('api');
    expect(result.subjects.map(subject => subject.name)).toEqual(['科学', '社会']);
    expect(schoolData.subjects).toEqual(['科学', '社会']);
  });

  it('falls back to local subjects when the backend is unavailable', async () => {
    global.fetch.mockRejectedValue(new TypeError('network down'));

    const result = await loadSubjectCatalog();

    expect(result.source).toBe('local');
    expect(result.subjects.map(subject => subject.name)).toEqual(['语文', '数学']);
  });

  it('keeps local mutations immutable and synced', () => {
    const rows = normalizeSubjectList([
      { id: 1, name: '语文', code: 'YW' },
      { id: 2, name: '数学', code: 'SX' },
    ]);

    const added = addLocalSubject(rows, { name: '英语', code: 'YY' });
    expect(rows.map(subject => subject.name)).toEqual(['语文', '数学']);
    expect(added.map(subject => subject.name)).toEqual(['语文', '数学', '英语']);

    const updated = updateLocalSubject(added, 2, { name: '数学A', code: 'SXA' });
    expect(updated.find(subject => subject.id === 2)).toMatchObject({ name: '数学A', code: 'SXA' });

    const deleted = deleteLocalSubjects(updated, [1]);
    expect(deleted.map(subject => subject.name)).toEqual(['数学A', '英语']);
    expect(schoolData.subjects).toEqual(['数学A', '英语']);
  });
});
