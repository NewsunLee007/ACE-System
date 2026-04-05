import React, { useState, useEffect } from 'react';
import {
  UserCircle,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  BookOpen,
  Calendar,
  TrendingUp,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Search,
  Phone,
  User
} from 'lucide-react';
import schoolData from '../data/schoolData';

const ParentPortal = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentParent, setCurrentParent] = useState(null);
  const [loginForm, setLoginForm] = useState({
    phone: '',
    password: '',
    studentCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('scores');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // 登录验证
  const handleLogin = (e) => {
    e.preventDefault();
    setLoginError('');

    const { phone, password, studentCode } = loginForm;

    if (!phone || !password) {
      setLoginError('请输入手机号和密码');
      return;
    }

    // 查找家长（通过手机号或学生学籍号）
    let parent = null;
    
    // 先通过手机号查找
    parent = schoolData.parents?.find(p => p.phone === phone);
    
    // 如果没找到，通过学生学籍号查找
    if (!parent && studentCode) {
      const student = schoolData.students?.find(s => s.student_code === studentCode);
      if (student) {
        parent = schoolData.parents?.find(p => 
          p.student_ids?.includes(student.id)
        );
      }
    }

    if (!parent) {
      setLoginError('未找到该家长信息，请检查手机号或学籍号');
      return;
    }

    // 验证密码（默认密码：手机号后6位）
    const defaultPassword = parent.phone.slice(-6);
    if (password !== defaultPassword && password !== parent.password) {
      setLoginError('密码错误');
      return;
    }

    // 登录成功
    setCurrentParent(parent);
    setIsLoggedIn(true);
    
    // 设置默认选中的学生
    if (parent.student_ids && parent.student_ids.length > 0) {
      const firstStudent = schoolData.getStudentById(parent.student_ids[0]);
      setSelectedStudent(firstStudent);
    }
  };

  // 退出登录
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentParent(null);
    setSelectedStudent(null);
    setLoginForm({ phone: '', password: '', studentCode: '' });
  };

  // 获取家长绑定的所有学生
  const getParentStudents = () => {
    if (!currentParent || !currentParent.student_ids) return [];
    return currentParent.student_ids
      .map(id => schoolData.getStudentById(id))
      .filter(Boolean);
  };

  // 获取学生的成绩
  const getStudentScores = (studentId) => {
    return (schoolData.scores || []).filter(s => s.student_id === studentId);
  };

  // 获取学生的考试列表
  const getStudentExams = (studentId) => {
    const scores = getStudentScores(studentId);
    const examIds = [...new Set(scores.map(s => s.exam_id))];
    return examIds.map(id => schoolData.exams?.find(e => e.id === id)).filter(Boolean);
  };

  // 登录界面
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <UserCircle className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">家长登录</h1>
            <p className="text-gray-500 mt-2">查询学生成绩与在校情况</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                手机号
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="tel"
                  value={loginForm.phone}
                  onChange={(e) => setLoginForm({ ...loginForm, phone: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="请输入家长手机号"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="默认密码：手机号后6位"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">初始密码为手机号后6位</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                学生学籍号（可选）
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={loginForm.studentCode}
                  onChange={(e) => setLoginForm({ ...loginForm, studentCode: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="如忘记手机号，可输入学生学籍号"
                />
              </div>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              登录
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>如有问题，请联系学校教务处</p>
          </div>
        </div>
      </div>
    );
  }

  // 主界面
  const students = getParentStudents();
  const scores = selectedStudent ? getStudentScores(selectedStudent.id) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-8 h-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-800">家长服务平台</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">{currentParent.name} ({currentParent.relation})</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                退出
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左侧：学生列表 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">我的学生</h2>
              <div className="space-y-3">
                {students.map(student => {
                  const cls = schoolData.getClassById(student.class_id);
                  return (
                    <button
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedStudent?.id === student.id
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      }`}
                    >
                      <p className="font-medium text-gray-800">{student.name}</p>
                      <p className="text-sm text-gray-500">
                        {cls ? schoolData.formatClassName(cls.id) : '未分配班级'}
                      </p>
                      <p className="text-xs text-gray-400">学号：{student.student_code}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右侧：成绩详情 */}
          <div className="lg:col-span-3">
            {selectedStudent ? (
              <div className="space-y-6">
                {/* 学生基本信息 */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">
                    {selectedStudent.name} 的成绩单
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">学籍号</p>
                      <p className="font-medium text-gray-800">{selectedStudent.student_code}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">班级</p>
                      <p className="font-medium text-gray-800">
                        {schoolData.getClassById(selectedStudent.class_id) 
                          ? schoolData.formatClassName(selectedStudent.class_id)
                          : '未分配'}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">性别</p>
                      <p className="font-medium text-gray-800">
                        {selectedStudent.gender === 1 ? '男' : '女'}
                      </p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">状态</p>
                      <p className="font-medium text-gray-800">{selectedStudent.status || '在读'}</p>
                    </div>
                  </div>
                </div>

                {/* 成绩列表 */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">考试成绩</h3>
                    <span className="text-sm text-gray-500">共 {scores.length} 条记录</span>
                  </div>

                  {scores.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">考试名称</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">学科</th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">分数</th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">满分</th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">班级排名</th>
                            <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">年级排名</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {scores.map((score, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{score.exam_name || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{score.subject_name || '-'}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2 py-1 rounded text-sm font-medium ${
                                  score.score >= 90 ? 'bg-green-100 text-green-800' :
                                  score.score >= 60 ? 'bg-blue-100 text-blue-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {score.score}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-gray-500">{score.full_score || 100}</td>
                              <td className="px-4 py-3 text-center text-sm text-gray-500">{score.class_rank || '-'}</td>
                              <td className="px-4 py-3 text-center text-sm text-gray-500">{score.grade_rank || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">暂无成绩记录</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <UserCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">请选择左侧学生查看成绩</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentPortal;
