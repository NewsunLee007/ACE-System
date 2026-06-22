import React, { useState } from 'react';
import {
  ChevronLeft,
  User,
  Calendar,
  MessageSquare,
  BarChart3,
  ChevronRight,
  LogOut
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
import {
  authenticateParentStudent,
  fetchParentStudentExams,
  fetchParentStudentReport
} from '../lib/parentPortalApi';
import {
  getLocalScoreVisibilitySettings,
  maskRankValue,
  resolveScoreVisibility,
} from '../lib/scoreVisibility';

const formatDisplayNumber = (value, digits = 1) => (
  Number.isFinite(Number(value)) ? Number(value).toFixed(digits).replace(/\.0$/, '') : '-'
);

const inferSubjectFullScore = (score) => {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return 100;
  if (numericScore > 120) return Math.ceil(numericScore / 10) * 10;
  if (numericScore > 100) return 120;
  return 100;
};

const buildH5Student = ({ report, session, loginForm }) => ({
  id: session.studentId,
  name: report?.student_name || loginForm.studentName.trim(),
  student_code: report?.student_code || '',
  class_name: report?.class_name || loginForm.className.trim()
});

const buildReportSubjectMap = (report) => (
  (report?.latest_exam?.subjects || []).reduce((result, item) => {
    result[item.subject] = item;
    return result;
  }, {})
);

const buildH5ExamScores = (examPayload, report) => {
  const reportSubjects = buildReportSubjectMap(report);
  const latestExamId = report?.latest_exam?.exam_id;

  return (examPayload?.exams || []).map((exam) => {
    const isLatest = Number(exam.exam_id) === Number(latestExamId);
    const subjects = Object.entries(exam.subjects || {}).reduce((result, [subject, rawScore]) => {
      if (rawScore === null || rawScore === undefined || rawScore === '') {
        return result;
      }

      const score = Number(rawScore);
      const reportSubject = isLatest ? reportSubjects[subject] : null;
      result[subject] = {
        score: Number.isFinite(score) ? score : null,
        class_rank: reportSubject?.rank_in_class || '-',
        grade_rank: '-',
        full_score: inferSubjectFullScore(score),
        class_avg: formatDisplayNumber(reportSubject?.class_avg)
      };
      return result;
    }, {});
    const totalScore = Number(exam.total_score);
    const totalFullScore = Object.values(subjects).reduce((sum, subject) => (
      sum + (Number(subject.full_score) || 0)
    ), 0);
    const latestReportExam = isLatest ? report?.latest_exam : null;

    return {
      exam_id: exam.exam_id,
      exam_name: exam.exam_name || `考试${exam.exam_id || ''}`,
      exam_date: exam.exam_date || '',
      exam_type: exam.term || latestReportExam?.term || '考试',
      subjects,
      total: {
        score: Number.isFinite(totalScore) ? totalScore : 0,
        class_rank: exam.class_rank || latestReportExam?.class_rank || '-',
        grade_rank: latestReportExam?.layer_rank || '-',
        full_score: totalFullScore || inferSubjectFullScore(totalScore),
        class_avg: '-',
      },
      layer_status: latestReportExam?.layer_status || '',
      teacher_comment: isLatest ? (report?.diagnosis || '暂无学情诊断。') : '暂无教师评语。',
    };
  });
};

/**
 * 家长H5查询端口
 * 专为移动端优化的家长查询界面
 */
const ParentH5Portal = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('scores');
  const [parentLabel, setParentLabel] = useState('家长');
  const [boundChildren, setBoundChildren] = useState([]);
  const [examScores, setExamScores] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [showExamDetail, setShowExamDetail] = useState(false);
  const [loginError, setLoginError] = useState('');

  // 登录表单
  const [loginForm, setLoginForm] = useState({
    studentName: '',
    className: '',
    authCode: ''
  });

  const latestExam = examScores[0] || null;
  const parentVisibility = resolveScoreVisibility('parent', getLocalScoreVisibilitySettings());

  // 趋势数据
  const trendData = examScores.slice().reverse().map(exam => ({
    exam: exam.exam_name,
    total: exam.total.score,
    avg: exam.total.class_avg
  }));
  const trendMax = Math.max(500, ...trendData.map(item => Number(item.total) || 0));

  // 雷达图数据
  const radarSource = selectedExam || latestExam;
  const radarData = Object.entries(radarSource?.subjects || {}).map(([subject, data]) => ({
    subject,
    score: data.score || 0,
    scoreRate: data.full_score ? Math.round(((data.score || 0) / data.full_score) * 100) : 0,
    fullMark: data.full_score || 100,
  }));

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    if (!loginForm.studentName.trim() || !loginForm.className.trim() || !loginForm.authCode.trim()) {
      setLoginError('请输入学生姓名、班级和鉴权码');
      return;
    }

    setLoading(true);
    try {
      const session = await authenticateParentStudent(loginForm);
      const [reportResult, examsResult] = await Promise.allSettled([
        fetchParentStudentReport(session.studentId, session.token),
        fetchParentStudentExams(session.studentId, session.token)
      ]);

      if (examsResult.status === 'rejected') {
        throw examsResult.reason;
      }

      const report = reportResult.status === 'fulfilled' ? reportResult.value : null;
      const child = buildH5Student({ report, session, loginForm });

      setParentLabel(`${child.name}家长`);
      setBoundChildren([child]);
      setSelectedChild(child);
      setExamScores(buildH5ExamScores(examsResult.value, report));
      setIsLoggedIn(true);
    } catch (error) {
      setLoginError(error?.message || '家长身份验证失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setParentLabel('家长');
    setBoundChildren([]);
    setExamScores([]);
    setSelectedChild(null);
    setSelectedExam(null);
    setShowExamDetail(false);
    setLoginForm({ studentName: '', className: '', authCode: '' });
  };

  const getScoreColor = (score, fullScore = 100) => {
    if (!Number.isFinite(Number(score)) || !Number.isFinite(Number(fullScore)) || Number(fullScore) <= 0) {
      return 'text-gray-500';
    }
    const rate = score / fullScore;
    if (rate >= 0.9) return 'text-green-600';
    if (rate >= 0.8) return 'text-blue-600';
    if (rate >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score, fullScore = 100) => {
    if (!Number.isFinite(Number(score)) || !Number.isFinite(Number(fullScore)) || Number(fullScore) <= 0) {
      return 'bg-gray-50';
    }
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
            {loginError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {loginError}
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">学生姓名</label>
                <input
                  type="text"
                  value={loginForm.studentName}
                  onChange={(e) => setLoginForm({...loginForm, studentName: e.target.value})}
                  placeholder="请输入学生姓名"
                  disabled={loading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">班级</label>
                <input
                  type="text"
                  value={loginForm.className}
                  onChange={(e) => setLoginForm({...loginForm, className: e.target.value})}
                  placeholder="如 701"
                  disabled={loading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">鉴权码</label>
                <input
                  type="password"
                  value={loginForm.authCode}
                  onChange={(e) => setLoginForm({...loginForm, authCode: e.target.value})}
                  placeholder="学籍辅号或身份证号后6位"
                  disabled={loading}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
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
              仅验证并展示该学生本人的成绩数据
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
                  <p className="text-sm text-gray-600">年级位置</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {parentVisibility.show_grade_rank
                      ? (selectedExam.layer_status || (selectedExam.total.grade_rank !== '-' ? `年级${selectedExam.total.grade_rank}名` : '-'))
                      : '排名暂未开放'}
                  </p>
                  <p className="text-xs text-gray-500">
                    班级第 {maskRankValue(selectedExam.total.class_rank, parentVisibility.show_class_rank)} 名
                  </p>
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
                      <p className="text-gray-600">班排 {maskRankValue(data.class_rank, parentVisibility.show_class_rank)}</p>
                      <p className="text-gray-500">年排 {maskRankValue(data.grade_rank, parentVisibility.show_grade_rank)}</p>
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
                  name="得分率"
                  dataKey="scoreRate"
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
            <p className="text-blue-200 text-sm">您好，{parentLabel}</p>
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
                <h2 className="font-semibold text-gray-800">{selectedChild.name || selectedChild.student_name}</h2>
                <p className="text-sm text-gray-500">{selectedChild.class_name || '未分配班级'}</p>
              </div>
              <div className="text-right text-sm text-gray-500">
                <p>学号</p>
                <p className="font-medium text-gray-800">{selectedChild.student_code || selectedChild.student_no || selectedChild.id}</p>
              </div>
            </div>
            {boundChildren.length > 1 && (
              <select
                value={selectedChild.id}
                onChange={(event) => {
                  const nextChild = boundChildren.find(child => String(child.id) === String(event.target.value));
                  setSelectedChild(nextChild || null);
                  setSelectedExam(null);
                  setShowExamDetail(false);
                }}
                className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {boundChildren.map(child => (
                  <option key={child.id} value={child.id}>{child.name || child.student_name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {boundChildren.length === 0 && (
        <div className="p-4">
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-semibold text-gray-800">暂无绑定学生</h3>
            <p className="text-sm text-gray-500 mt-2">当前家长档案还没有绑定学生。完成家长管理中的绑定后，这里才会展示学生成绩。</p>
          </div>
        </div>
      )}

      {/* 最新成绩 */}
      {latestExam ? (
        <div className="p-4">
          <div className="bg-white rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">最新成绩</h3>
              <span className="text-sm text-gray-500">{latestExam.exam_name}</span>
            </div>

            <div className={`rounded-lg p-4 ${getScoreBg(latestExam.total.score, latestExam.total.full_score)}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">总分</p>
                  <p className={`text-3xl font-bold ${getScoreColor(latestExam.total.score, latestExam.total.full_score)}`}>
                    {latestExam.total.score}
                  </p>
                  <p className="text-xs text-gray-500">
                    班级第 {maskRankValue(latestExam.total.class_rank, parentVisibility.show_class_rank)} 名
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">年级位置</p>
                  <p className="max-w-32 text-sm font-semibold text-gray-800">
                    {parentVisibility.show_grade_rank ? (latestExam.layer_status || '-') : '排名暂未开放'}
                  </p>
                </div>
              </div>
            </div>

            {/* 快捷查看各科 */}
            <div className="grid grid-cols-5 gap-2 mt-4">
              {Object.entries(latestExam.subjects).map(([subject, data]) => (
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
                setSelectedExam(latestExam);
                setShowExamDetail(true);
              }}
              className="w-full mt-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              查看详情
            </button>
          </div>
        </div>
      ) : boundChildren.length > 0 && (
        <div className="p-4">
          <div className="bg-white rounded-xl shadow p-5">
            <h3 className="font-semibold text-gray-800">暂无有效成绩</h3>
            <p className="text-sm text-gray-500 mt-2">成绩导入并确认有效后，将自动显示总分、班级排名、学科明细和趋势图。</p>
          </div>
        </div>
      )}

      {/* 成绩趋势 */}
      {examScores.length > 0 && (
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-800 mb-3">成绩趋势</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="exam" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, trendMax]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total" name="总分" stroke="#3B82F6" strokeWidth={2} />
              <Line type="monotone" dataKey="avg" name="班均" stroke="#10B981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      )}

      {/* 历史考试列表 */}
      {examScores.length > 0 && (
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
                    <p className="text-xs text-gray-500">
                      班排{maskRankValue(exam.total.class_rank, parentVisibility.show_class_rank)}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

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
