import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import StudentScoreDetail, { buildStudentDynamicDiagnosis, buildStudentExamScores, findStudentForScoreDetail } from './StudentScoreDetail';
import schoolData from '../data/schoolData';
import { buildStudentScoreAiPayload } from '../lib/aiAnalysisApi';

const clearArray = (items) => {
  items.splice(0, items.length);
};

describe('StudentScoreDetail', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  beforeEach(() => {
    localStorage.clear();
    clearArray(schoolData.students);
    clearArray(schoolData.teachers);
    clearArray(schoolData.parents);
    clearArray(schoolData.exams);
    clearArray(schoolData.examScores);
  });

  it('shows an explicit empty state instead of a sample student when no student is found', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<StudentScoreDetail studentId="missing-student" />);
    });

    expect(container.textContent).toContain('未找到学生档案');
    expect(container.textContent).toContain('系统不会用样例学生替代真实学生');
    expect(container.textContent).not.toContain('张小明');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('builds the detail view from real schoolData scores', () => {
    schoolData.students.push(
      { id: 1, student_code: 'S001', name: '真实学生', class_id: 701, gender: '女' },
      { id: 2, student_code: 'S002', name: '同班学生', class_id: 701, gender: '男' }
    );
    schoolData.exams.push({
      id: 10,
      exam_name: '7年级期中考试',
      exam_date: '2026-01-10',
      subjects: ['语文', '数学'],
      subject_scores: { 语文: 100, 数学: 100 },
      full_score: 200,
    });
    schoolData.examScores.push(
      { id: 100, exam_id: 10, student_id: 1, class_id: 701, scores: { 语文: 88, 数学: 92 }, total_score: 180, is_valid: true },
      { id: 101, exam_id: 10, student_id: 2, class_id: 701, scores: { 语文: 90, 数学: 80 }, total_score: 170, is_valid: true }
    );

    const student = findStudentForScoreDetail('S001');
    const scores = buildStudentExamScores(student);
    expect(scores[0].total.score).toBe(180);
    expect(scores[0].total.class_rank).toBe(1);
    expect(scores[0].subjects['数学'].class_rank).toBe(1);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<StudentScoreDetail studentId="S001" />);
    });

    expect(container.textContent).toContain('真实学生');
    expect(container.textContent).toContain('7年级期中考试');
    expect(container.textContent).toContain('180');
    expect(container.textContent).not.toContain('张小明');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('builds multi-exam dynamic diagnosis and AI payload from scoped student scores', () => {
    schoolData.students.push(
      { id: 1, student_code: 'S001', name: '真实学生', class_id: 701, gender: '女' },
      { id: 2, student_code: 'S002', name: '同班学生', class_id: 701, gender: '男' }
    );
    schoolData.exams.push(
      {
        id: 10,
        exam_name: '7年级期中考试',
        exam_date: '2026-01-10',
        subjects: ['语文', '数学'],
        subject_scores: { 语文: 100, 数学: 100 },
        full_score: 200,
      },
      {
        id: 11,
        exam_name: '7年级期末考试',
        exam_date: '2026-02-10',
        subjects: ['语文', '数学'],
        subject_scores: { 语文: 100, 数学: 100 },
        full_score: 200,
      }
    );
    schoolData.examScores.push(
      { id: 100, exam_id: 10, student_id: 1, class_id: 701, scores: { 语文: 80, 数学: 92 }, total_score: 172, is_valid: true },
      { id: 101, exam_id: 10, student_id: 2, class_id: 701, scores: { 语文: 90, 数学: 80 }, total_score: 170, is_valid: true },
      { id: 102, exam_id: 11, student_id: 1, class_id: 701, scores: { 语文: 82, 数学: 62 }, total_score: 144, is_valid: true },
      { id: 103, exam_id: 11, student_id: 2, class_id: 701, scores: { 语文: 88, 数学: 90 }, total_score: 178, is_valid: true }
    );

    const student = findStudentForScoreDetail('S001');
    const scores = buildStudentExamScores(student);
    const diagnosis = buildStudentDynamicDiagnosis(scores);

    expect(diagnosis.hasHistory).toBe(true);
    expect(diagnosis.totalTrend.direction).toBe('down');
    expect(diagnosis.weakSubjects[0]).toMatchObject({
      subject: '数学',
      score: 62,
      scoreDelta: -30,
    });
    expect(diagnosis.weakSubjects[0].remedy).toContain('数学');

    const payload = buildStudentScoreAiPayload({
      profile: { name: student.name, class_name: '2025级01班' },
      currentExam: scores[0],
      dynamicDiagnosis: diagnosis,
    });

    expect(payload.student_name).toBe('真实学生');
    expect(payload.history).toHaveLength(2);
    expect(payload.weak_subjects[0].subject).toBe('数学');
    expect(JSON.stringify(payload)).not.toContain('同班学生');
  });
});
