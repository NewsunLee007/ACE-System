import React, { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import HeadTeacherView from './components/HeadTeacherView';
import ExamManagement from './components/ExamManagement';
import StudentManagement from './components/StudentManagement';
import TeacherManagement from './components/TeacherManagement';
import ClassManagement from './components/ClassManagement';
import RoleManagement from './components/RoleManagement';
import RoleSettings from './components/RoleSettings';
import SubjectManagement from './components/SubjectManagement';
import SubjectAnalysis from './components/SubjectAnalysis';
import ScoreAnalysis from './components/ScoreAnalysis';
import ParentManagement from './components/ParentManagement';
import StudentScoreDetail from './components/StudentScoreDetail';
import ParentH5Portal from './components/ParentH5Portal';
import ParentPortal from './components/ParentPortal';
import SystemSettings from './components/SystemSettings';
import { 
  LayoutDashboard, Users, Settings, LogOut, BookOpen, GraduationCap, 
  UserCircle, School, BarChart3, Heart, ChevronDown, ChevronRight,
  Briefcase, Award, Library
} from 'lucide-react';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [expandedMenus, setExpandedMenus] = useState(['educational']); // 默认展开教务管理

  const handleLogin = (userData) => {
    setUser(userData);
    setIsLoggedIn(true);
    // 存储用户信息到 localStorage
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', 'mock_token_' + Date.now());
  };

  const handleLogout = () => {
    setUser(null);
    setIsLoggedIn(false);
    setCurrentView('dashboard');
    // 清除 localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => 
      prev.includes(menuId) 
        ? prev.filter(id => id !== menuId)
        : [...prev, menuId]
    );
  };

  const isEducationalActive = ['subjects', 'roleSettings', 'classes', 'teachers', 'roles', 'students', 'parents'].includes(currentView);
  const isExamActive = ['exams'].includes(currentView);

  // 如果未登录，显示登录页面
  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 侧边导航栏 */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-50 flex flex-col">
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <h1 className="text-xl font-bold text-gray-800">新纪元教务平台</h1>
          <p className="text-xs text-gray-500 mt-1">瑞安市新纪元实验学校</p>
        </div>
        
        <nav className="p-4 flex-1 overflow-y-auto">
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  currentView === 'dashboard'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>教务处看板</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView('headteacher')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  currentView === 'headteacher'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Users className="w-5 h-5" />
                <span>班主任视图</span>
              </button>
            </li>
            
            {/* 教务管理折叠菜单 */}
            <li>
              <button
                onClick={() => toggleMenu('educational')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                  isEducationalActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5" />
                  <span>教务管理</span>
                </div>
                {expandedMenus.includes('educational') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              
              {/* 子菜单 - 按数据依赖关系排序 */}
              {expandedMenus.includes('educational') && (
                <ul className="mt-1 ml-4 space-y-1">
                  {/* 1. 学科管理 - 最基础数据 */}
                  <li>
                    <button
                      onClick={() => setCurrentView('subjects')}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                        currentView === 'subjects'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Library className="w-4 h-4" />
                      <span>1. 学科管理</span>
                    </button>
                  </li>
                  {/* 2. 角色设定 - 基础数据配置 */}
                  <li>
                    <button
                      onClick={() => setCurrentView('roleSettings')}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                        currentView === 'roleSettings'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Award className="w-4 h-4" />
                      <span>2. 角色设定</span>
                    </button>
                  </li>
                  {/* 3. 班级管理 - 基础数据 */}
                  <li>
                    <button
                      onClick={() => setCurrentView('classes')}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                        currentView === 'classes'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <School className="w-4 h-4" />
                      <span>3. 班级管理</span>
                    </button>
                  </li>
                  {/* 4. 教师管理 - 基础数据 */}
                  <li>
                    <button
                      onClick={() => setCurrentView('teachers')}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                        currentView === 'teachers'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <UserCircle className="w-4 h-4" />
                      <span>4. 教师管理</span>
                    </button>
                  </li>
                  {/* 5. 职务管理 - 关联数据 */}
                  <li>
                    <button
                      onClick={() => setCurrentView('roles')}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                        currentView === 'roles'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Briefcase className="w-4 h-4" />
                      <span>5. 职务管理</span>
                    </button>
                  </li>
                  {/* 6. 学生管理 - 依赖班级 */}
                  <li>
                    <button
                      onClick={() => setCurrentView('students')}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                        currentView === 'students'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>6. 学生管理</span>
                    </button>
                  </li>
                  {/* 7. 家长管理 - 依赖学生 */}
                  <li>
                    <button
                      onClick={() => setCurrentView('parents')}
                      className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${
                        currentView === 'parents'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Heart className="w-4 h-4" />
                      <span>7. 家长管理</span>
                    </button>
                  </li>
                </ul>
              )}
            </li>

            {/* 考务管理 - 独立一级菜单 */}
            <li>
              <button
                onClick={() => setCurrentView('exams')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isExamActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <BookOpen className="w-5 h-5" />
                <span>考务管理</span>
              </button>
            </li>

            <li>
              <button
                onClick={() => setCurrentView('scoreAnalysis')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  currentView === 'scoreAnalysis'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                <span>成绩分析</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView('parentPortal')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  currentView === 'parentPortal'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Heart className="w-5 h-5" />
                <span>家长门户</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  currentView === 'settings'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Settings className="w-5 h-5" />
                <span>系统设置</span>
              </button>
            </li>
          </ul>
        </nav>

        {/* 用户信息 */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-semibold">
                {user?.real_name?.charAt(0) || '用'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{user?.real_name || '用户'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.role_name || '普通用户'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="ml-64">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'headteacher' && <HeadTeacherView />}
        {currentView === 'subjects' && <SubjectManagement />}
        {currentView === 'roleSettings' && <RoleSettings />}
        {currentView === 'classes' && <ClassManagement />}
        {currentView === 'teachers' && <TeacherManagement />}
        {currentView === 'roles' && <RoleManagement />}
        {currentView === 'students' && <StudentManagement />}
        {currentView === 'parents' && <ParentManagement />}
        {currentView === 'exams' && <ExamManagement />}
        {currentView === 'scoreAnalysis' && <ScoreAnalysis currentUser={user} />}
        {currentView === 'parentPortal' && <ParentPortal />}
        {currentView === 'settings' && <SystemSettings />}
      </main>
    </div>
  );
}

export default App;
