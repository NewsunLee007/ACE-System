import React from 'react';
import { X } from 'lucide-react';

const getSubjectScore = (subjectScores = {}, subject) => subjectScores?.[subject] || 100;

export const calculateExamFullScore = (subjects = [], subjectScores = {}) => (
  subjects.reduce((sum, subject) => sum + getSubjectScore(subjectScores, subject), 0)
);

export const updateExamSubjects = (form, subject, checked) => {
  const currentSubjects = Array.isArray(form.subjects) ? form.subjects : [];
  const currentScores = { ...(form.subject_scores || {}) };
  const nextSubjects = checked
    ? Array.from(new Set([...currentSubjects, subject]))
    : currentSubjects.filter(item => item !== subject);

  if (checked) {
    currentScores[subject] = getSubjectScore(currentScores, subject);
  } else {
    delete currentScores[subject];
  }

  return {
    ...form,
    subjects: nextSubjects,
    subject_scores: currentScores,
    full_score: calculateExamFullScore(nextSubjects, currentScores),
  };
};

export const updateSubjectScore = (form, subject, value) => {
  const nextScores = { ...(form.subject_scores || {}) };
  nextScores[subject] = parseInt(value, 10) || 0;

  return {
    ...form,
    subject_scores: nextScores,
    full_score: calculateExamFullScore(form.subjects || [], nextScores),
  };
};

export default function ExamFormModal({
  mode = 'create',
  form,
  setForm,
  availableSubjects = [],
  subjectCatalogHint = null,
  onClose,
  onSubmit,
}) {
  const isCreate = mode === 'create';
  const title = isCreate ? '创建新考试' : '编辑考试';
  const submitText = isCreate ? '创建' : '保存';
  const subjects = Array.isArray(form.subjects) ? form.subjects : [];
  const fullScore = form.full_score || calculateExamFullScore(subjects, form.subject_scores || {});

  const updateField = (field, value) => {
    setForm(previous => ({ ...previous, [field]: value }));
  };

  const handleSubjectToggle = (subject, checked) => {
    setForm(previous => updateExamSubjects(previous, subject, checked));
  };

  const handleSubjectScoreChange = (subject, value) => {
    setForm(previous => updateSubjectScore(previous, subject, value));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button type="button" onClick={onClose}>
            <X className="w-6 h-6 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">考试名称{isCreate ? ' *' : ''}</label>
            <input
              type="text"
              required={isCreate}
              value={form.exam_name}
              onChange={(event) => updateField('exam_name', event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder={isCreate ? '如：2025-1 7年级教学调研' : undefined}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学期</label>
              <select
                value={form.term}
                onChange={(event) => updateField('term', event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option>2025-1</option>
                <option>2024-2</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">考试类型</label>
              <select
                value={form.exam_type}
                onChange={(event) => updateField('exam_type', event.target.value)}
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
                value={form.grade_level}
                onChange={(event) => updateField('grade_level', event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option>7年级</option>
                <option>8年级</option>
                <option>9年级</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">考试日期{isCreate ? ' *' : ''}</label>
              <input
                type="date"
                required={isCreate}
                value={form.exam_date}
                onChange={(event) => updateField('exam_date', event.target.value)}
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
                    checked={subjects.includes(subject)}
                    onChange={(event) => handleSubjectToggle(subject, event.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">{subject}</span>
                </label>
              ))}
            </div>
            {availableSubjects.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">请先前往"学科管理"添加学科</p>
            )}
            {subjectCatalogHint}
          </div>

          {subjects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">学科满分分值设定</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {subjects.map(subject => (
                  <div key={subject} className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 w-12">{subject}</span>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={getSubjectScore(form.subject_scores, subject)}
                      onChange={(event) => handleSubjectScoreChange(subject, event.target.value)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="text-xs text-gray-400">分</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                总分: <span className="font-medium text-blue-600">{fullScore}</span> 分
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
