import {
  LayoutDashboard,
  Users,
  Settings,
  BookOpen,
  GraduationCap,
  UserCircle,
  School,
  BarChart3,
  Heart,
  Briefcase,
  Award,
  Library,
} from 'lucide-react';

export const navigationConfig = [
  {
    path: '/analysis',
    label: '成绩分析',
    description: 'Z 值、教学积分、三率一分、临界生和历史对比',
    icon: BarChart3,
    roles: ['校长', '副校长', 'principal', 'vice_principal', '年段长', '段长', '副段长', 'grade_leader', 'grade_deputy', '科任教师', '班主任', '备课组长', '教研组长', '教务处主任', '管理员'],
  },
  {
    path: '/dashboards',
    label: '数据看板',
    description: '按角色查看权限范围内的数据样态',
    icon: LayoutDashboard,
    roles: ['校长', '副校长', 'principal', 'vice_principal', '年段长', '段长', '副段长', 'grade_leader', 'grade_deputy', '科任教师', '班主任', '备课组长', '教研组长', '家长', '教务处主任', '管理员'],
    children: [
      {
        path: '/principal-dashboard',
        label: '校长',
        description: '三个年段完整数据与统测大屏',
        icon: Award,
        roles: ['校长', 'principal', '教务处主任', '管理员'],
      },
      {
        path: '/vice-principal-dashboard',
        label: '副校长',
        description: '三个年段完整数据与分管查看',
        icon: Award,
        roles: ['副校长', 'vice_principal', '教务处主任', '管理员'],
      },
      {
        path: '/dashboard',
        label: '教务处',
        description: '全校统测、分层、临界分和会议展示',
        icon: LayoutDashboard,
        roles: ['教务处主任', '管理员'],
      },
      {
        path: '/grade-leader-dashboard',
        label: '段长',
        description: '只查看本人负责年级的年段成绩',
        icon: Users,
        roles: ['年段长', '段长', '副段长', 'grade_leader', 'grade_deputy', '教务处主任', '管理员'],
      },
      {
        path: '/headteacher',
        label: '班主任',
        description: '本班概览、进退步、薄弱学科和缺考上报',
        icon: Users,
        roles: ['班主任', '教务处主任', '管理员'],
      },
      {
        path: '/research-dashboard',
        label: '教研',
        description: '按年级、学科和分层查看教学质量',
        icon: Library,
        roles: ['教研组长', '备课组长', '教务处主任', '管理员'],
      },
      {
        path: '/teacher-dashboard',
        label: '教师',
        description: '任教班级、薄弱学生和班级责任清单',
        icon: GraduationCap,
        roles: ['科任教师', '班主任', '教务处主任', '管理员'],
      },
      {
        path: '/parent-dashboard',
        label: '家长',
        description: '绑定学生趋势、等级变化和家校沟通信息',
        icon: Heart,
        roles: ['家长', '教务处主任', '管理员'],
      },
    ],
  },
  {
    path: '/educational',
    label: '教务管理',
    description: '基础数据、角色、班级、师生和家长维护',
    icon: Briefcase,
    roles: ['教务处主任', '管理员'],
    children: [
      {
        path: '/exams',
        label: '考务管理',
        description: '考试信息、成绩导入和成绩维护',
        icon: BookOpen,
        roles: ['班主任', '教务处主任', '管理员'],
      },
      { path: '/educational/subjects', label: '学科管理', description: '学科、满分和启用状态维护', icon: Library },
      { path: '/educational/role-settings', label: '角色设定', description: '角色权限与菜单能力维护', icon: Award },
      { path: '/educational/classes', label: '班级管理', description: '班级、年级、班主任和容量维护', icon: School },
      { path: '/educational/teachers', label: '教师管理', description: '教师档案、任教关系和状态维护', icon: UserCircle },
      { path: '/educational/roles', label: '职务管理', description: '岗位职务和管理范围维护', icon: Briefcase },
      { path: '/educational/students', label: '学生管理', description: '学生档案、班级和状态维护', icon: GraduationCap },
      { path: '/educational/parents', label: '家长管理', description: '家长档案、学生绑定和联系方式维护', icon: Heart },
    ],
  },
  {
    path: '/settings',
    label: '系统设置',
    description: '系统参数、备份导入和安全配置',
    icon: Settings,
    roles: ['教务处主任', '管理员'],
  },
];

