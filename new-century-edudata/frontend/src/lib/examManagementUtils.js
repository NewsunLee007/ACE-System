import { DEFAULT_SUBJECTS } from './subjectCatalog';
import { hasBackendAuthToken } from './sessionToken';

export const hasBackendSession = hasBackendAuthToken;

export const getNextExamId = (items) => (
  items.reduce((maxId, item) => Math.max(maxId, Number(item.id) || 0), 0) + 1
);

export const isExcelScoreFile = (file) => /\.(xls|xlsx)$/i.test(file?.name || '');

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const csvValue = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export const getLocalSubjectNames = (subjects = []) => (
  Array.isArray(subjects) && subjects.length > 0 ? subjects : DEFAULT_SUBJECTS
);

export const normalizeExamNameWithTerm = (examName, term) => {
  const base = String(examName || '').replace(/^\s*\d{4}-\d{1,2}\s+/, '').trim();
  if (!term) return base;
  return `${term} ${base}`.trim();
};

export const buildScoreTemplateCsv = (exam) => {
  const subjects = Array.isArray(exam?.subjects) ? exam.subjects : [];
  const headers = ['学籍辅号', '姓名', '班级', ...subjects, '参与统计', '额外统计班级'];
  const sampleData = [
    ['20240701001', '张三', '701', ...subjects.map(() => '85'), '是', '704;705'],
    ['20240701002', '李四', '701', ...subjects.map(() => '90'), '是', ''],
  ];

  return [headers.join(','), ...sampleData.map(row => row.join(','))].join('\n');
};

export const buildLocalExamScoresCsv = ({ exam, scores = [] }) => {
  const subjects = Array.isArray(exam?.subjects) ? exam.subjects : [];
  const headers = ['学籍辅号', '姓名', '班级', '考号', ...subjects, '总分', '参与统计', '备注'];
  const rows = scores.map(score => ([
    score.student_code || '',
    score.student_name || '',
    score.class_name || score.class_id || '',
    score.exam_number || '',
    ...subjects.map(subject => score.scores?.[subject] ?? ''),
    score.total_score ?? '',
    score.is_valid === false || score.is_included === false ? '否' : '是',
    score.remarks || ''
  ]));

  return [headers, ...rows].map(row => row.map(csvValue).join(',')).join('\n');
};

export const filterAndSortScores = ({
  scores = [],
  searchTerm = '',
  filterClass = '',
  sortField = 'total_score',
  sortOrder = 'desc',
}) => {
  let nextScores = [...scores];

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    nextScores = nextScores.filter(score =>
      score.student_name?.toLowerCase().includes(term) ||
      score.student_code?.toLowerCase().includes(term)
    );
  }

  if (filterClass) {
    nextScores = nextScores.filter(score => String(score.class_id) === String(filterClass));
  }

  return [...nextScores].sort((a, b) => {
    let aValue;
    let bValue;

    if (sortField === 'total_score') {
      aValue = Number(a.total_score) || 0;
      bValue = Number(b.total_score) || 0;
    } else if (sortField === 'rank') {
      aValue = Number(a.rank) || 0;
      bValue = Number(b.rank) || 0;
    } else if (sortField === 'class_rank') {
      aValue = Number(a.class_rank) || 0;
      bValue = Number(b.class_rank) || 0;
    } else {
      aValue = Number(a.scores?.[sortField]) || 0;
      bValue = Number(b.scores?.[sortField]) || 0;
    }

    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });
};

export const getGradeClassesForExam = ({ exam, classes = [] }) => {
  if (!exam) return [];
  const grade = parseInt(exam.grade_level, 10);
  return (classes || [])
    .filter(item => Math.floor(Number(item.id) / 100) === grade)
    .sort((a, b) => Number(a.id) - Number(b.id));
};

