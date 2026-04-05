import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from 'recharts';
import {
  Trophy,
  TrendingUp,
  Users,
  Target,
  Award,
  ChevronDown,
  Download,
  RefreshCw
} from 'lucide-react';

// 教务处统测大屏组件
const Dashboard = () => {
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exams, setExams] = useState([]);
  const [layers, setLayers] = useState([]);

  // 模拟数据获取
  useEffect(() => {
    // 模拟考试列表
    setExams([
      { id: 1, name: '2025-1 7年级教学调研', grade: '7年级' },
      { id: 2, name: '2024-2 7年级期末统考', grade: '7年级' },
      { id: 3, name: '2024-2 8年级期中考试', grade: '8年级' },
    ]);

    // 模拟分层列表
    setLayers([
      { id: 1, name: 'A层 (701-710)', description: '前10个班级对比' },
      { id: 2, name: 'B层 (701-712)', description: '前12个班级对比' },
      { id: 3, name: '全段 (701-718)', description: '全部18个班级' },
    ]);

    // 模拟看板数据
    setDashboardData({
      exam_id: 1,
      exam_name: '2025-1 7年级教学调研',
      layer_id: 1,
      layer_name: 'A层 (701-710)',
      layer_stats: {
        total_students: 450,
        mean_score: 385.5,
        std_score: 45.23,
        max_score: 485,
        min_score: 185,
        threshold_20: 425,
        threshold_40: 398,
        threshold_60: 375,
        threshold_80: 345,
      },
      class_rankings: [
        { class_name: '702', final_z_value: 0.8234, class_mean: 412.5, top20_ratio: 0.35, top80_ratio: 0.85, class_count: 45 },
        { class_name: '705', final_z_value: 0.6543, class_mean: 405.2, top20_ratio: 0.30, top80_ratio: 0.82, class_count: 46 },
        { class_name: '701', final_z_value: 0.5432, class_mean: 398.5, top20_ratio: 0.28, top80_ratio: 0.78, class_count: 44 },
        { class_name: '708', final_z_value: 0.4321, class_mean: 392.0, top20_ratio: 0.25, top80_ratio: 0.75, class_count: 45 },
        { class_name: '703', final_z_value: 0.3210, class_mean: 388.5, top20_ratio: 0.22, top80_ratio: 0.72, class_count: 45 },
        { class_name: '710', final_z_value: 0.2109, class_mean: 382.0, top20_ratio: 0.20, top80_ratio: 0.70, class_count: 44 },
        { class_name: '704', final_z_value: 0.1098, class_mean: 378.5, top20_ratio: 0.18, top80_ratio: 0.68, class_count: 46 },
        { class_name: '706', final_z_value: -0.0123, class_mean: 375.0, top20_ratio: 0.15, top80_ratio: 0.65, class_count: 45 },
        { class_name: '709', final_z_value: -0.1234, class_mean: 368.5, top20_ratio: 0.12, top80_ratio: 0.62, class_count: 45 },
        { class_name: '707', final_z_value: -0.2345, class_mean: 362.0, top20_ratio: 0.10, top80_ratio: 0.58, class_count: 45 },
      ],
      subject_thresholds: [
        { percentage: 0.20, label: '前20%', threshold_total: 425, threshold_chinese: 88, threshold_math: 85, threshold_english: 82, threshold_science: 90, threshold_society: 85, student_count: 90 },
        { percentage: 0.40, label: '前40%', threshold_total: 398, threshold_chinese: 82, threshold_math: 78, threshold_english: 75, threshold_science: 82, threshold_society: 78, student_count: 180 },
        { percentage: 0.60, label: '前60%', threshold_total: 375, threshold_chinese: 76, threshold_math: 72, threshold_english: 68, threshold_science: 75, threshold_society: 72, student_count: 270 },
        { percentage: 0.80, label: '前80%', threshold_total: 345, threshold_chinese: 70, threshold_math: 65, threshold_english: 60, threshold_science: 68, threshold_society: 65, student_count: 360 },
      ],
    });
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  const getZValueColor = (zValue) => {
    if (zValue >= 0.5) return '#10b981'; // 绿色-优秀
    if (zValue >= 0) return '#3b82f6';   // 蓝色-良好
    if (zValue >= -0.3) return '#f59e0b'; // 黄色-一般
    return '#ef4444'; // 红色-需改进
  };

  const getZValueLevel = (zValue) => {
    if (zValue >= 0.5) return '优秀';
    if (zValue >= 0) return '良好';
    if (zValue >= -0.3) return '一般';
    return '需改进';
  };

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 顶部导航栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">教务处统测数据看板</h1>
            <p className="text-sm text-gray-500 mt-1">
              {dashboardData.exam_name} | {dashboardData.layer_name}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* 考试选择 */}
            <div className="relative">
              <select
                className="appearance-none bg-gray-50 border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedExam || ''}
                onChange={(e) => setSelectedExam(e.target.value)}
              >
                <option value="">选择考试</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            {/* 分层选择 */}
            <div className="relative">
              <select
                className="appearance-none bg-gray-50 border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedLayer || ''}
                onChange={(e) => setSelectedLayer(e.target.value)}
              >
                <option value="">选择分层</option>
                {layers.map((layer) => (
                  <option key={layer.id} value={layer.id}>
                    {layer.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>

            {/* 刷新按钮 */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新数据
            </button>

            {/* 导出按钮 */}
            <button className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
              <Download className="w-4 h-4" />
              导出报表
            </button>
          </div>
        </div>
      </div>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">分层总人数</p>
              <p className="text-3xl font-bold text-gray-800">
                {dashboardData.layer_stats.total_students}
              </p>
              <p className="text-xs text-gray-400 mt-1">参与统计学生</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">分层平均分</p>
              <p className="text-3xl font-bold text-gray-800">
                {dashboardData.layer_stats.mean_score}
              </p>
              <p className="text-xs text-gray-400 mt-1">标准差: {dashboardData.layer_stats.std_score}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">前20%分数线</p>
              <p className="text-3xl font-bold text-gray-800">
                {dashboardData.layer_stats.threshold_20}
              </p>
              <p className="text-xs text-gray-400 mt-1">高分段 cutoff</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Target className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">最高/最低分</p>
              <p className="text-3xl font-bold text-gray-800">
                {dashboardData.layer_stats.max_score}
              </p>
              <p className="text-xs text-gray-400 mt-1">最低: {dashboardData.layer_stats.min_score}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 班级Z值排名 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              班级综合Z值排名
            </h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              50-20-30加权模型
            </span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dashboardData.class_rankings}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[-0.5, 1]} />
                <YAxis dataKey="class_name" type="category" width={40} />
                <Tooltip
                  formatter={(value) => [value, 'Z值']}
                  labelFormatter={(label) => `${label}班`}
                />
                <Bar dataKey="final_z_value" radius={[0, 4, 4, 0]}>
                  {dashboardData.class_rankings.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getZValueColor(entry.final_z_value)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span>优秀(≥0.5)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span>良好(0~0.5)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-500"></div>
              <span>一般(-0.3~0)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span>需改进(&lt;-0.3)</span>
            </div>
          </div>
        </div>

        {/* 学科有效分/下限分 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              各学科有效分/下限分
            </h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              基于总分前N%反算
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600">分数段</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">总分</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">语文</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">数学</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600 text-red-600">英语</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">科学</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">社会</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">人数</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.subject_thresholds.map((threshold, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-800">{threshold.label}</td>
                    <td className="px-3 py-2 text-center font-bold text-blue-600">{threshold.threshold_total}</td>
                    <td className="px-3 py-2 text-center">{threshold.threshold_chinese}</td>
                    <td className="px-3 py-2 text-center">{threshold.threshold_math}</td>
                    <td className="px-3 py-2 text-center text-red-600 font-medium">{threshold.threshold_english}</td>
                    <td className="px-3 py-2 text-center">{threshold.threshold_science}</td>
                    <td className="px-3 py-2 text-center">{threshold.threshold_society}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{threshold.student_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 班级详细排名表 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-500" />
            班级详细数据表
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">共 {dashboardData.class_rankings.length} 个班级</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">排名</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">班级</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">综合Z值</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">等级</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">班级均分</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">与年段差</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">前20%率</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">前80%率</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">有效人数</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.class_rankings.map((cls, index) => (
                <tr key={cls.class_name} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {index === 0 && <span className="text-yellow-500 font-bold">🥇</span>}
                    {index === 1 && <span className="text-gray-400 font-bold">🥈</span>}
                    {index === 2 && <span className="text-amber-600 font-bold">🥉</span>}
                    {index > 2 && <span className="text-gray-500">{index + 1}</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{cls.class_name}班</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="px-2 py-1 rounded text-white font-medium"
                      style={{ backgroundColor: getZValueColor(cls.final_z_value) }}
                    >
                      {cls.final_z_value.toFixed(4)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{getZValueLevel(cls.final_z_value)}</td>
                  <td className="px-4 py-3 text-center font-medium">{cls.class_mean}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cls.class_mean - dashboardData.layer_stats.mean_score >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {cls.class_mean - dashboardData.layer_stats.mean_score >= 0 ? '+' : ''}
                      {(cls.class_mean - dashboardData.layer_stats.mean_score).toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{(cls.top20_ratio * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-center">{(cls.top80_ratio * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-center text-gray-500">{cls.class_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 底部说明 */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Z值计算公式说明</h3>
        <p className="text-sm text-blue-700">
          <strong>Z_class = (Score_standard × 50%) + (Top20%_ratio × 20%) + (Top80%_ratio × 30%)</strong>
        </p>
        <p className="text-xs text-blue-600 mt-1">
          其中 Score_standard 为班级标准分，Top20%_ratio 为班级进入分层前20%人数占比，Top80%_ratio 为班级进入分层前80%人数占比。
          该公式综合考量班级整体水平、优秀生比例和中坚生比例，全面评估班级教学成效。
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