const CANONICAL_ROLES = new Set([
  '校长',
  '副校长',
  '教务处主任',
  '管理员',
  '年段长',
  '段长',
  '副段长',
  '班主任',
  '科任教师',
  '教研组长',
  '备课组长',
  '家长',
]);

const ROLE_ALIASES = {
  principal: '校长',
  vice_principal: '副校长',
  school_leader: '校长',
  '教务处主任/校领导': '教务处主任',
  dean: '教务处主任',
  edu_admin: '教务处主任',
  admin: '管理员',
  sys_admin: '管理员',
  super_admin: '管理员',
  '系统管理员': '管理员',
  grade_leader: '年段长',
  grade_deputy: '副段长',
  head_teacher: '班主任',
  class_teacher: '班主任',
  teacher: '科任教师',
  subject_teacher: '科任教师',
  research_leader: '教研组长',
  prep_leader: '备课组长',
  lesson_prep_leader: '备课组长',
  parent: '家长',
  guardian: '家长',
};

const normalizeRole = (value) => {
  const role = String(value || '').trim();
  if (!role) return '';
  return ROLE_ALIASES[role] || (CANONICAL_ROLES.has(role) ? role : '');
};

export const getUserRole = (user) => {
  const candidates = [user?.role_name, user?.role, user?.permission_code, user?.legacy_role];
  const normalized = candidates.map(normalizeRole).find(Boolean);
  if (normalized) return normalized;
  return candidates.map((value) => String(value || '').trim()).find(Boolean) || '';
};

export const isAllowedForRole = (item, role) => {
  const normalizedRole = normalizeRole(role) || role;
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.includes(normalizedRole);
};

const getChildWithInheritedRoles = (item, child) => ({
  ...child,
  groupLabel: item.label,
  roles: child.roles || item.roles,
});

export const getNavigationForRole = (role) => {
  const normalizedRole = normalizeRole(role) || role;

  return navigationConfig
    .map((item) => {
      if (!item.children) return isAllowedForRole(item, normalizedRole) ? item : null;

      const children = item.children
        .map((child) => getChildWithInheritedRoles(item, child))
        .filter((child) => isAllowedForRole(child, normalizedRole));

      if (!isAllowedForRole(item, normalizedRole) && children.length === 0) return null;

      return {
        ...item,
        children,
      };
    })
    .filter(Boolean)
    .filter((item) => !item.children || item.children.length > 0);
};

export const getFlatNavigationForRole = (role) =>
  getNavigationForRole(role).flatMap((item) => {
    if (!item.children) return [{ ...item, groupLabel: '常用入口' }];
    return item.children.map((child) => getChildWithInheritedRoles(item, child));
  });

const DEFAULT_PATH_BY_ROLE = {
  校长: '/principal-dashboard',
  principal: '/principal-dashboard',
  副校长: '/vice-principal-dashboard',
  vice_principal: '/vice-principal-dashboard',
  教务处主任: '/dashboard',
  管理员: '/dashboard',
  年段长: '/grade-leader-dashboard',
  段长: '/grade-leader-dashboard',
  副段长: '/grade-leader-dashboard',
  grade_leader: '/grade-leader-dashboard',
  grade_deputy: '/grade-leader-dashboard',
  班主任: '/headteacher',
  科任教师: '/teacher-dashboard',
  教研组长: '/research-dashboard',
  备课组长: '/research-dashboard',
  家长: '/parent-dashboard',
};

export const getDefaultPathForRole = (role) => {
  const normalizedRole = normalizeRole(role) || role;
  const flatNavigation = getFlatNavigationForRole(normalizedRole);
  const preferredPath = DEFAULT_PATH_BY_ROLE[normalizedRole];
  if (preferredPath && flatNavigation.some((item) => item.path === preferredPath)) {
    return preferredPath;
  }

  return flatNavigation[0]?.path || '/login';
};
