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
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
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
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="headteacher" element={<HeadTeacherView />} />
            
            {/* Educational Management */}
            <Route path="educational/subjects" element={<SubjectManagement />} />
            <Route path="educational/role-settings" element={<RoleSettings />} />
            <Route path="educational/classes" element={<ClassManagement />} />
            <Route path="educational/teachers" element={<TeacherManagement />} />
            <Route path="educational/roles" element={<RoleManagement />} />
            <Route path="educational/students" element={<StudentManagement />} />
            <Route path="educational/parents" element={<ParentManagement />} />
            
            <Route path="exams" element={<ExamManagement />} />
            <Route path="analysis" element={<ScoreAnalysis />} />
            <Route path="parent-portal" element={<ParentPortal />} />
            <Route path="settings" element={<SystemSettings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
