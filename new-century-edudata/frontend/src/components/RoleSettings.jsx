import React, { useCallback, useState, useEffect } from 'react';
import {
  Download,
  Plus,
  RefreshCw,
  X,
  Save,
  Trash2,
  AlertCircle,
  CheckCircle,
  Eye,
  FileSpreadsheet,
  Sparkles,
  Upload
} from 'lucide-react';
import schoolData from '../data/schoolData';
import { notify } from '../lib/notify';
import {
  DEFAULT_ROLE_SETTINGS,
  ROLE_PERMISSION_OPTIONS,
  buildRoleImport,
  downloadRoleImportTemplate,
  mergeRoleSettings,
  parseRoleImportText,
  sortRoleSettings,
} from '../lib/roleImport';
import { useConfirm } from './ui/confirm';
import {
  createRoleSetting,
  deleteRoleSetting,
  fetchRoleSettings,
  fetchScoreVisibilitySettings as fetchScoreVisibilitySettingsRemote,
  updateScoreVisibilitySettings,
} from '../lib/roleSettingsApi';
import { hasBackendAuthToken } from '../lib/sessionToken';
import {
  getDefaultScoreVisibilitySettings,
  getLocalScoreVisibilitySettings,
  saveLocalScoreVisibilitySettings,
} from '../lib/scoreVisibility';

const hasBackendSession = hasBackendAuthToken;

