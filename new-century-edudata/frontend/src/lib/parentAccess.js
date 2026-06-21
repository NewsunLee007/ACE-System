const normalizeText = (value) => String(value || '').trim();
const normalizePhone = (value) => normalizeText(value).replace(/\s+/g, '');

const hasSameValue = (leftValues, rightValues, normalizer = normalizeText) => {
  const left = leftValues.map(normalizer).filter(Boolean);
  const right = rightValues.map(normalizer).filter(Boolean);

  return left.some((item) => right.includes(item));
};

export const parentMatchesUser = (parent, user = {}) => {
  if (!parent || !user) return false;

  const parentIds = [parent.id, parent.parent_id, parent.parentId, parent.account_id];
  const userParentIds = [user.parent_id, user.parentId, user.parent_profile_id, user.parentProfileId];
  const parentPhones = [parent.phone, parent.mobile, parent.tel, parent.username, parent.account];
  const userPhones = [user.username, user.phone, user.mobile, user.tel];

  return (
    hasSameValue(parentIds, userParentIds) ||
    hasSameValue(parentPhones, userPhones, normalizePhone)
  );
};

export const findParentForUser = (parents = [], user = {}) => (
  parents.find((parent) => parentMatchesUser(parent, user)) || null
);

export const getBoundStudentIds = (parent) => {
  if (!parent) return [];
  const ids = parent.student_ids || parent.studentIds || parent.children_ids || [];
  return Array.isArray(ids) ? ids : [];
};

export const getBoundStudents = (parent, getStudentById) => (
  getBoundStudentIds(parent)
    .map((id) => getStudentById?.(id))
    .filter(Boolean)
);

export const getParentAccessState = ({ parents = [], user = {}, getStudentById }) => {
  const parent = findParentForUser(parents, user);

  if (!parent) {
    return {
      status: 'no-parent',
      parent: null,
      children: [],
    };
  }

  const children = getBoundStudents(parent, getStudentById);

  if (children.length === 0) {
    return {
      status: 'no-children',
      parent,
      children,
    };
  }

  return {
    status: 'ready',
    parent,
    children,
  };
};
