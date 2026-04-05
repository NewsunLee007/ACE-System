import React, { useState, useEffect } from 'react';
import {
  Award,
  Plus,
  X,
  Save,
  Trash2,
  AlertCircle
} from 'lucide-react';
import schoolData from '../data/schoolData';

const RoleSettings = () => {
  const [roles, setRoles] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRole, setNewRole] = useState({
    id: '',
    name: '',
    level: 1,
    permissions: []
  });
  const [availablePermissions] = useState([
    { id: 'view_own_class', name: '查看自己班级' },
    { id: 'view_own_students', name: '查看自己学生' },
    { id: 'input_scores', name: '录入成绩' },
    { id: 'manage_class_students', name: '管理班级学生' },
    { id: 'view_class_reports', name: '查看班级报告' },
    { id: 'view_subject_classes', name: '查看学科班级' },
    { id: 'view_subject_scores', name: '查看学科成绩' },
    { id: 'manage_subject_materials', name: '管理学科资料' },
    { id: 'view_grade_subject', name: '查看年级学科' },
    { id: 'manage_subject_teachers', name: '管理学科教师' },
    { id: 'view_grade_all', name: '查看年级全部' },
    { id: 'manage_grade_teachers', name: '管理年级教师' },
    { id: 'view_dept_all', name: '查看科室全部' },
    { id: 'manage_dept_staff', name: '管理科室人员' },
    { id: 'view_school_all', name: '查看全校数据' },
    { id: 'manage_departments', name: '管理部门' },
    { id: 'all_permissions', name: '所有权限' },
    { id: 'system_config', name: '系统配置' }
  ]);

  useEffect(() => {
    // 加载角色数据
    const loadedRoles = schoolData.teacherRoles || [];
    setRoles(loadedRoles);
  }, []);

  const handleSaveRole = () => {
    if (!newRole.id.trim() || !newRole.name.trim()) {
      alert('请填写角色ID和名称');
      return;
    }

    // 检查ID是否已存在
    const existing = roles.find(r => r.id === newRole.id);
    if (existing) {
      alert('角色ID已存在');
      return;
    }

    const roleToAdd = {
      ...newRole,
      permissions: newRole.permissions.length > 0 ? newRole.permissions : ['view_own_class']
    };

    const updatedRoles = [...roles, roleToAdd];
    setRoles(updatedRoles);
    schoolData.teacherRoles = updatedRoles;
    
    setShowAddModal(false);
    setNewRole({ id: '', name: '', level: 1, permissions: [] });
    alert('角色添加成功');
  };

  const handleDeleteRole = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;

    // 检查是否是系统预设角色
    const systemRoles = ['subject_teacher', 'head_teacher', 'lesson_leader', 'research_leader', 
                        'grade_leader', 'grade_deputy', 'dept_director', 'dept_deputy', 
                        'vice_principal', 'principal', 'admin'];
    if (systemRoles.includes(roleId)) {
      alert('系统预设角色不能删除');
      return;
    }

    if (window.confirm(`确定要删除角色 "${role.name}" 吗？`)) {
      const updatedRoles = roles.filter(r => r.id !== roleId);
      setRoles(updatedRoles);
      schoolData.teacherRoles = updatedRoles;
    }
  };

  const togglePermission = (permissionId) => {
    setNewRole(prev => {
      const permissions = prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId];
      return { ...prev, permissions };
    });
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">角色设定</h1>
        <p className="text-gray-600 mt-1">管理系统角色及其权限配置，职务管理将使用此处定义的角色</p>
      </div>

      {/* 角色列表 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">角色列表</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            添加角色
          </button>
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
            {roles.map(role => {
              const isSystemRole = ['subject_teacher', 'head_teacher', 'lesson_leader', 
                                   'research_leader', 'grade_leader', 'grade_deputy', 
                                   'dept_director', 'dept_deputy', 'vice_principal', 
                                   'principal', 'admin'].includes(role.id);
              return (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{role.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{role.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{role.level}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{role.permissions?.length || 0}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      isSystemRole ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {isSystemRole ? '系统预设' : '自定义'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {!isSystemRole && (
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
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleSettings;
