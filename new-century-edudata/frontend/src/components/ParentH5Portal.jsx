import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  User,
  School,
  Calendar,
  TrendingUp,
  TrendingDown,
  Award,
  BookOpen,
  Phone,
  MessageSquare,
  BarChart3,
  ChevronRight,
  LogOut,
  Lock
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

/**
 * 家长H5查询端口
 * 专为移动端优化的家长查询界面
 */
const ParentH5Portal = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('scores');
  const [selectedChild, setSelectedChild] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [showExamDetail, setShowExamDetail] = useState(false);

  // 登录表单
  const [loginForm, setLoginForm] = useState({
    phone: '',
    code: ''
  });
  const [countdown, setCountdown] = useState(0);

  // 模拟家长数据
  const parentData = {
    id: 1,
    name: '张大明',
    phone: '13800138001',
    children: [
      {
        id: 1,
        name: '张小明',
        student_code: '20240701001',
        gender: '男',
        grade_level: '7年级',
        class_no: '3',
        class_name: '7年级(3)班',
        head_teacher: '李老师',
        school: '瑞安市新纪元实验学校'
      }
    ]
  };

  // 模拟成绩数据
  const examScores = [
    {
      exam_id: 1,
      exam_name: '2025-1期末',
      exam_date: '2025-01-15',
      exam_type: '期末',
      subjects: {
        语文: { score: 85, class_rank: 12, grade_rank: 45, full_score: 100, class_avg: 78.5 },
        数学: { score: 92, class_rank: 5, grade_rank: 18, full_score: 100, class_avg: 76.2 },
        英语: { score: 88, class_rank: 8, grade_rank: 32, full_score: 100, class_avg: 79.8 },
        科学: { score: 90, class_rank: 6, grade_rank: 22, full_score: 100, class_avg: 80.5 },
        社会: { score: 87, class_rank: 10, grade_rank: 38, full_score: 100, class_avg: 81.2 }
      },
      total: { score: 442, class_rank: 7, grade_rank: 28, full_score: 500, class_avg: 396 },
      z_value: 0.65,
      teacher_comment: '张小明同学本学期表现良好，数学成绩突出，但语文阅读理解还需加强。希望下学期能继续保持优势科目，同时提升薄弱科目。'
    },
    {
      exam_id: 2,
      exam_name: '2024-2期末',
      exam_date: '2024-07-10',
      exam_type: '期末',
      subjects: {
        语文: { score: 82, class_rank: 15, grade_rank: 52, full_score: 100, class_avg: 77.8 },
        数学: { score: 89, class_rank: 8, grade_rank: 25, full_score: 100, class_avg: 75.5 },
        英语: { score: 85, class_rank: 12, grade_rank: 41, full_score: 100, class_avg: 78.2 },
        科学: { score: 87, class_rank: 9, grade_rank: 35, full_score: 100, class_avg: 79.5 },
        社会: { score: 84, class_rank: 14, grade_rank: 48, full_score: 100, class_avg: 80.8 }
      },
      total: { score: 427, class_rank: 10, grade_rank: 42, full_score: 500, class_avg: 392 },
      z_value: 0.42,
      teacher_comment: '整体表现稳定，需要加强语文和社会学科的学习。'
    },
    {
      exam_id: 3,
      exam_name: '2024-2期中',
      exam_date: '2024-11-15',
      exam_type: '期中',
      subjects: {
        语文: { score: 80, class_rank: 18, grade_rank: 58, full_score: 100, class_avg: 76.5 },
        数学: { score: 87, class_rank: 10, grade_rank: 32, full_score: 100, class_avg: 74.8 },
        英语: { score: 83, class_rank: 14, grade_rank: 46, full_score: 100, class_avg: 77.5 },
        科学: { score: 85, class_rank: 11, grade_rank: 39, full_score: 100, class_avg: 78.8 },
        社会: { score: 82, class_rank: 16, grade_rank: 52, full_score: 100, class_avg: 79.5 }
      },
      total: { score: 417, class_rank: 13, grade_rank: 48, full_score: 500, class_avg: 387 },
      z_value: 0.28,
      teacher_comment: '期中考试表现中等，需要继续努力。'
    }
  ];

  // 趋势数据
  const trendData = examScores.map(exam => ({
    exam: exam.exam_name.replace('202', ''),
    total: exam.total.score,
    avg: exam.total.class_avg
  })).reverse();

  // 雷达图数据
  const radarData = examScores[0] ? [
    { subject: '语文', score: examScores[0].subjects.语文.score, fullMark: 100 },
    { subject: '数学', score: examScores[0].subjects.数学.score, fullMark: 100 },
    { subject: '英语', score: examScores[0].subjects.英语.score, fullMark: 100 },
    { subject: '科学', score: examScores[0].subjects.科学.score, fullMark: 100 },
    { subject: '社会', score: examScores[0].subjects.社会.score, fullMark: 100 }
  ] : [];

  useEffect(() => {
    if (parentData.children.length > 0) {
      setSelectedChild(parentData.children[0]);
    }
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = () => {
    if (loginForm.phone && countdown === 0) {
      setCountdown(60);
      alert('验证码已发送：123456');
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (loginForm.phone && loginForm.code) {
      setLoading(true);
      setTimeout(() => {
        setIsLoggedIn(true);
        setLoading(false);
      }, 1000);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoginForm({ phone: '', code: '' });
  };

  const getScoreColor = (score, fullScore = 100) => {
    const rate = score / fullScore;
    if (rate >= 0.9) return 'text-green-600';
    if (rate >= 0.8) return 'text-blue-600';
    if (rate >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score, fullScore = 100) => {
    const rate = score / fullScore;
    if (rate >= 0.9) return 'bg-green-50';
    if (rate >= 0.8) return 'bg-blue-50';
    if (rate >= 0.6) return 'bg-yellow-50';
    return 'bg-red-50';
  };

  // 登录页面
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col">
        {/* 顶部 */}
        <div className="bg-blue-600 text-white p-6 pb-12">
          <h1 className="text-2xl font-bold text-center">新纪元教务平台</h1>
          <p className="text-center text-blue-200 mt-2">家长查询系统</p>
        </div>

        {/* 登录表单 */}
        <div className="flex-1 px-4 -mt-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">家长登录</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
                <input
                  type="tel"
                  value={loginForm.phone}
                  onChange={(e) => setLoginForm({...loginForm, phone: e.target.value})}
                  placeholder="请输入手机号"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">验证码</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={loginForm.code}
                    onChange={(e) => setLoginForm({...loginForm, code: e.target.value})}
                    placeholder="请输入验证码"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={countdown > 0}
                    className={`px-4 py-3 rounded-lg font-medium ${
                      countdown > 0
                        ? 'bg-gray-300 text-gray-500'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '登录中...' : '登录'}
              </button>
            </form>
            <p className="text-xs text-gray-500 text-center mt-4">
              首次登录将自动注册账号
            </p>
          </div>
        </div>

        {/* 底部 */}
        <div className="p-4 text-center text-sm text-gray-500">
          <p>瑞安市新纪元实验学校</p>
          <p className="mt-1">技术支持：新纪元信息中心</p>
        </div>
      </div>
    );
  }

  // 考试详情页面
  if (showExamDetail && selectedExam) {
    return (
      <div className="min-h-screen bg-gray-100">
        {/* 顶部导航 */}
        <div className="bg-blue-600 text-white p-4 sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowExamDetail(false)}>
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold">{selectedExam.exam_name}</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* 考试信息 */}
          <div className="bg-white rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
              <Calendar className="w-4 h-4" />
              <span>{selectedExam.exam_date}</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-xs">
                {selectedExam.exam_type}
              </span>
            </div>

            {/* 总分 */}
            <div className={`rounded-lg p-4 ${getScoreBg(selectedExam.total.score, selectedExam.total.full_score)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">总分</p>
                  <p className={`text-3xl font-bold ${getScoreColor(selectedExam.total.score, selectedExam.total.full_score)}`}>
                    {selectedExam.total.score}
                  </p>
                  <p className="text-xs text-gray-500">满分{selectedExam.total.full_score}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">班级排名</p>
                  <p className="text-xl font-bold text-gray-800">{selectedExam.total.class_rank}</p>
                  <p className="text-xs text-gray-500">年级{selectedExam.total.grade_rank}名</p>
                </div>
              </div>
            </div>
          </div>

          {/* 各科成绩 */}
          <div className="bg-white rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 mb-3">各科成绩</h3>
            <div className="space-y-3">
              {Object.entries(selectedExam.subjects).map(([subject, data]) => (
                <div key={subject} className={`p-3 rounded-lg ${getScoreBg(data.score, data.full_score)}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{subject}</p>
                      <p className={`text-2xl font-bold ${getScoreColor(data.score, data.full_score)}`}>
                        {data.score}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-gray-600">班排 {data.class_rank}</p>
                      <p className="text-gray-500">年排 {data.grade_rank}</p>
                      <p className="text-gray-400">班均 {data.class_avg}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 学科能力雷达图 */}
          <div className="bg-white rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 mb-3">学科能力分布</h3>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar
                  name="成绩"
                  dataKey="score"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* 教师评语 */}
          <div className="bg-white rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 mb-3">教师评语</h3>
            <div className="bg-yellow-50 rounded-lg p-3">
              <p className="text-sm text-gray-700 leading-relaxed">
                {selectedExam.teacher_comment}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 主页面
  return (
    <div className="min-h-screen bg-gray-100">
      {/* 顶部 */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm">您好，{parentData.name}</p>
            <h1 className="text-lg font-semibold">学生成绩查询</h1>
          </div>
          <button onClick={handleLogout} className="text-white">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 学生信息卡片 */}
      {selectedChild && (
        <div className="px-4 -mt-2">
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-gray-800">{selectedChild.name}</h2>
                <p className="text-sm text-gray-500">{selectedChild.class_name}</p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>学号</p>
                <p className="font-medium text-gray-800">{selectedChild.student_code}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 最新成绩 */}
      {examScores[0] && (
        <div className="p-4">
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">最新成绩</h3>
              <span className="text-sm text-gray-500">{examScores[0].exam_name}</span>
            </div>

            <div className={`rounded-lg p-4 ${getScoreBg(examScores[0].total.score, examScores[0].total.full_score)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">总分</p>
                  <p className={`text-3xl font-bold ${getScoreColor(examScores[0].total.score, examScores[0].total.full_score)}`}>
                    {examScores[0].total.score}
                  </p>
                  <p className="text-xs text-gray-500">班级第 {examScores[0].total.class_rank} 名</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Z值</p>
                  <p className={`text-xl font-bold ${examScores[0].z_value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {examScores[0].z_value > 0 ? '+' : ''}{examScores[0].z_value}
                  </p>
                </div>
              </div>
            </div>

            {/* 快捷查看各科 */}
            <div className="grid grid-cols-5 gap-2 mt-4">
              {Object.entries(examScores[0].subjects).map(([subject, data]) => (
                <div key={subject} className="text-center">
                  <p className="text-xs text-gray-500">{subject}</p>
                  <p className={`font-semibold ${getScoreColor(data.score, data.full_score)}`}>
                    {data.score}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setSelectedExam(examScores[0]);
                setShowExamDetail(true);
              }}
              className="w-full mt-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              查看详情
            </button>
          </div>
        </div>
      )}

      {/* 成绩趋势 */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3">成绩趋势</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="exam" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 500]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total" name="总分" stroke="#3B82F6" strokeWidth={2} />
              <Line type="monotone" dataKey="avg" name="班均" stroke="#10B981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 历史考试列表 */}
      <div className="px-4 pb-20">
        <h3 className="font-semibold text-gray-800 mb-3">历史考试</h3>
        <div className="space-y-3">
          {examScores.map((exam) => (
            <div
              key={exam.exam_id}
              onClick={() => {
                setSelectedExam(exam);
                setShowExamDetail(true);
              }}
              className="bg-white rounded-xl shadow p-4 active:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{exam.exam_name}</p>
                  <p className="text-sm text-gray-500">{exam.exam_date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-xl font-bold ${getScoreColor(exam.total.score, exam.total.full_score)}`}>
                      {exam.total.score}
                    </p>
                    <p className="text-xs text-gray-500">班排{exam.total.class_rank}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部导航 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex items-center justify-around">
          <button
            onClick={() => setActiveTab('scores')}
            className={`flex flex-col items-center gap-1 py-2 ${activeTab === 'scores' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <BarChart3 className="w-6 h-6" />
            <span className="text-xs">成绩</span>
          </button>
          <button
            onClick={() => setActiveTab('message')}
            className={`flex flex-col items-center gap-1 py-2 ${activeTab === 'message' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <MessageSquare className="w-6 h-6" />
            <span className="text-xs">消息</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 py-2 ${activeTab === 'profile' ? 'text-blue-600' : 'text-gray-500'}`}
          >
            <User className="w-6 h-6" />
            <span className="text-xs">我的</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ParentH5Portal;
