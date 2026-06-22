import React, { useCallback, useEffect, useState } from 'react';
import {
  Download,
  Upload,
  UserCheck,
  Users,
  GraduationCap,
  BookOpen,
  Award,
  Briefcase,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import schoolData from '../data/schoolData';
import { notify } from '../lib/notify';
import { fetchClassList } from '../lib/classApi';
import {
  assignTeacherClass,
  buildTeacherAssignmentPayload,
  fetchTeacherListWithAssignments,
  removeTeacherAssignment,
} from '../lib/teacherApi';
import {
  assignTeacherDuty,
  buildTeacherDutyPayload,
  deactivateTeacherDuty,
  fetchTeacherDuties,
} from '../lib/teacherDutiesApi';

// 权限优先级定义（数字越大权限越高）
const ROLE_PRIORITY = {
  'principal': 100,
  'vice_principal': 90,
  'dept_director': 80,
  'dept_deputy': 75,
  'grade_leader': 70,
  'grade_deputy': 65,
  'research_leader': 60,
  'lesson_leader': 55,
  'head_teacher': 50,
  'subject_teacher': 10
};

// 权限配置
const ROLE_PERMISSIONS = {
  'principal': ['view_all', 'manage_all', 'approve_all', 'system_config'],
  'vice_principal': ['view_all', 'manage_departments', 'approve_school'],
  'dept_director': ['view_dept', 'manage_dept_staff', 'approve_dept'],
  'dept_deputy': ['view_dept', 'assist_dept', 'approve_dept_limited'],
  'grade_leader': ['view_grade', 'manage_grade_teachers', 'approve_grade'],
  'grade_deputy': ['view_grade', 'assist_grade', 'approve_grade_limited'],
  'research_leader': ['view_subject_all', 'manage_subject_teachers', 'approve_subject'],
  'lesson_leader': ['view_subject_grade', 'manage_lesson_group', 'approve_lesson'],
  'head_teacher': ['view_class', 'manage_class_students', 'input_scores'],
  'subject_teacher': ['view_own_classes', 'input_subject_scores']
};

const getCurrentTerm = () => (
  schoolData.getCurrentSemesterDisplay?.() || `${schoolData.config?.currentAcademicYear || new Date().getFullYear()}-${schoolData.config?.currentSemester || 1}`
);

const normalizeClassKey = (value) => {
  const match = String(value ?? '').match(/\d{3,4}/);
  return match ? match[0] : String(value ?? '').trim();
};

const unique = (items) => [...new Set((items || []).filter(Boolean))];

const mergeDutiesIntoTeachers = (teacherRows = [], duties = []) => {
  const dutiesByTeacherId = new Map();
  duties.forEach(duty => {
    if (!duty.is_active) return;
    const key = Number(duty.teacher_id);
    if (!dutiesByTeacherId.has(key)) dutiesByTeacherId.set(key, []);
    dutiesByTeacherId.get(key).push({
      id: duty.id,
      role_type: duty.role_type || duty.duty_type,
      duty_type: duty.duty_type,
      grade: duty.grade,
      subject: duty.subject,
      class_id: duty.class_id,
      class_name: duty.class_name,
      term: duty.term,
      assigned_at: duty.assigned_at,
      scope_label: duty.scope_label,
      source: 'backend',
    });
  });

  return teacherRows.map(teacher => {
    const dutyDetails = dutiesByTeacherId.get(Number(teacher.id)) || [];
    const dutyRoles = dutyDetails.map(detail => detail.role_type);
    const merged = {
      ...teacher,
      roles: unique([...(teacher.roles || []), ...dutyRoles]),
      role_details: [...(teacher.role_details || []), ...dutyDetails],
    };
    updateTeacherPermissionShape(merged);
    return merged;
  });
};

const applyHeadTeacherDutiesToClasses = (classRows = [], duties = []) => {
  const headTeacherByClass = new Map();
  duties
    .filter(duty => duty.is_active && (duty.role_type || duty.duty_type) === 'head_teacher')
    .forEach(duty => {
      headTeacherByClass.set(normalizeClassKey(duty.class_name || duty.class_id), Number(duty.teacher_id));
    });

  return classRows.map(cls => {
    const classKey = normalizeClassKey(cls.id || cls.class_code || cls.class_name || cls.name);
    return {
      ...cls,
      head_teacher_id: headTeacherByClass.get(classKey) || cls.head_teacher_id || null,
    };
  });
};

const getGradeNameFromClassId = (classId) => {
  const grade = Math.floor(Number(classId) / 100);
  return Number.isFinite(grade) && grade > 0 ? `${grade}年级` : '';
};

const updateTeacherPermissionShape = (teacher) => {
  if (!teacher.roles || teacher.roles.length === 0) {
    teacher.permissions = ROLE_PERMISSIONS.subject_teacher;
    teacher.primary_role = 'subject_teacher';
    return teacher;
  }

  const highestRole = teacher.roles.reduce((highest, role) => {
    const currentPriority = ROLE_PRIORITY[role] || 0;
    const highestPriority = ROLE_PRIORITY[highest] || 0;
    return currentPriority > highestPriority ? role : highest;
  }, 'subject_teacher');

  const allPermissions = new Set();
  teacher.roles.forEach(role => {
    const perms = ROLE_PERMISSIONS[role] || [];
    perms.forEach(permission => allPermissions.add(permission));
  });

  teacher.permissions = Array.from(allPermissions);
  teacher.primary_role = highestRole;
  return teacher;
};

const RoleManagement = () => {
  const [activeTab, setActiveTab] = useState('headteacher'); // headteacher | middle | leadership
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [syncSource, setSyncSource] = useState('local');
  const [syncMessage, setSyncMessage] = useState('正在使用本地数据');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = React.useRef(null);
  const currentTerm = getCurrentTerm();

  const loadLocalData = useCallback(() => {
    setTeachers(schoolData.teachers || []);
    setClasses(schoolData.classes || []);
    setSyncSource('local');
    setSyncMessage('后端未同步时使用本地数据');
  }, []);

  const refreshBackendData = useCallback(async () => {
    if (!localStorage.getItem('token')) {
      loadLocalData();
      return false;
    }

    setLoading(true);
    try {
      const classPayload = await fetchClassList({ pageSize: 200 });
      const backendClasses = classPayload.classes?.length ? classPayload.classes : (schoolData.classes || []);
      const [teacherPayload, dutyPayload] = await Promise.all([
        fetchTeacherListWithAssignments({ pageSize: 100, term: currentTerm }, backendClasses),
        fetchTeacherDuties({ term: currentTerm }),
      ]);

      const duties = dutyPayload.duties || [];
      setTeachers(mergeDutiesIntoTeachers(teacherPayload.teachers || [], duties));
      setClasses(applyHeadTeacherDutiesToClasses(backendClasses, duties));
      setSyncSource('backend');
      setSyncMessage(`已同步后端职务数据 · ${currentTerm}`);
      return true;
    } catch (error) {
      console.warn('职务管理后端同步失败:', error);
      loadLocalData();
      setSyncMessage('后端暂不可用，当前使用本地数据');
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentTerm, loadLocalData]);

  useEffect(() => {
    loadLocalData();
    refreshBackendData();
  }, [loadLocalData, refreshBackendData]);

  // 自动分配角色和权限
  const assignRoleToTeacher = (teacherCode, roleType, additionalData = {}) => {
    const teacher = schoolData.teachers.find(t => t.code === teacherCode || t.name === teacherCode);
    if (!teacher) return { success: false, message: `未找到教师: ${teacherCode}` };

    // 初始化角色数组（如果不存在）
    if (!teacher.roles) teacher.roles = [];
    if (!teacher.role_details) teacher.role_details = [];

    // 添加新角色（支持多角色）
    if (!teacher.roles.includes(roleType)) {
      teacher.roles.push(roleType);
    }

    // 添加角色详情
    const roleDetail = {
      role_type: roleType,
      assigned_at: new Date().toISOString(),
      ...additionalData
    };
    teacher.role_details.push(roleDetail);

    // 自动分配权限（取最高权限）
    updateTeacherPermissions(teacher);

    return { success: true, message: `已为 ${teacher.name} 分配 ${getRoleName(roleType)} 角色` };
  };

  // 更新教师权限（权限就高不就低）
  const updateTeacherPermissions = (teacher) => {
    updateTeacherPermissionShape(teacher);
  };

  const getRoleName = (roleId) => {
    const roleNames = {
      'head_teacher': '班主任',
      'lesson_leader': '备课组长',
      'research_leader': '教研组长',
      'grade_leader': '年段长',
      'grade_deputy': '副段长',
      'dept_director': '科室主任',
      'dept_deputy': '科室副主任',
      'vice_principal': '副校长',
      'principal': '校长'
    };
    return roleNames[roleId] || roleId;
  };

  const findTeacher = (teacherCodeOrName) => (
    teachers.find(t => t.code === teacherCodeOrName || t.name === teacherCodeOrName) ||
    schoolData.teachers.find(t => t.code === teacherCodeOrName || t.name === teacherCodeOrName)
  );

  const findClass = (classIdOrNo) => (
    classes.find(c => Number(c.id) === Number(classIdOrNo) || c.class_no === String(classIdOrNo)) ||
    schoolData.classes.find(c => Number(c.id) === Number(classIdOrNo) || c.class_no === String(classIdOrNo))
  );

  const assignDuty = async (teacher, roleType, detail = {}) => {
    if (!teacher) return { success: false, message: '未找到教师' };

    if (syncSource === 'backend') {
      const payload = buildTeacherDutyPayload({
        teacherId: teacher.id,
        dutyType: roleType,
        term: currentTerm,
        gradeName: detail.grade_name || detail.grade,
        subjectName: detail.subject_name || detail.subject,
        className: detail.class_name || detail.class_id,
        scopeLabel: detail.scope_label,
      });
      const result = await assignTeacherDuty(payload);
      if (result?.success === false) return result;
      await refreshBackendData();
      return { success: true, message: `已为 ${teacher.name} 分配 ${getRoleName(roleType)} 角色` };
    }

    const result = assignRoleToTeacher(teacher.code || teacher.name, roleType, detail);
    setTeachers([...(schoolData.teachers || [])]);
    return result;
  };

  const deactivateDutyDetail = async (teacher, detail) => {
    if (syncSource === 'backend' && detail?.id) {
      const result = await deactivateTeacherDuty(detail.id);
      if (result?.success === false) return result;
      await refreshBackendData();
      return { success: true, message: '职务已解除' };
    }

    if (teacher) {
      teacher.roles = (teacher.roles || []).filter(r => r !== detail.role_type);
      teacher.role_details = (teacher.role_details || []).filter(r => r !== detail);
      updateTeacherPermissions(teacher);
      setTeachers([...(schoolData.teachers || [])]);
    }
    return { success: true, message: '职务已解除' };
  };

  // ============ 模块1: 班主任管理 ============
  const HeadTeacherModule = () => {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedTeacher, setSelectedTeacher] = useState('');

    const handleAssignHeadTeacher = async () => {
      if (!selectedClass || !selectedTeacher) {
        notify('请选择班级和教师');
        return;
      }

      const teacher = findTeacher(selectedTeacher);
      const cls = findClass(selectedClass);

      if (!teacher || !cls) {
        notify('选择的数据有误');
        return;
      }

      setSaving(true);
      try {
        if (syncSource === 'backend') {
          const className = String(cls.id || cls.class_code || selectedClass);
          const dutyResult = await assignDuty(teacher, 'head_teacher', {
            grade_name: getGradeNameFromClassId(className),
            class_id: className,
            class_name: className,
            scope_label: schoolData.formatClassName?.(className) || cls.name || className,
          });
          if (dutyResult?.success === false) {
            notify(dutyResult.message || '班主任分配失败', 'warning');
            return;
          }

          const assignmentPayload = buildTeacherAssignmentPayload({
            teacherId: teacher.id,
            teachingClass: {
              class_id: className,
              class_name: className,
              subject: '',
              is_headmaster: true,
            },
            classes,
            term: currentTerm,
          });
          const assignmentResult = await assignTeacherClass(assignmentPayload);
          if (assignmentResult?.success === false && !String(assignmentResult.message || '').includes('已有')) {
            notify(assignmentResult.message || '班主任任课关系同步失败', 'warning');
          }
          await refreshBackendData();
        } else {
          cls.head_teacher_id = teacher.id;
          const result = await assignDuty(teacher, 'head_teacher', {
            class_id: cls.id,
            class_name: schoolData.formatClassName(cls.id)
          });
          if (result?.success === false) {
            notify(result.message || '班主任分配失败', 'warning');
            return;
          }
        }

        notify(`已为 ${teacher.name} 分配班主任职务`);
        setSelectedClass('');
        setSelectedTeacher('');
      } catch (error) {
        console.error('分配班主任失败:', error);
        notify(error.message || '分配班主任失败', 'error');
      } finally {
        setSaving(false);
      }
    };

    const handleRemoveHeadTeacher = async (classId) => {
      const cls = findClass(classId);
      if (!cls || !cls.head_teacher_id) return;

      const teacher = teachers.find(t => Number(t.id) === Number(cls.head_teacher_id)) ||
        schoolData.teachers.find(t => Number(t.id) === Number(cls.head_teacher_id));
      const detail = teacher?.role_details?.find(r => (
        r.role_type === 'head_teacher' &&
        normalizeClassKey(r.class_name || r.class_id) === normalizeClassKey(classId)
      ));

      setSaving(true);
      try {
        const result = await deactivateDutyDetail(teacher, detail || { role_type: 'head_teacher' });
        if (result?.success === false) {
          notify(result.message || '解除班主任失败', 'warning');
          return;
        }

        if (syncSource === 'backend' && teacher) {
          const assignment = teacher.teaching_classes?.find(item => (
            item.is_headmaster && normalizeClassKey(item.class_id || item.class_name) === normalizeClassKey(classId)
          ));
          if (assignment?.assignment_id) {
            await removeTeacherAssignment(assignment.assignment_id);
          }
          await refreshBackendData();
        } else {
          cls.head_teacher_id = null;
          setClasses([...(schoolData.classes || [])]);
        }

        notify('已解除班主任职务');
      } catch (error) {
        console.error('解除班主任失败:', error);
        notify(error.message || '解除班主任失败', 'error');
      } finally {
        setSaving(false);
      }
    };

    // 下载班主任导入模板
    const downloadHeadTeacherTemplate = () => {
      const headers = ['教师姓名', '班主任班级(班级编号如701)'];
      const comments = [
        '# 班主任导入模板',
        '# 教师姓名: 系统中已存在的教师姓名',
        '# 班主任班级: 班级编号，如 701、702 等',
        '#',
        '# 示例：',
      ];
      const sampleData = [
        ['林昕昕', '701'],
        ['王江鹏', '702'],
        ['周慧敏', '703'],
      ];

      const csvContent = [
        ...comments,
        headers.join(','),
        ...sampleData.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = '班主任导入模板.csv';
      link.click();
    };

    // 导入班主任数据
    const handleImportHeadTeachers = async (content) => {
      const lines = content.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#');
      });

      if (lines.length < 2) {
        notify('文件格式错误');
        return;
      }

      let successCount = 0;
      let errorMessages = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length >= 2) {
          const teacherName = cols[0]?.trim();
          const classNo = cols[1]?.trim();

          // 查找班级
          let cls = findClass(classNo);
          if (!cls) {
            cls = classes.find(c => c.class_no === classNo);
          }

          if (!cls) {
            errorMessages.push(`第${i + 1}行: 未找到班级 ${classNo}`);
            continue;
          }

          // 查找教师
          const teacher = findTeacher(teacherName);
          if (!teacher) {
            errorMessages.push(`第${i + 1}行: 未找到教师 ${teacherName}`);
            continue;
          }

          const className = String(cls.id || cls.class_code || classNo);
          const result = await assignDuty(teacher, 'head_teacher', {
            grade_name: getGradeNameFromClassId(className),
            class_id: className,
            class_name: className,
            scope_label: schoolData.formatClassName?.(className) || cls.name || className,
          });

          if (syncSource === 'backend' && result.success) {
            const assignmentPayload = buildTeacherAssignmentPayload({
              teacherId: teacher.id,
              teachingClass: {
                class_id: className,
                class_name: className,
                subject: '',
                is_headmaster: true,
              },
              classes,
              term: currentTerm,
            });
            const assignmentResult = await assignTeacherClass(assignmentPayload);
            if (assignmentResult?.success === false && !String(assignmentResult.message || '').includes('已有')) {
              errorMessages.push(`第${i + 1}行: ${assignmentResult.message || '任课关系同步失败'}`);
            }
          } else if (result.success) {
            cls.head_teacher_id = teacher.id;
          }

          if (result.success) successCount++;
        }
      }

      if (syncSource === 'backend') {
        await refreshBackendData();
      } else {
        setTeachers([...schoolData.teachers]);
        setClasses([...schoolData.classes]);
      }
      let message = `成功导入 ${successCount} 位班主任`;
      if (errorMessages.length > 0) {
        message += `\n\n错误信息:\n${errorMessages.slice(0, 5).join('\n')}`;
        if (errorMessages.length > 5) message += `\n...还有${errorMessages.length - 5}条错误`;
      }
      notify(message);
    };

    const classesWithHeadTeacher = classes.filter(c => c.head_teacher_id);
    const classesWithoutHeadTeacher = classes.filter(c => !c.head_teacher_id);

    return (
      <div className="space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-red-100 text-red-600">
                <UserCheck className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">已分配班主任</p>
                <p className="text-2xl font-bold text-red-600">{classesWithHeadTeacher.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">待分配班级</p>
                <p className="text-2xl font-bold text-yellow-600">{classesWithoutHeadTeacher.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">班主任覆盖率</p>
                <p className="text-2xl font-bold text-blue-600">
                  {classes.length > 0 ? Math.round((classesWithHeadTeacher.length / classes.length) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 分配区域 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">分配班主任</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择班级</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">请选择班级</option>
                {classesWithoutHeadTeacher.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {schoolData.formatClassName(cls.id)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择教师</label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">请选择教师</option>
                {teachers.map(t => (
                  <option key={t.code} value={t.code}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAssignHeadTeacher}
              disabled={!selectedClass || !selectedTeacher || saving}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {saving ? '保存中' : '确认分配'}
            </button>
          </div>
        </div>

        {/* 导入区域 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">批量导入班主任</h3>
            <button
              onClick={downloadHeadTeacherTemplate}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              下载模板
            </button>
          </div>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">点击上传班主任分配文件</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => handleImportHeadTeachers(ev.target.result);
                  reader.readAsText(file);
                }
              }}
            />
          </div>
        </div>

        {/* 班主任列表 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">班主任列表</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">班级</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">班主任</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">联系电话</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {classesWithHeadTeacher.map(cls => {
                const teacher = teachers.find(t => t.id === cls.head_teacher_id);
                return (
                  <tr key={cls.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">
                      {schoolData.formatClassName(cls.id)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {teacher ? teacher.name : '未设置'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {teacher ? teacher.phone : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleRemoveHeadTeacher(cls.id)}
                        disabled={saving}
                        className="text-red-600 hover:text-red-900 text-sm"
                      >
                        解除职务
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ============ 模块2: 中间管理层 ============
  const MiddleManagementModule = () => {
    const [selectedTeacher, setSelectedTeacher] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedGrade, setSelectedGrade] = useState('');

    // 图标映射表
    const iconMap = {
      'lesson_leader': BookOpen,
      'research_leader': GraduationCap,
      'grade_leader': Users,
      'grade_deputy': Users,
    };

    // 只使用系统预设的4个职务类型，不加载自定义职务
    const middleRoles = [
      { id: 'lesson_leader', name: '备课组长', iconKey: 'lesson_leader', isCustom: false },
      { id: 'research_leader', name: '教研组长', iconKey: 'research_leader', isCustom: false },
      { id: 'grade_leader', name: '年段长', iconKey: 'grade_leader', isCustom: false },
      { id: 'grade_deputy', name: '副段长', iconKey: 'grade_deputy', isCustom: false },
    ];

    // 获取图标组件
    const getRoleIcon = (role) => {
      if (role.iconKey && iconMap[role.iconKey]) {
        return iconMap[role.iconKey];
      }
      return Briefcase; // 默认图标
    };

    const grades = [
      { value: '7', label: '七年级' },
      { value: '8', label: '八年级' },
      { value: '9', label: '九年级' },
    ];

    const handleAssignRole = async () => {
      if (!selectedTeacher || !selectedRole || !selectedGrade) {
        notify('请完整填写所有字段');
        return;
      }

      const teacher = findTeacher(selectedTeacher);
      setSaving(true);
      try {
        const gradeLabel = `${selectedGrade}年级`;
        const result = await assignDuty(teacher, selectedRole, {
          grade: gradeLabel,
          grade_name: gradeLabel,
          assigned_date: new Date().toISOString(),
        });

        if (result?.success === false) {
          notify(result.message || '职务分配失败', 'warning');
          return;
        }
        notify(result.message);
        setSelectedTeacher('');
        setSelectedRole('');
        setSelectedGrade('');
      } catch (error) {
        console.error('分配职务失败:', error);
        notify(error.message || '职务分配失败', 'error');
      } finally {
        setSaving(false);
      }
    };

    const middleFileInputRef = React.useRef(null);

    const downloadTemplate = () => {
      const headers = ['教师姓名', '职务类型', '学科', '年级'];
      const comments = [
        '# 中间管理层导入模板',
        '#',
        '# 职务类型说明：',
        '# - 备课组长：管理某个学科某个年级的教学工作（需填写学科+年级）',
        '# - 教研组长：统管某个学科全部年级的教学工作（只需填写学科，年级留空）',
        '# - 年段长/副段长：管理整个年级（只需填写年级，学科留空）',
      ];
      
      // 添加自定义职务说明
      const customRoles = middleRoles.filter(r => r.isCustom);
      if (customRoles.length > 0) {
        comments.push('#');
        comments.push('# 自定义职务：');
        customRoles.forEach(r => {
          comments.push(`# - ${r.name}`);
        });
      }
      
      comments.push('#');
      comments.push('# 示例数据：');
      
      const sampleData = [
        ['林昕昕', '备课组长', '语文', '七年级'],
        ['王江鹏', '教研组长', '数学', ''],
        ['周慧敏', '年段长', '', '九年级'],
        ['吴国平', '副段长', '', '八年级'],
      ];

      const csvContent = [
        ...comments,
        headers.join(','),
        ...sampleData.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = '中间管理层导入模板.csv';
      link.click();
    };

    // 导入中间管理层数据
    const handleImportMiddleManagement = async (content) => {
      const lines = content.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#');
      });

      if (lines.length < 2) {
        notify('文件格式错误');
        return;
      }

      let successCount = 0;
      let errorMessages = [];

      // 构建职务类型映射（包含自定义职务）
      const roleTypeMap = {};
      middleRoles.forEach(role => {
        roleTypeMap[role.name] = role.id;
      });

      // 年级映射
      const gradeMap = {
        '七年级': '7',
        '八年级': '8',
        '九年级': '9',
        '7': '7',
        '8': '8',
        '9': '9'
      };

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length >= 2) {
          const teacherName = cols[0]?.trim();
          const roleTypeName = cols[1]?.trim();
          const subject = cols[2]?.trim();
          const gradeName = cols[3]?.trim();

          // 查找教师
          const teacher = findTeacher(teacherName);
          if (!teacher) {
            errorMessages.push(`第${i + 1}行: 未找到教师 ${teacherName}`);
            continue;
          }

          // 转换职务类型（支持自定义职务）
          let roleType = roleTypeMap[roleTypeName];
          if (!roleType) {
            // 尝试查找不区分大小写的匹配
            const matchedRole = middleRoles.find(r => 
              r.name.toLowerCase() === roleTypeName.toLowerCase()
            );
            if (matchedRole) {
              roleType = matchedRole.id;
            }
          }
          
          if (!roleType) {
            errorMessages.push(`第${i + 1}行: 未知的职务类型 "${roleTypeName}"，请先添加该职务类型`);
            continue;
          }

          // 分配角色
          const grade = gradeMap[gradeName] || gradeName;
          const gradeLabel = grade
            ? (String(grade).includes('年级') ? String(grade) : `${grade}年级`)
            : undefined;

          const result = await assignDuty(teacher, roleType, {
            subject: subject || undefined,
            subject_name: subject || undefined,
            grade: gradeLabel,
            grade_name: gradeLabel,
            assigned_date: new Date().toISOString(),
            scope_label: subject && gradeLabel ? `${subject} / ${gradeLabel}` : (subject || gradeLabel)
          });

          if (result.success) successCount++;
        }
      }

      if (syncSource === 'backend') {
        await refreshBackendData();
      } else {
        setTeachers([...schoolData.teachers]);
      }
      let message = `成功导入 ${successCount} 条职务记录`;
      if (errorMessages.length > 0) {
        message += `\n\n错误信息:\n${errorMessages.slice(0, 5).join('\n')}`;
        if (errorMessages.length > 5) message += `\n...还有${errorMessages.length - 5}条错误`;
      }
      notify(message);
    };

    return (
      <div className="space-y-6">
        {/* 统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {middleRoles.map(role => {
            const count = teachers.filter(t => t.roles?.includes(role.id)).length;
            const Icon = getRoleIcon(role);
            return (
              <div key={role.id} className="bg-white rounded-lg shadow-sm p-4 relative group">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-500">{role.name}</p>
                    <p className="text-xl font-bold text-gray-800">{count}</p>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

        {/* 分配区域 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">分配职务</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择教师</label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">请选择教师</option>
                {teachers.map(t => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">职务类型</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">请选择职务</option>
                {middleRoles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">职务年级</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">请选择年级</option>
                {grades.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAssignRole}
              disabled={!selectedTeacher || !selectedRole || !selectedGrade || saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              {saving ? '保存中' : '确认分配'}
            </button>
          </div>
        </div>

        {/* 导入 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">批量导入</h3>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              下载模板
            </button>
          </div>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            onClick={() => middleFileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">点击上传中间管理层分配文件</p>
            <input
              ref={middleFileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => handleImportMiddleManagement(ev.target.result);
                  reader.readAsText(file);
                }
              }}
            />
          </div>
        </div>

        {/* 中间管理层列表 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">中间管理层列表</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">教师姓名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">职务类型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">学科/年级</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">联系电话</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(() => {
                // 获取所有中间管理层职务ID（包括自定义）
                const middleRoleIds = middleRoles.map(r => r.id);
                
                return teachers
                  .filter(t => t.roles?.some(r => middleRoleIds.includes(r)))
                  .flatMap(teacher => {
                    const middleRoleDetails = teacher.role_details?.filter(r => 
                      middleRoleIds.includes(r.role_type)
                    ) || [];
                    
                    return middleRoleDetails.map((detail, idx) => {
                      // 查找职务名称（支持自定义职务）
                      const roleConfig = middleRoles.find(r => r.id === detail.role_type);
                      const roleName = roleConfig ? roleConfig.name : getRoleName(detail.role_type);
                      
                      // 处理年级显示，避免重复"年级"
                      const gradeDisplay = detail.grade 
                        ? (detail.grade.toString().includes('年级') ? detail.grade : `${detail.grade}年级`)
                        : null;
                      const scopeInfo = detail.subject 
                        ? (gradeDisplay ? `${detail.subject} / ${gradeDisplay}` : `${detail.subject} (全年级)`)
                        : (gradeDisplay || '-');
                      
                      return (
                        <tr key={`${teacher.id}-${idx}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{teacher.name}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {roleName}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{scopeInfo}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{teacher.phone || '-'}</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={async () => {
                                setSaving(true);
                                try {
                                  const result = await deactivateDutyDetail(teacher, detail);
                                  if (result?.success === false) {
                                    notify(result.message || '解除职务失败', 'warning');
                                    return;
                                  }
                                  notify(`已解除 ${teacher.name} 的 ${roleName} 职务`);
                                } catch (error) {
                                  console.error('解除职务失败:', error);
                                  notify(error.message || '解除职务失败', 'error');
                                } finally {
                                  setSaving(false);
                                }
                              }}
                              disabled={saving}
                              className="text-red-600 hover:text-red-900 text-sm"
                            >
                              解除职务
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ============ 模块3: 校级领导 ============
  const LeadershipModule = () => {
    const [selectedTeacher, setSelectedTeacher] = useState('');
    const [selectedRole, setSelectedRole] = useState('');

    const leadershipRoles = [
      { id: 'dept_director', name: '科室主任', icon: Briefcase },
      { id: 'dept_deputy', name: '科室副主任', icon: Briefcase },
      { id: 'vice_principal', name: '副校长', icon: Award },
      { id: 'principal', name: '校长', icon: Award },
    ];

    const handleAssignRole = async () => {
      if (!selectedTeacher || !selectedRole) {
        notify('请选择教师和职务');
        return;
      }

      const teacher = findTeacher(selectedTeacher);
      setSaving(true);
      try {
        const result = await assignDuty(teacher, selectedRole, {
          assigned_date: new Date().toISOString()
        });

        if (result?.success === false) {
          notify(result.message || '职务分配失败', 'warning');
          return;
        }
        notify(result.message);
        setSelectedTeacher('');
        setSelectedRole('');
      } catch (error) {
        console.error('分配校级职务失败:', error);
        notify(error.message || '职务分配失败', 'error');
      } finally {
        setSaving(false);
      }
    };

    const leadershipFileInputRef = React.useRef(null);

    const downloadTemplate = () => {
      const headers = ['教师姓名', '职务名称'];
      const comments = [
        '# 校级领导导入模板',
        '# 职务名称: 科室主任、科室副主任、副校长、校长',
        '#',
        '# 示例：',
      ];
      const sampleData = [
        ['林昕昕', '科室主任'],
        ['王江鹏', '副校长'],
        ['周慧敏', '校长'],
      ];

      const csvContent = [
        ...comments,
        headers.join(','),
        ...sampleData.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = '校级领导导入模板.csv';
      link.click();
    };

    // 导入校级领导数据
    const handleImportLeadership = async (content) => {
      const lines = content.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#');
      });

      if (lines.length < 2) {
        notify('文件格式错误');
        return;
      }

      let successCount = 0;
      let errorMessages = [];

      // 职务名称映射
      const roleNameMap = {
        '科室主任': 'dept_director',
        '科室副主任': 'dept_deputy',
        '副校长': 'vice_principal',
        '校长': 'principal'
      };

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length >= 2) {
          const teacherName = cols[0]?.trim();
          const roleName = cols[1]?.trim();

          // 查找教师
          const teacher = findTeacher(teacherName);
          if (!teacher) {
            errorMessages.push(`第${i + 1}行: 未找到教师 ${teacherName}`);
            continue;
          }

          // 转换职务类型
          const roleType = roleNameMap[roleName];
          if (!roleType) {
            errorMessages.push(`第${i + 1}行: 未知的职务名称 ${roleName}`);
            continue;
          }

          // 分配角色
          const result = await assignDuty(teacher, roleType, {
            assigned_date: new Date().toISOString()
          });

          if (result.success) successCount++;
        }
      }

      if (syncSource === 'backend') {
        await refreshBackendData();
      } else {
        setTeachers([...schoolData.teachers]);
      }
      let message = `成功导入 ${successCount} 条职务记录`;
      if (errorMessages.length > 0) {
        message += `\n\n错误信息:\n${errorMessages.slice(0, 5).join('\n')}`;
        if (errorMessages.length > 5) message += `\n...还有${errorMessages.length - 5}条错误`;
      }
      notify(message);
    };

    return (
      <div className="space-y-6">
        {/* 统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {leadershipRoles.map(role => {
            const count = teachers.filter(t => t.roles?.includes(role.id)).length;
            const Icon = role.icon || Briefcase;
            return (
              <div key={role.id} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center">
                  <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-500">{role.name}</p>
                    <p className="text-xl font-bold text-gray-800">{count}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 分配区域 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">分配职务</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择教师</label>
              <select
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">请选择教师</option>
                {teachers.map(t => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">职务名称</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">请选择职务</option>
                {leadershipRoles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAssignRole}
              disabled={!selectedTeacher || !selectedRole || saving}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300"
            >
              {saving ? '保存中' : '确认分配'}
            </button>
          </div>
        </div>

        {/* 导入 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">批量导入</h3>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              下载模板
            </button>
          </div>
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
            onClick={() => leadershipFileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">点击上传校级领导分配文件</p>
            <input
              ref={leadershipFileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => handleImportLeadership(ev.target.result);
                  reader.readAsText(file);
                }
              }}
            />
          </div>
        </div>

        {/* 校级领导列表 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">校级领导列表</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">教师姓名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">职务名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">联系电话</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {teachers.filter(t => t.roles?.some(r => ['dept_director', 'dept_deputy', 'vice_principal', 'principal'].includes(r))).map(teacher => {
                const leadershipRoleDetails = teacher.role_details?.filter(r => 
                  ['dept_director', 'dept_deputy', 'vice_principal', 'principal'].includes(r.role_type)
                ) || [];
                
                return leadershipRoleDetails.map((detail, idx) => {
                  const roleName = getRoleName(detail.role_type);
                  
                  return (
                    <tr key={`${teacher.id}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{teacher.name}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                          {roleName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{teacher.phone || '-'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={async () => {
                            setSaving(true);
                            try {
                              const result = await deactivateDutyDetail(teacher, detail);
                              if (result?.success === false) {
                                notify(result.message || '解除职务失败', 'warning');
                                return;
                              }
                              notify(`已解除 ${teacher.name} 的 ${roleName} 职务`);
                            } catch (error) {
                              console.error('解除职务失败:', error);
                              notify(error.message || '解除职务失败', 'error');
                            } finally {
                              setSaving(false);
                            }
                          }}
                          disabled={saving}
                          className="text-red-600 hover:text-red-900 text-sm"
                        >
                          解除职务
                        </button>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ============ 主渲染 ============
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">职务管理</h1>
        <p className="text-gray-500 mt-1">管理教师职务分配，支持多角色和权限自动分配</p>
      </div>

      <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
        syncSource === 'backend'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      }`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            <span>{syncMessage}</span>
          </div>
          <button
            type="button"
            onClick={refreshBackendData}
            disabled={loading || saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-current/20 bg-white/70 px-3 py-1.5 text-sm hover:bg-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            同步
          </button>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('headteacher')}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'headteacher'
                ? 'text-red-600 border-b-2 border-red-600 bg-red-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            班主任管理
          </button>
          <button
            onClick={() => setActiveTab('middle')}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'middle'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4" />
            中间管理层
          </button>
          <button
            onClick={() => setActiveTab('leadership')}
            className={`flex-1 px-6 py-4 text-sm font-medium flex items-center justify-center gap-2 ${
              activeTab === 'leadership'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Award className="w-4 h-4" />
            校级领导
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      {activeTab === 'headteacher' && <HeadTeacherModule />}
      {activeTab === 'middle' && <MiddleManagementModule />}
      {activeTab === 'leadership' && <LeadershipModule />}
    </div>
  );
};

export default RoleManagement;
