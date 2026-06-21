import React, { useMemo, useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LogOut, ChevronDown, ChevronRight,
  Eye, Menu, Moon, Sun, Search
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { getNavigationForRole, getUserRole } from '../lib/navigation';
import {
  clearStoredDashboardPreviewRole,
  DASHBOARD_PREVIEW_OPTIONS,
  getDashboardPreviewOption,
  getStoredDashboardPreviewRole,
  isDashboardPreviewController,
  setStoredDashboardPreviewRole,
} from '../lib/rolePreview';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(() => (
    typeof window === 'undefined' ? true : window.innerWidth >= 768
  ));
  const [expandedMenus, setExpandedMenus] = useState([]);
  const [activePreviewRole, setActivePreviewRole] = useState(() => getStoredDashboardPreviewRole());
  const filteredNavigation = useMemo(() => getNavigationForRole(getUserRole(user)), [user]);
  const canPreviewDashboards = isDashboardPreviewController(user);
  const activePreviewOption = getDashboardPreviewOption(activePreviewRole);

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

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    const activeMenuPaths = filteredNavigation
      .filter(item => item.children?.some(child => location.pathname.startsWith(child.path)))
      .map(item => item.path);

    if (activeMenuPaths.length) {
      setExpandedMenus(prev => (
        activeMenuPaths.every(path => prev.includes(path))
          ? prev
          : [...new Set([...prev, ...activeMenuPaths])]
      ));
    }
  }, [location.pathname, filteredNavigation]);

  useEffect(() => {
    if (user && !canPreviewDashboards && activePreviewRole !== 'actual') {
      clearStoredDashboardPreviewRole();
      setActivePreviewRole('actual');
    }
  }, [activePreviewRole, canPreviewDashboards, user]);

  const handleLogout = () => {
    clearStoredDashboardPreviewRole();
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
  const isNavigationItemActive = (item) => (
    item.children
      ? item.children.some(child => isRouteActive(child.path)) || isRouteActive(item.path)
      : isRouteActive(item.path)
  );

  const handlePreviewRoleChange = (event) => {
    const roleId = event.target.value;
    setStoredDashboardPreviewRole(roleId);
    setActivePreviewRole(roleId);

    const option = getDashboardPreviewOption(roleId);
    if (option.path && location.pathname !== option.path) {
      navigate(option.path);
    }
  };

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
          {canPreviewDashboards && (
            <div className="hidden lg:flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
              <Eye className="h-4 w-4" />
              <span className="font-medium">看板预览</span>
              <select
                value={activePreviewRole}
                onChange={handlePreviewRoleChange}
                className="bg-transparent text-sm font-medium outline-none"
                aria-label="切换看板预览角色"
              >
                {DASHBOARD_PREVIEW_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
          )}

          <button 
            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            onClick={() => document.dispatchEvent(new CustomEvent('ace:open-command-menu'))}
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
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activePreviewRole !== 'actual' && canPreviewDashboards
                  ? `预览：${activePreviewOption.label}视图`
                  : (user?.role_name || '管理员')}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center border border-blue-200 dark:border-blue-800">
              <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                {user?.real_name?.charAt(0) || 'A'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
              title="退出登录"
              aria-label="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
            {filteredNavigation.map((item) => (
              <div key={item.path}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleMenu(item.path)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                        isNavigationItemActive(item)
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
                              isRouteActive(child.path)
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
                      isRouteActive(item.path)
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
