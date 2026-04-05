import React, { useState, useEffect } from 'react';
import { 
  Settings, Shield, Users, Database, Bell, Mail, 
  Save, RefreshCw, CheckCircle, AlertTriangle, 
  Key, Lock, Eye, EyeOff, ChevronRight, Server,
  FileText, Download, Upload, Trash2, Plus, X,
  GraduationCap, Calendar, ArrowUpCircle, AlertCircle
} from 'lucide-react';
import schoolData from '../data/schoolData';

const SystemSettings = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  
  // 学年管理状态
  const [academicYearInfo, setAcademicYearInfo] = useState({
    currentYear: schoolData.config.currentAcademicYear,
    currentSemester: schoolData.config.currentSemester,
    displayYear: schoolData.getCurrentAcademicYearDisplay(),
    displaySemester: schoolData.getCurrentSemesterDisplay()
  });
  
  // 通用设置
  const [generalSettings, setGeneralSettings] = useState({
    schoolName: '瑞安市新纪元实验学校',
    schoolCode: 'RAXXJ',
    academicYear: academicYearInfo.displayYear,
    currentSemester: academicYearInfo.currentSemester === 1 ? '第一学期' : '第二学期',
    systemName: '新纪元教务大数据平台',
    logoUrl: '/logo.png',
    footerText: '© 2024 瑞安市新纪元实验学校 版权所有'
  });

  // 安全设置
  const [securitySettings, setSecuritySettings] = useState({
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecial: true,
    loginMaxAttempts: 5,
    lockoutDuration: 30,
    sessionTimeout: 120,
    enableTwoFactor: false,
    enableLoginLog: true
  });

  // 通知设置
  const [notificationSettings, setNotificationSettings] = useState({
    enableEmail: true,
    enableSms: false,
    examResultNotify: true,
    systemAlertNotify: true,
    weeklyReportNotify: true,
    emailServer: 'smtp.school.edu.cn',
    emailPort: '587',
    emailUsername: 'system@school.edu.cn'
  });

  // 数据备份设置
  const [backupSettings, setBackupSettings] = useState({
    autoBackup: true,
    backupFrequency: 'daily',
    backupTime: '02:00',
    backupRetention: 30,
    backupLocation: '/backup/edudata',
    lastBackup: '2024-01-15 02:00:00'
  });

  // 从schoolData加载角色
  const [roles, setRoles] = useState([]);
  
  useEffect(() => {
    // 转换schoolData中的角色定义
    const teacherRoles = schoolData.teacherRoles.map(role => ({
      id: role.id,
      name: role.name,
      color: getRoleColor(role.id),
      level: role.level,
      permissions: role.permissions,
      userCount: schoolData.teachers.filter(t => t.roles?.includes(role.id)).length
    }));
    setRoles(teacherRoles);
  }, []);

  // 获取角色对应的颜色
  const getRoleColor = (roleId) => {
    const colorMap = {
      'subject_teacher': 'cyan',
      'head_teacher': 'green',
      'lesson_leader': 'blue',
      'research_leader': 'purple',
      'grade_leader': 'orange',
      'grade_deputy': 'yellow',
      'dept_director': 'indigo',
      'dept_deputy': 'pink',
      'vice_principal': 'red',
      'principal': 'red',
      'admin': 'slate'
    };
    return colorMap[roleId] || 'gray';
  };

  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  
  // 年级升级确认弹窗
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradePreview, setUpgradePreview] = useState(null);

  const handleSave = async (section) => {
    setLoading(true);
    setSaveStatus(null);
    
    // 模拟保存
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setLoading(false);
    setSaveStatus('success');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  // 处理年级升级预览
  const handlePreviewUpgrade = () => {
    const currentYear = schoolData.config.currentAcademicYear;
    const nextYear = currentYear + 1;
    
    // 统计各年级变化
    const gradeStats = {};
    schoolData.classes.forEach(cls => {
      const currentGradeInfo = schoolData.getClassGradeInfo(cls.id);
      if (currentGradeInfo?.isActive) {
        const gradeName = currentGradeInfo.name;
        if (!gradeStats[gradeName]) {
          gradeStats[gradeName] = { count: 0, nextGrade: '' };
        }
        gradeStats[gradeName].count++;
        
        // 计算升级后的年级
        const nextGradeLevel = currentGradeInfo.grade + 1;
        if (nextGradeLevel <= 9) {
          gradeStats[gradeName].nextGrade = schoolData.config.gradeConfig.gradeNames[nextGradeLevel];
        } else {
          gradeStats[gradeName].nextGrade = '已毕业';
        }
      }
    });
    
    setUpgradePreview({
      currentYear: `${currentYear}-${currentYear + 1}`,
      nextYear: `${nextYear}-${nextYear + 1}`,
      gradeStats: gradeStats
    });
    setShowUpgradeModal(true);
  };

  // 执行年级升级
  const handleExecuteUpgrade = () => {
    const result = schoolData.upgradeAllGrades();
    
    // 更新本地状态
    setAcademicYearInfo({
      currentYear: schoolData.config.currentAcademicYear,
      currentSemester: schoolData.config.currentSemester,
      displayYear: schoolData.getCurrentAcademicYearDisplay(),
      displaySemester: schoolData.getCurrentSemesterDisplay()
    });
    
    setGeneralSettings(prev => ({
      ...prev,
      academicYear: schoolData.getCurrentAcademicYearDisplay(),
      currentSemester: '第一学期'
    }));
    
    setShowUpgradeModal(false);
    alert(result.message);
  };

  // 切换学期
  const handleSwitchSemester = () => {
    const result = schoolData.switchSemester();
    
    setAcademicYearInfo({
      currentYear: schoolData.config.currentAcademicYear,
      currentSemester: schoolData.config.currentSemester,
      displayYear: schoolData.getCurrentAcademicYearDisplay(),
      displaySemester: schoolData.getCurrentSemesterDisplay()
    });
    
    setGeneralSettings(prev => ({
      ...prev,
      academicYear: schoolData.getCurrentAcademicYearDisplay(),
      currentSemester: schoolData.config.currentSemester === 1 ? '第一学期' : '第二学期'
    }));
    
    alert(result.message);
  };

  const handleBackupNow = async () => {
    if (window.confirm('确定要立即执行数据备份吗？')) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 2000));
      setBackupSettings({
        ...backupSettings,
        lastBackup: new Date().toLocaleString('zh-CN')
      });
      setLoading(false);
      window.alert('备份完成！');
    }
  };

  const colorOptions = [
    { value: 'red', label: '红色', class: 'bg-red-500' },
    { value: 'orange', label: '橙色', class: 'bg-orange-500' },
    { value: 'yellow', label: '黄色', class: 'bg-yellow-500' },
    { value: 'green', label: '绿色', class: 'bg-green-500' },
    { value: 'cyan', label: '青色', class: 'bg-cyan-500' },
    { value: 'blue', label: '蓝色', class: 'bg-blue-500' },
    { value: 'indigo', label: '靛蓝', class: 'bg-indigo-500' },
    { value: 'purple', label: '紫色', class: 'bg-purple-500' },
    { value: 'pink', label: '粉色', class: 'bg-pink-500' },
    { value: 'gray', label: '灰色', class: 'bg-gray-500' },
    { value: 'slate', label: '石板色', class: 'bg-slate-500' }
  ];

  const permissionOptions = [
    { id: 'all_permissions', label: '所有权限' },
    { id: 'system_config', label: '系统配置' },
    { id: 'view_own_class', label: '查看任教班级' },
    { id: 'view_own_students', label: '查看任教学生' },
    { id: 'input_scores', label: '成绩录入' },
    { id: 'manage_class_students', label: '管理班级学生' },
    { id: 'view_class_reports', label: '查看班级报告' },
    { id: 'view_subject_classes', label: '查看学科班级' },
    { id: 'view_subject_scores', label: '查看学科成绩' },
    { id: 'manage_subject_materials', label: '管理学科资料' },
    { id: 'view_grade_subject', label: '查看年级学科' },
    { id: 'manage_subject_teachers', label: '管理学科教师' },
    { id: 'approve_subject_activities', label: '审批学科活动' },
    { id: 'view_grade_all', label: '查看年级全部' },
    { id: 'manage_grade_teachers', label: '管理年级教师' },
    { id: 'approve_grade_activities', label: '审批年级活动' },
    { id: 'view_grade_reports', label: '查看年级报告' },
    { id: 'view_dept_all', label: '查看科室全部' },
    { id: 'manage_dept_staff', label: '管理科室人员' },
    { id: 'approve_dept_activities', label: '审批科室活动' },
    { id: 'view_school_all', label: '查看全校数据' },
    { id: 'manage_departments', label: '管理各部门' },
    { id: 'approve_school_activities', label: '审批学校活动' }
  ];

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      {/* 学年管理卡片 */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold mb-2">学年管理</h3>
            <p className="text-blue-100">当前学年：{academicYearInfo.displayYear}</p>
            <p className="text-blue-100">当前学期：第{academicYearInfo.currentSemester}学期</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSwitchSemester}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors"
            >
              <Calendar className="h-5 w-5 mr-2" />
              切换学期
            </button>
            <button
              onClick={handlePreviewUpgrade}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-yellow-400 text-yellow-900 rounded-lg hover:bg-yellow-300 transition-colors font-medium"
            >
              <ArrowUpCircle className="h-5 w-5 mr-2" />
              年级升级
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">学校信息</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">学校名称</label>
            <input
              type="text"
              value={generalSettings.schoolName}
              onChange={(e) => setGeneralSettings({...generalSettings, schoolName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">学校代码</label>
            <input
              type="text"
              value={generalSettings.schoolCode}
              onChange={(e) => setGeneralSettings({...generalSettings, schoolCode: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">当前学年</label>
            <input
              type="text"
              value={generalSettings.academicYear}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">通过"年级升级"按钮自动更新</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">当前学期</label>
            <input
              type="text"
              value={generalSettings.currentSemester}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
            />
            <p className="text-xs text-gray-500 mt-1">通过"切换学期"按钮自动更新</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">系统信息</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">系统名称</label>
            <input
              type="text"
              value={generalSettings.systemName}
              onChange={(e) => setGeneralSettings({...generalSettings, systemName: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">页脚文本</label>
            <input
              type="text"
              value={generalSettings.footerText}
              onChange={(e) => setGeneralSettings({...generalSettings, footerText: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => handleSave('general')}
          disabled={loading}
          className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-5 w-5 mr-2 animate-spin" /> : <Save className="h-5 w-5 mr-2" />}
          保存设置
        </button>
      </div>

      {/* 年级升级确认弹窗 */}
      {showUpgradeModal && upgradePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                年级升级确认
              </h3>
              <button onClick={() => setShowUpgradeModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>警告：</strong> 此操作将升级所有学生的年级信息，请确保在当前学年结束时执行。
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <span className="text-gray-600">当前学年</span>
                  <span className="font-medium">{upgradePreview.currentYear}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                  <span className="text-blue-600">升级后学年</span>
                  <span className="font-bold text-blue-700">{upgradePreview.nextYear}</span>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">年级变化预览</h4>
                <div className="space-y-2">
                  {Object.entries(upgradePreview.gradeStats).map(([grade, info]) => (
                    <div key={grade} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                      <span>{grade}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{info.count}个班</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium text-blue-600">{info.nextGrade}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleExecuteUpgrade}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
              >
                确认升级
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">密码策略</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最小密码长度</label>
              <input
                type="number"
                min="6"
                max="20"
                value={securitySettings.passwordMinLength}
                onChange={(e) => setSecuritySettings({...securitySettings, passwordMinLength: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={securitySettings.passwordRequireUppercase}
                onChange={(e) => setSecuritySettings({...securitySettings, passwordRequireUppercase: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">要求包含大写字母</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={securitySettings.passwordRequireNumber}
                onChange={(e) => setSecuritySettings({...securitySettings, passwordRequireNumber: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">要求包含数字</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={securitySettings.passwordRequireSpecial}
                onChange={(e) => setSecuritySettings({...securitySettings, passwordRequireSpecial: e.target.checked})}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">要求包含特殊字符</span>
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">登录安全</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">最大登录尝试次数</label>
            <input
              type="number"
              value={securitySettings.loginMaxAttempts}
              onChange={(e) => setSecuritySettings({...securitySettings, loginMaxAttempts: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">锁定时间（分钟）</label>
            <input
              type="number"
              value={securitySettings.lockoutDuration}
              onChange={(e) => setSecuritySettings({...securitySettings, lockoutDuration: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">会话超时（分钟）</label>
            <input
              type="number"
              value={securitySettings.sessionTimeout}
              onChange={(e) => setSecuritySettings({...securitySettings, sessionTimeout: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={securitySettings.enableTwoFactor}
              onChange={(e) => setSecuritySettings({...securitySettings, enableTwoFactor: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">启用双因素认证</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={securitySettings.enableLoginLog}
              onChange={(e) => setSecuritySettings({...securitySettings, enableLoginLog: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">记录登录日志</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => handleSave('security')}
          disabled={loading}
          className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-5 w-5 mr-2 animate-spin" /> : <Save className="h-5 w-5 mr-2" />}
          保存设置
        </button>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">通知渠道</h3>
        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={notificationSettings.enableEmail}
              onChange={(e) => setNotificationSettings({...notificationSettings, enableEmail: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">启用邮件通知</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={notificationSettings.enableSms}
              onChange={(e) => setNotificationSettings({...notificationSettings, enableSms: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">启用短信通知</span>
          </label>
        </div>
      </div>

      {notificationSettings.enableEmail && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">邮件服务器设置</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SMTP服务器</label>
              <input
                type="text"
                value={notificationSettings.emailServer}
                onChange={(e) => setNotificationSettings({...notificationSettings, emailServer: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">端口</label>
              <input
                type="text"
                value={notificationSettings.emailPort}
                onChange={(e) => setNotificationSettings({...notificationSettings, emailPort: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input
                type="text"
                value={notificationSettings.emailUsername}
                onChange={(e) => setNotificationSettings({...notificationSettings, emailUsername: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">通知事件</h3>
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={notificationSettings.examResultNotify}
              onChange={(e) => setNotificationSettings({...notificationSettings, examResultNotify: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">考试成绩发布通知</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={notificationSettings.systemAlertNotify}
              onChange={(e) => setNotificationSettings({...notificationSettings, systemAlertNotify: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">系统告警通知</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={notificationSettings.weeklyReportNotify}
              onChange={(e) => setNotificationSettings({...notificationSettings, weeklyReportNotify: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">周报生成通知</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => handleSave('notification')}
          disabled={loading}
          className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? <RefreshCw className="h-5 w-5 mr-2 animate-spin" /> : <Save className="h-5 w-5 mr-2" />}
          保存设置
        </button>
      </div>
    </div>
  );

  const renderBackupSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">自动备份</h3>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={backupSettings.autoBackup}
              onChange={(e) => setBackupSettings({...backupSettings, autoBackup: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">启用自动备份</span>
          </label>
        </div>
        
        {backupSettings.autoBackup && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">备份频率</label>
              <select
                value={backupSettings.backupFrequency}
                onChange={(e) => setBackupSettings({...backupSettings, backupFrequency: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="hourly">每小时</option>
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">备份时间</label>
              <input
                type="time"
                value={backupSettings.backupTime}
                onChange={(e) => setBackupSettings({...backupSettings, backupTime: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">保留天数</label>
              <input
                type="number"
                value={backupSettings.backupRetention}
                onChange={(e) => setBackupSettings({...backupSettings, backupRetention: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">备份路径</label>
              <input
                type="text"
                value={backupSettings.backupLocation}
                onChange={(e) => setBackupSettings({...backupSettings, backupLocation: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 数据导出 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">数据导出（备份）</h3>
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-4">
            导出所有数据（包括学生、班级、教师、考试、成绩等）到JSON文件，可用于数据备份或迁移。
          </p>
          <button
            onClick={() => {
              const dataStr = JSON.stringify(schoolData, null, 2);
              const blob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `school_data_backup_${new Date().toISOString().slice(0, 10)}.json`;
              link.click();
              URL.revokeObjectURL(url);
              setSaveStatus({ type: 'success', message: '数据导出成功！' });
              setTimeout(() => setSaveStatus(null), 3000);
            }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-5 w-5 mr-2" />
            导出所有数据
          </button>
        </div>
      </div>

      {/* 数据导入 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">数据导入（恢复）</h3>
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-sm text-gray-600 mb-4">
            <strong>警告：</strong>导入数据将覆盖当前所有数据，请确保已备份重要数据！
          </p>
          <div className="flex gap-4">
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const data = JSON.parse(event.target.result);
                      if (window.confirm('确定要导入数据吗？这将覆盖当前所有数据！')) {
                        Object.assign(schoolData, data);
                        setSaveStatus({ type: 'success', message: '数据导入成功！请刷新页面。' });
                        setTimeout(() => {
                          window.location.reload();
                        }, 2000);
                      }
                    } catch (error) {
                      setSaveStatus({ type: 'error', message: '数据格式错误：' + error.message });
                    }
                  };
                  reader.readAsText(file);
                }
              }}
              className="hidden"
              id="data-import"
            />
            <label
              htmlFor="data-import"
              className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors cursor-pointer"
            >
              <Upload className="h-5 w-5 mr-2" />
              选择备份文件
            </label>
          </div>
        </div>
      </div>

      {/* 数据清理 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">数据清理</h3>
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-gray-600 mb-4">
            <strong>危险操作：</strong>清除所有数据将无法恢复，请确保已备份！
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (window.confirm('确定要清除所有数据吗？此操作无法撤销！')) {
                if (window.confirm('再次确认：您真的要删除所有数据吗？')) {
                  localStorage.removeItem('new_century_school_data');
                  setSaveStatus({ type: 'success', message: '数据已清除，页面将刷新...' });
                  setTimeout(() => {
                    window.location.reload();
                  }, 2000);
                }
              }
            }}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="h-5 w-5 mr-2" />
            清除所有数据
          </button>
        </div>
      </div>
    </div>
  );

  const renderRoleSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">教师角色权限管理</h3>
            <p className="text-sm text-gray-500 mt-1">系统预定义角色，级别越高权限越大</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">级别</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">标识颜色</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">教师数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">权限数量</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {roles.sort((a, b) => b.level - a.level).map((role) => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`h-3 w-3 rounded-full bg-${role.color}-500 mr-2`}></div>
                      <span className="text-sm font-medium text-gray-900">{role.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      L{role.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${role.color}-100 text-${role.color}-800`}>
                      {colorOptions.find(c => c.value === role.color)?.label || role.color}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {role.userCount} 人
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {role.permissions.length} 项
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => { setEditingRole(role); setShowRoleModal(true); }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      查看权限
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 角色权限说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">角色级别说明</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-blue-700">
          <div>L9: 系统管理员 - 最高权限</div>
          <div>L8: 校长 - 全校管理</div>
          <div>L7: 副校长 - 分管管理</div>
          <div>L6: 科室主任/副主任 - 科室管理</div>
          <div>L5: 年段长/副段长 - 年级管理</div>
          <div>L4: 教研组长 - 学科管理</div>
          <div>L3: 备课组长 - 备课组管理</div>
          <div>L2: 班主任 - 班级管理</div>
          <div>L1: 科任教师 - 基础教学</div>
        </div>
      </div>

      {/* 查看角色权限模态框 */}
      {showRoleModal && editingRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{editingRole.name} - 权限详情</h3>
                <p className="text-sm text-gray-500">级别: L{editingRole.level}</p>
              </div>
              <button onClick={() => setShowRoleModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-3">
                {editingRole.permissions.map((perm, index) => {
                  const permInfo = permissionOptions.find(p => p.id === perm);
                  return (
                    <div key={index} className="flex items-center p-2 bg-gray-50 rounded">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      <span className="text-sm text-gray-700">{permInfo?.label || perm}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const tabs = [
    { id: 'general', label: '通用设置', icon: Settings },
    { id: 'security', label: '安全设置', icon: Shield },
    { id: 'notification', label: '通知设置', icon: Bell },
    { id: 'backup', label: '数据备份', icon: Database },
    { id: 'roles', label: '角色权限', icon: Users }
  ];

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
        <p className="text-gray-500 mt-1">配置系统参数、安全策略、学年管理和权限管理</p>
      </div>

      {/* 保存状态提示 */}
      {saveStatus === 'success' && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
          <CheckCircle className="h-5 w-5 mr-2" />
          设置已保存成功！
        </div>
      )}

      {/* 标签页 */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="p-6">
          {activeTab === 'general' && renderGeneralSettings()}
          {activeTab === 'security' && renderSecuritySettings()}
          {activeTab === 'notification' && renderNotificationSettings()}
          {activeTab === 'backup' && renderBackupSettings()}
          {activeTab === 'roles' && renderRoleSettings()}
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
