import React from 'react';
import { AlertCircle, BarChart3, FileText, Settings, Share2, X } from 'lucide-react';

export const getScoreAnalysisNoticeClass = (type) => {
  if (type === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (type === 'error') return 'border-red-200 bg-red-50 text-red-800';
  if (type === 'warning') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-blue-200 bg-blue-50 text-blue-800';
};

export const isScoreAnalysisAdminUser = (user) => {
  const role = String(user?.role || user?.role_name || '');
  const permissionCode = user?.permission_code || '';
  const adminRoles = ['super_admin', 'dean', '系统管理员', '管理员', '教务处主任', '教务处主任/校领导'];
  const adminPermissions = ['sys_admin', 'edu_admin'];

  return adminPermissions.includes(permissionCode) ||
    adminRoles.includes(role) ||
    adminRoles.some(adminRole => role.includes(adminRole));
};

export function ScoreAnalysisNotice({ notice, onClose }) {
  if (!notice) return null;

  return (
    <div className={`fixed right-5 top-5 z-[60] max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${getScoreAnalysisNoticeClass(notice.type)}`}>
      <div className="flex items-start justify-between gap-3">
        <span>{notice.message}</span>
        <button
          type="button"
          onClick={onClose}
          className="text-current opacity-60 hover:opacity-100"
          aria-label="关闭通知"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ScoreAnalysisAccessDenied() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">无权访问</h2>
        <p className="text-gray-600">您没有权限访问成绩分析功能</p>
        <p className="text-sm text-gray-500 mt-2">请联系教务处主任或系统管理员</p>
      </div>
    </div>
  );
}

export default function ScoreAnalysisHeaderTabs({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenLogs,
}) {
  const tabButtonClass = (tab) => `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 ${
    activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
  }`;

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-800">成绩分析</h1>
        <p className="text-sm text-gray-500 mt-1">分层教学数据分析与成果发布</p>
      </div>
      <div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:px-0">
        <button
          type="button"
          onClick={() => setActiveTab('analysis')}
          className={tabButtonClass('analysis')}
        >
          <BarChart3 className="w-4 h-4" />
          成绩分析
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('layers')}
          className={tabButtonClass('layers')}
        >
          <Settings className="w-4 h-4" />
          层次配置
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('publications')}
          className={tabButtonClass('publications')}
        >
          <Share2 className="w-4 h-4" />
          发布记录
        </button>
        {isScoreAnalysisAdminUser(currentUser) && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('logs');
              onOpenLogs?.();
            }}
            className={tabButtonClass('logs')}
          >
            <FileText className="w-4 h-4" />
            操作日志
          </button>
        )}
      </div>
    </div>
  );
}
