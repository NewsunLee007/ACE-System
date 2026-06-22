import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import GradeLeaderDashboard from './components/GradeLeaderDashboard';
import HeadTeacherView from './components/HeadTeacherView';
import ExamManagement from './components/ExamManagement';
import StudentManagement from './components/StudentManagement';
import TeacherManagement from './components/TeacherManagement';
import ClassManagement from './components/ClassManagement';
import RoleManagement from './components/RoleManagement';
import RoleSettings from './components/RoleSettings';
import SubjectManagement from './components/SubjectManagement';
import ScoreAnalysis from './components/ScoreAnalysis';
import ParentManagement from './components/ParentManagement';
import ParentH5Portal from './components/ParentH5Portal';
import ParentPortal from './components/ParentPortal';
import SystemSettings from './components/SystemSettings';
import { CommandMenu } from './components/CommandMenu';
import { ResearchDashboard, TeacherDashboard, ParentDashboard } from './components/RoleDashboards';
import { ToastProvider } from './components/ui/toast';
import { ConfirmProvider } from './components/ui/confirm';
import { getDefaultPathForRole, getUserRole } from './lib/navigation';

const readStoredUser = () => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch (error) {
    return null;
  }
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const user = readStoredUser();
  
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  
  const role = getUserRole(user);
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    const fallbackPath = getDefaultPathForRole(role);
    const safeFallbackPath = fallbackPath && fallbackPath !== location.pathname ? fallbackPath : '/login';
    return <Navigate to={safeFallbackPath} replace />;
  }

  return children;
};

const RoleLandingRedirect = () => {
  const user = readStoredUser();
  return <Navigate to={getDefaultPathForRole(getUserRole(user))} replace />;
};

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <CommandMenu />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/parent-h5" element={<ParentH5Portal />} />
              <Route path="/parent-portal" element={<ParentPortal />} />

              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<RoleLandingRedirect />} />
                <Route path="principal-dashboard" element={<ProtectedRoute allowedRoles={['校长', 'principal', '教务处主任', '管理员']}><Dashboard title="校长看板" description="三个年段完整数据" defaultLayer="ALL" /></ProtectedRoute>} />
                <Route path="vice-principal-dashboard" element={<ProtectedRoute allowedRoles={['副校长', 'vice_principal', '教务处主任', '管理员']}><Dashboard title="副校长看板" description="三个年段完整数据" defaultLayer="ALL" /></ProtectedRoute>} />
                <Route path="dashboard" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><Dashboard /></ProtectedRoute>} />
                <Route path="grade-leader-dashboard" element={<ProtectedRoute allowedRoles={['年段长', '段长', '副段长', 'grade_leader', 'grade_deputy', '教务处主任', '管理员']}><GradeLeaderDashboard /></ProtectedRoute>} />
                <Route path="headteacher" element={<ProtectedRoute allowedRoles={['班主任', '教务处主任', '管理员']}><HeadTeacherView /></ProtectedRoute>} />
                <Route path="research-dashboard" element={<ProtectedRoute allowedRoles={['教研组长', '备课组长', '教务处主任', '管理员']}><ResearchDashboard /></ProtectedRoute>} />
                <Route path="teacher-dashboard" element={<ProtectedRoute allowedRoles={['科任教师', '班主任', '教务处主任', '管理员']}><TeacherDashboard /></ProtectedRoute>} />
                <Route path="parent-dashboard" element={<ProtectedRoute allowedRoles={['家长', '教务处主任', '管理员']}><ParentDashboard /></ProtectedRoute>} />

                {/* Educational Management */}
                <Route path="educational/subjects" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><SubjectManagement /></ProtectedRoute>} />
                <Route path="educational/role-settings" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><RoleSettings /></ProtectedRoute>} />
                <Route path="educational/classes" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><ClassManagement /></ProtectedRoute>} />
                <Route path="educational/teachers" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><TeacherManagement /></ProtectedRoute>} />
                <Route path="educational/roles" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><RoleManagement /></ProtectedRoute>} />
                <Route path="educational/students" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><StudentManagement /></ProtectedRoute>} />
                <Route path="educational/parents" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><ParentManagement /></ProtectedRoute>} />

                <Route path="exams" element={<ProtectedRoute allowedRoles={['班主任', '教务处主任', '管理员']}><ExamManagement /></ProtectedRoute>} />
                <Route path="analysis" element={<ProtectedRoute allowedRoles={['校长', '副校长', 'principal', 'vice_principal', '年段长', '段长', '副段长', 'grade_leader', 'grade_deputy', '科任教师', '班主任', '备课组长', '教研组长', '教务处主任', '管理员']}><ScoreAnalysis /></ProtectedRoute>} />
                <Route path="settings" element={<ProtectedRoute allowedRoles={['管理员', '教务处主任']}><SystemSettings /></ProtectedRoute>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
