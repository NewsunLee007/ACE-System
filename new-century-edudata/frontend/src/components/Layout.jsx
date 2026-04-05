import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Settings, LogOut, BookOpen, GraduationCap, 
  UserCircle, School, BarChart3, Heart, ChevronDown, ChevronRight,
  Briefcase, Award, Library, Menu, Moon, Sun, Search
} from 'lucide-react';
import { useTheme } from 'next-themes';

const navigationConfig = [
  { path: '/dashboard', label: '教务大屏', icon: LayoutDashboard },
  { path: '/headteacher', label: '班主任视图', icon: Users },
  {
    path: '/educational',
    label: '教务管理',
    icon: Briefcase,
    children: [
      { path: '/educational/subjects', label: '学科管理', icon: Library },
      { path: '/educational/role-settings', label: '角色设定', icon: Award },
      { path: '/educational/classes', label: '班级管理', icon: School },
      { path: '/educational/teachers', label: '教师管理', icon: UserCircle },
      { path: '/educational/roles', label: '职务管理', icon: Briefcase },
      { path: '/educational/students', label: '学生管理', icon: GraduationCap },
      { path: '/educational/parents', label: '家长管理', icon: Heart },
    ]
  },
  { path: '/exams', label: '考务管理', icon: BookOpen },
  { path: '/analysis', label: '成绩分析', icon: BarChart3 },
  { path: '/parent-portal', label: '家长门户', icon: Heart },
  { path: '/settings', label: '系统设置', icon: Settings },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenus, setExpandedMenus] = useState(['/educational']);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/login');
  };

  const toggleMenu = (path) => {
    setExpandedMenus(prev => 
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const isRouteActive = (path) => location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Top Navigation */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-50 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold">ACE</span>
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 hidden sm:block">新纪元教务平台</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          >
            <Search className="w-4 h-4" />
            <span>搜索...</span>
            <kbd className="ml-2 px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs font-mono">⌘K</kbd>
          </button>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-700">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{user?.real_name || 'Admin'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role_name || '管理员'}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center border border-blue-200 dark:border-blue-800 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all" onClick={handleLogout} title="点击登出">
              <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                {user?.real_name?.charAt(0) || 'A'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Left Sidebar & Main Content */}
      <div className="pt-16 flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside 
          className={`fixed md:relative flex-shrink-0 w-64 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 z-40 overflow-y-auto
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:w-0 md:-translate-x-full'}
          `}
        >
          <nav className="p-4 space-y-1">
            {navigationConfig.map((item) => (
              <div key={item.path}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleMenu(item.path)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                        isRouteActive(item.path)
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {expandedMenus.includes(item.path) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    {expandedMenus.includes(item.path) && (
                      <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 dark:border-slate-800 pl-2">
                        {item.children.map(child => (
                          <Link
                            key={child.path}
                            to={child.path}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm ${
                              location.pathname === child.path
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                          >
                            <child.icon className="w-4 h-4" />
                            <span>{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    to={item.path}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                      location.pathname === item.path
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className={`flex-1 h-full overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950 transition-all ${!isSidebarOpen && 'w-full'}`}>
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>

        {/* Overlay for mobile sidebar */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 dark:bg-slate-900/80 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
}