import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import Dashboard from './Dashboard';
import schoolData from '../data/schoolData';
import {
  getEffectiveDashboardUser,
  readStoredUser,
  ROLE_PREVIEW_CHANGED_EVENT,
} from '../lib/rolePreview';
import { getManagedGradeLevelsForUser } from '../lib/teacherAccess';

const useGradeLeaderUser = () => {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion(version => version + 1);
    window.addEventListener(ROLE_PREVIEW_CHANGED_EVENT, refresh);
    window.addEventListener('schoolData:changed', refresh);
    return () => {
      window.removeEventListener(ROLE_PREVIEW_CHANGED_EVENT, refresh);
      window.removeEventListener('schoolData:changed', refresh);
    };
  }, []);

  return getEffectiveDashboardUser(readStoredUser(), {
    teachers: schoolData.teachers || [],
    classes: schoolData.classes || [],
    students: schoolData.students || [],
  });
};

export default function GradeLeaderDashboard() {
  const user = useGradeLeaderUser();
  const gradeLevels = getManagedGradeLevelsForUser({
    teachers: schoolData.teachers || [],
    user,
  });
  const scopedGradeLevels = gradeLevels.length ? gradeLevels : (user.preview_grade_levels || []);

  if (!scopedGradeLevels.length) {
    return (
      <div className="rounded-lg border border-slate-100 bg-white p-8 shadow-sm">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
            <Lock className="h-4 w-4" />
            段长范围未配置
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">请先配置负责年级</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            段长看板只展示本人负责年级的数据。请在职务管理中为该账号配置年级后再查看。
          </p>
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      title="段长看板"
      description={`${scopedGradeLevels.join('、')}年段成绩`}
      defaultLayer="ALL"
      allowedGrades={scopedGradeLevels}
    />
  );
}
