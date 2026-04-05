import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import Layout from './components/Layout';
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
import ScoreAnalysis from './components/ScoreAnalysis';
import ParentManagement from './components/ParentManagement';
import ParentH5Portal from './components/ParentH5Portal';
import ParentPortal from './components/ParentPortal';
import SystemSettings from './components/SystemSettings';
import { CommandMenu } from './components/CommandMenu';

// Protected Route Wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }
  
  try {
    const user = JSON.parse(userStr);
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role_name)) {
      // 如果是班主任，重定向到班主任视图
      if (user.role_name === '班主任') {
        return <Navigate to="/headteacher" replace />;
      }
      return <Navigate to="/login" replace />;
    }
  } catch (e) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <CommandMenu />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/parent-h5" element={<ParentH5Portal />} />
          <Route path="/parent-portal" element={<ParentPortal />} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><Dashboard /></ProtectedRoute>} />
            <Route path="headteacher" element={<ProtectedRoute allowedRoles={['班主任', '教务处主任', '管理员']}><HeadTeacherView /></ProtectedRoute>} />
            
            {/* Educational Management */}
            <Route path="educational/subjects" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><SubjectManagement /></ProtectedRoute>} />
            <Route path="educational/role-settings" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><RoleSettings /></ProtectedRoute>} />
            <Route path="educational/classes" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><ClassManagement /></ProtectedRoute>} />
            <Route path="educational/teachers" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><TeacherManagement /></ProtectedRoute>} />
            <Route path="educational/roles" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><RoleManagement /></ProtectedRoute>} />
            <Route path="educational/students" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><StudentManagement /></ProtectedRoute>} />
            <Route path="educational/parents" element={<ProtectedRoute allowedRoles={['教务处主任', '管理员']}><ParentManagement /></ProtectedRoute>} />
            
            <Route path="exams" element={<ProtectedRoute allowedRoles={['班主任', '教务处主任', '管理员']}><ExamManagement /></ProtectedRoute>} />
            <Route path="analysis" element={<ProtectedRoute allowedRoles={['班主任', '教务处主任', '管理员']}><ScoreAnalysis /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute allowedRoles={['管理员', '教务处主任']}><SystemSettings /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
