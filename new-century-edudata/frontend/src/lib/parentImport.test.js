import {
  buildParentImport,
  commitParentImport,
  parseParentImportText,
} from './parentImport';

const students = [
  { id: 101, student_code: 'S001', name: '学生一' },
  { id: 102, student_code: 'S002', name: '学生二' },
];

describe('parent import helpers', () => {
  it('parses tab-delimited parent binding data copied from Excel', () => {
    const parsed = parseParentImportText('家长姓名\t与学生关系\t联系电话\t学生学籍辅号\t学生姓名\n王女士\t母亲\t13800138001\tS001\t学生一');

    expect(parsed.headers).toEqual(['家长姓名', '与学生关系', '联系电话', '学生学籍辅号', '学生姓名']);
    expect(parsed.rows[0]).toMatchObject({
      家长姓名: '王女士',
      与学生关系: '母亲',
      联系电话: '13800138001',
      学生学籍辅号: 'S001',
      学生姓名: '学生一',
    });
  });

  it('previews new and updated parents and validates bound students', () => {
    const parsed = parseParentImportText([
      '家长姓名,与学生关系,联系电话,学生学籍辅号,学生姓名,状态',
      '王女士,母亲,13800138001,S001,学生一,正常',
      '李先生,父亲,13900139001,S999,不存在,正常',
    ].join('\n'));

    const result = buildParentImport({
      parsedRows: parsed.rows,
      parents: [{ id: 1, name: '王女士', phone: '13800138001', relation: '母亲', student_ids: [] }],
      students,
    });

    expect(result.insertedCount).toBe(0);
    expect(result.updatedCount).toBe(1);
    expect(result.errors).toEqual(['第3行：学籍辅号 "S999" 不存在，请先维护学生档案']);
    expect(result.items[0].data).toMatchObject({
      id: 1,
      phone: '13800138001',
      student_ids: [101],
    });
  });

  it('commits imported parents by merging bound students instead of duplicating phones', () => {
    const parsed = parseParentImportText([
      '家长姓名,与学生关系,联系电话,学生学籍辅号,学生姓名,状态',
      '王女士,母亲,13800138001,S002,学生二,正常',
      '张先生,父亲,13700137001,S001,学生一,正常',
    ].join('\n'));
    const parents = [{ id: 1, name: '王女士', phone: '13800138001', relation: '母亲', student_ids: [101] }];
    const result = buildParentImport({ parsedRows: parsed.rows, parents, students });
    const committed = commitParentImport({ parents, importResult: result });

    expect(committed).toHaveLength(2);
    expect(committed.find(parent => parent.phone === '13800138001')).toMatchObject({
      id: 1,
      student_ids: [101, 102],
    });
    expect(committed.find(parent => parent.phone === '13700137001')).toMatchObject({
      id: 2,
      name: '张先生',
      student_ids: [101],
    });
  });

  it('does not merge different phone numbers just because parent names are the same', () => {
    const parsed = parseParentImportText([
      '家长姓名,与学生关系,联系电话,学生学籍辅号,学生姓名,状态',
      '王女士,母亲,13700137001,S002,学生二,正常',
    ].join('\n'));
    const parents = [{ id: 1, name: '王女士', phone: '13800138001', relation: '母亲', student_ids: [101] }];
    const result = buildParentImport({ parsedRows: parsed.rows, parents, students });
    const committed = commitParentImport({ parents, importResult: result });

    expect(result.insertedCount).toBe(1);
    expect(result.updatedCount).toBe(0);
    expect(committed).toHaveLength(2);
    expect(committed.find(parent => parent.phone === '13800138001')).toMatchObject({
      id: 1,
      student_ids: [101],
    });
    expect(committed.find(parent => parent.phone === '13700137001')).toMatchObject({
      id: 2,
      name: '王女士',
      student_ids: [102],
    });
  });
});