export const getStatusColor = (status) => {
  switch (status) {
    case '已完成':
      return 'bg-green-100 text-green-700';
    case '进行中':
      return 'bg-blue-100 text-blue-700';
    case '未开始':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export const filterExams = ({
  exams = [],
  searchTerm = '',
  filterGrade = '',
  filterTerm = '',
}) => {
  const normalizedSearch = searchTerm.toLowerCase();
  return exams.filter(exam => {
    const matchSearch = String(exam.exam_name || '').toLowerCase().includes(normalizedSearch);
    const matchGrade = !filterGrade || exam.grade_level === filterGrade;
    const matchTerm = !filterTerm || exam.term === filterTerm;
    return matchSearch && matchGrade && matchTerm;
  });
};

export const getExamValidStudentCount = ({ exam, scores = [] }) => {
  const localScores = scores.filter(score => Number(score.exam_id) === Number(exam?.id));
  return Number(exam?.valid_students || 0) || localScores.filter(score => score.is_valid !== false).length;
};

export const calculateExamOverview = ({ exams = [], examScores = [], now = new Date() }) => {
  const backendValidStudents = exams.reduce((sum, exam) => sum + Number(exam.valid_students || 0), 0);
  const localValidStudents = examScores.filter(score => score.is_valid !== false).length;
  const validStudents = backendValidStudents || localValidStudents;

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const thisMonthExams = exams.filter(exam => {
    const examDate = new Date(exam.exam_date);
    return examDate.getMonth() === currentMonth && examDate.getFullYear() === currentYear;
  }).length;

  const backendCompletedExams = exams.filter(exam => Number(exam.valid_students || 0) > 0 || exam.status === '已完成').length;
  const localCompletedExams = new Set(examScores.map(score => score.exam_id)).size;
  const completedExams = backendCompletedExams || localCompletedExams;

  return {
    totalExams: exams.length,
    completedExams,
    validStudents,
    thisMonthExams,
  };
};

export const calculateClassStats = ({ selectedExam, examScores = [], classes = [] }) => {
  if (!selectedExam || examScores.length === 0) return [];

  const gradeClasses = getGradeClassesForExam({ exam: selectedExam, classes });
  const scores = examScores.filter(score => score.exam_id === selectedExam.id);
  const allScores = scores.map(score => score.total_score);
  if (allScores.length === 0) return [];

  const gradeAvg = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
  const gradeStd = Math.sqrt(allScores.reduce((sq, score) => sq + Math.pow(score - gradeAvg, 2), 0) / allScores.length);
  const sortedScores = [...allScores].sort((a, b) => b - a);
  const top20Threshold = sortedScores[Math.floor(allScores.length * 0.2)] || 0;
  const classStatsMap = {};

  scores.forEach(score => {
    const classId = score.class_id;
    if (!classStatsMap[classId]) {
      classStatsMap[classId] = {
        class_id: classId,
        scores: [],
        top20_count: 0
      };
    }
    classStatsMap[classId].scores.push(score.total_score);
    if (score.total_score >= top20Threshold) {
      classStatsMap[classId].top20_count += 1;
    }
  });

  const stats = Object.values(classStatsMap).map(stat => {
    const targetClass = gradeClasses.find(item => item.id === stat.class_id);
    const classNo = targetClass ? parseInt(String(targetClass.id).slice(-2), 10) : 0;
    const count = stat.scores.length;
    const avg = stat.scores.reduce((sum, score) => sum + score, 0) / count;
    const zValue = gradeStd > 0 ? (avg - gradeAvg) / gradeStd : 0;
    const top20Rate = Math.round((stat.top20_count / count) * 100);

    return {
      class_no: classNo,
      student_count: count,
      avg_score: avg.toFixed(1),
      z_value: zValue.toFixed(2),
      top20_rate: top20Rate,
      rank: 0
    };
  });

  stats.sort((a, b) => b.avg_score - a.avg_score);
  stats.forEach((stat, index) => {
    stat.rank = index + 1;
  });

  return stats;
};
