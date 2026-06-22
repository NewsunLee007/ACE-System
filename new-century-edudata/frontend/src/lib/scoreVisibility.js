import { apiRequest } from './api';

export const SCORE_VISIBILITY_STORAGE_KEY = 'ace.scoreVisibilitySettings';

export const DEFAULT_SCORE_VISIBILITY = {
  sys_admin: {
    show_class_rank: true,
    show_grade_rank: true,
    show_layer_rank: true,
    show_percentile: true,
    allow_ai_analysis: true,
    allow_export: true,
  },
  edu_admin: {
    show_class_rank: true,
    show_grade_rank: true,
    show_layer_rank: true,
    show_percentile: true,
    allow_ai_analysis: true,
    allow_export: true,
  },
  exam_admin: {
    show_class_rank: true,
    show_grade_rank: true,
    show_layer_rank: true,
    show_percentile: true,
    allow_ai_analysis: true,
    allow_export: true,
  },
  grade_leader: {
    show_class_rank: true,
    show_grade_rank: true,
    show_layer_rank: true,
    show_percentile: true,
    allow_ai_analysis: true,
    allow_export: true,
  },
  subject_leader: {
    show_class_rank: true,
    show_grade_rank: true,
    show_layer_rank: true,
    show_percentile: false,
    allow_ai_analysis: true,
    allow_export: true,
  },
  lesson_leader: {
    show_class_rank: true,
    show_grade_rank: false,
    show_layer_rank: true,
    show_percentile: false,
    allow_ai_analysis: true,
    allow_export: true,
  },
  headmaster: {
    show_class_rank: true,
    show_grade_rank: false,
    show_layer_rank: false,
    show_percentile: false,
    allow_ai_analysis: true,
    allow_export: true,
  },
  teacher: {
    show_class_rank: false,
    show_grade_rank: false,
    show_layer_rank: false,
    show_percentile: false,
    allow_ai_analysis: true,
    allow_export: false,
  },
  parent: {
    show_class_rank: true,
    show_grade_rank: false,
    show_layer_rank: false,
    show_percentile: false,
    allow_ai_analysis: true,
    allow_export: false,
  },
  custom: {
    show_class_rank: false,
    show_grade_rank: false,
    show_layer_rank: false,
    show_percentile: false,
    allow_ai_analysis: false,
    allow_export: false,
  },
};

const ROLE_ALIASES = {
  admin: 'sys_admin',
  super_admin: 'sys_admin',
  dean: 'edu_admin',
  school_leader: 'edu_admin',
  principal: 'edu_admin',
  vice_principal: 'edu_admin',
  middle_manager: 'exam_admin',
  research_leader: 'subject_leader',
  prep_leader: 'lesson_leader',
  head_teacher: 'headmaster',
  subject_teacher: 'teacher',
  教务主任: 'edu_admin',
  教务处主任: 'edu_admin',
  '教务处主任/校领导': 'edu_admin',
  校长: 'edu_admin',
  副校长: 'edu_admin',
  系统管理员: 'sys_admin',
  管理员: 'sys_admin',
  考务与学籍管理员: 'exam_admin',
  年段长: 'grade_leader',
  段长: 'grade_leader',
  副段长: 'grade_leader',
  教研组长: 'subject_leader',
  备课组长: 'lesson_leader',
  班主任: 'headmaster',
  科任教师: 'teacher',
  家长: 'parent',
  学生家长: 'parent',
};

export const normalizeScoreRole = (roleOrUser) => {
  if (!roleOrUser) return 'custom';
  const raw = typeof roleOrUser === 'string'
    ? roleOrUser
    : roleOrUser.permission_code || roleOrUser.role || roleOrUser.role_name || roleOrUser.id;
  const key = String(raw || '').trim();
  return ROLE_ALIASES[key] || key || 'custom';
};

export const getDefaultScoreVisibilitySettings = () => (
  Object.entries(DEFAULT_SCORE_VISIBILITY).reduce((result, [role, settings]) => {
    result[role] = { ...settings };
    return result;
  }, {})
);

export const getLocalScoreVisibilitySettings = () => {
  if (typeof window === 'undefined') return getDefaultScoreVisibilitySettings();

  try {
    const parsed = JSON.parse(window.localStorage?.getItem(SCORE_VISIBILITY_STORAGE_KEY) || '{}');
    return {
      ...getDefaultScoreVisibilitySettings(),
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
    };
  } catch (error) {
    return getDefaultScoreVisibilitySettings();
  }
};

export const saveLocalScoreVisibilitySettings = (settings) => {
  if (typeof window === 'undefined') return;
  window.localStorage?.setItem(SCORE_VISIBILITY_STORAGE_KEY, JSON.stringify(settings || {}));
};

export const resolveScoreVisibility = (roleOrUser, settings = getLocalScoreVisibilitySettings()) => {
  const role = normalizeScoreRole(roleOrUser);
  return {
    ...DEFAULT_SCORE_VISIBILITY.custom,
    ...(DEFAULT_SCORE_VISIBILITY[role] || {}),
    ...(settings?.[role] || {}),
  };
};

export const maskRankValue = (value, visible, hiddenText = '暂未开放') => (
  visible ? (value ?? '-') : hiddenText
);

export const fetchScoreVisibilitySettings = async () => {
  const payload = await apiRequest('/score-visibility/settings');
  const settings = {
    ...getDefaultScoreVisibilitySettings(),
    ...(payload?.settings || {}),
  };
  saveLocalScoreVisibilitySettings(settings);
  return settings;
};

export const updateScoreVisibilitySettings = async (settings) => {
  const payload = await apiRequest('/score-visibility/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
  const nextSettings = {
    ...getDefaultScoreVisibilitySettings(),
    ...(payload?.settings || settings || {}),
  };
  saveLocalScoreVisibilitySettings(nextSettings);
  return nextSettings;
};
