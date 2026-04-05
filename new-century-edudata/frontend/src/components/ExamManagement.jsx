import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Calendar,
  BookOpen,
  Users,
  TrendingUp,
  FileText,
  Trash2,
  Edit,
  Eye,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  BarChart3,
  GraduationCap,
  School
} from 'lucide-react';
import schoolData from '../data/schoolData';
import AbsenceManagement from './AbsenceManagement';

const ExamManagement = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [importResults, setImportResults] = useState(null);
  const fileInputRef = useRef(null);

  // 成绩管理相关状态
  const [examScores, setExamScores] = useState([]);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showScoreImportModal, setShowScoreImportModal] = useState(false);
  const [showScoreEditModal, setShowScoreEditModal] = useState(false);
  const [selectedScore, setSelectedScore] = useState(null);
  const [scoreSearchTerm, setScoreSearchTerm] = useState('');
  const [scoreFilterClass, setScoreFilterClass] = useState('');
  const [scoreSortField, setScoreSortField] = useState('total_score');
  const [scoreSortOrder, setScoreSortOrder] = useState('desc');
  const [editingScores, setEditingScores] = useState({});
  const [editingIsValid, setEditingIsValid] = useState(true);
  const [editingAdditionalClasses, setEditingAdditionalClasses] = useState([]);

  // 缺考管理相关状态
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);

  // 编辑表单数据
  const [editForm, setEditForm] = useState({
    exam_name: '',
    term: '',
    exam_type: '',
    grade_level: '',
    exam_date: '',
    subjects: []
  });

  // 从学科管理获取学科列表
  const [availableSubjects, setAvailableSubjects] = useState([]);

  // 加载学科数据
  useEffect(() => {
    // 从schoolData获取学科列表
    const subjects = schoolData.subjects || ['语文', '数学', '英语', '科学', '社会'];
    setAvailableSubjects(subjects);
  }, []);

  // 创建考试表单数据
  const [createForm, setCreateForm] = useState({
    exam_name: '',
    term: '2025-1',
    exam_type: '期中',
    grade_level: '7年级',
    exam_date: '',
    subjects: [],
    subject_scores: {},
    full_score: 0
  });

  // 初始化创建表单的学科
  useEffect(() => {
    if (availableSubjects.length > 0 && createForm.subjects.length === 0) {
      const defaultSubjects = availableSubjects.slice(0, 5);
      const defaultScores = {};
      defaultSubjects.forEach(subj => {
        defaultScores[subj] = 100;
      });
      setCreateForm(prev => ({
        ...prev,
        subjects: defaultSubjects,
        subject_scores: defaultScores,
        full_score: defaultSubjects.length * 100
      }));
    }
  }, [availableSubjects]);

  // 从schoolData加载考试数据
  useEffect(() => {
    // 优先从localStorage加载数据
    const storedExams = schoolData.exams || [];
    if (storedExams.length > 0) {
      setExams(storedExams);
    } else {
      // 如果没有存储数据，使用默认示例数据
      const defaultSubjects = availableSubjects.length > 0 ? availableSubjects.slice(0, 5) : ['语文', '数学', '英语', '科学', '社会'];
      const defaultSubjectScores = {
        '语文': 100,
        '数学': 100,
        '英语': 100,
        '科学': 100,
        '社会': 100
      };
      const defaultExams = [
      {
        id: 1,
        exam_name: '2025-1 7年级教学调研',
        term: '2025-1',
        exam_type: '统测',
        grade_level: '7年级',
        exam_date: '2025-02-15',
        subjects: defaultSubjects,
        subject_scores: defaultSubjectScores,
        full_score: 500,
        total_students: 0,
        valid_students: 0,
        class_count: 0,
        status: '待导入',
        avg_score: 0,
        top_score: 0,
        pass_rate: 0
      },
      {
        id: 2,
        exam_name: '2024-2 7年级期末统考',
        term: '2024-2',
        exam_type: '期末',
        grade_level: '7年级',
        exam_date: '2025-01-10',
        subjects: defaultSubjects,
        subject_scores: defaultSubjectScores,
        full_score: 500,
        total_students: 0,
        valid_students: 0,
        class_count: 0,
        status: '待导入',
        avg_score: 0,
        top_score: 0,
        pass_rate: 0
      },
      {
        id: 3,
        exam_name: '2024-2 8年级期中考试',
        term: '2024-2',
        exam_type: '期中',
        grade_level: '8年级',
        exam_date: '2024-11-15',
        subjects: defaultSubjects,
        subject_scores: defaultSubjectScores,
        full_score: 500,
        total_students: 0,
        valid_students: 0,
        class_count: 0,
        status: '待导入',
        avg_score: 0,
        top_score: 0,
        pass_rate: 0
      },
      {
        id: 4,
        exam_name: '2025-1 8年级教学调研',
        term: '2025-1',
        exam_type: '统测',
        grade_level: '8年级',
        exam_date: '2025-02-20',
        subjects: defaultSubjects,
        subject_scores: defaultSubjectScores,
        full_score: 500,
        total_students: 0,
        valid_students: 0,
        class_count: 0,
        status: '未开始',
        avg_score: 0,
        top_score: 0,
        pass_rate: 0
      }
      ];
      setExams(defaultExams);
      // 保存到schoolData
      schoolData.exams = defaultExams;
    }
  }, [availableSubjects]);

  // 同步exams到schoolData
  useEffect(() => {
    if (exams.length > 0) {
      schoolData.exams = exams;
    }
  }, [exams]);

  useEffect(() => {
    if (!selectedExam) return;
    const latest = exams.find(e => e.id === selectedExam.id);
    if (latest) setSelectedExam(latest);
  }, [exams, selectedExam]);

  const handleCreateExam = () => {
    const defaultSubjects = ['语文', '数学', '英语', '科学', '社会'];
    const defaultScores = {};
    defaultSubjects.forEach(subj => {
      defaultScores[subj] = 100;
    });
    setCreateForm({
      exam_name: '',
      term: '2025-1',
      exam_type: '期中',
      grade_level: '7年级',
      exam_date: '',
      subjects: defaultSubjects,
      subject_scores: defaultScores,
      full_score: 500
    });
    setShowCreateModal(true);
  };

  const handleSaveCreate = (e) => {
    e.preventDefault();
    // 计算总分
    const totalScore = createForm.subjects.reduce((sum, subj) => {
      return sum + (createForm.subject_scores?.[subj] || 100);
    }, 0);
    const newExam = {
      id: exams.length + 1,
      ...createForm,
      full_score: totalScore,
      total_students: 0,
      valid_students: 0,
      class_count: 0,
      status: '未开始',
      avg_score: 0,
      top_score: 0,
      pass_rate: 0
    };
    setExams([...exams, newExam]);
    setShowCreateModal(false);
    alert('考试创建成功！');
  };

  const handleEditExam = (exam) => {
    setSelectedExam(exam);
    setEditForm({
      exam_name: exam.exam_name,
      term: exam.term,
      exam_type: exam.exam_type,
      grade_level: exam.grade_level,
      exam_date: exam.exam_date,
      subjects: [...exam.subjects],
      subject_scores: { ...(exam.subject_scores || {}) }
    });
    setShowEditModal(true);
  };

  const normalizeExamNameWithTerm = (examName, term) => {
    const base = String(examName || '').replace(/^\s*\d{4}-\d{1,2}\s+/, '').trim();
    if (!term) return base;
    return `${term} ${base}`.trim();
  };

  const handleViewDetail = (exam) => {
    setSelectedExam(exam);
    setShowDetailModal(true);
  };

  const handleImportScores = (exam) => {
    setSelectedExam(exam);
    setShowScoreImportModal(true);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      processImport(file);
    }
  };

  const processImport = async (file) => {
    setImportStatus('reading');
    setImportProgress(10);
    
    // 模拟读取文件
    await new Promise(resolve => setTimeout(resolve, 500));
    setImportProgress(30);
    
    // 模拟解析数据
    setImportStatus('parsing');
    await new Promise(resolve => setTimeout(resolve, 800));
    setImportProgress(50);
    
    // 模拟数据验证
    setImportStatus('validating');
    await new Promise(resolve => setTimeout(resolve, 600));
    setImportProgress(70);
    
    // 模拟导入数据
    setImportStatus('importing');
    await new Promise(resolve => setTimeout(resolve, 1000));
    setImportProgress(90);
    
    // 模拟计算Z值
    setImportStatus('calculating');
    await new Promise(resolve => setTimeout(resolve, 800));
    setImportProgress(100);
    
    // 导入完成
    setImportStatus('completed');
    setImportResults({
      total: 830,
      success: 827,
      failed: 3,
      skipped: 15,
      message: '成绩导入成功！已自动计算Z值和班级排名。'
    });
    
    // 更新考试状态
    if (selectedExam) {
      setExams(exams.map(e => 
        e.id === selectedExam.id 
          ? { ...e, status: '已完成', valid_students: 827, total_students: 830 }
          : e
      ));
    }
  };

  const handleSaveEdit = () => {
    if (selectedExam) {
      const normalizedExamName = normalizeExamNameWithTerm(editForm.exam_name, editForm.term);
      setExams(exams.map(e => 
        e.id === selectedExam.id 
          ? { ...e, ...editForm, exam_name: normalizedExamName }
          : e
      ));
      setSelectedExam({ ...selectedExam, ...editForm, exam_name: normalizedExamName });
      setShowEditModal(false);
      alert('考试信息更新成功！');
    }
  };

  const handleDeleteExam = (id) => {
    if (window.confirm('确定要删除这个考试吗？此操作不可恢复！')) {
      setExams(exams.filter(exam => exam.id !== id));
    }
  };

  // ==================== 成绩管理功能 ====================

  // 加载考试成绩数据
  const loadExamScores = (examId) => {
    // 从schoolData加载成绩数据
    const scores = schoolData.examScores?.filter(s => s.exam_id === examId) || [];
    
    // 设置成绩数据（不再自动生成模拟数据，用户需要通过导入添加成绩）
    setExamScores(scores);
    return scores;
  };

  // 打开成绩管理弹窗
  const handleManageScores = (exam) => {
    setSelectedExam(exam);
    loadExamScores(exam.id);
    setShowScoreModal(true);
    setScoreSearchTerm('');
    setScoreFilterClass('');
  };

  // 处理缺考管理
  const handleManageAbsence = (exam) => {
    setSelectedExam(exam);
    setShowAbsenceModal(true);
  };

  // 处理成绩文件导入
  const handleScoreFileImport = (e) => {
    const file = e.target.files[0];
    if (!file || !selectedExam) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const lines = content.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        alert('文件格式错误，至少需要包含表头和一行数据');
        return;
      }

      // 解析表头
      const headers = lines[0].split(',').map(h => h.trim());
      const requiredFields = ['学籍辅号', '姓名'];
      const subjectFields = selectedExam.subjects;

      // 验证必需字段
      for (const field of requiredFields) {
        if (!headers.includes(field)) {
          alert(`缺少必需字段：${field}`);
          return;
        }
      }

      // 解析数据
      const importedScores = [];
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length < headers.length) continue;

        const studentCode = cols[headers.indexOf('学籍辅号')]?.trim();
        const studentName = cols[headers.indexOf('姓名')]?.trim();

        // 查找学生
        let student = schoolData.students?.find(s => s.student_code === studentCode);
        
        // 如果找不到学生，尝试从学籍号解析班级信息创建临时学生
        if (!student) {
          // 尝试从学籍号解析班级ID (如: 20240701001 -> 701)
          const classIdMatch = studentCode.match(/\d{4}(\d{2})\d+/);
          if (classIdMatch) {
            const grade = parseInt(selectedExam.grade_level);
            const classNum = parseInt(classIdMatch[1]);
            const classId = grade * 100 + classNum;
            
            // 检查班级是否存在
            const cls = schoolData.classes?.find(c => c.id === classId);
            if (cls) {
              // 创建临时学生记录
              student = {
                id: Date.now() + i,
                student_code: studentCode,
                name: studentName,
                class_id: classId
              };
            } else {
              errors.push(`第${i + 1}行：学籍辅号 "${studentCode}" 对应的班级不存在`);
              continue;
            }
          } else {
            errors.push(`第${i + 1}行：学籍辅号 "${studentCode}" 不存在且无法解析班级信息`);
            continue;
          }
        }

        // 解析各科成绩
        const scores = {};
        let hasValidScore = false;
        subjectFields.forEach(subject => {
          const scoreIndex = headers.indexOf(subject);
          if (scoreIndex >= 0) {
            const score = parseFloat(cols[scoreIndex]);
            if (!isNaN(score) && score >= 0) {
              scores[subject] = score;
              hasValidScore = true;
            }
          }
        });

        if (!hasValidScore) {
          errors.push(`第${i + 1}行：没有有效的成绩数据`);
          continue;
        }

        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

        // 解析是否参与统计
        const isValidIndex = headers.indexOf('参与统计');
        let isValid = true;
        if (isValidIndex >= 0) {
          const validValue = cols[isValidIndex]?.trim();
          isValid = validValue !== '否' && validValue !== '0' && validValue !== 'false';
        }

        // 解析额外统计班级
        const additionalClassesIndex = headers.indexOf('额外统计班级');
        let additionalClasses = [];
        if (additionalClassesIndex >= 0) {
          const classesValue = cols[additionalClassesIndex]?.trim();
          if (classesValue) {
            // 格式：班级ID1,班级ID2 或 班级名1,班级名2
            const classIds = classesValue.split(',').map(c => c.trim());
            additionalClasses = classIds.map(classId => {
              // 尝试查找班级
              const cls = schoolData.classes?.find(c => c.id === parseInt(classId) || c.name === classId);
              if (cls) {
                return { class_id: cls.id, class_name: cls.name };
              }
              return null;
            }).filter(Boolean);
          }
        }

        importedScores.push({
          exam_id: selectedExam.id,
          student_id: student.id,
          student_code: studentCode,
          student_name: studentName,
          class_id: student.class_id,
          scores: scores,
          total_score: totalScore,
          is_valid: isValid,
          additional_classes: additionalClasses,
          rank: 0,
          class_rank: 0,
          created_at: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString().split('T')[0]
        });
      }

      if (errors.length > 0) {
        console.warn('导入警告：', errors);
      }

      // 合并现有成绩和新导入的成绩
      const existingScores = examScores.filter(s => s.exam_id === selectedExam.id);
      const mergedScores = [...existingScores];

      importedScores.forEach(newScore => {
        const existingIndex = mergedScores.findIndex(s => s.student_id === newScore.student_id);
        if (existingIndex >= 0) {
          // 更新现有记录
          mergedScores[existingIndex] = {
            ...mergedScores[existingIndex],
            scores: { ...mergedScores[existingIndex].scores, ...newScore.scores },
            total_score: newScore.total_score,
            updated_at: new Date().toISOString().split('T')[0]
          };
        } else {
          // 添加新记录 - 使用学生ID和考试ID组合生成唯一ID
          mergedScores.push({
            ...newScore,
            id: `${selectedExam.id}_${newScore.student_id}_${Date.now()}`
          });
        }
      });

      // 重新计算排名
      mergedScores.sort((a, b) => b.total_score - a.total_score);
      mergedScores.forEach((score, index) => {
        score.rank = index + 1;
      });

      // 按班级计算班级排名
      const classGroups = {};
      mergedScores.forEach(score => {
        if (!classGroups[score.class_id]) classGroups[score.class_id] = [];
        classGroups[score.class_id].push(score);
      });

      Object.values(classGroups).forEach(classScores => {
        classScores.sort((a, b) => b.total_score - a.total_score);
        classScores.forEach((score, index) => {
          score.class_rank = index + 1;
        });
      });

      // 更新状态
      setExamScores(mergedScores);

      // 更新schoolData
      const otherScores = (schoolData.examScores || []).filter(s => s.exam_id !== selectedExam.id);
      schoolData.examScores = [...otherScores, ...mergedScores];

      // 更新考试统计信息
      const validStudents = mergedScores.filter(s => s.total_score > 0).length;
      const avgScore = validStudents > 0
        ? mergedScores.reduce((sum, s) => sum + s.total_score, 0) / validStudents
        : 0;
      const topScore = validStudents > 0
        ? Math.max(...mergedScores.map(s => s.total_score))
        : 0;

      setExams(exams.map(e =>
        e.id === selectedExam.id
          ? {
              ...e,
              status: '已完成',
              valid_students: validStudents,
              total_students: mergedScores.length,
              avg_score: avgScore.toFixed(1),
              top_score: topScore.toFixed(1)
            }
          : e
      ));

      // 构建导入结果提示
      let message = '成功导入 ' + importedScores.length + ' 条成绩记录';
      if (errors.length > 0) {
        message += '\n\n以下 ' + errors.length + ' 条记录出错：\n';
        message += errors.slice(0, 20).join('\n'); // 最多显示20条错误
        if (errors.length > 20) {
          message += '\n... 还有 ' + (errors.length - 20) + ' 条错误未显示';
        }
      }
      alert(message);
      setShowScoreImportModal(false);
    };
    reader.readAsText(file);
  };

  // 下载成绩导入模板
  const downloadScoreTemplate = () => {
    if (!selectedExam) return;

    const headers = ['学籍辅号', '姓名', ...selectedExam.subjects, '参与统计', '额外统计班级'];
    const sampleData = [
      ['20240701001', '张三', ...selectedExam.subjects.map(() => '85'), '是', '704,705'],
      ['20240701002', '李四', ...selectedExam.subjects.map(() => '90'), '是', ''],
    ];

    const csvContent = [headers.join(','), ...sampleData.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedExam.exam_name}_成绩导入模板.csv`;
    link.click();
  };

  // 打开成绩编辑弹窗
  const handleEditScore = (score) => {
    setSelectedScore(score);
    setEditingScores({ ...score.scores });
    setEditingIsValid(score.is_valid !== false);
    setEditingAdditionalClasses(score.additional_classes || []);
    setShowScoreEditModal(true);
  };

  // 保存成绩修改
  const handleSaveScoreEdit = () => {
    if (!selectedScore || !selectedExam) return;

    // 数据校验
    const validatedScores = {};
    let hasError = false;
    let errorMsg = '';

    selectedExam.subjects.forEach(subject => {
      const value = editingScores[subject];
      const numValue = parseFloat(value);

      if (value === '' || value === undefined || value === null) {
        validatedScores[subject] = null; // 允许空值
      } else if (isNaN(numValue)) {
        hasError = true;
        errorMsg = `${subject} 成绩格式错误`;
      } else if (numValue < 0 || numValue > 100) {
        hasError = true;
        errorMsg = `${subject} 成绩必须在 0-100 之间`;
      } else {
        validatedScores[subject] = numValue;
      }
    });

    if (hasError) {
      alert('数据校验失败：' + errorMsg);
      return;
    }

    // 检查是否所有成绩都为空
    const hasAnyScore = Object.values(validatedScores).some(v => v !== null && v !== undefined);
    if (!hasAnyScore) {
      alert('请至少输入一科成绩');
      return;
    }

    const totalScore = Object.values(validatedScores).reduce((a, b) => a + (b || 0), 0);

    const updatedScore = {
      ...selectedScore,
      scores: validatedScores,
      total_score: totalScore,
      is_valid: editingIsValid,
      additional_classes: editingAdditionalClasses,
      updated_at: new Date().toISOString().split('T')[0]
    };

    // 更新成绩列表
    const updatedScores = examScores.map(s =>
      s.id === selectedScore.id ? updatedScore : s
    );

    // 重新计算排名
    updatedScores.sort((a, b) => b.total_score - a.total_score);
    updatedScores.forEach((score, index) => {
      score.rank = index + 1;
    });

    // 按班级计算班级排名
    const classGroups = {};
    updatedScores.forEach(score => {
      if (!classGroups[score.class_id]) classGroups[score.class_id] = [];
      classGroups[score.class_id].push(score);
    });

    Object.values(classGroups).forEach(classScores => {
      classScores.sort((a, b) => b.total_score - a.total_score);
      classScores.forEach((score, index) => {
        score.class_rank = index + 1;
      });
    });

    setExamScores(updatedScores);

    // 更新schoolData
    const otherScores = (schoolData.examScores || []).filter(s => s.exam_id !== selectedExam.id);
    schoolData.examScores = [...otherScores, ...updatedScores];

    // 更新考试统计
    const validStudents = updatedScores.filter(s => s.total_score > 0).length;
    const avgScore = validStudents > 0
      ? updatedScores.reduce((sum, s) => sum + s.total_score, 0) / validStudents
      : 0;

    setExams(exams.map(e =>
      e.id === selectedExam.id
        ? { ...e, avg_score: avgScore.toFixed(1) }
        : e
    ));

    setShowScoreEditModal(false);
    alert('成绩修改成功！排名已自动更新。');
  };

  // 删除成绩
  const handleDeleteScore = (scoreId) => {
    if (window.confirm('确定要删除这条成绩记录吗？此操作不可恢复！')) {
      const updatedScores = examScores.filter(s => s.id !== scoreId);
      setExamScores(updatedScores);
      
      // 更新schoolData
      const otherScores = (schoolData.examScores || []).filter(s => s.exam_id !== selectedExam.id);
      schoolData.examScores = [...otherScores, ...updatedScores];
      
      // 重新计算排名
      updatedScores.sort((a, b) => b.total_score - a.total_score);
      updatedScores.forEach((score, index) => {
        score.rank = index + 1;
      });
      
      // 按班级计算班级排名
      const classGroups = {};
      updatedScores.forEach(score => {
        if (!classGroups[score.class_id]) classGroups[score.class_id] = [];
        classGroups[score.class_id].push(score);
      });
      
      Object.values(classGroups).forEach(classScores => {
        classScores.sort((a, b) => b.total_score - a.total_score);
        classScores.forEach((score, index) => {
          score.class_rank = index + 1;
        });
      });
      
      setExamScores([...updatedScores]);
    }
  };

  // 一键清空成绩
  const handleClearAllScores = () => {
    if (!selectedExam) return;
    
    const count = examScores.length;
    if (count === 0) {
      alert('当前没有成绩数据可清空');
      return;
    }
    
    if (window.confirm(`确定要清空所有 ${count} 条成绩记录吗？此操作不可恢复！`)) {
      // 先清空成绩状态
      setExamScores([]);
      
      // 更新schoolData
      const otherScores = (schoolData.examScores || []).filter(s => s.exam_id !== selectedExam.id);
      schoolData.examScores = otherScores;
      
      // 更新考试状态
      setExams(prevExams => prevExams.map(e =>
        e.id === selectedExam.id
          ? { ...e, status: '未开始', valid_students: 0, total_students: 0, avg_score: 0, top_score: 0, pass_rate: 0 }
          : e
      ));
      
      // 重置筛选状态
      setScoreSearchTerm('');
      setScoreFilterClass('');
      setScoreSortField('total_score');
      setScoreSortOrder('desc');
    }
  };

  // 过滤和排序成绩 - 使用 useMemo 缓存结果
  const filteredScores = useMemo(() => {
    // 直接使用当前 examScores，不再按 exam_id 筛选（因为打开弹窗时已经加载了该考试的成绩）
    let scores = [...examScores];

    // 搜索过滤
    if (scoreSearchTerm) {
      const term = scoreSearchTerm.toLowerCase();
      scores = scores.filter(s =>
        s.student_name?.toLowerCase().includes(term) ||
        s.student_code?.toLowerCase().includes(term)
      );
    }

    // 班级过滤 - 使用严格比较
    if (scoreFilterClass && scoreFilterClass !== '') {
      const filterId = scoreFilterClass;
      scores = scores.filter(s => {
        const scoreId = String(s.class_id);
        return scoreId === filterId;
      });
    }

    // 排序 - 确保返回新数组避免原地修改问题
    const sortedScores = [...scores].sort((a, b) => {
      let aVal, bVal;
      if (scoreSortField === 'total_score') {
        aVal = Number(a.total_score) || 0;
        bVal = Number(b.total_score) || 0;
      } else if (scoreSortField === 'rank') {
        aVal = Number(a.rank) || 0;
        bVal = Number(b.rank) || 0;
      } else if (scoreSortField === 'class_rank') {
        aVal = Number(a.class_rank) || 0;
        bVal = Number(b.class_rank) || 0;
      } else {
        aVal = Number(a.scores?.[scoreSortField]) || 0;
        bVal = Number(b.scores?.[scoreSortField]) || 0;
      }

      return scoreSortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return sortedScores;
  }, [examScores, scoreSearchTerm, scoreFilterClass, scoreSortField, scoreSortOrder]);

  // 获取班级列表 - 返回该年级的所有班级
  const getClassList = () => {
    if (!selectedExam) return [];
    const grade = parseInt(selectedExam.grade_level);
    
    // 获取该年级的所有班级
    const allGradeClasses = schoolData.classes?.filter(c => Math.floor(c.id / 100) === grade) || [];
    
    // 返回所有班级，不管是否有成绩数据
    return allGradeClasses.sort((a, b) => a.id - b.id);
  };

  const getStatusColor = (status) => {
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

  const filteredExams = exams.filter(exam => {
    const matchSearch = exam.exam_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchGrade = !filterGrade || exam.grade_level === filterGrade;
    const matchTerm = !filterTerm || exam.term === filterTerm;
    return matchSearch && matchGrade && matchTerm;
  });

  // 根据实际成绩数据计算班级统计
  const calculateClassStats = () => {
    if (!selectedExam || examScores.length === 0) return [];
    
    const grade = parseInt(selectedExam.grade_level);
    const gradeClasses = schoolData.classes?.filter(c => Math.floor(c.id / 100) === grade) || [];
    
    // 获取该考试的所有成绩
    const scores = schoolData.examScores?.filter(s => s.exam_id === selectedExam.id) || [];
    
    // 计算年级平均分用于Z值计算
    const allScores = scores.map(s => s.total_score);
    const gradeAvg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    const gradeStd = Math.sqrt(allScores.reduce((sq, n) => sq + Math.pow(n - gradeAvg, 2), 0) / allScores.length);
    
    // 计算前20%的分数线
    const sortedScores = [...allScores].sort((a, b) => b - a);
    const top20Threshold = sortedScores[Math.floor(allScores.length * 0.2)] || 0;
    
    // 按班级统计
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
        classStatsMap[classId].top20_count++;
      }
    });
    
    // 计算每个班级的统计数据
    const stats = Object.values(classStatsMap).map(stat => {
      const cls = gradeClasses.find(c => c.id === stat.class_id);
      const classNo = cls ? parseInt(String(cls.id).slice(-2)) : 0;
      const count = stat.scores.length;
      const avg = stat.scores.reduce((a, b) => a + b, 0) / count;
      const zValue = gradeStd > 0 ? (avg - gradeAvg) / gradeStd : 0;
      const top20Rate = Math.round((stat.top20_count / count) * 100);
      
      return {
        class_no: classNo,
        student_count: count,
        avg_score: avg.toFixed(1),
        z_value: zValue.toFixed(2),
        top20_rate: top20Rate,
        rank: 0 // 稍后计算
      };
    });
    
    // 按平均分排序计算排名
    stats.sort((a, b) => b.avg_score - a.avg_score);
    stats.forEach((stat, index) => {
      stat.rank = index + 1;
    });
    
    return stats;
  };
  
  const classStats = calculateClassStats();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">考试管理</h1>
        <p className="text-gray-500 mt-1">创建和管理各类考试，导入成绩数据</p>
      </div>

      {/* 操作栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* 搜索 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索考试名称..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-64"
              />
            </div>

            {/* 年级筛选 */}
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">所有年级</option>
              <option value="7年级">7年级</option>
              <option value="8年级">8年级</option>
              <option value="9年级">9年级</option>
            </select>

            {/* 学期筛选 */}
            <select
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">所有学期</option>
              <option value="2025-1">2025-1</option>
              <option value="2024-2">2024-2</option>
              <option value="2024-1">2024-1</option>
            </select>
          </div>

          {/* 创建按钮 */}
          <button
            onClick={handleCreateExam}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            创建考试
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">考试总数</p>
              <p className="text-2xl font-bold text-gray-800">{exams.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {(() => {
          // 从实际成绩数据计算概览统计
          const allExamScores = schoolData.examScores || [];
          const validStudents = allExamScores.filter(s => s.is_valid !== false).length;
          
          // 计算本月考试数量
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          const thisMonthExams = exams.filter(e => {
            const examDate = new Date(e.exam_date);
            return examDate.getMonth() === currentMonth && examDate.getFullYear() === currentYear;
          }).length;
          
          // 计算已完成考试数量（有成绩数据的考试）
          const completedExams = new Set(allExamScores.map(s => s.exam_id)).size;
          
          return (
            <>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">已完成</p>
                    <p className="text-2xl font-bold text-green-600">
                      {completedExams}
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
                    <p className="text-sm text-gray-500">参与学生</p>
                    <p className="text-2xl font-bold text-gray-800">
                      {validStudents}
                    </p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-lg">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">本月考试</p>
                    <p className="text-2xl font-bold text-gray-800">{thisMonthExams}</p>
                  </div>
                  <div className="bg-yellow-100 p-3 rounded-lg">
                    <Calendar className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>

      {/* 考试列表 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {/* 桌面端表格 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">考试信息</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">学期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">年级</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">考试日期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">参与人数</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredExams.map((exam) => {
                // 从实际成绩数据计算参与人数
                const examScoresData = schoolData.examScores?.filter(s => s.exam_id === exam.id) || [];
                const validStudents = examScoresData.filter(s => s.is_valid !== false).length;
                const totalStudents = examScoresData.length;
                
                return (
                <tr key={exam.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">#{exam.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-9 w-9 bg-blue-100 rounded-lg flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate" title={exam.exam_name}>{exam.exam_name}</div>
                        <div className="text-xs text-gray-500 truncate" title={exam.subjects.join('、')}>{exam.subjects.join('、')}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{exam.term}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                      {exam.exam_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{exam.grade_level}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{exam.exam_date}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {validStudents > 0 ? `${validStudents}人` : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(exam.status)}`}>
                      {exam.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        title="查看详情"
                        onClick={() => handleViewDetail(exam)}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                        title="成绩管理"
                        onClick={() => handleManageScores(exam)}
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 text-orange-600 hover:bg-orange-50 rounded"
                        title="缺考管理"
                        onClick={() => handleManageAbsence(exam)}
                      >
                        <AlertCircle className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                        title="导入成绩"
                        onClick={() => handleImportScores(exam)}
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                        title="编辑"
                        onClick={() => handleEditExam(exam)}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="删除"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDeleteExam(exam.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>

        {/* 移动端卡片布局 */}
        <div className="md:hidden">
          {filteredExams.map((exam) => {
            // 从实际成绩数据计算参与人数
            const examScoresData = schoolData.examScores?.filter(s => s.exam_id === exam.id) || [];
            const validStudents = examScoresData.filter(s => s.is_valid !== false).length;
            
            return (
            <div key={exam.id} className="p-4 border-b border-gray-200 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 break-words">#{exam.id} {exam.exam_name}</div>
                    <div className="text-xs text-gray-500 mt-1 break-words">{exam.subjects.join('、')}</div>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded flex-shrink-0 ${getStatusColor(exam.status)}`}>
                  {exam.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                <div>
                  <span className="text-gray-400">学期：</span>{exam.term}
                </div>
                <div>
                  <span className="text-gray-400">类型：</span>{exam.exam_type}
                </div>
                <div>
                  <span className="text-gray-400">年级：</span>{exam.grade_level}
                </div>
                <div>
                  <span className="text-gray-400">日期：</span>{exam.exam_date}
                </div>
                <div className="col-span-2">
                  <span className="text-gray-400">参与人数：</span>{validStudents > 0 ? `${validStudents}人` : '-'}
                </div>
              </div>

              <div className="flex items-center justify-end gap-1">
                <button
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  title="查看详情"
                  onClick={() => handleViewDetail(exam)}
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  className="p-2 text-purple-600 hover:bg-purple-50 rounded"
                  title="成绩管理"
                  onClick={() => handleManageScores(exam)}
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
                <button
                  className="p-2 text-green-600 hover:bg-green-50 rounded"
                  title="导入成绩"
                  onClick={() => handleImportScores(exam)}
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                  title="编辑"
                  onClick={() => handleEditExam(exam)}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="p-2 text-red-600 hover:bg-red-50 rounded"
                  title="删除"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteExam(exam.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );})}
        </div>

        {filteredExams.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">暂无考试数据</p>
          </div>
        )}
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-gray-500">
          共 {filteredExams.length} 条记录
        </p>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 bg-blue-600 text-white rounded">1</span>
          <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 创建考试弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">创建新考试</h2>
              <button onClick={() => setShowCreateModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            <form className="space-y-4" onSubmit={handleSaveCreate}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">考试名称 *</label>
                <input 
                  type="text" 
                  required
                  value={createForm.exam_name}
                  onChange={(e) => setCreateForm({...createForm, exam_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="如：2025-1 7年级教学调研" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">学期</label>
                  <select 
                    value={createForm.term}
                    onChange={(e) => setCreateForm({...createForm, term: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option>2025-1</option>
                    <option>2024-2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">考试类型</label>
                  <select 
                    value={createForm.exam_type}
                    onChange={(e) => setCreateForm({...createForm, exam_type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option>期中</option>
                    <option>期末</option>
                    <option>月考</option>
                    <option>统测</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">年级</label>
                  <select 
                    value={createForm.grade_level}
                    onChange={(e) => setCreateForm({...createForm, grade_level: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option>7年级</option>
                    <option>8年级</option>
                    <option>9年级</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">考试日期 *</label>
                  <input 
                    type="date" 
                    required
                    value={createForm.exam_date}
                    onChange={(e) => setCreateForm({...createForm, exam_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">考试科目</label>
                <div className="flex gap-2 flex-wrap">
                  {availableSubjects.map(subject => (
                    <label key={subject} className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded cursor-pointer hover:bg-gray-200">
                      <input
                        type="checkbox"
                        checked={createForm.subjects.includes(subject)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCreateForm({...createForm, subjects: [...createForm.subjects, subject]});
                          } else {
                            setCreateForm({...createForm, subjects: createForm.subjects.filter(s => s !== subject)});
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{subject}</span>
                    </label>
                  ))}
                </div>
                {availableSubjects.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">请先前往"学科管理"添加学科</p>
                )}
              </div>

              {/* 学科满分分值设定 */}
              {createForm.subjects.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">学科满分分值设定</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {createForm.subjects.map(subject => (
                      <div key={subject} className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 w-12">{subject}</span>
                        <input
                          type="number"
                          min="0"
                          max="200"
                          value={createForm.subject_scores?.[subject] || 100}
                          onChange={(e) => {
                            const newScores = { ...(createForm.subject_scores || {}) };
                            newScores[subject] = parseInt(e.target.value) || 0;
                            // 自动计算总分
                            const totalScore = createForm.subjects.reduce((sum, subj) => {
                              return sum + (newScores[subj] || 100);
                            }, 0);
                            setCreateForm({
                              ...createForm,
                              subject_scores: newScores,
                              full_score: totalScore
                            });
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <span className="text-xs text-gray-400">分</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    总分: <span className="font-medium text-blue-600">{createForm.full_score || createForm.subjects.reduce((sum, subj) => sum + (createForm.subject_scores?.[subj] || 100), 0)}</span> 分
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 编辑考试弹窗 */}
      {showEditModal && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">编辑考试</h2>
              <button onClick={() => setShowEditModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">考试名称</label>
                <input 
                  type="text" 
                  value={editForm.exam_name}
                  onChange={(e) => setEditForm({...editForm, exam_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">学期</label>
                  <select 
                    value={editForm.term}
                    onChange={(e) => setEditForm({...editForm, term: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option>2025-1</option>
                    <option>2024-2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">考试类型</label>
                  <select 
                    value={editForm.exam_type}
                    onChange={(e) => setEditForm({...editForm, exam_type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option>期中</option>
                    <option>期末</option>
                    <option>月考</option>
                    <option>统测</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">年级</label>
                  <select 
                    value={editForm.grade_level}
                    onChange={(e) => setEditForm({...editForm, grade_level: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option>7年级</option>
                    <option>8年级</option>
                    <option>9年级</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">考试日期</label>
                  <input 
                    type="date" 
                    value={editForm.exam_date}
                    onChange={(e) => setEditForm({...editForm, exam_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">考试科目</label>
                <div className="flex gap-2 flex-wrap">
                  {availableSubjects.map(subject => (
                    <label key={subject} className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded cursor-pointer hover:bg-gray-200">
                      <input
                        type="checkbox"
                        checked={editForm.subjects.includes(subject)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditForm({...editForm, subjects: [...editForm.subjects, subject]});
                          } else {
                            setEditForm({...editForm, subjects: editForm.subjects.filter(s => s !== subject)});
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{subject}</span>
                    </label>
                  ))}
                </div>
                {availableSubjects.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">请先前往"学科管理"添加学科</p>
                )}
              </div>

              {/* 学科满分分值设定 */}
              {editForm.subjects.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">学科满分分值设定</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {editForm.subjects.map(subject => (
                      <div key={subject} className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 w-12">{subject}</span>
                        <input
                          type="number"
                          min="0"
                          max="200"
                          value={editForm.subject_scores?.[subject] || 100}
                          onChange={(e) => {
                            const newScores = { ...(editForm.subject_scores || {}) };
                            newScores[subject] = parseInt(e.target.value) || 0;
                            // 自动计算总分
                            const totalScore = editForm.subjects.reduce((sum, subj) => {
                              return sum + (newScores[subj] || 100);
                            }, 0);
                            setEditForm({
                              ...editForm,
                              subject_scores: newScores,
                              full_score: totalScore
                            });
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <span className="text-xs text-gray-400">分</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    总分: <span className="font-medium text-blue-600">{editForm.full_score || editForm.subjects.reduce((sum, subj) => sum + (editForm.subject_scores?.[subj] || 100), 0)}</span> 分
                  </p>
                </div>
              )}
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 考试详情弹窗 */}
      {showDetailModal && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          {(() => {
            // 从exams数组中获取最新的考试数据
            const currentExam = exams.find(e => e.id === selectedExam.id) || selectedExam;
            
            // 从schoolData获取该考试的实际成绩数据
            const examScoresData = schoolData.examScores?.filter(s => s.exam_id === selectedExam.id) || [];
            
            // 实时计算统计数据
            const validStudents = examScoresData.filter(s => s.is_valid !== false).length;
            const totalStudents = examScoresData.length;
            
            // 计算平均分、最高分、及格率
            let avgScore = '-';
            let topScore = '-';
            let passRate = '-';
            
            if (examScoresData.length > 0) {
              const validScores = examScoresData.filter(s => s.is_valid !== false);
              if (validScores.length > 0) {
                const scores = validScores.map(s => s.total_score);
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                const max = Math.max(...scores);
                // 五科总分满分500分，及格线300分（5×60）
                const passCount = scores.filter(s => s >= 300).length;
                const passRateValue = (passCount / scores.length) * 100;
                
                avgScore = avg.toFixed(1);
                topScore = max.toFixed(1);
                passRate = passRateValue.toFixed(1);
              }
            }
            
            return (
          <div className="bg-white rounded-lg w-full max-w-4xl m-4 p-4 md:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4 md:mb-6">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg md:text-xl font-bold text-gray-800 break-words">{currentExam.exam_name}</h2>
                <p className="text-xs md:text-sm text-gray-500 mt-1">
                  {currentExam.grade_level} · {currentExam.exam_type} · {currentExam.exam_date}
                </p>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="flex-shrink-0 ml-2">
                <X className="w-5 h-5 md:w-6 md:h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            {/* 考试统计 - 使用实时计算的数据 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
              <div className="bg-blue-50 rounded-lg p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1 md:mb-2">
                  <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                  <span className="text-xs md:text-sm text-gray-600">参与人数</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-blue-700">{validStudents}</p>
                <p className="text-xs text-gray-500">共{totalStudents}人报名</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1 md:mb-2">
                  <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                  <span className="text-xs md:text-sm text-gray-600">平均分</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-green-700">{avgScore}</p>
                <p className="text-xs text-gray-500">满分{currentExam.full_score}分</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1 md:mb-2">
                  <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
                  <span className="text-xs md:text-sm text-gray-600">最高分</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-purple-700">{topScore}</p>
                <p className="text-xs text-gray-500">年级最高</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1 md:mb-2">
                  <School className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
                  <span className="text-xs md:text-sm text-gray-600">及格率</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-orange-700">{passRate !== '-' ? `${passRate}%` : '-'}</p>
                <p className="text-xs text-gray-500">300分以上（及格）</p>
              </div>
            </div>

            {/* 班级统计表 */}
            <div className="mb-4 md:mb-6">
              <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">班级成绩统计</h3>
              {selectedExam.valid_students === 0 ? (
                <div className="bg-gray-50 rounded-lg p-6 md:p-12 text-center">
                  <Upload className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-3 md:mb-4" />
                  <h4 className="text-base md:text-lg font-medium text-gray-700 mb-2">暂无成绩数据</h4>
                  <p className="text-sm text-gray-500 mb-4">该考试尚未导入成绩数据，请先导入成绩</p>
                  <div className="text-xs md:text-sm text-gray-400 mb-4 md:mb-6">
                    <p>导入流程：</p>
                    <p>1. 准备CSV格式的成绩文件（参考系统模板）</p>
                    <p>2. 上传文件并验证数据</p>
                    <p>3. 系统自动计算Z值和排名</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleImportScores(currentExam);
                    }}
                    className="flex items-center gap-2 px-4 py-2 md:px-6 md:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto text-sm"
                  >
                    <Upload className="w-4 h-4 md:w-5 md:h-5" />
                    导入成绩
                  </button>
                </div>
              ) : (
                <>
                  {/* 桌面端表格 */}
                  <div className="hidden md:block bg-gray-50 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">班级</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">人数</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">平均分</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Z值</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">前20%占比</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">年级排名</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {classStats.map((cls) => (
                          <tr key={cls.class_no} className="bg-white hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{cls.class_no}班</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{cls.student_count}人</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{cls.avg_score}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`${cls.z_value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {cls.z_value > 0 ? '+' : ''}{cls.z_value}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">{cls.top20_rate}%</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                cls.rank <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                第{cls.rank}名
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* 移动端卡片布局 */}
                  <div className="md:hidden space-y-3">
                    {classStats.map((cls) => (
                      <div key={cls.class_no} className="bg-white rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-base font-medium text-gray-900">{cls.class_no}班</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            cls.rank <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            第{cls.rank}名
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500">人数：</span>
                            <span className="text-gray-900">{cls.student_count}人</span>
                          </div>
                          <div>
                            <span className="text-gray-500">平均分：</span>
                            <span className="text-gray-900">{cls.avg_score}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Z值：</span>
                            <span className={`${cls.z_value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {cls.z_value > 0 ? '+' : ''}{cls.z_value}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">前20%：</span>
                            <span className="text-gray-900">{cls.top20_rate}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  handleImportScores(currentExam);
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Upload className="w-4 h-4" />
                导入成绩
              </button>
              <button
                onClick={() => alert('导出功能开发中...')}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Download className="w-4 h-4" />
                导出报表
              </button>
            </div>
          </div>
          );
          })()}
        </div>
      )}

      {/* 导入成绩弹窗 */}
      {showImportModal && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">导入成绩数据</h2>
              <button onClick={() => setShowImportModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">考试：{selectedExam.exam_name}</p>
              <p className="text-sm text-gray-500">请上传CSV格式的成绩文件，系统支持以下字段：</p>
              <div className="mt-2 p-3 bg-gray-50 rounded text-xs text-gray-600">
                <p className="font-medium mb-1">必需字段：学籍号、姓名、班级、各科成绩</p>
                <p>可选字段：考号、是否参与统计、备注</p>
              </div>
            </div>

            {!importStatus && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">点击或拖拽文件到此处上传</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  选择文件
                </button>
                <p className="text-xs text-gray-400 mt-4">支持格式：CSV (GBK编码)</p>
              </div>
            )}

            {importStatus && importStatus !== 'completed' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <span className="text-gray-700">
                    {importStatus === 'reading' && '正在读取文件...'}
                    {importStatus === 'parsing' && '正在解析数据...'}
                    {importStatus === 'validating' && '正在验证数据...'}
                    {importStatus === 'importing' && '正在导入成绩...'}
                    {importStatus === 'calculating' && '正在计算Z值...'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 text-center">{importProgress}%</p>
              </div>
            )}

            {importStatus === 'completed' && importResults && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-green-600">
                  <CheckCircle className="w-6 h-6" />
                  <span className="font-medium">导入完成！</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-gray-800">{importResults.total}</p>
                    <p className="text-sm text-gray-500">总记录数</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{importResults.success}</p>
                    <p className="text-sm text-gray-500">导入成功</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{importResults.skipped}</p>
                    <p className="text-sm text-gray-500">跳过(不参与统计)</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-600">{importResults.failed}</p>
                    <p className="text-sm text-gray-500">导入失败</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                  {importResults.message}
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    关闭
                  </button>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      handleViewDetail(selectedExam);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    查看详情
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 成绩管理弹窗 */}
      {showScoreModal && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-7xl m-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">成绩管理 - {selectedExam.exam_name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedExam.grade_level} · {selectedExam.exam_type} · 共 {examScores.length} 人
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleImportScores(selectedExam)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Upload className="w-4 h-4" />
                  导入成绩
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClearAllScores();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                  清空成绩
                </button>
                <button onClick={() => setShowScoreModal(false)}>
                  <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
                </button>
              </div>
            </div>

            {/* 筛选和搜索 */}
            <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="搜索学生姓名或学籍号..."
                  value={scoreSearchTerm}
                  onChange={(e) => setScoreSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full"
                />
              </div>
              <select
                value={scoreFilterClass}
                onChange={(e) => setScoreFilterClass(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">所有班级</option>
                {getClassList().map(cls => (
                  <option key={cls.id} value={String(cls.id)}>{cls.name}</option>
                ))}
              </select>
              <select
                value={scoreSortField}
                onChange={(e) => setScoreSortField(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="total_score">按总分排序</option>
                <option value="rank">按年级排名</option>
                <option value="class_rank">按班级排名</option>
                {selectedExam.subjects.map(subject => (
                  <option key={subject} value={subject}>按{subject}排序</option>
                ))}
              </select>
              <button
                onClick={() => setScoreSortOrder(scoreSortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                {scoreSortOrder === 'asc' ? '升序 ↑' : '降序 ↓'}
              </button>
            </div>

            {/* 成绩列表 */}
            <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-16">排名</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-20">班排</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">学生信息</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-24">所属班级</th>
                    {selectedExam.subjects.map(subject => (
                      <th key={subject} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">{subject}</th>
                    ))}
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-24">总分</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-24">参与统计</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredScores.map((score) => (
                    <tr key={score.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {score.rank <= 3 ? (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            score.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                            score.rank === 2 ? 'bg-gray-100 text-gray-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {score.rank}
                          </span>
                        ) : (
                          <span className="text-gray-500">{score.rank}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                        {score.class_rank}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{score.student_name}</span>
                          <span className="text-xs text-gray-500">{score.student_code}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                        {schoolData.classes?.find(c => c.id === score.class_id)?.name || score.class_id}
                      </td>
                      {selectedExam.subjects.map(subject => (
                        <td key={subject} className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-700">
                          {score.scores[subject] !== undefined && score.scores[subject] !== null ? score.scores[subject] : '-'}
                        </td>
                      ))}
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-bold text-center text-blue-600">
                        {score.total_score}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <button
                          onClick={() => {
                            const updatedScores = examScores.map(s =>
                              s.id === score.id ? { ...s, is_valid: !s.is_valid } : s
                            );
                            setExamScores(updatedScores);
                            // 更新schoolData
                            const otherScores = (schoolData.examScores || []).filter(s => s.exam_id !== selectedExam.id);
                            schoolData.examScores = [...otherScores, ...updatedScores];
                          }}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            score.is_valid !== false
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {score.is_valid !== false ? '是' : '否'}
                        </button>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditScore(score)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="编辑成绩"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteScore(score.id);
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="删除成绩"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredScores.length === 0 && (
                <div className="text-center py-12">
                  <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">暂无成绩数据，请先导入成绩</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 成绩导入弹窗 */}
      {showScoreImportModal && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">导入成绩</h2>
              <button onClick={() => setShowScoreImportModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="bg-green-50 p-4 rounded-lg mb-4">
              <h3 className="font-medium text-green-900 mb-2">导入说明</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• 支持CSV格式文件</li>
                <li>• 表头必须包含：学籍辅号、姓名、{selectedExam.subjects.join('、')}</li>
                <li>• 可选字段：参与统计（是/否）、额外统计班级（如：704,705）</li>
                <li>• 学籍辅号必须存在于系统中</li>
                <li>• 导入后会自动计算排名</li>
                <li>• 系统会自动检测并更新已存在的成绩记录</li>
              </ul>
            </div>

            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors"
              onClick={() => document.getElementById('score-file-input').click()}
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">点击选择文件或拖拽到此处</p>
              <input
                id="score-file-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleScoreFileImport}
              />
            </div>

            <div className="flex justify-between items-center mt-6">
              <button
                onClick={downloadScoreTemplate}
                className="flex items-center gap-2 text-green-600 hover:text-green-800 text-sm"
              >
                <Download className="w-4 h-4" />
                下载模板
              </button>
              <button
                onClick={() => setShowScoreImportModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 成绩编辑弹窗 */}
      {showScoreEditModal && selectedScore && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">编辑成绩</h2>
              <button onClick={() => setShowScoreEditModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-medium">学生：</span>{selectedScore.student_name}
              </p>
              <p className="text-sm text-gray-500">
                <span className="font-medium">学籍号：</span>{selectedScore.student_code}
              </p>
            </div>

            <div className="space-y-3">
              {selectedExam.subjects.map(subject => (
                <div key={subject} className="flex items-center gap-4">
                  <label className="w-20 text-sm font-medium text-gray-700">{subject}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={editingScores[subject] || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
                        setEditingScores({...editingScores, [subject]: value});
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0-100"
                  />
                </div>
              ))}

              <div className="flex items-center gap-4 pt-4 border-t">
                <label className="w-20 text-sm font-medium text-gray-700">总分</label>
                <span className="flex-1 text-lg font-bold text-blue-600">
                  {Object.values(editingScores).reduce((a, b) => a + (parseFloat(b) || 0), 0).toFixed(1)}
                </span>
              </div>

              {/* 是否参与统计 */}
              <div className="flex items-center gap-4 pt-4 border-t">
                <label className="w-20 text-sm font-medium text-gray-700">参与统计</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingIsValid}
                    onChange={(e) => setEditingIsValid(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">
                    {editingIsValid ? '是（计入年级统计）' : '否（不计入统计）'}
                  </span>
                </div>
              </div>

              {/* 多班级统计 */}
              <div className="pt-4 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-2">额外统计班级</label>
                <p className="text-xs text-gray-500 mb-2">该学生成绩将同时统计到以下班级</p>
                <div className="flex flex-wrap gap-2">
                  {getClassList().map(cls => (
                    <label key={cls.id} className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded cursor-pointer hover:bg-gray-200">
                      <input
                        type="checkbox"
                        checked={editingAdditionalClasses.some(c => c.class_id === cls.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditingAdditionalClasses([...editingAdditionalClasses, { class_id: cls.id, class_name: cls.name }]);
                          } else {
                            setEditingAdditionalClasses(editingAdditionalClasses.filter(c => c.class_id !== cls.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{cls.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowScoreEditModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveScoreEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 缺考管理弹窗 */}
      {showAbsenceModal && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-6xl m-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">缺考管理</h2>
                <p className="text-sm text-gray-500">{selectedExam.exam_name}</p>
              </div>
              <button onClick={() => setShowAbsenceModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <AbsenceManagement 
              mode="admin" 
              examId={selectedExam.id}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamManagement;
