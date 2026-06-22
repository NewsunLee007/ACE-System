import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Calendar,
  BookOpen,
  Users,
  TrendingUp,
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
  BarChart3,
  School
} from 'lucide-react';
import schoolData from '../data/schoolData';
import { notify } from '../lib/notify';
import {
  buildExamPayload,
  createExamRecord,
  deleteExamRecord,
  exportExamScores,
  fetchExamScoreRows,
  fetchExamListWithStatistics,
  normalizeExamRecord,
  updateExamRecord,
} from '../lib/examApi';
import {
  buildScoreImport,
  commitScoreImport,
  parseScoreImportText,
  recalculateScoreRanks,
  scoreImportRowsToCsv,
  uploadScoreImportFile,
} from '../lib/scoreImport';
import { loadSubjectCatalog } from '../lib/subjectCatalog';
import {
  buildLocalExamScoresCsv,
  buildScoreTemplateCsv,
  calculateClassStats,
  calculateExamOverview,
  downloadBlob,
  filterAndSortScores,
  filterExams,
  getExamValidStudentCount,
  getGradeClassesForExam,
  getLocalSubjectNames,
  getNextExamId,
  getStatusColor,
  hasBackendSession,
  isExcelScoreFile,
  normalizeExamNameWithTerm,
} from '../lib/examManagementUtils';
import { useConfirm } from './ui/confirm';
import AbsenceManagement from './AbsenceManagement';
import ExamFormModal from './exam-management/ExamFormModal';

