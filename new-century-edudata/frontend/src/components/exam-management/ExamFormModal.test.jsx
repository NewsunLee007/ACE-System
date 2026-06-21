import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ExamFormModal, {
  calculateExamFullScore,
  updateExamSubjects,
  updateSubjectScore,
} from './ExamFormModal';

const baseForm = {
  exam_name: '7年级期中考试',
  term: '2025-1',
  exam_type: '期中',
  grade_level: '7年级',
  exam_date: '2026-06-18',
  subjects: ['语文'],
  subject_scores: { 语文: 100 },
  full_score: 100,
};

describe('ExamFormModal', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('keeps subject scores and total score synchronized when subjects change', () => {
    expect(calculateExamFullScore(['语文', '数学'], { 语文: 100, 数学: 120 })).toBe(220);

    const added = updateExamSubjects(baseForm, '数学', true);
    expect(added.subjects).toEqual(['语文', '数学']);
    expect(added.subject_scores).toMatchObject({ 语文: 100, 数学: 100 });
    expect(added.full_score).toBe(200);

    const removed = updateExamSubjects(added, '语文', false);
    expect(removed.subjects).toEqual(['数学']);
    expect(removed.subject_scores).toEqual({ 数学: 100 });
    expect(removed.full_score).toBe(100);
  });

  it('recalculates the total when a subject full score is edited', () => {
    const result = updateSubjectScore({
      ...baseForm,
      subjects: ['语文', '数学'],
      subject_scores: { 语文: 100, 数学: 100 },
      full_score: 200,
    }, '数学', '120');

    expect(result.subject_scores).toMatchObject({ 语文: 100, 数学: 120 });
    expect(result.full_score).toBe(220);
  });

  it('submits the shared create/edit form and updates visible totals', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onSubmit = jest.fn(event => event.preventDefault());
    let latestForm = null;

    const Wrapper = () => {
      const [form, setForm] = useState(baseForm);
      latestForm = form;
      return (
        <ExamFormModal
          mode="create"
          form={form}
          setForm={setForm}
          availableSubjects={['语文', '数学']}
          subjectCatalogHint={<p>学科选项来自本地缓存。</p>}
          onClose={jest.fn()}
          onSubmit={onSubmit}
        />
      );
    };

    act(() => {
      root.render(<Wrapper />);
    });

    const mathCheckbox = Array.from(container.querySelectorAll('input[type="checkbox"]'))
      .find(input => input.parentElement.textContent.includes('数学'));
    act(() => {
      mathCheckbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(latestForm.subjects).toEqual(['语文', '数学']);
    expect(latestForm.full_score).toBe(200);
    expect(container.textContent).toContain('总分: 200 分');

    act(() => {
      container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
