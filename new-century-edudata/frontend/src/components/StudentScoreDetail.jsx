import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Award,
  Target,
  BookOpen,
  Calendar,
  School,
  BarChart3,
  Download,
  Share2,
  ChevronRight,
  Star,
  AlertCircle
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
  Tooltip,
  Legend,
  BarChart,
  Bar
} from 'recharts';

const StudentScoreDetail = ({ studentId, onBack }) => {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState('latest');
  const [activeTab, setActiveTab] = useState('overview');

  // 模拟学生数据
  const mockStudent = {
    id: 1,
    student_code: '20240701001',
    name: '张小明',
    gender: '男',
    grade_level: '7年级',
    class_no: '3',
    class_name: '7年级(3)班',
    head_teacher: '李老师',
    enrollment_date: '2024-09-01',
    parent_name: '张大明',
    parent_phone: '13800138001'
  };

  // 模拟成绩数据
  const examScores = [
    {
      exam_id: 1,
      exam_name: '2025-1期末',
      exam_date: '2025-01-15',
      subjects: {
        语文: { score: 85, class_rank: 12, grade_rank: 45, full_score: 100 },
        数学: { score: 92, class_rank: 5, grade_rank: 18, full_score: 100 },
        英语: { score: 88, class_rank: 8, grade_rank: 32, full_score: 100 },
        科学: { score: 90, class_rank: 6, grade_rank: 22, full_score: 100 },
        社会: { score: 87, class_rank: 10, grade_rank: 38, full_score: 100 }
      },
      total: { score: 442, class_rank: 7, grade_rank: 28, full_score: 500 },
      z_value: 0.65
    },
    {
      exam_id: 2,
      exam_name: '2024-2期末',
      exam_date: '2024-07-10',
      subjects: {
        语文: { score: 82, class_rank: 15, grade_rank: 52, full_score: 100 },
        数学: { score: 89, class_rank: 8, grade_rank: 25, full_score: 100 },
        英语: { score: 85, class_rank: 12, grade_rank: 41, full_score: 100 },
        科学: { score: 87, class_rank: 9, grade_rank: 35, full_score: 100 },
        社会: { score: 84, class_rank: 14, grade_rank: 48, full_score: 100 }
      },
      total: { score: 427, class_rank: 10, grade_rank: 42, full_score: 500 },
      z_value: 0.42
    },
    {
      exam_id: 3,
      exam_name: '2024-2期中',
      exam_date: '2024-11-15',
      subjects: {
        语文: { score: 80, class_rank: 18, grade_rank: 58, full_score: 100 },
        数学: { score: 87, class_rank: 10, grade_rank: 32, full_score: 100 },
        英语: { score: 83, class_rank: 14, grade_rank: 46, full_score: 100 },
        科学: { score: 85, class_rank: 11, grade_rank: 39, full_score: 100 },
        社会: { score: 82, class_rank: 16, grade_rank: 52, full_score: 100 }
      },
      total: { score: 417, class_rank: 13, grade_rank: 48, full_score: 500 },
      z_value: 0.28
    }
  ];

  // 知识点掌握情况
  const knowledgeMastery = [
    { subject: '语文', area: '基础知识', mastery: 85, trend: 'up' },
    { subject: '语文', area: '阅读理解', mastery: 78, trend: 'up' },
    { subject: '语文', area: '写作能力', mastery: 82, trend: 'stable' },
    { subject: '数学', area: '代数运算', mastery: 92, trend: 'up' },
    { subject: '数学', area: '几何证明', mastery: 88, trend: 'down' },
    { subject: '数学', area: '函数应用', mastery: 90, trend: 'up' },
    { subject: '英语', area: '词汇语法', mastery: 86, trend: 'stable' },
    { subject: '英语', area: '阅读理解', mastery: 84, trend: 'up' },
    { subject: '英语', area: '写作表达', mastery: 80, trend: 'down' }
  ];

  // 历次考试趋势数据
  const trendData = examScores.map(exam => ({
    exam: exam.exam_name,
    total: exam.total.score,
    语文: exam.subjects.语文.score,
    数学: exam.subjects.数学.score,
    英语: exam.subjects.英语.score,
    科学: exam.subjects.科学.score,
    社会: exam.subjects.社会.score
  })).reverse();

  // 雷达图数据
  const radarData = [
    { subject: '语文', score: 85, fullMark: 100 },
    { subject: '数学', score: 92, fullMark: 100 },
    { subject: '英语', score: 88, fullMark: 100 },
    { subject: '科学', score: 90, fullMark: 100 },
    { subject: '社会', score: 87, fullMark: 100 }
  ];

  useEffect(() => {
    // 模拟加载学生数据
    setTimeout(() => {
      setStudent(mockStudent);
      setLoading(false);
    }, 500);
  }, [studentId]);

  const currentExam = examScores[0];

  const getScoreColor = (score, fullScore = 100) => {
    const rate = score / fullScore;
    if (rate >= 0.9) return 'text-green-600';
    if (rate >= 0.8) return 'text-blue-600';
    if (rate >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score, fullScore = 100) => {
    const rate = score / fullScore;
    if (rate >= 0.9) return 'bg-green-100';
    if (rate >= 0.8) return 'bg-blue-100';
    if (rate >= 0.6) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getRankTrend = (current, previous) => {
    if (current < previous) return { icon: TrendingUp, color: 'text-green-600', text: `↑${previous - current}` };
    if (current > previous) return { icon: TrendingDown, color: 'text-red-600', text: `↓${current - previous}` };
    return { icon: null, color: 'text-gray-600', text: '-' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 返回按钮和标题 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="w-5 h-5" />
          返回
        </button>
        <h1 className="text-2xl font-bold text-gray-800">学生成绩详情</h1>
      </div>

      {/* 学生基本信息卡片 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-3xl font-bold text-blue-600">{student.name.charAt(0)}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{student.name}</h2>
              <p className="text-gray-500">{student.student_code}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <School className="w-4 h-4" />
                  {student.class_name}
                </span>
                <span>班主任：{student.head_teacher}</span>
                <span>性别：{student.gender}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Download className="w-4 h-4" />
              导出成绩单
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Share2 className="w-4 h-4" />
              分享给家长
            </button>
          </div>
        </div>
      </div>

      {/* 最新考试成绩总览 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">最新考试成绩</h3>
          <select
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
          >
            <option value="latest">{currentExam.exam_name}</option>
            {examScores.slice(1).map(exam => (
              <option key={exam.exam_id} value={exam.exam_id}>{exam.exam_name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
          {/* 总分卡片 */}
          <div className={`rounded-lg p-4 ${getScoreBg(currentExam.total.score, currentExam.total.full_score)}`}>
            <p className="text-sm text-gray-600 mb-1">总分</p>
            <p className={`text-2xl font-bold ${getScoreColor(currentExam.total.score, currentExam.total.full_score)}`}>
              {currentExam.total.score}
            </p>
            <p className="text-xs text-gray-500">满分{currentExam.total.full_score}</p>
            <div className="mt-2 text-xs">
              <span className="text-gray-600">班排：{currentExam.total.class_rank}</span>
              <span className="mx-2">|</span>
              <span className="text-gray-600">年排：{currentExam.total.grade_rank}</span>
            </div>
          </div>

          {/* 各科成绩 */}
          {Object.entries(currentExam.subjects).map(([subject, data]) => (
            <div key={subject} className={`rounded-lg p-4 ${getScoreBg(data.score, data.full_score)}`}>
              <p className="text-sm text-gray-600 mb-1">{subject}</p>
              <p className={`text-xl font-bold ${getScoreColor(data.score, data.full_score)}`}>
                {data.score}
              </p>
              <div className="mt-2 text-xs text-gray-600">
                <span>班排{data.class_rank}</span>
                <span className="mx-1">|</span>
                <span>年排{data.grade_rank}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Z值评价 */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Z值：</span>
              <span className={`text-lg font-bold ${currentExam.z_value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {currentExam.z_value > 0 ? '+' : ''}{currentExam.z_value}
              </span>
            </div>
            <div className="flex-1 h-2 bg-gray-200 rounded-full">
              <div
                className={`h-2 rounded-full ${currentExam.z_value >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${Math.min(Math.abs(currentExam.z_value) * 50, 100)}%`, marginLeft: currentExam.z_value < 0 ? 'auto' : 0, marginRight: currentExam.z_value >= 0 ? 'auto' : 0 }}
              />
            </div>
            <span className="text-sm text-gray-500">
              {currentExam.z_value >= 0.5 ? '优秀' : currentExam.z_value >= 0 ? '良好' : currentExam.z_value >= -0.5 ? '一般' : '需努力'}
            </span>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 学科能力雷达图 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">学科能力分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar
                name="成绩"
                dataKey="score"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.3}
              />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* 历次考试趋势 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">历次考试趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="exam" />
              <YAxis domain={[0, 500]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" name="总分" stroke="#3B82F6" strokeWidth={2} />
              <Line type="monotone" dataKey="语文" name="语文" stroke="#EF4444" />
              <Line type="monotone" dataKey="数学" name="数学" stroke="#10B981" />
              <Line type="monotone" dataKey="英语" name="英语" stroke="#F59E0B" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 知识点掌握情况 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">知识点掌握情况</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {knowledgeMastery.map((item, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-800">{item.area}</p>
                  <p className="text-xs text-gray-500">{item.subject}</p>
                </div>
                <div className="flex items-center gap-1">
                  {item.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-600" />}
                  {item.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-600" />}
                  {item.trend === 'stable' && <span className="text-gray-400">→</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      item.mastery >= 80 ? 'bg-green-500' :
                      item.mastery >= 60 ? 'bg-blue-500' :
                      'bg-yellow-500'
                    }`}
                    style={{ width: `${item.mastery}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700">{item.mastery}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 历史成绩记录 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">历史成绩记录</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">考试</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">日期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">语文</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">数学</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">英语</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">科学</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">社会</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">总分</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">班排</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">年排</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Z值</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {examScores.map((exam, index) => (
                <tr key={exam.exam_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{exam.exam_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{exam.exam_date}</td>
                  {Object.entries(exam.subjects).map(([subject, data]) => (
                    <td key={subject} className="px-4 py-3 text-sm">
                      <span className={getScoreColor(data.score, data.full_score)}>
                        {data.score}
                      </span>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {exam.total.score}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{exam.total.class_rank}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{exam.total.grade_rank}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={exam.z_value >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {exam.z_value > 0 ? '+' : ''}{exam.z_value}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StudentScoreDetail;