const ExamManagement = () => {
  const { confirm: confirmAction } = useConfirm();
  const [exams, setExams] = useState(() => [...(schoolData.exams || [])]);
  const localExamCacheRef = React.useRef([...(schoolData.exams || [])]);
  const [examListLoading, setExamListLoading] = useState(false);
  const [examListError, setExamListError] = useState('');
  const [examSyncSource, setExamSyncSource] = useState('local');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [exportingExamId, setExportingExamId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterTerm, setFilterTerm] = useState('');

  // 成绩管理相关状态
  const [examScores, setExamScores] = useState([]);
  const [scoreListLoading, setScoreListLoading] = useState(false);
  const [scoreListError, setScoreListError] = useState('');
  const [scoreListSource, setScoreListSource] = useState('local');
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showScoreImportModal, setShowScoreImportModal] = useState(false);
  const [scoreImportText, setScoreImportText] = useState('');
  const [scoreImportPreview, setScoreImportPreview] = useState(null);
  const [scoreImportRows, setScoreImportRows] = useState([]);
  const [scoreImportHeaders, setScoreImportHeaders] = useState([]);
  const [scoreImportError, setScoreImportError] = useState('');
  const [scoreImportResult, setScoreImportResult] = useState(null);
  const [scoreImportBackendResult, setScoreImportBackendResult] = useState(null);
  const [scoreImportFile, setScoreImportFile] = useState(null);
  const [scoreImporting, setScoreImporting] = useState(false);
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
    subjects: [],
    subject_scores: {},
    full_score: 0
  });

  // 从学科管理获取学科列表
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [subjectCatalogSource, setSubjectCatalogSource] = useState('local');
  const [subjectCatalogError, setSubjectCatalogError] = useState('');

  // 加载学科数据
  useEffect(() => {
    let cancelled = false;
    const localSubjects = getLocalSubjectNames(schoolData.subjects);

    if (!hasBackendSession()) {
      setAvailableSubjects(localSubjects);
      setSubjectCatalogSource('local');
      setSubjectCatalogError('');
      return () => {
        cancelled = true;
      };
    }

    setSubjectCatalogSource('api');
    setSubjectCatalogError('');
    loadSubjectCatalog()
      .then(({ subjects, source, error }) => {
        if (cancelled) return;
        const subjectNames = subjects.map(subject => subject.name).filter(Boolean);
        setAvailableSubjects(subjectNames.length ? subjectNames : localSubjects);
        setSubjectCatalogSource(source);
        setSubjectCatalogError(source === 'api' ? '' : `后端学科目录暂不可用，当前使用本地缓存：${error?.message || '连接失败'}`);
      })
      .catch((error) => {
        if (cancelled) return;
        setAvailableSubjects(localSubjects);
        setSubjectCatalogSource('local');
        setSubjectCatalogError(`后端学科目录暂不可用，当前使用本地缓存：${error.message || '连接失败'}`);
      });

    return () => {
      cancelled = true;
    };
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
    if (availableSubjects.length === 0) return;

    setCreateForm(prev => {
      if (prev.subjects.length > 0) return prev;

      const defaultSubjects = availableSubjects.slice(0, 5);
      const defaultScores = defaultSubjects.reduce((scores, subject) => ({
        ...scores,
        [subject]: 100,
      }), {});

      return {
        ...prev,
        subjects: defaultSubjects,
        subject_scores: defaultScores,
        full_score: defaultSubjects.length * 100,
      };
    });
  }, [availableSubjects]);

  // 考试列表只读取真实数据；后端为空时保留本地真实导入结果，避免空库覆盖分析口径。
  useEffect(() => {
    if (exams.length > 0 || localExamCacheRef.current.length === 0) {
      schoolData.exams = exams;
    }
    if (exams.length > 0) {
      localExamCacheRef.current = exams;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('schoolData:changed'));
    }
  }, [exams]);

  const refreshExamList = useCallback(async () => {
    if (!hasBackendSession()) {
      setExamSyncSource('local');
      return null;
    }

    setExamListLoading(true);
    try {
      const payload = await fetchExamListWithStatistics({ pageSize: 100 });
      const remoteExams = payload.exams || [];
      if (remoteExams.length === 0 && localExamCacheRef.current.length > 0) {
        setExams(localExamCacheRef.current);
        setExamSyncSource('local');
        setExamListError('后端考试库暂无考试记录，当前显示本地真实导入数据。');
        return {
          ...payload,
          exams: localExamCacheRef.current,
          source: 'local-fallback',
        };
      }

      setExams(remoteExams);
      if (remoteExams.length > 0) {
        localExamCacheRef.current = remoteExams;
      }
      setExamSyncSource('backend');
      setExamListError('');
      return payload;
    } catch (error) {
      setExamSyncSource('local');
      setExamListError(`后端考试库暂不可用，当前显示本地缓存：${error.message || '连接失败'}`);
      return null;
    } finally {
      setExamListLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshExamList();
  }, [refreshExamList]);

  useEffect(() => {
    if (!selectedExam) return;
    const latest = exams.find(e => e.id === selectedExam.id);
    if (latest) setSelectedExam(latest);
  }, [exams, selectedExam]);

  const handleCreateExam = () => {
    const defaultSubjects = (availableSubjects.length ? availableSubjects : ['语文', '数学', '英语', '科学', '社会']).slice(0, 5);
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
      full_score: defaultSubjects.length * 100
    });
    setShowCreateModal(true);
  };

  const handleSaveCreate = async (e) => {
    e.preventDefault();
    const payload = buildExamPayload(createForm);
    const localExam = normalizeExamRecord({
      id: getNextExamId(exams),
      ...createForm,
      ...payload,
      total_students: 0,
      valid_students: 0,
      class_count: 0,
      status: '未开始',
      avg_score: 0,
      top_score: 0,
      pass_rate: 0
    });

    if (hasBackendSession()) {
      try {
        const result = await createExamRecord(createForm);
        if (result?.success === false) {
          notify(result.message || '考试创建失败', 'warning');
          return;
        }

        setShowCreateModal(false);
        const reloaded = await refreshExamList();
        if (!reloaded) {
          setExams(prevExams => [...prevExams, { ...localExam, id: result?.exam_id || localExam.id }]);
        }
        notify(result?.message || '考试创建成功！', 'success');
      } catch (error) {
        setExamListError(`后端创建考试失败：${error.message || '请稍后重试'}`);
        notify(`考试创建失败：${error.message || '请稍后重试'}`, 'error');
      }
      return;
    }

    setExams([...exams, localExam]);
    setShowCreateModal(false);
    notify('考试创建成功！', 'success');
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
      subject_scores: { ...(exam.subject_scores || {}) },
      full_score: exam.full_score || 0
    });
    setShowEditModal(true);
  };

  const handleViewDetail = (exam) => {
    setSelectedExam(exam);
    setShowDetailModal(true);
  };

  const handleImportScores = (exam) => {
    setSelectedExam(exam);
    resetScoreImportState();
    setShowScoreImportModal(true);
  };

  const handleSaveEdit = async () => {
    if (selectedExam) {
      const normalizedExamName = normalizeExamNameWithTerm(editForm.exam_name, editForm.term);
      const nextForm = { ...editForm, exam_name: normalizedExamName };
      const payload = buildExamPayload(nextForm);
      const updatedExam = normalizeExamRecord({
        ...selectedExam,
        ...nextForm,
        ...payload,
      });

      if (hasBackendSession()) {
        try {
          const result = await updateExamRecord(selectedExam.id, nextForm);
          if (result?.success === false) {
            notify(result.message || '考试信息更新失败', 'warning');
            return;
          }

          setExams(exams.map(e =>
            e.id === selectedExam.id ? updatedExam : e
          ));
          setSelectedExam(updatedExam);
          setShowEditModal(false);
          await refreshExamList();
          notify(result?.message || '考试信息更新成功！', 'success');
        } catch (error) {
          setExamListError(`后端更新考试失败：${error.message || '请稍后重试'}`);
          notify(`考试信息更新失败：${error.message || '请稍后重试'}`, 'error');
        }
        return;
      }

      setExams(exams.map(e =>
        e.id === selectedExam.id 
          ? updatedExam
          : e
      ));
      setSelectedExam(updatedExam);
      setShowEditModal(false);
      notify('考试信息更新成功！', 'success');
    }
  };

  const handleDeleteExam = async (id) => {
    const confirmed = await confirmAction({
      title: '删除考试',
      message: '确定要删除这个考试吗？此操作不可恢复！',
      confirmText: '删除'
    });
    if (!confirmed) return;

    if (hasBackendSession()) {
      try {
        const result = await deleteExamRecord(id);
        if (result?.success === false) {
          notify(result.message || '考试删除失败', 'warning');
          return;
        }
        setExams(exams.filter(exam => exam.id !== id));
        notify(result?.message || '考试删除成功', 'success');
      } catch (error) {
        setExamListError(`后端删除考试失败：${error.message || '请稍后重试'}`);
        notify(`考试删除失败：${error.message || '请稍后重试'}`, 'error');
      }
      return;
    }

    setExams(exams.filter(exam => exam.id !== id));
    notify('考试删除成功', 'success');
  };

  // ==================== 成绩管理功能 ====================

  // 加载考试成绩数据
  const loadExamScores = useCallback(async (examId) => {
    const readLocalScores = () => (
      (schoolData.examScores || []).filter(s => Number(s.exam_id) === Number(examId))
    );

    if (!hasBackendSession()) {
      const scores = readLocalScores();
      setScoreListSource('local');
      setScoreListError('');
      setExamScores(scores);
      return scores;
    }

    setScoreListLoading(true);
    try {
      const payload = await fetchExamScoreRows(examId, { includeInvalid: true });
      const backendScores = recalculateScoreRanks(payload.scores || []);
      const otherScores = (schoolData.examScores || []).filter(s => Number(s.exam_id) !== Number(examId));
      schoolData.examScores = [...otherScores, ...backendScores];
      setExamScores(backendScores);
      setScoreListSource('backend');
      setScoreListError('');
      return backendScores;
    } catch (error) {
      const fallbackScores = readLocalScores();
      setScoreListSource('local');
      setScoreListError(`后端成绩明细暂不可用，当前显示本地缓存：${error.message || '连接失败'}`);
      setExamScores(fallbackScores);
      return fallbackScores;
    } finally {
      setScoreListLoading(false);
    }
  }, []);

  const updateSelectedExamScores = (scores) => {
    if (!selectedExam) return scores;

    const rankedScores = recalculateScoreRanks(scores);
    setExamScores(rankedScores);

    const otherScores = (schoolData.examScores || []).filter(s => Number(s.exam_id) !== Number(selectedExam.id));
    schoolData.examScores = [...otherScores, ...rankedScores];

    const validScores = rankedScores.filter(score => score.is_valid !== false && Number(score.total_score) > 0);
    const avgScore = validScores.length
      ? validScores.reduce((sum, score) => sum + Number(score.total_score), 0) / validScores.length
      : 0;
    const topScore = validScores.length
      ? Math.max(...validScores.map(score => Number(score.total_score)))
      : 0;

    const nextExams = exams.map(exam =>
      Number(exam.id) === Number(selectedExam.id)
        ? {
            ...exam,
            status: validScores.length > 0 ? '已完成' : '未开始',
            total_students: rankedScores.length,
            valid_students: validScores.length,
            avg_score: Number(avgScore.toFixed(1)),
            top_score: Number(topScore.toFixed(1)),
          }
        : exam
    );
    setExams(nextExams);

    const latestExam = nextExams.find(exam => Number(exam.id) === Number(selectedExam.id));
    if (latestExam) setSelectedExam(latestExam);

    return rankedScores;
  };

  // 打开成绩管理弹窗
  const handleManageScores = async (exam) => {
    setSelectedExam(exam);
    setShowScoreModal(true);
    setScoreSearchTerm('');
    setScoreFilterClass('');
    await loadExamScores(exam.id);
  };

  // 处理缺考管理
  const handleManageAbsence = (exam) => {
    setSelectedExam(exam);
    setShowAbsenceModal(true);
  };

  const resetScoreImportState = () => {
    setScoreImportText('');
    setScoreImportPreview(null);
    setScoreImportRows([]);
    setScoreImportHeaders([]);
    setScoreImportError('');
    setScoreImportResult(null);
    setScoreImportBackendResult(null);
    setScoreImportFile(null);
    setScoreImporting(false);
  };

  const previewScoreImport = (text, exam = selectedExam) => {
    if (!text.trim()) {
      setScoreImportPreview(null);
      setScoreImportRows([]);
      setScoreImportHeaders([]);
      setScoreImportError('');
      setScoreImportResult(null);
      setScoreImportBackendResult(null);
      return null;
    }

    try {
      const parsed = parseScoreImportText(text);
      const existingExamScores = (schoolData.examScores || []).filter(s => Number(s.exam_id) === Number(exam.id));
      const result = buildScoreImport({
        parsedRows: parsed.rows,
        headers: parsed.headers,
        examData: exam,
        existingExamScores,
      });
      setScoreImportHeaders(parsed.headers);
      setScoreImportRows(parsed.rows);
      setScoreImportPreview(result);
      setScoreImportResult(null);
      setScoreImportBackendResult(null);
      setScoreImportError(result.importedScores.length === 0 ? (result.errors[0] || '没有可导入的数据') : '');
      return result;
    } catch (error) {
      setScoreImportPreview(null);
      setScoreImportRows([]);
      setScoreImportHeaders([]);
      setScoreImportError(error.message);
      setScoreImportResult(null);
      setScoreImportBackendResult(null);
      return null;
    }
  };

  // 处理成绩文件导入
  const handleScoreFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedExam) return;

    setScoreImportFile(file);
    setScoreImportBackendResult(null);
    setScoreImportResult(null);
    setScoreImportError('');

    if (isExcelScoreFile(file)) {
      setScoreImportText('');
      setScoreImportPreview(null);
      setScoreImportRows([]);
      setScoreImportHeaders([]);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result || '';
      setScoreImportText(content);
      previewScoreImport(content, selectedExam);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const buildScoreImportUploadPayload = (result) => {
    if (scoreImportFile && isExcelScoreFile(scoreImportFile)) {
      return { file: scoreImportFile, filename: scoreImportFile.name };
    }

    if (result && scoreImportHeaders.length && scoreImportRows.length) {
      const csv = scoreImportRowsToCsv({ headers: scoreImportHeaders, rows: scoreImportRows });
      return {
        file: new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }),
        filename: `${selectedExam.exam_name || selectedExam.id}_scores.csv`,
      };
    }

    return null;
  };

  const handleConfirmScoreImport = async () => {
    if (!selectedExam) return;

    setScoreImporting(true);
    setScoreImportError('');

    try {
      if (scoreImportFile && isExcelScoreFile(scoreImportFile)) {
        if (!hasBackendSession()) {
          setScoreImportError('Excel 文件需要在登录后写入后端数据库；当前会话未检测到登录 token。');
          return;
        }

        const backendResult = await uploadScoreImportFile({
          examId: selectedExam.id,
          file: scoreImportFile,
          filename: scoreImportFile.name,
        });
        if (backendResult?.success === false) {
          throw new Error(backendResult.message || '后端导入失败');
        }

        setScoreImportBackendResult(backendResult);
        setScoreImportResult({
          importedScores: [],
          insertedCount: backendResult.stats?.success || 0,
          updatedCount: 0,
          validCount: backendResult.stats?.success || 0,
          errors: backendResult.stats?.errors || [],
        });
        await refreshExamList();
        await loadExamScores(selectedExam.id);
        notify(backendResult.message || '成绩导入完成，考试统计已刷新。', 'success');
        return;
      }

      const result = scoreImportPreview || previewScoreImport(scoreImportText, selectedExam);
      if (!result || result.importedScores.length === 0) {
        setScoreImportError(result?.errors?.[0] || '没有可导入的数据');
        return;
      }

      if (hasBackendSession()) {
        const uploadPayload = buildScoreImportUploadPayload(result);
        const backendResult = await uploadScoreImportFile({
          examId: selectedExam.id,
          file: uploadPayload.file,
          filename: uploadPayload.filename,
        });
        if (backendResult?.success === false) {
          throw new Error(backendResult.message || '后端导入失败');
        }
        setScoreImportBackendResult(backendResult);
      }

      commitScoreImport({ examData: selectedExam, importResult: result });
      setExamScores(result.mergedScores);
      setExams([...(schoolData.exams || [])]);
      const latestExam = (schoolData.exams || []).find(exam => Number(exam.id) === Number(selectedExam.id));
      if (latestExam) setSelectedExam(latestExam);
      setScoreImportResult(result);
      setScoreImportError(result.errors.length ? `已写入成绩库，但有 ${result.errors.length} 行需要检查。` : '');
      if (hasBackendSession()) {
        await refreshExamList();
        await loadExamScores(selectedExam.id);
      }
      notify(`成绩导入完成：新增 ${result.insertedCount} 条，覆盖 ${result.updatedCount} 条，参与统计 ${result.validCount} 人。`, result.errors.length ? 'warning' : 'success');
    } catch (error) {
      setScoreImportError(error.message || '成绩导入失败');
      notify(`成绩导入失败：${error.message || '请稍后重试'}`, 'error');
    } finally {
      setScoreImporting(false);
    }
  };

  // 下载成绩导入模板
  const downloadScoreTemplate = () => {
    if (!selectedExam) return;

    const csvContent = buildScoreTemplateCsv(selectedExam);
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${selectedExam.exam_name}_成绩导入模板.csv`);
  };

  const exportLocalExamScores = (exam) => {
    const scores = (schoolData.examScores || []).filter(score => Number(score.exam_id) === Number(exam.id));
    if (scores.length === 0) {
      notify('当前考试没有可导出的本地成绩数据', 'warning');
      return false;
    }

    const csv = buildLocalExamScoresCsv({ exam, scores });
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${exam.exam_name || `exam_${exam.id}`}_成绩明细.csv`);
    return true;
  };

  const handleExportScores = async (exam) => {
    if (!exam?.id) return;

    setExportingExamId(exam.id);
    try {
      if (hasBackendSession()) {
        const blob = await exportExamScores(exam.id);
        downloadBlob(
          blob,
          `${exam.exam_name || `exam_${exam.id}`}_成绩明细.xlsx`
        );
        notify('成绩明细已导出', 'success');
        return;
      }

      if (exportLocalExamScores(exam)) {
        notify('本地成绩明细已导出', 'success');
      }
    } catch (error) {
      if (exportLocalExamScores(exam)) {
        notify(`后端导出失败，已导出本地缓存：${error.message || '连接失败'}`, 'warning');
      } else {
        notify(`导出失败：${error.message || '请稍后重试'}`, 'error');
      }
    } finally {
      setExportingExamId(null);
    }
  };

  const renderSubjectCatalogHint = () => (
    <p className={`mt-2 text-xs ${subjectCatalogError ? 'text-amber-600' : 'text-gray-500'}`}>
      {subjectCatalogError || (
        subjectCatalogSource === 'api'
          ? '学科选项来自后端学科目录。'
          : '学科选项来自本地缓存。'
      )}
    </p>
  );

  // 打开成绩编辑弹窗
  const handleEditScore = (score) => {
    if (hasBackendSession() && scoreListSource === 'backend') {
      notify('后端成绩明细暂不支持直接编辑，请通过成绩导入覆盖更新。', 'warning');
      return;
    }

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
      notify('数据校验失败：' + errorMsg);
      return;
    }

    // 检查是否所有成绩都为空
    const hasAnyScore = Object.values(validatedScores).some(v => v !== null && v !== undefined);
    if (!hasAnyScore) {
      notify('请至少输入一科成绩');
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

    updateSelectedExamScores(updatedScores);
    setShowScoreEditModal(false);
    notify('成绩修改成功！排名已自动更新。');
  };

  // 删除成绩
  const handleDeleteScore = async (scoreId) => {
    if (hasBackendSession() && scoreListSource === 'backend') {
      notify('后端成绩明细暂不支持直接删除，请通过重新导入或数据库维护处理。', 'warning');
      return;
    }

    const confirmed = await confirmAction({
      title: '删除成绩记录',
      message: '确定要删除这条成绩记录吗？此操作不可恢复！',
      confirmText: '删除'
    });
    if (!confirmed) return;

    const updatedScores = examScores.filter(s => s.id !== scoreId);
    updateSelectedExamScores(updatedScores);
    notify('成绩记录已删除，排名已重新计算。');
  };

  // 一键清空成绩
  const handleClearAllScores = async () => {
    if (!selectedExam) return;

    const count = examScores.length;
    if (hasBackendSession() && scoreListSource === 'backend') {
      notify('已连接后端成绩库，清空成绩需要后端删除接口支持；请通过重新导入覆盖或联系管理员处理。', 'warning');
      return;
    }

    if (count === 0) {
      notify('当前没有成绩数据可清空');
      return;
    }

    const confirmed = await confirmAction({
      title: '清空成绩',
      message: `确定要清空所有 ${count} 条成绩记录吗？此操作不可恢复！`,
      confirmText: '清空'
    });
    if (!confirmed) return;

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
  };

  // 过滤和排序成绩 - 使用 useMemo 缓存结果
  const filteredScores = useMemo(() => (
    filterAndSortScores({
      scores: examScores,
      searchTerm: scoreSearchTerm,
      filterClass: scoreFilterClass,
      sortField: scoreSortField,
      sortOrder: scoreSortOrder,
    })
  ), [examScores, scoreSearchTerm, scoreFilterClass, scoreSortField, scoreSortOrder]);

  // 获取班级列表 - 返回该年级的所有班级
  const getClassList = () => {
    return getGradeClassesForExam({ exam: selectedExam, classes: schoolData.classes || [] });
  };

  const filteredExams = useMemo(() => (
    filterExams({ exams, searchTerm, filterGrade, filterTerm })
  ), [exams, searchTerm, filterGrade, filterTerm]);

  const sourceExamScores = schoolData.examScores || [];
  const examOverview = calculateExamOverview({
    exams,
    examScores: sourceExamScores,
  });

  const classStats = calculateClassStats({
    selectedExam,
    examScores: sourceExamScores,
    classes: schoolData.classes || [],
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">考试管理</h1>
        <p className="text-gray-500 mt-1">创建和管理各类考试，导入成绩数据</p>
      </div>

      {(examListLoading || examListError || examSyncSource === 'backend') && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
          examListError
            ? 'border-amber-100 bg-amber-50 text-amber-700'
            : 'border-emerald-100 bg-emerald-50 text-emerald-700'
        }`}>
          {examListError ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          <span>
            {examListLoading
              ? '正在同步后端考试库...'
              : examListError || '已连接后端考试库，考试列表和统计来自数据库。'}
          </span>
        </div>
      )}

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
              <p className="text-2xl font-bold text-gray-800">{examOverview.totalExams}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已完成</p>
              <p className="text-2xl font-bold text-green-600">
                {examOverview.completedExams}
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
                {examOverview.validStudents}
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
              <p className="text-2xl font-bold text-gray-800">{examOverview.thisMonthExams}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
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
                const validStudents = getExamValidStudentCount({
                  exam,
                  scores: schoolData.examScores || [],
                });
                
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
            const validStudents = getExamValidStudentCount({
              exam,
              scores: schoolData.examScores || [],
            });
            
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
        <ExamFormModal
          mode="create"
          form={createForm}
          setForm={setCreateForm}
          availableSubjects={availableSubjects}
          subjectCatalogHint={renderSubjectCatalogHint()}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleSaveCreate}
        />
      )}

      {/* 编辑考试弹窗 */}
      {showEditModal && selectedExam && (
        <ExamFormModal
          mode="edit"
          form={editForm}
          setForm={setEditForm}
          availableSubjects={availableSubjects}
          subjectCatalogHint={renderSubjectCatalogHint()}
          onClose={() => setShowEditModal(false)}
          onSubmit={(event) => {
            event.preventDefault();
            handleSaveEdit();
          }}
        />
      )}

      {/* 考试详情弹窗 */}
      {showDetailModal && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          {(() => {
            // 从exams数组中获取最新的考试数据
            const currentExam = exams.find(e => e.id === selectedExam.id) || selectedExam;
            
            // 从schoolData获取该考试的实际成绩数据
            const examScoresData = schoolData.examScores?.filter(s => s.exam_id === selectedExam.id) || [];
            
            // 优先展示后端统计；本地成绩弹窗编辑时仍可即时反映未同步的本地变化。
            const localValidStudents = examScoresData.filter(s => s.is_valid !== false).length;
            const validStudents = Number(currentExam.valid_students || 0) || localValidStudents;
            const totalStudents = Number(currentExam.total_students || 0) || examScoresData.length;
            
            // 计算平均分、最高分、及格率
            let avgScore = '-';
            let topScore = '-';
            let passRate = '-';
            
            if (Number(currentExam.avg_score || 0) > 0 || Number(currentExam.top_score || 0) > 0) {
              avgScore = Number(currentExam.avg_score || 0).toFixed(1);
              topScore = Number(currentExam.top_score || 0).toFixed(1);
            } else if (examScoresData.length > 0) {
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
                    <Download className="w-4 h-4 md:w-5 md:h-5" />
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
                onClick={() => handleExportScores(currentExam)}
                disabled={exportingExamId === currentExam.id}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Download className="w-4 h-4" />
                {exportingExamId === currentExam.id ? '导出中...' : '导出成绩'}
              </button>
            </div>
          </div>
          );
          })()}
        </div>
      )}

      {/* 成绩管理弹窗 */}
      {showScoreModal && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          {(() => {
            const scoreEditingLocked = hasBackendSession() && scoreListSource === 'backend';

            return (
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

            {(scoreListLoading || scoreListError || scoreListSource === 'backend') && (
              <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
                scoreListError
                  ? 'border-amber-100 bg-amber-50 text-amber-700'
                  : 'border-emerald-100 bg-emerald-50 text-emerald-700'
              }`}>
                {scoreListError ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                <span>
                  {scoreListLoading
                    ? '正在读取后端成绩明细...'
                    : scoreListError || '成绩明细来自后端数据库；如需修正，请通过成绩导入覆盖更新。'}
                </span>
              </div>
            )}

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
                            if (scoreEditingLocked) {
                              notify('后端成绩明细暂不支持直接切换参与统计，请通过成绩导入覆盖更新。', 'warning');
                              return;
                            }
                            const updatedScores = examScores.map(s =>
                              s.id === score.id ? { ...s, is_valid: s.is_valid === false } : s
                            );
                            updateSelectedExamScores(updatedScores);
                          }}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            score.is_valid !== false
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          } ${scoreEditingLocked ? 'cursor-not-allowed opacity-70' : ''}`}
                        >
                          {score.is_valid !== false ? '是' : '否'}
                        </button>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditScore(score)}
                            className={`p-1.5 rounded ${
                              scoreEditingLocked
                                ? 'cursor-not-allowed text-gray-300'
                                : 'text-blue-600 hover:bg-blue-50'
                            }`}
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
                            className={`p-1.5 rounded ${
                              scoreEditingLocked
                                ? 'cursor-not-allowed text-gray-300'
                                : 'text-red-600 hover:bg-red-50'
                            }`}
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
            );
          })()}
        </div>
      )}

      {/* 成绩导入弹窗 */}
      {showScoreImportModal && selectedExam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg w-full max-w-5xl m-4 max-h-[92vh] overflow-y-auto p-6">
            <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-800">导入成绩</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedExam.exam_name} · {selectedExam.grade_level} · {selectedExam.subjects.join('、')}
                </p>
              </div>
              <button onClick={() => setShowScoreImportModal(false)} className="self-end md:self-start">
                <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                  <h3 className="font-medium text-emerald-900">导入规则</h3>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-emerald-800">
                    <li>支持 CSV/TSV 预览导入，也支持 Excel 文件直接写入后端。</li>
                    <li>表头建议包含：学籍辅号、姓名、班级、{selectedExam.subjects.join('、')}。</li>
                    <li>可选字段：总分、参与统计、额外统计班级。</li>
                    <li>确认写入前会预检新增、覆盖和异常行。</li>
                  </ul>
                </div>

                <label
                  htmlFor="score-file-input"
                  className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50"
                >
                  <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700">选择成绩文件</p>
                  <p className="mt-1 text-xs text-gray-400">CSV/TSV 先预览，Excel 直接写入后端</p>
                  <input
                    id="score-file-input"
                    type="file"
                    accept=".csv,.tsv,.txt,.xls,.xlsx"
                    className="hidden"
                    onChange={handleScoreFileImport}
                  />
                </label>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">粘贴成绩表</label>
                <textarea
                  value={scoreImportText}
                  onChange={(event) => {
                    setScoreImportFile(null);
                    setScoreImportText(event.target.value);
                    previewScoreImport(event.target.value, selectedExam);
                  }}
                  className="h-56 w-full resize-none rounded-lg border border-gray-300 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="学籍辅号\t姓名\t班级\t语文\t数学\t英语\t总分\t参与统计"
                />
              </div>
            </div>

            {scoreImportFile && isExcelScoreFile(scoreImportFile) && (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                <div className="flex items-center gap-2 font-medium">
                  <Upload className="h-4 w-4" />
                  Excel 文件待写入
                </div>
                <p className="mt-2 text-blue-700">{scoreImportFile.name}</p>
                <p className="mt-1 text-blue-600">该文件将交由后端校验并写入数据库，本页不读取 Excel 内容做本地预览。</p>
              </div>
            )}

            {scoreImportError && (
              <div className={`mt-4 flex items-start gap-2 rounded-lg p-3 text-sm ${scoreImportResult ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{scoreImportError}</span>
              </div>
            )}

            {scoreImportPreview && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    ['新增', scoreImportPreview.insertedCount],
                    ['覆盖', scoreImportPreview.updatedCount],
                    ['参与统计', scoreImportPreview.validCount],
                    ['需检查', scoreImportPreview.errors.length],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                    <p className="font-medium text-gray-800">解析预览</p>
                    <p className="text-sm text-gray-500">共 {scoreImportRows.length} 行，仅显示前 20 行</p>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr>
                          {scoreImportHeaders.map(header => (
                            <th key={header} className="px-3 py-2 text-left font-medium text-gray-500">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {scoreImportRows.slice(0, 20).map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {scoreImportHeaders.map(header => (
                              <td key={header} className="whitespace-nowrap px-3 py-2 text-gray-700">{row[header] || '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {scoreImportPreview.errors.length > 0 && (
                  <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                    <p className="font-medium">需检查行</p>
                    <ul className="mt-2 space-y-1">
                      {scoreImportPreview.errors.slice(0, 8).map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {scoreImportResult && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircle className="h-4 w-4" />
                <span>成绩已写入，考试统计和排名已刷新。</span>
              </div>
            )}

            {scoreImportBackendResult && (
              <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle className="h-4 w-4" />
                  已同步后端数据库
                </div>
                <p className="mt-2">
                  {scoreImportBackendResult.message || `成功 ${scoreImportBackendResult.stats?.success || 0} 条，失败 ${scoreImportBackendResult.stats?.failed || 0} 条`}
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={downloadScoreTemplate}
                className="flex items-center gap-2 text-green-600 hover:text-green-800 text-sm"
              >
                <Download className="w-4 h-4" />
                下载模板
              </button>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowScoreImportModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                {scoreImportResult ? (
                  <button
                    onClick={() => {
                      setShowScoreImportModal(false);
                      handleManageScores(selectedExam);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    查看成绩
                  </button>
                ) : (
                  <button
                    onClick={handleConfirmScoreImport}
                    disabled={scoreImporting || !(scoreImportPreview?.importedScores?.length || (scoreImportFile && isExcelScoreFile(scoreImportFile)))}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {scoreImporting ? '写入中...' : '确认写入'}
                  </button>
                )}
              </div>
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
