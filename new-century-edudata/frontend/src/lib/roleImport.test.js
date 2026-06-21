import {
  DEFAULT_ROLE_SETTINGS,
  buildRoleImport,
  buildRoleImportTemplateCsv,
  buildRoleImportTemplateHtml,
  mergeRoleSettings,
  parseRoleImportText,
} from './roleImport';

describe('roleImport helpers', () => {
  it('builds an Excel-compatible template and parses it back', () => {
    const html = buildRoleImportTemplateHtml(DEFAULT_ROLE_SETTINGS.slice(0, 2));
    const parsed = parseRoleImportText(html);

    expect(parsed.headers).toContain('角色ID');
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]['角色名称']).toBe('系统管理员');
  });

  it('parses CSV role rows and maps permission labels to ids', () => {
    const csv = [
      '"角色ID","角色名称","级别","标识颜色","权限标识(英文逗号分隔)","类型"',
      '"mentor","导师","2","green","查看任教班级,成绩录入","自定义"',
    ].join('\n');
    const parsed = parseRoleImportText(csv);
    const result = buildRoleImport({ parsedRows: parsed.rows });

    expect(result.errors).toEqual([]);
    expect(result.roles[0]).toMatchObject({
      id: 'mentor',
      name: '导师',
      level: 2,
      permissions: ['view_own_class', 'input_scores'],
      is_system: false,
    });
  });

  it('keeps built-in roles when merging imported custom roles', () => {
    const merged = mergeRoleSettings({
      existingRoles: [],
      importedRoles: [{ id: 'mentor', name: '导师', level: 2, permissions: ['view_own_class'] }],
    });

    expect(merged.some(role => role.id === 'admin')).toBe(true);
    expect(merged.some(role => role.id === 'subject_teacher')).toBe(true);
    expect(merged.some(role => role.id === 'mentor')).toBe(true);
  });

  it('exports a CSV fallback for tests and manual inspection', () => {
    const csv = buildRoleImportTemplateCsv(DEFAULT_ROLE_SETTINGS.slice(0, 1));

    expect(csv).toContain('"角色ID"');
    expect(csv).toContain('"admin"');
  });
});
