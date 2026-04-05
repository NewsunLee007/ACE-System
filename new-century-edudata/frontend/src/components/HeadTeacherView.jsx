import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  BookOpen,
  Award,
  ChevronDown,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import AbsenceManagement from './AbsenceManagement';

// 班主任专属视图组件
const HeadTeacherView = () => {
  const [selectedClass, setSelectedClass] = useState('701');
  const [selectedSubject, setSelectedSubject] = useState('english');
  const [activeTab, setActiveTab] = useState('overview');
  const [classData, setClassData] = useState(null);

  // 模拟数据
  useEffect(() => {
    setClassData({
      class_name: '701',
      term: '2025-1',
      total_students: 45,
      current_exam: {
        exam_id: 1,
        exam_name: '2025-1 7年级教学调研',
        class_mean: 398.5,
        layer_mean: 385.5,
        z_value: 0.5432,
        rank_in_layer: 3,
        rank_change: 2, // 上升2名
      },
      historical_trends: [
        { exam_name: '期中考试', exam_date: '2024-10', z_value: 0.32, class_mean: 395, layer_mean: 388, mean_diff: 7 },
        { exam_name: '月考3', exam_date: '2024-11', z_value: 0.41, class_mean: 402, layer_mean: 390, mean_diff: 12 },
        { exam_name: '月考4', exam_date: '2024-12', z_value: 0.38, class_mean: 398, layer_mean: 392, mean_diff: 6 },
        { exam_name: '期末统考', exam_date: '2025-01', z_value: 0.48, class_mean: 405, layer_mean: 393, mean_diff: 12 },
        { exam_name: '本次调研', exam_date: '2025-02', z_value: 0.54, class_mean: 398.5, layer_mean: 385.5, mean_diff: 13 },
      ],
      subject_analysis: {
        chinese: { class_mean: 84.5, layer_mean: 82.0, diff: 2.5, trend: 'stable' },
        math: { class_mean: 82.0, layer_mean: 85.5, diff: -3.5, trend: 'decline' },
        english: { class_mean: 78.5, layer_mean: 91.45, diff: -12.95, trend: 'decline' },
        science: { class_mean: 88.0, layer_mean: 90.0, diff: -2.0, trend: 'stable' },
        society: { class_mean: 78.0, layer_mean: 80.0, diff: -2.0, trend: 'stable' },
      },
      student_rank_changes: [
        { student_id: 1, student_name: '张三', student_code: '20240101', current_rank: 1, previous_rank: 3, rank_change: 2, change_direction: '进步', current_score: 465 },
        { student_id: 2, student_name: '李四', student_code: '20240102', current_rank: 2, previous_rank: 5, rank_change: 3, change_direction: '进步', current_score: 458 },
        { student_id: 3, student_name: '王五', student_code: '20240103', current_rank: 3, previous_rank: 2, rank_change: -1, change_direction: '退步', current_score: 452 },
        { student_id: 4, student_name: '赵六', student_code: '20240104', current_rank: 4, previous_rank: 1, rank_change: -3, change_direction: '退步', current_score: 448 },
        { student_id: 5, student_name: '钱七', student_code: '20240105', current_rank: 5, previous_rank: 4, rank_change: -1, change_direction: '退步', current_score: 445 },
        { student_id: 6, student_name: '孙八', student_code: '20240106', current_rank: 6, previous_rank: 8, rank_change: 2, change_direction: '进步', current_score: 438 },
        { student_id: 7, student_name: '周九', student_code: '20240107', current_rank: 7, previous_rank: 6, rank_change: -1, change_direction: '退步', current_score: 435 },
        { student_id: 8, student_name: '吴十', student_code: '20240108', current_rank: 8, previous_rank: 10, rank_change: 2, change_direction: '进步', current_score: 428 },
      ],
      weak_subject_trend: [
        { term: '2024-2期中', exam_name: '期中考试', class_mean: 75.5, layer_mean: 88.2, gap: -12.7, status: '落后' },
        { term: '2024-2月考3', exam_name: '月考3', class_mean: 76.2, layer_mean: 89.5, gap: -13.3, status: '落后' },
        { term: '2024-2月考4', exam_name: '月考4', class_mean: 77.0, layer_mean: 90.1, gap: -13.1, status: '落后' },
        { term: '2024-2期末', exam_name: '期末统考', class_mean: 77.8, layer_mean: 90.8, gap: -13.0, status: '落后' },
        { term: '2025-1调研', exam_name: '本次调研', class_mean: 78.5, layer_mean: 91.45, gap: -12.95, status: '落后' },
      ],
    });
  }, [selectedClass]);

  const subjectNames = {
    chinese: '语文',
    math: '数学',
    english: '英语',
    science: '科学',
    society: '社会',
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'improve':
        return <ArrowUp className="w-4 h-4 text-green-500" />;
      case 'decline':
        return <ArrowDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const getDiffColor = (diff) => {
    if (diff > 0) return 'text-green-600';
    if (diff < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (!classData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-gray-600">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 顶部导航 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">班主任学情追踪视图</h1>
            <p className="text-sm text-gray-500 mt-1">
              {classData.class_name}班 | {classData.term}学期 | 共{classData.total_students}人
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <select
                className="appearance-none bg-gray-50 border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="701">701班</option>
                <option value="702">702班</option>
                <option value="703">703班</option>
              </select>
              <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Tab切换 */}
        <div className="flex gap-2 mt-4">
          {[
            { id: 'overview', label: '班级概览', icon: TrendingUp },
            { id: 'subjects', label: '学科分析', icon: BookOpen },
            { id: 'students', label: '学生进退步', icon: Users },
            { id: 'weak', label: '薄弱学科追踪', icon: AlertCircle },
            { id: 'absence', label: '缺考上报', icon: AlertCircle },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 班级概览 Tab */}
      {activeTab === 'overview' && (
        <>
          {/* 关键指标卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">班级综合Z值</p>
                  <p className="text-3xl font-bold text-gray-800">
                    {classData.current_exam.z_value.toFixed(4)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    分层排名: 第{classData.current_exam.rank_in_layer}名
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Award className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">班级均分</p>
                  <p className="text-3xl font-bold text-gray-800">
                    {classData.current_exam.class_mean}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    年段平均: {classData.current_exam.layer_mean}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">排名变化</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-bold text-gray-800">
                      {classData.current_exam.rank_change > 0 ? '+' : ''}
                      {classData.current_exam.rank_change}
                    </p>
                    {classData.current_exam.rank_change > 0 ? (
                      <ArrowUp className="w-6 h-6 text-green-500" />
                    ) : (
                      <ArrowDown className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    较上次考试
                  </p>
                </div>
                <div className="bg-yellow-100 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">与年段均差</p>
                  <p className={`text-3xl font-bold ${getDiffColor(classData.current_exam.class_mean - classData.current_exam.layer_mean)}`}>
                    +{(classData.current_exam.class_mean - classData.current_exam.layer_mean).toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    高于年段平均
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* 历史趋势图 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">班级历史成绩趋势</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={classData.historical_trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="exam_name" />
                  <YAxis yAxisId="left" domain={[0, 1]} />
                  <YAxis yAxisId="right" orientation="right" domain={[350, 450]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="z_value"
                    name="Z值"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6' }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="class_mean"
                    name="班级均分"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981' }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="layer_mean"
                    name="年段均分"
                    stroke="#9ca3af"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* 学科分析 Tab */}
      {activeTab === 'subjects' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">各学科成绩分析</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 学科对比图 */}
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Object.entries(classData.subject_analysis).map(([key, value]) => ({
                    subject: subjectNames[key],
                    class_mean: value.class_mean,
                    layer_mean: value.layer_mean,
                    diff: value.diff,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="subject" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="class_mean" name="班级均分" fill="#3b82f6" />
                  <Bar dataKey="layer_mean" name="年段均分" fill="#9ca3af" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 学科差距表 */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">学科</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">班级均分</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">年段均分</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">差距</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(classData.subject_analysis).map(([key, value]) => (
                    <tr key={key} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{subjectNames[key]}</td>
                      <td className="px-4 py-3 text-center">{value.class_mean}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{value.layer_mean}</td>
                      <td className={`px-4 py-3 text-center font-medium ${getDiffColor(value.diff)}`}>
                        {value.diff > 0 ? '+' : ''}{value.diff}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {value.diff > 0 ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">领先</span>
                        ) : value.diff < -5 ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">落后</span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">持平</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 英语学科警告 */}
          {classData.subject_analysis.english.diff < -10 && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-800">英语学科预警</h3>
                  <p className="text-sm text-red-700 mt-1">
                    本班英语均分({classData.subject_analysis.english.class_mean})与年段均分({classData.subject_analysis.english.layer_mean})差距较大，
                    落后{classData.subject_analysis.english.diff}分。建议加强英语学科的教学投入，关注后进生转化。
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 学生进退步 Tab */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">学生进退步名单</h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-green-500"></div>
                进步
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-red-500"></div>
                退步
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">当前排名</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">姓名</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">学籍号</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">当前分数</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">上次排名</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">排名变化</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">状态</th>
                </tr>
              </thead>
              <tbody>
                {classData.student_rank_changes.map((student) => (
                  <tr key={student.student_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{student.current_rank}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{student.student_name}</td>
                    <td className="px-4 py-3 text-gray-500">{student.student_code}</td>
                    <td className="px-4 py-3 text-center font-medium">{student.current_score}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{student.previous_rank}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${student.rank_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {student.rank_change > 0 ? '+' : ''}{student.rank_change}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {student.change_direction === '进步' ? (
                        <span className="flex items-center justify-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                          <TrendingUp className="w-3 h-3" />
                          进步
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs">
                          <TrendingDown className="w-3 h-3" />
                          退步
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 薄弱学科追踪 Tab */}
      {activeTab === 'weak' && (
        <div className="space-y-6">
          {/* 学科选择 */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">选择追踪学科:</span>
              <div className="flex gap-2">
                {Object.entries(subjectNames).map(([key, name]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedSubject(key)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      selectedSubject === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 趋势图 */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {subjectNames[selectedSubject]}学科差距趋势
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={classData.weak_subject_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="exam_name" />
                  <YAxis domain={[60, 100]} />
                  <Tooltip />
                  <Legend />
                  <ReferenceLine y={0} stroke="#000" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="class_mean"
                    name="班级均分"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="layer_mean"
                    name="年段均分"
                    stroke="#9ca3af"
                    strokeWidth={2}
                    dot={{ fill: '#9ca3af' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 趋势分析 */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">趋势分析</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">历次考试数</p>
                <p className="text-2xl font-bold text-gray-800">{classData.weak_subject_trend.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">当前差距</p>
                <p className="text-2xl font-bold text-red-600">
                  {classData.weak_subject_trend[classData.weak_subject_trend.length - 1]?.gap}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">总体趋势</p>
                <p className="text-2xl font-bold text-gray-800">略有改善</p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>分析结论:</strong> 本班{subjectNames[selectedSubject]}学科与年段平均水平存在差距，
                建议加强该学科的教学投入，重点关注后进生转化，争取在下次考试中缩小差距。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 缺考上报 Tab */}
      {activeTab === 'absence' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800">缺考上报</h2>
            <p className="text-sm text-gray-500">上报本班学生的缺考情况，提交后需教务处审核</p>
          </div>
          <AbsenceManagement 
            mode="teacher" 
            className={selectedClass}
          />
        </div>
      )}
    </div>
  );
};

export default HeadTeacherView;
