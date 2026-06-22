import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  BookOpen,
  Award,
  Target,
  ChevronDown,
  ChevronRight,
  Filter,
  Upload,
  Search,
  School,
  GraduationCap,
  Calculator,
  Percent,
  Trophy,
  BarChart2,
  PieChart as PieChartIcon,
  TrendingDown
} from 'lucide-react';
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
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from 'recharts';

const SubjectAnalysis = () => {
  const [selectedExam, setSelectedExam] = useState('2025-1期末');
  const [selectedGrade, setSelectedGrade] = useState('7年级');
  const [selectedSubject, setSelectedSubject] = useState('语文');
  const [activeTab, setActiveTab] = useState('class'); // class, distribution, rank
  const [rankRange, setRankRange] = useState(100);

  // 模拟考试数据
  const exams = [
    { id: 1, name: '2025-1期末', grade: '7年级', date: '2025-01-15' },
    { id: 2, name: '2024-2期末', grade: '7年级', date: '2024-07-10' },
    { id: 3, name: '2024-2期中', grade: '8年级', date: '2024-11-15' },
  ];

  const subjects = ['语文', '数学', '英语', '科学', '社会'];
  const grades = ['7年级', '8年级', '9年级'];

  // 年级统计数据
  const gradeStats = {
    total_students: 433,
    avg_score: 73.41,
    std_deviation: 8.0,
    max_score: 89,
    excellent_score: 80.5,
    pass_score: 60,
    full_score: 100
  };

  // 详细班级成绩分析数据（根据您提供的表格）
  const detailedClassData = [
    { 
      class: '701', teacher: '林听听', 
      should_attend: 44, actual_attend: 43,
      avg: 73.24, avg_diff: -0.16, rank: 6,
      std_dev: 7.1, std_score: 69.70, cv: 0.10,
      top20_count: 10, top20_rate: 23.26, top20_rank: 3,
      top40_count: 15, top40_rate: 34.88, top40_rank: 6,
      top60_count: 22, top60_rate: 51.16, top60_rank: 9,
      top80_count: 32, top80_rate: 74.42, top80_rank: 8,
      bottom20_count: 11, bottom20_rate: 25.58, bottom20_rank: 6,
      z_value: 61.83, z_rank: 6
    },
    { 
      class: '702', teacher: '林听听',
      should_attend: 46, actual_attend: 45,
      avg: 74.06, avg_diff: 0.65, rank: 3,
      std_dev: 8.1, std_score: 71.22, cv: 0.11,
      top20_count: 10, top20_rate: 22.22, top20_rank: 4,
      top40_count: 18, top40_rate: 40.00, top40_rank: 1,
      top60_count: 28, top60_rate: 62.22, top60_rank: 5,
      top80_count: 39, top80_rate: 86.67, top80_rank: 1,
      bottom20_count: 6, bottom20_rate: 13.33, bottom20_rank: 3,
      z_value: 66.06, z_rank: 3
    },
    { 
      class: '703', teacher: '王江萌',
      should_attend: 44, actual_attend: 43,
      avg: 73.34, avg_diff: -0.07, rank: 4,
      std_dev: 8.5, std_score: 73.64, cv: 0.11,
      top20_count: 16, top20_rate: 36.36, top20_rank: 1,
      top40_count: 25, top40_rate: 56.82, top40_rank: 1,
      top60_count: 30, top60_rate: 68.18, top40_rank: 2,
      top80_count: 36, top80_rate: 81.82, top40_rank: 4,
      bottom20_count: 8, bottom20_rate: 18.18, top40_rank: 1,
      z_value: 68.64, z_rank: 1
    },
    { 
      class: '704', teacher: '周慧敏',
      should_attend: 44, actual_attend: 43,
      avg: 72.24, avg_diff: -1.16, rank: 8,
      std_dev: 7.9, std_score: 67.82, cv: 0.11,
      top20_count: 7, top20_rate: 16.28, top20_rank: 7,
      top40_count: 14, top40_rate: 32.56, top40_rank: 8,
      top60_count: 23, top60_rate: 53.49, top60_rank: 7,
      top80_count: 29, top80_rate: 67.44, top80_rank: 10,
      bottom20_count: 14, bottom20_rate: 32.56, bottom20_rank: 10,
      z_value: 57.40, z_rank: 10
    },
    { 
      class: '705', teacher: '周慧敏',
      should_attend: 48, actual_attend: 46,
      avg: 74.04, avg_diff: 0.64, rank: 4,
      std_dev: 8.0, std_score: 71.20, cv: 0.11,
      top20_count: 9, top20_rate: 19.57, top20_rank: 6,
      top40_count: 21, top40_rate: 45.65, top40_rank: 2,
      top60_count: 29, top60_rate: 63.04, top60_rank: 4,
      top80_count: 37, top80_rate: 80.43, top80_rank: 5,
      bottom20_count: 9, bottom20_rate: 19.57, bottom20_rank: 5,
      z_value: 63.64, z_rank: 5
    },
    { 
      class: '706', teacher: '吴国平',
      should_attend: 43, actual_attend: 43,
      avg: 73.93, avg_diff: -0.07, rank: 5,
      std_dev: 9.1, std_score: 69.87, cv: 0.12,
      top20_count: 9, top20_rate: 20.93, top20_rank: 5,
      top40_count: 17, top40_rate: 39.53, top40_rank: 5,
      top60_count: 28, top60_rate: 65.12, top60_rank: 3,
      top80_count: 37, top80_rate: 86.05, top80_rank: 2,
      bottom20_count: 6, bottom20_rate: 13.95, bottom20_rank: 2,
      z_value: 64.94, z_rank: 4
    },
    { 
      class: '707', teacher: '吴国平',
      should_attend: 44, actual_attend: 44,
      avg: 72.95, avg_diff: -0.44, rank: 6,
      std_dev: 7.2, std_score: 69.18, cv: 0.10,
      top20_count: 7, top20_rate: 15.91, top20_rank: 8,
      top40_count: 16, top40_rate: 36.36, top40_rank: 6,
      top60_count: 28, top60_rate: 63.64, top60_rank: 6,
      top80_count: 38, top80_rate: 86.36, top40_rank: 3,
      bottom20_count: 6, bottom20_rate: 13.64, bottom20_rank: 4,
      z_value: 61.26, z_rank: 7
    },
    { 
      class: '708', teacher: '张琪',
      should_attend: 44, actual_attend: 44,
      avg: 72.05, avg_diff: -1.36, rank: 9,
      std_dev: 7.59, std_score: 67.45, cv: 0.11,
      top20_count: 6, top20_rate: 13.64, top20_rank: 10,
      top40_count: 12, top40_rate: 27.27, top40_rank: 9,
      top60_count: 23, top60_rate: 52.27, top60_rank: 9,
      top80_count: 35, top80_rate: 79.55, top40_rank: 7,
      bottom20_count: 9, bottom20_rate: 20.45, bottom20_rank: 7,
      z_value: 60.31, z_rank: 8
    },
    { 
      class: '709', teacher: '陈黄蔓',
      should_attend: 43, actual_attend: 43,
      avg: 74.63, avg_diff: 1.22, rank: 2,
      std_dev: 8.6, std_score: 72.30, cv: 0.12,
      top20_count: 12, top20_rate: 27.91, top20_rank: 2,
      top40_count: 19, top40_rate: 44.19, top40_rank: 3,
      top60_count: 30, top60_rate: 69.77, top60_rank: 1,
      top80_count: 37, top80_rate: 86.05, top40_rank: 2,
      bottom20_count: 6, bottom20_rate: 13.95, bottom20_rank: 2,
      z_value: 67.54, z_rank: 2
    },
    { 
      class: '710', teacher: '陈盈盈',
      should_attend: 45, actual_attend: 34,
      avg: 71.76, avg_diff: -1.64, rank: 10,
      std_dev: 7.6, std_score: 66.92, cv: 0.11,
      top20_count: 5, top20_rate: 14.71, top20_rank: 9,
      top40_count: 11, top40_rate: 32.35, top40_rank: 10,
      top60_count: 16, top60_rate: 47.06, top60_rank: 10,
      top80_count: 24, top80_rate: 70.59, top40_rank: 9,
      bottom20_count: 10, bottom20_rate: 29.41, bottom20_rank: 9,
      z_value: 57.58, z_rank: 9
    }
  ];

  // 前后20%分布数据
  const topBottom20Data = {
    top20_line: 429, // 前20%分数线
    bottom20_line: 351, // 后20%分数线
    classes: [
      { class: '1', top20_count: 6, top20_rate: 13.95, bottom20_count: 9, bottom20_rate: 20.93 },
      { class: '2', top20_count: 11, top20_rate: 24.44, bottom20_count: 8, bottom20_rate: 17.78 },
      { class: '3', top20_count: 13, top20_rate: 29.55, bottom20_count: 8, bottom20_rate: 18.18 },
      { class: '4', top20_count: 8, top20_rate: 18.60, bottom20_count: 9, bottom20_rate: 20.93 },
      { class: '5', top20_count: 9, top20_rate: 19.57, bottom20_count: 10, bottom20_rate: 21.74 },
      { class: '6', top20_count: 4, top20_rate: 9.30, bottom20_count: 9, bottom20_rate: 20.93 },
      { class: '7', top20_count: 11, top20_rate: 22.92, bottom20_count: 4, bottom20_rate: 8.33 },
      { class: '8', top20_count: 7, top20_rate: 15.91, bottom20_count: 8, bottom20_rate: 18.18 },
      { class: '9', top20_count: 13, top20_rate: 30.23, bottom20_count: 10, bottom20_rate: 23.26 },
      { class: '10', top20_count: 5, top20_rate: 14.71, bottom20_count: 13, bottom20_rate: 38.24 }
    ]
  };

  // 名次段人数分布数据
  const rankDistributionData = [
    { class: '1', count: 7, rate: 16.28 },
    { class: '2', count: 11, rate: 24.44 },
    { class: '3', count: 15, rate: 34.09 },
    { class: '4', count: 10, rate: 23.26 },
    { class: '5', count: 10, rate: 21.74 },
    { class: '6', count: 7, rate: 16.28 },
    { class: '7', count: 14, rate: 29.17 },
    { class: '8', count: 7, rate: 15.91 },
    { class: '9', count: 14, rate: 32.56 },
    { class: '10', count: 6, rate: 17.65 }
  ];

  // 总分排名分数段数据
  const scoreRankData = [
    { rank: 50, score: 438 },
    { rank: 100, score: 424.5 },
    { rank: 150, score: 410.5 },
    { rank: 200, score: 397.5 },
    { rank: 250, score: 388 },
    { rank: 300, score: 366 },
    { rank: 350, score: 349.5 },
    { rank: 400, score: 322 },
    { rank: 433, score: 207.5 }
  ];

  // 综合分析数据
  const comprehensiveAnalysis = {
    subjects: [
      { name: '语文', max: 89, excellent: 80.5, avg: 73.4, full: 100 },
      { name: '数学', max: 100, excellent: 92, avg: 80.9, full: 100 },
      { name: '英语', max: 98.5, excellent: 88.5, avg: 71.9, full: 100 },
      { name: '科学', max: 100, excellent: 95, avg: 88.9, full: 100 },
      { name: '社会', max: 95, excellent: 82.5, avg: 73.2, full: 100 }
    ],
    total: { max: 470, excellent: 429, avg: 388.3, full: 500 }
  };

  const getZValueColor = (z) => {
    if (z >= 65) return 'text-green-600';
    if (z >= 60) return 'text-blue-600';
    if (z >= 55) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getZValueBg = (z) => {
    if (z >= 65) return 'bg-green-100';
    if (z >= 60) return 'bg-blue-100';
    if (z >= 55) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getRateColor = (rate) => {
    if (rate >= 25) return 'text-green-600 font-semibold';
    if (rate >= 15) return 'text-blue-600';
    if (rate >= 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">学科成绩分析</h1>
        <p className="text-gray-500 mt-1">多维度分析学科成绩，精准定位教学问题</p>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-gray-400" />
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {exams.map(exam => (
                <option key={exam.id} value={exam.name}>{exam.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <School className="w-5 h-5 text-gray-400" />
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {grades.map(grade => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-gray-400" />
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ml-auto">
            <Upload className="w-4 h-4" />
            导出分析报告
          </button>
        </div>
      </div>

      {/* 年级统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">实考人数</p>
              <p className="text-xl font-bold text-gray-800">{gradeStats.total_students}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Calculator className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">年级平均分</p>
              <p className="text-xl font-bold text-blue-600">{gradeStats.avg_score}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">标准差</p>
              <p className="text-xl font-bold text-purple-600">{gradeStats.std_deviation}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Trophy className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">最高分</p>
              <p className="text-xl font-bold text-orange-600">{gradeStats.max_score}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-2 rounded-lg">
              <Award className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">优秀分</p>
              <p className="text-xl font-bold text-yellow-600">{gradeStats.excellent_score}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 综合分析表 */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart2 className="w-5 h-5" />
          综合分析
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">学科</th>
                {comprehensiveAnalysis.subjects.map(sub => (
                  <th key={sub.name} className="border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">{sub.name}</th>
                ))}
                <th className="border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-blue-50">总分</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50">最高分</td>
                {comprehensiveAnalysis.subjects.map(sub => (
                  <td key={sub.name} className="border border-gray-300 px-4 py-2 text-sm text-center">{sub.max}</td>
                ))}
                <td className="border border-gray-300 px-4 py-2 text-sm text-center font-semibold bg-blue-50">{comprehensiveAnalysis.total.max}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50">优秀分</td>
                {comprehensiveAnalysis.subjects.map(sub => (
                  <td key={sub.name} className="border border-gray-300 px-4 py-2 text-sm text-center text-green-600">{sub.excellent}</td>
                ))}
                <td className="border border-gray-300 px-4 py-2 text-sm text-center font-semibold text-green-600 bg-blue-50">{comprehensiveAnalysis.total.excellent}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50">平均分</td>
                {comprehensiveAnalysis.subjects.map(sub => (
                  <td key={sub.name} className="border border-gray-300 px-4 py-2 text-sm text-center">{sub.avg}</td>
                ))}
                <td className="border border-gray-300 px-4 py-2 text-sm text-center font-semibold bg-blue-50">{comprehensiveAnalysis.total.avg}</td>
              </tr>
              <tr>
                <td className="border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50">卷面分</td>
                {comprehensiveAnalysis.subjects.map(sub => (
                  <td key={sub.name} className="border border-gray-300 px-4 py-2 text-sm text-center text-gray-500">{sub.full}</td>
                ))}
                <td className="border border-gray-300 px-4 py-2 text-sm text-center text-gray-500 bg-blue-50">{comprehensiveAnalysis.total.full}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 选项卡切换 */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('class')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium ${
              activeTab === 'class'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <School className="w-4 h-4" />
            班级成绩分析
          </button>
          <button
            onClick={() => setActiveTab('distribution')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium ${
              activeTab === 'distribution'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <PieChartIcon className="w-4 h-4" />
            前后20%分布
          </button>
          <button
            onClick={() => setActiveTab('rank')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium ${
              activeTab === 'rank'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            名次段分布
          </button>
        </div>

        {/* 班级成绩分析表 */}
        {activeTab === 'class' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {selectedSubject}成绩分析表（{selectedExam}）
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th rowSpan="2" className="px-2 py-2 border text-xs font-medium text-gray-600">班级</th>
                    <th rowSpan="2" className="px-2 py-2 border text-xs font-medium text-gray-600">老师</th>
                    <th colSpan="2" className="px-2 py-2 border text-xs font-medium text-gray-600 bg-blue-50">人数</th>
                    <th colSpan="4" className="px-2 py-2 border text-xs font-medium text-gray-600 bg-green-50">平均分</th>
                    <th colSpan="3" className="px-2 py-2 border text-xs font-medium text-gray-600 bg-purple-50">标准差</th>
                    <th colSpan="2" className="px-2 py-2 border text-xs font-medium text-gray-600 bg-yellow-50">前20%</th>
                    <th colSpan="2" className="px-2 py-2 border text-xs font-medium text-gray-600 bg-orange-50">前40%</th>
                    <th colSpan="2" className="px-2 py-2 border text-xs font-medium text-gray-600 bg-pink-50">前60%</th>
                    <th colSpan="2" className="px-2 py-2 border text-xs font-medium text-gray-600 bg-indigo-50">前80%</th>
                    <th colSpan="2" className="px-2 py-2 border text-xs font-medium text-gray-600 bg-red-50">后20%</th>
                    <th colSpan="2" className="px-2 py-2 border text-xs font-medium text-gray-600 bg-gray-100">Z值</th>
                  </tr>
                  <tr className="bg-gray-50">
                    <th className="px-2 py-2 border text-xs text-gray-500">应考</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">实考</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">平均</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">均差</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">序</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">标准差</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">标准分</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">变差系数</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">人数</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">比例</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">人数</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">比例</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">人数</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">比例</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">人数</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">比例</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">人数</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">比例</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">Z分</th>
                    <th className="px-2 py-2 border text-xs text-gray-500">序</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {detailedClassData.map((cls) => (
                    <tr key={cls.class} className="hover:bg-gray-50">
                      <td className="px-2 py-2 border text-center font-medium">{cls.class}</td>
                      <td className="px-2 py-2 border text-center">{cls.teacher}</td>
                      <td className="px-2 py-2 border text-center">{cls.should_attend}</td>
                      <td className="px-2 py-2 border text-center">{cls.actual_attend}</td>
                      <td className="px-2 py-2 border text-center font-semibold">{cls.avg}</td>
                      <td className={`px-2 py-2 border text-center ${cls.avg_diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {cls.avg_diff > 0 ? '+' : ''}{cls.avg_diff}
                      </td>
                      <td className="px-2 py-2 border text-center">{cls.rank}</td>
                      <td className="px-2 py-2 border text-center">{cls.std_dev}</td>
                      <td className="px-2 py-2 border text-center">{cls.std_score}</td>
                      <td className="px-2 py-2 border text-center">{cls.cv}</td>
                      <td className="px-2 py-2 border text-center">{cls.top20_count}</td>
                      <td className={`px-2 py-2 border text-center ${getRateColor(cls.top20_rate)}`}>{cls.top20_rate}%</td>
                      <td className="px-2 py-2 border text-center">{cls.top40_count}</td>
                      <td className={`px-2 py-2 border text-center ${getRateColor(cls.top40_rate)}`}>{cls.top40_rate}%</td>
                      <td className="px-2 py-2 border text-center">{cls.top60_count}</td>
                      <td className="px-2 py-2 border text-center">{cls.top60_rate}%</td>
                      <td className="px-2 py-2 border text-center">{cls.top80_count}</td>
                      <td className="px-2 py-2 border text-center">{cls.top80_rate}%</td>
                      <td className="px-2 py-2 border text-center">{cls.bottom20_count}</td>
                      <td className={`px-2 py-2 border text-center ${cls.bottom20_rate > 20 ? 'text-red-600 font-semibold' : ''}`}>{cls.bottom20_rate}%</td>
                      <td className={`px-2 py-2 border text-center font-semibold ${getZValueColor(cls.z_value)}`}>{cls.z_value}</td>
                      <td className="px-2 py-2 border text-center">{cls.z_rank}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 前后20%分布 */}
        {activeTab === 'distribution' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              前后20%人数分布（{selectedExam}）
            </h3>
            
            {/* 分数线提示 */}
            <div className="flex gap-6 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                <span className="text-sm text-gray-600">前20%分数线：</span>
                <span className="text-lg font-bold text-green-600">{topBottom20Data.top20_line}分</span>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                <span className="text-sm text-gray-600">后20%分数线：</span>
                <span className="text-lg font-bold text-red-600">{topBottom20Data.bottom20_line}分</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-yellow-100">
                    <th className="border border-gray-300 px-4 py-2 text-sm font-medium">前20%</th>
                    <th className="border border-gray-300 px-4 py-2 text-sm font-medium">班级</th>
                    <th colSpan="2" className="border border-gray-300 px-4 py-2 text-sm font-medium bg-green-50">前20%</th>
                    <th colSpan="2" className="border border-gray-300 px-4 py-2 text-sm font-medium bg-red-50">后20%</th>
                  </tr>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-sm">分数线</th>
                    <th className="border border-gray-300 px-4 py-2 text-sm"></th>
                    <th className="border border-gray-300 px-4 py-2 text-sm">人数</th>
                    <th className="border border-gray-300 px-4 py-2 text-sm">占比</th>
                    <th className="border border-gray-300 px-4 py-2 text-sm">人数</th>
                    <th className="border border-gray-300 px-4 py-2 text-sm">占比</th>
                  </tr>
                </thead>
                <tbody>
                  {topBottom20Data.classes.map((cls, index) => (
                    <tr key={cls.class} className="hover:bg-gray-50">
                      {index === 0 && (
                        <td rowSpan={topBottom20Data.classes.length} className="border border-gray-300 px-4 py-2 text-center font-semibold text-green-600 bg-green-50">
                          {topBottom20Data.top20_line}
                        </td>
                      )}
                      <td className="border border-gray-300 px-4 py-2 text-center">{cls.class}班</td>
                      <td className={`border border-gray-300 px-4 py-2 text-center ${cls.top20_count >= 11 ? 'bg-yellow-100 font-semibold' : ''}`}>{cls.top20_count}</td>
                      <td className={`border border-gray-300 px-4 py-2 text-center ${getRateColor(cls.top20_rate)}`}>{cls.top20_rate}%</td>
                      <td className={`border border-gray-300 px-4 py-2 text-center ${cls.bottom20_count >= 10 ? 'bg-yellow-100 font-semibold' : ''}`}>{cls.bottom20_count}</td>
                      <td className={`border border-gray-300 px-4 py-2 text-center ${cls.bottom20_rate >= 23 ? 'text-red-600 font-semibold' : ''}`}>{cls.bottom20_rate}%</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-semibold">
                    <td colSpan="2" className="border border-gray-300 px-4 py-2 text-center">合计/平均</td>
                    <td className="border border-gray-300 px-4 py-2 text-center">91</td>
                    <td className="border border-gray-300 px-4 py-2 text-center">21.02%</td>
                    <td className="border border-gray-300 px-4 py-2 text-center">89</td>
                    <td className="border border-gray-300 px-4 py-2 text-center">20.55%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 名次段分布 */}
        {activeTab === 'rank' && (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              名次段人数分布（{selectedExam}）
            </h3>
            
            {/* 名次范围输入 */}
            <div className="flex items-center gap-4 mb-6">
              <label className="text-sm text-gray-600">名次范围：</label>
              <input
                type="number"
                value={rankRange}
                onChange={(e) => setRankRange(parseInt(e.target.value) || 100)}
                className="px-3 py-2 border border-gray-300 rounded-lg w-24"
                placeholder="输入名次"
              />
              <span className="text-sm text-gray-500">名以内</span>
              <span className="text-xs text-gray-400 ml-2">💡 输入数字即可看到各班对应名次范围的人数</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-yellow-100">
                    <th className="border border-gray-300 px-4 py-2 text-sm font-medium">名次范围</th>
                    <th className="border border-gray-300 px-4 py-2 text-sm font-medium">班级</th>
                    <th className="border border-gray-300 px-4 py-2 text-sm font-medium">对应名次人数</th>
                    <th className="border border-gray-300 px-4 py-2 text-sm font-medium">占比</th>
                  </tr>
                </thead>
                <tbody>
                  {rankDistributionData.map((cls, index) => (
                    <tr key={cls.class} className="hover:bg-gray-50">
                      {index === 0 && (
                        <td rowSpan={rankDistributionData.length} className="border border-gray-300 px-4 py-2 text-center font-semibold bg-green-50">
                          {rankRange}
                        </td>
                      )}
                      <td className="border border-gray-300 px-4 py-2 text-center">{cls.class}班</td>
                      <td className={`border border-gray-300 px-4 py-2 text-center ${cls.count >= 11 ? 'bg-yellow-100 font-semibold' : ''}`}>{cls.count}</td>
                      <td className={`border border-gray-300 px-4 py-2 text-center ${getRateColor(cls.rate)}`}>{cls.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 总分排名分数段 */}
            <div className="mt-8">
              <h4 className="font-semibold text-gray-800 mb-4">总分排名分数段参考</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="border border-gray-300 px-4 py-2 text-sm font-medium">名次</th>
                      {scoreRankData.map(item => (
                        <th key={item.rank} className="border border-gray-300 px-4 py-2 text-sm font-medium">{item.rank}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2 text-sm font-medium bg-gray-50">分数</td>
                      {scoreRankData.map(item => (
                        <td key={item.rank} className="border border-gray-300 px-4 py-2 text-sm text-center">{item.score}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubjectAnalysis;