const RoleSettings = () => {
  const { confirm: confirmAction } = useConfirm();
  const [roles, setRoles] = useState([]);
  const [roleSyncSource, setRoleSyncSource] = useState('local');
  const [roleListLoading, setRoleListLoading] = useState(false);
  const [roleListError, setRoleListError] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleImporting, setRoleImporting] = useState(false);
  const [scoreVisibility, setScoreVisibility] = useState(getLocalScoreVisibilitySettings);
  const [scoreVisibilitySource, setScoreVisibilitySource] = useState('local');
  const [scoreVisibilitySaving, setScoreVisibilitySaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRole, setNewRole] = useState({
    id: '',
    name: '',
    level: 1,
    permissions: []
  });
  const [availablePermissions] = useState(
    ROLE_PERMISSION_OPTIONS.map(permission => ({ id: permission.id, name: permission.label }))
  );
  const skipInitialRoleSync = React.useRef(true);

  useEffect(() => {
    const loadedRoles = mergeRoleSettings({
      existingRoles: schoolData.teacherRoles || [],
      includeDefaults: true,
    });
    schoolData.teacherRoles = loadedRoles;
    setRoles(loadedRoles);
  }, []);

  const refreshRoles = useCallback(async () => {
    if (!hasBackendSession()) {
      setRoleSyncSource('local');
      return null;
    }

    setRoleListLoading(true);
    try {
      const payload = await fetchRoleSettings();
      const backendRoles = payload.roles || [];
      setRoles(mergeRoleSettings({
        existingRoles: backendRoles.length > 0 ? backendRoles : schoolData.teacherRoles,
        includeDefaults: true,
      }));
      setRoleSyncSource('backend');
      setRoleListError(backendRoles.length > 0 ? '' : '后端角色库暂无角色，当前已显示系统内置角色模板。');
      return payload;
    } catch (error) {
      setRoleSyncSource('local');
      setRoleListError(`后端角色库暂不可用，当前显示本地缓存：${error.message || '连接失败'}`);
      return null;
    } finally {
      setRoleListLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRoles();
  }, [refreshRoles]);

  useEffect(() => {
    if (!hasBackendSession()) {
      setScoreVisibilitySource('local');
      setScoreVisibility(getLocalScoreVisibilitySettings());
      return;
    }

    fetchScoreVisibilitySettingsRemote()
      .then(settings => {
        const merged = {
          ...getDefaultScoreVisibilitySettings(),
          ...settings,
        };
        setScoreVisibility(merged);
        saveLocalScoreVisibilitySettings(merged);
        setScoreVisibilitySource('backend');
      })
      .catch(() => {
        setScoreVisibilitySource('local');
        setScoreVisibility(getLocalScoreVisibilitySettings());
      });
  }, []);

  useEffect(() => {
    if (skipInitialRoleSync.current) {
      skipInitialRoleSync.current = false;
      return;
    }
    schoolData.teacherRoles = roles;
  }, [roles]);

  const isSystemRole = (role) => {
    const systemRoles = [
      'subject_teacher', 'head_teacher', 'lesson_leader', 'research_leader',
      'grade_leader', 'grade_deputy', 'dept_director', 'dept_deputy',
      'vice_principal', 'principal', 'admin', 'edu_admin', 'exam_admin', 'parent'
    ];
    return Boolean(role?.is_system) || systemRoles.includes(role?.id);
  };

  const resetNewRole = () => {
    setNewRole({ id: '', name: '', level: 1, permissions: [] });
  };

  const handleSaveRole = async () => {
    if (!newRole.id.trim() || !newRole.name.trim()) {
      notify('请填写角色ID和名称');
      return;
    }

    // 检查ID是否已存在
    const existing = roles.find(r => r.id === newRole.id);
    if (existing) {
      notify('角色ID已存在');
      return;
    }

    const roleToAdd = {
      ...newRole,
      permissions: newRole.permissions.length > 0 ? newRole.permissions : ['view_own_class']
    };

    if (hasBackendSession()) {
      setRoleSaving(true);
      try {
        const result = await createRoleSetting(roleToAdd);
        if (result?.success === false) {
          notify(result.message || '角色添加失败', 'warning');
          return;
        }
        await refreshRoles();
        setShowAddModal(false);
        resetNewRole();
        notify(result?.message || '角色添加成功', 'success');
      } catch (error) {
        notify('角色添加失败：' + (error.message || '请稍后重试'), 'error');
      } finally {
        setRoleSaving(false);
      }
      return;
    }

    const updatedRoles = [...roles, roleToAdd];
    setRoles(updatedRoles);
    
    setShowAddModal(false);
    resetNewRole();
    notify('角色添加成功');
  };

  const handleDeleteRole = async (roleId) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;

    // 检查是否是系统预设角色
    if (isSystemRole(role)) {
      notify('系统预设角色不能删除');
      return;
    }

    const confirmed = await confirmAction({
      title: '删除角色',
      message: `确定要删除角色 "${role.name}" 吗？`,
      confirmText: '删除'
    });
    if (!confirmed) return;

    if (hasBackendSession()) {
      setRoleSaving(true);
      try {
        const result = await deleteRoleSetting(roleId);
        if (result?.success === false) {
          notify(result.message || '角色删除失败', 'warning');
          return;
        }
        await refreshRoles();
        notify(result?.message || '角色已删除', 'success');
      } catch (error) {
        notify('角色删除失败：' + (error.message || '请稍后重试'), 'error');
      } finally {
        setRoleSaving(false);
      }
      return;
    }

    const updatedRoles = roles.filter(r => r.id !== roleId);
    setRoles(updatedRoles);
  };

  const togglePermission = (permissionId) => {
    setNewRole(prev => {
      const permissions = prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId];
      return { ...prev, permissions };
    });
  };

  const persistRoleList = (nextRoles) => {
    const mergedRoles = mergeRoleSettings({
      existingRoles: nextRoles,
      includeDefaults: true,
    });
    schoolData.teacherRoles = mergedRoles;
    setRoles(mergedRoles);
    return mergedRoles;
  };

  const handleDownloadRoleTemplate = () => {
    downloadRoleImportTemplate(mergeRoleSettings({
      existingRoles: roles.length > 0 ? roles : DEFAULT_ROLE_SETTINGS,
      includeDefaults: true,
    }));
  };

  const handleRestoreDefaultRoles = async () => {
    const confirmed = await confirmAction({
      title: '恢复内置角色',
      message: '确定要恢复系统内置角色吗？系统会保留已有自定义角色，并补齐缺失的内置角色。',
      confirmText: '恢复'
    });
    if (!confirmed) return;

    persistRoleList(roles);
    notify('已恢复系统内置角色', 'success');
  };

  const handleImportRoleFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (/\.xlsx$/i.test(file.name || '')) {
      notify('当前模板为Excel 97-2003工作簿（.xls）。请下载模板填写后导入，或另存为CSV后导入。', 'warning');
      event.target.value = '';
      return;
    }

    setRoleImporting(true);
    const reader = new FileReader();
    reader.onload = async (readerEvent) => {
      try {
        const parsed = parseRoleImportText(readerEvent.target.result);
        const result = buildRoleImport({
          parsedRows: parsed.rows,
          existingRoles: roles,
        });

        if (result.errors.length > 0) {
          notify(`导入文件有 ${result.errors.length} 行需要修正：${result.errors[0]}`, 'warning');
          return;
        }
        if (result.roles.length === 0) {
          notify('导入文件没有可写入的角色数据', 'warning');
          return;
        }

        const confirmed = await confirmAction({
          title: '批量导入角色权限',
          message: `将按角色ID覆盖/新增 ${result.roles.length} 个角色，并自动补齐系统内置角色。确定导入吗？`,
          confirmText: '导入'
        });
        if (!confirmed) return;

        persistRoleList(mergeRoleSettings({
          existingRoles: roles,
          importedRoles: result.roles,
          includeDefaults: true,
        }));
        notify(`角色权限导入完成：写入 ${result.roles.length} 个角色`, 'success');
      } catch (error) {
        notify('角色权限导入失败：' + (error.message || '文件格式错误'), 'error');
      } finally {
        setRoleImporting(false);
        event.target.value = '';
      }
    };
    reader.onerror = () => {
      setRoleImporting(false);
      event.target.value = '';
      notify('读取角色权限文件失败', 'error');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const visibilityColumns = [
    { key: 'show_class_rank', label: '班排', icon: Eye },
    { key: 'show_grade_rank', label: '年排', icon: Eye },
    { key: 'show_layer_rank', label: '层排', icon: Eye },
    { key: 'show_percentile', label: '百分位', icon: Eye },
    { key: 'allow_ai_analysis', label: 'AI', icon: Sparkles },
    { key: 'allow_export', label: '导出', icon: FileSpreadsheet },
  ];

  const roleCodeForVisibility = (role) => role.permission_code || role.id;

  const updateVisibilityFlag = (roleCode, key) => {
    const next = {
      ...scoreVisibility,
      [roleCode]: {
        ...(scoreVisibility[roleCode] || getDefaultScoreVisibilitySettings().custom),
        [key]: !Boolean(scoreVisibility[roleCode]?.[key]),
      },
    };
    setScoreVisibility(next);
    saveLocalScoreVisibilitySettings(next);
  };

  const handleSaveScoreVisibility = async () => {
    saveLocalScoreVisibilitySettings(scoreVisibility);

    if (!hasBackendSession()) {
      notify('成绩可见性已保存到本地缓存', 'success');
      return;
    }

    setScoreVisibilitySaving(true);
    try {
      const payload = await updateScoreVisibilitySettings(scoreVisibility);
      const nextSettings = payload?.settings || scoreVisibility;
      setScoreVisibility(nextSettings);
      saveLocalScoreVisibilitySettings(nextSettings);
      setScoreVisibilitySource('backend');
      notify(payload?.message || '成绩可见性设置已保存', 'success');
    } catch (error) {
      notify('成绩可见性保存失败：' + (error.message || '请稍后重试'), 'error');
    } finally {
      setScoreVisibilitySaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">角色设定</h1>
        <p className="text-gray-600 mt-1">管理系统角色及其权限配置，职务管理将使用此处定义的角色</p>
      </div>

      {(roleListLoading || roleListError || roleSyncSource === 'backend') && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
          roleListError
            ? 'border-amber-100 bg-amber-50 text-amber-700'
            : 'border-emerald-100 bg-emerald-50 text-emerald-700'
        }`}>
          {roleListError ? <X className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          <span>
            {roleListLoading
              ? '正在同步后端角色库...'
              : roleListError || '已连接后端角色库，角色配置来自 sys_roles。'}
          </span>
        </div>
      )}

      {/* 角色列表 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">角色列表</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDefaultRoles}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
              恢复内置
            </button>
            <button
              type="button"
              onClick={handleDownloadRoleTemplate}
              className="flex items-center gap-2 px-3 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
            >
              <Download className="w-4 h-4" />
              Excel模板
            </button>
            <label className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              roleImporting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
            }`}>
              <Upload className="w-4 h-4" />
              {roleImporting ? '导入中...' : '批量导入'}
              <input
                type="file"
                accept=".xls,.csv,.tsv,.txt,.html"
                className="hidden"
                disabled={roleImporting}
                onChange={handleImportRoleFile}
              />
            </label>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              <Plus className="w-4 h-4" />
              添加角色
            </button>
          </div>
        </div>

        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色名称</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">级别</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">权限数量</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortRoleSettings(roles).map(role => {
              const systemRole = isSystemRole(role);
              return (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{role.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{role.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{role.level}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{role.permissions?.length || 0}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      systemRole ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {systemRole ? '系统预设' : '自定义'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {!systemRole && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteRole(role.id);
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">成绩可见性</h2>
            <p className="mt-1 text-sm text-gray-500">
              控制不同角色是否能看到排名、百分位、AI分析和报告导出。
              当前来源：{scoreVisibilitySource === 'backend' ? '后端配置' : '本地缓存'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveScoreVisibility}
            disabled={scoreVisibilitySaving}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${
              scoreVisibilitySaving
                ? 'bg-gray-300 text-gray-500'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Save className="h-4 w-4" />
            {scoreVisibilitySaving ? '保存中...' : '保存设置'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">角色</th>
                {visibilityColumns.map(column => (
                  <th key={column.key} className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortRoleSettings(roles).map(role => {
                const roleCode = roleCodeForVisibility(role);
                const settings = scoreVisibility[roleCode] || getDefaultScoreVisibilitySettings().custom;
                return (
                  <tr key={`visibility-${roleCode}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{role.name}</p>
                      <p className="text-xs text-gray-500">{roleCode}</p>
                    </td>
                    {visibilityColumns.map(column => {
                      const Icon = column.icon;
                      const checked = Boolean(settings[column.key]);
                      return (
                        <td key={`${roleCode}-${column.key}`} className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => updateVisibilityFlag(roleCode, column.key)}
                            className={`inline-flex h-8 min-w-16 items-center justify-center gap-1 rounded-full border px-3 text-xs font-medium ${
                              checked
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-gray-200 bg-gray-50 text-gray-400'
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {checked ? '开放' : '关闭'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 说明 */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">说明</h3>
            <p className="text-sm text-blue-600 mt-1">
              此处定义的角色将用于职务管理模块。系统预设角色不能删除，但可以添加自定义角色。
              级别越高，权限越大。职务分配时将根据角色级别自动计算教师权限。
            </p>
          </div>
        </div>
      </div>

      {/* 添加角色弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">添加角色</h2>
              <button onClick={() => setShowAddModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色ID</label>
                <input
                  type="text"
                  value={newRole.id}
                  onChange={(e) => setNewRole({ ...newRole, id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="如: custom_role"
                />
                <p className="text-xs text-gray-500 mt-1">唯一标识，不能重复</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色名称</label>
                <input
                  type="text"
                  value={newRole.name}
                  onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="如: 学科组长"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">级别</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newRole.level}
                  onChange={(e) => setNewRole({ ...newRole, level: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">数字越大级别越高（1-10）</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">权限</label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {availablePermissions.map(permission => (
                    <label key={permission.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={newRole.permissions.includes(permission.id)}
                        onChange={() => togglePermission(permission.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{permission.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveRole}
                disabled={roleSaving}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  roleSaving
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Save className="w-4 h-4" />
                {roleSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleSettings;
