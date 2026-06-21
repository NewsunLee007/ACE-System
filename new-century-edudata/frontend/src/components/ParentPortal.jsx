import React, { useState } from 'react';
import {
  UserCircle,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  BookOpen,
  LogOut,
  User
} from 'lucide-react';
import {
  authenticateParentStudent,
  fetchParentStudentExams,
  fetchParentStudentReport
} from '../lib/parentPortalApi';

const buildStudentFromReport = (report) => {
  if (!report) return null;
  return {
    id: report.student_id,
    name: report.student_name,
    student_code: report.student_code,
    class_name: report.class_name,
    current_term: report.current_term,
    latest_exam_name: report.latest_exam?.exam_name || '',
    status: '已验证'
  };
};

const buildScoreRowsFromExams = (examPayload) => (
  (examPayload?.exams || []).flatMap((exam) => (
    Object.entries(exam.subjects || {}).map(([subject, score]) => ({
      exam_id: exam.exam_id,
      exam_name: exam.exam_name,
      subject_name: subject,
      score: Number(score),
      full_score: '-',
      class_rank: exam.class_rank || '-',
      grade_rank: '-'
    }))
  ))
);

const ParentPortal = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [studentReport, setStudentReport] = useState(null);
  const [scoreRows, setScoreRows] = useState([]);
  const [loginForm, setLoginForm] = useState({
    studentName: '',
    className: '',
    authCode: ''
  });
  const [loading, setLoading] = useState(false);
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  // 登录验证
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    const { studentName, className, authCode } = loginForm;
    if (!studentName.trim() || !className.trim() || !authCode.trim()) {
      setLoginError('请输入学生姓名、班级和鉴权码');
      setLoading(false);
      return;
    }

    try {
      const session = await authenticateParentStudent({
        studentName,
        className,
        authCode
      });
      const [report, exams] = await Promise.all([
        fetchParentStudentReport(session.studentId, session.token),
        fetchParentStudentExams(session.studentId, session.token)
      ]);
      const student = buildStudentFromReport(report);

      setStudentReport(report);
      setScoreRows(buildScoreRowsFromExams(exams));
      setSelectedStudent(student);
      setIsLoggedIn(true);
    } catch (error) {
      setLoginError(error?.message || '家长身份验证失败');
    } finally {
      setLoading(false);
    }
  };

  // 退出登录
  const handleLogout = () => {
    setIsLoggedIn(false);
    setStudentReport(null);
    setScoreRows([]);
    setSelectedStudent(null);
    setLoginForm({ studentName: '', className: '', authCode: '' });
  };

  // 获取家长绑定的所有学生
  const getParentStudents = () => {
    return selectedStudent ? [selectedStudent] : [];
  };

  // 获取学生的成绩
  const getStudentScores = (studentId) => {
    return Number(selectedStudent?.id) === Number(studentId) ? scoreRows : [];
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
                学生姓名
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={loginForm.studentName}
                  onChange={(e) => setLoginForm({ ...loginForm, studentName: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="请输入学生姓名"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                班级
              </label>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={loginForm.className}
                  onChange={(e) => setLoginForm({ ...loginForm, className: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="如 701"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                鉴权码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showAuthCode ? 'text' : 'password'}
                  value={loginForm.authCode}
                  onChange={(e) => setLoginForm({ ...loginForm, authCode: e.target.value })}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="学籍辅号或身份证号后6位"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowAuthCode(!showAuthCode)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={loading}
                  aria-label={showAuthCode ? '隐藏鉴权码' : '显示鉴权码'}
                >
                  {showAuthCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">鉴权码只用于本次查询，成功后仅能访问该学生成绩。</p>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? '验证中...' : '验证并查询'}
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
              <span className="text-gray-600">
                {studentReport?.student_name || selectedStudent?.name} 家长
              </span>
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
                {students.length > 0 ? students.map(student => (
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
                        {student.class_name || '未分配班级'}
                      </p>
                      <p className="text-xs text-gray-400">学号：{student.student_code}</p>
                    </button>
                  )) : (
                  <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                    当前家长档案暂无绑定学生。完成家长管理中的绑定后才会显示成绩。
                  </div>
                )}
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
                        {selectedStudent.class_name || '未分配'}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">当前学期</p>
                      <p className="font-medium text-gray-800">
                        {selectedStudent.current_term || '-'}
                      </p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">最近考试</p>
                      <p className="font-medium text-gray-800">{selectedStudent.latest_exam_name || '-'}</p>
                    </div>
                  </div>
                </div>

                {studentReport && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">学情诊断</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-lg bg-red-50 p-4">
                        <p className="text-sm font-medium text-red-700">薄弱学科</p>
                        <p className="mt-2 text-lg font-semibold text-gray-900">
                          {(studentReport.weak_subjects || []).join('、') || '暂无明显短板'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-green-50 p-4">
                        <p className="text-sm font-medium text-green-700">优势学科</p>
                        <p className="mt-2 text-lg font-semibold text-gray-900">
                          {(studentReport.advantage_subjects || []).join('、') || '继续观察'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-4">
                        <p className="text-sm font-medium text-blue-700">历史考试</p>
                        <p className="mt-2 text-lg font-semibold text-gray-900">
                          {(studentReport.historical_trends || []).length} 次
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                      {studentReport.diagnosis || '暂无诊断内容'}
                    </p>
                  </div>
                )}

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
