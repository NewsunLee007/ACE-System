import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import schoolData from '../../data/schoolData';
import ScoreRawData from './ScoreRawData';
import {
  buildScoreImport,
  commitScoreImport,
  parseScoreImportText,
  scoreImportRowsToCsv,
  uploadScoreImportFile,
} from '../../lib/scoreImport';

const clearArray = (items) => {
  items.splice(0, items.length);
};

const originalFetch = global.fetch;
const mockResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => JSON.stringify(body),
});

describe('ScoreRawData import helpers', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    localStorage.clear();
    global.fetch = originalFetch;
    clearArray(schoolData.students);
    clearArray(schoolData.classes);
    clearArray(schoolData.exams);
    clearArray(schoolData.examScores);

    schoolData.classes.push(
      { id: 701, class_no: '701', name: '701班', status: 'active' },
      { id: 704, class_no: '704', name: '704班', status: 'active' },
      { id: 705, class_no: '705', name: '705班', status: 'active' }
    );
    schoolData.students.push(
      { id: 1, student_code: 'S001', name: '真实学生', class_id: 701 },
      { id: 2, student_code: 'S002', name: '同班学生', class_id: 701 }
    );
    schoolData.exams.push({
      id: 10,
      exam_name: '7年级期中考试',
      grade_level: '7年级',
      subjects: ['语文', '数学'],
      subject_scores: { 语文: 100, 数学: 100 },
      full_score: 200,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('parses tab-delimited text copied from Excel', () => {
    const parsed = parseScoreImportText('学籍辅号\t姓名\t班级\t语文\t数学\nS001\t真实学生\t701\t88\t92');

    expect(parsed.headers).toEqual(['学籍辅号', '姓名', '班级', '语文', '数学']);
    expect(parsed.rows[0]).toMatchObject({
      学籍辅号: 'S001',
      姓名: '真实学生',
      班级: '701',
      语文: '88',
      数学: '92',
    });
  });

  it('skips blank CSV tail rows left by spreadsheet exports', () => {
    const parsed = parseScoreImportText([
      '学籍辅号,姓名,语文,数学,参与统计',
      'S001,真实学生,88,92,是',
      ',,,,　',
      ',,,,',
    ].join('\n'));

    expect(parsed.rows).toHaveLength(1);
  });

  it('serializes parsed rows as backend-compatible CSV', () => {
    const csv = scoreImportRowsToCsv({
      headers: ['学籍辅号', '姓名', '班级', '语文'],
      rows: [
        { 学籍辅号: 'S001', 姓名: '真实学生', 班级: '701', 语文: '88' },
        { 学籍辅号: 'S002', 姓名: '带"引号"', 班级: '701', 语文: '90' },
      ],
    });

    expect(csv).toBe('"学籍辅号","姓名","班级","语文"\n"S001","真实学生","701","88"\n"S002","带""引号""","701","90"');
  });

  it('uploads score files to the backend with the current auth token', async () => {
    localStorage.setItem('token', 'staff-token');
    global.fetch = jest.fn().mockResolvedValue(mockResponse({
      success: true,
      message: '导入完成: 成功1条, 失败0条',
      stats: { success: 1, failed: 0, errors: [] },
    }));
    const file = new Blob(['学籍辅号,姓名,班级,语文\nS001,真实学生,701,88'], { type: 'text/csv' });

    const result = await uploadScoreImportFile({ examId: 10, file, filename: 'scores.csv' });

    expect(result.message).toBe('导入完成: 成功1条, 失败0条');
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/data/import/scores/10?skip_invalid=true', expect.objectContaining({
      method: 'POST',
      body: expect.any(FormData),
      headers: expect.objectContaining({
        Authorization: 'Bearer staff-token',
      }),
    }));
    expect(global.fetch.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
  });

  it('builds ranked scores and reports duplicate overwrites', () => {
    const parsed = parseScoreImportText([
      '学籍辅号,姓名,班级,语文,数学,参与统计',
      'S001,真实学生,701,90,95,是',
      'S002,同班学生,701,80,82,是',
    ].join('\n'));

    const result = buildScoreImport({
      parsedRows: parsed.rows,
      headers: parsed.headers,
      examData: schoolData.exams[0],
      existingExamScores: [
        { id: 'old_1', exam_id: 10, student_id: 1, student_code: 'S001', class_id: 701, scores: { 语文: 70, 数学: 70 }, total_score: 140, is_valid: true },
      ],
    });

    expect(result.insertedCount).toBe(1);
    expect(result.updatedCount).toBe(1);
    expect(result.mergedScores.find(score => score.student_code === 'S001')).toMatchObject({
      id: 'old_1',
      total_score: 185,
      rank: 1,
      class_rank: 1,
    });
    expect(result.mergedScores.find(score => score.student_code === 'S002')).toMatchObject({
      total_score: 162,
      rank: 2,
      class_rank: 2,
    });
  });

  it('commits imported scores to schoolData for the selected exam', () => {
    const parsed = parseScoreImportText('学籍辅号\t姓名\t班级\t语文\t数学\nS001\t真实学生\t701\t88\t92');
    const result = buildScoreImport({
      parsedRows: parsed.rows,
      headers: parsed.headers,
      examData: schoolData.exams[0],
    });

    commitScoreImport({ examData: schoolData.exams[0], importResult: result });

    expect(schoolData.examScores).toHaveLength(1);
    expect(schoolData.examScores[0]).toMatchObject({
      exam_id: 10,
      student_code: 'S001',
      total_score: 180,
      rank: 1,
    });
    expect(schoolData.exams[0]).toMatchObject({
      status: '已完成',
      total_students: 1,
      valid_students: 1,
      avg_score: 180,
      top_score: 180,
    });
  });

  it('keeps extra class statistics and excludes invalid rows from ranks', () => {
    const parsed = parseScoreImportText([
      '学籍辅号,姓名,班级,语文,数学,参与统计,额外统计班级',
      'S001,真实学生,701,90,95,否,704;705',
      'S002,同班学生,701,80,82,是,',
    ].join('\n'));

    const result = buildScoreImport({
      parsedRows: parsed.rows,
      headers: parsed.headers,
      examData: schoolData.exams[0],
    });

    const invalidStudent = result.mergedScores.find(score => score.student_code === 'S001');
    const validStudent = result.mergedScores.find(score => score.student_code === 'S002');

    expect(invalidStudent).toMatchObject({
      is_valid: false,
      additional_classes: [
        { class_id: 704, class_name: '704班' },
        { class_id: 705, class_name: '705班' },
      ],
    });
    expect(invalidStudent.rank).toBe(0);
    expect(validStudent).toMatchObject({ rank: 1, class_rank: 1 });
    expect(result.validCount).toBe(1);
  });

  it('imports scoreless invalid rows as non-participating records', () => {
    const parsed = parseScoreImportText([
      '学籍辅号,姓名,班级,语文,数学,参与统计',
      'S001,真实学生,701,,,不是',
      'S002,同班学生,701,80,82,是',
    ].join('\n'));

    const result = buildScoreImport({
      parsedRows: parsed.rows,
      headers: parsed.headers,
      examData: schoolData.exams[0],
    });

    const absentStudent = result.mergedScores.find(score => score.student_code === 'S001');
    expect(absentStudent).toMatchObject({
      total_score: 0,
      is_valid: false,
      rank: 0,
    });
    expect(result.errors).toEqual([]);
    expect(result.validCount).toBe(1);
  });

  it('renders source, preview and result as a staged import workflow', async () => {
    const onImportSuccess = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ScoreRawData examData={schoolData.exams[0]} onImportSuccess={onImportSuccess} />);
    });

    expect(container.textContent).toContain('数据核对工作台');
    expect(container.textContent).toContain('数据导入结果控件');
    expect(container.textContent).toContain('当前：数据来源');
    expect(container.querySelector('#score-raw-module-content')).toBeTruthy();
    expect(container.textContent).toContain('智能粘贴');
    expect(container.textContent).toContain('文件导入');
    expect(container.textContent).toContain('从 Excel 复制成绩区域后直接粘贴');
    expect(container.textContent).not.toContain('选择成绩文件');
    expect(container.textContent).not.toContain('解析预览（共');
    expect(container.textContent).not.toContain('当前：解析预览');

    const fileSourceButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('CSV/TSV 预览'));
    await act(async () => {
      fileSourceButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('选择成绩文件');

    const pasteSourceButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('智能粘贴'));
    await act(async () => {
      pasteSourceButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).not.toContain('选择成绩文件');

    const textarea = container.querySelector('textarea');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, '学籍辅号\t姓名\t班级\t语文\t数学\nS001\t真实学生\t701\t88\t92');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：解析预览');
    expect(container.textContent).toContain('预览核对结果控件');
    expect(container.textContent).toContain('解析预览（共 1 行）');
    expect(container.textContent).toContain('当前：预览摘要');
    expect(container.querySelector('#score-raw-preview-content')).toBeTruthy();
    expect(container.textContent).toContain('字段识别');
    expect(container.textContent).toContain('首行样例');
    expect(container.textContent).toContain('进入写入确认');
    expect(container.textContent).not.toContain('选择成绩文件');
    expect(Array.from(container.querySelectorAll('th')).map(th => th.textContent.trim())).toEqual([]);

    const detailButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('查看行级明细'));
    await act(async () => {
      detailButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：行级明细');
    expect(container.textContent).toContain('行级明细');
    expect(Array.from(container.querySelectorAll('th')).map(th => th.textContent.trim())).toEqual([
      '学籍辅号',
      '姓名',
      '班级',
      '语文',
      '数学',
    ]);

    const summaryButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('返回预览摘要'));
    await act(async () => {
      summaryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('当前：预览摘要');
    expect(Array.from(container.querySelectorAll('th')).map(th => th.textContent.trim())).toEqual([]);

    const allButtons = Array.from(container.querySelectorAll('button'))
      .filter(button => button.textContent.includes('全面铺开'));
    const allButton = allButtons[allButtons.length - 1];
    await act(async () => {
      allButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('字段识别');
    expect(container.textContent).toContain('行级明细');
    expect(Array.from(container.querySelectorAll('th')).map(th => th.textContent.trim())).toContain('学籍辅号');

    const confirmButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('进入写入确认'));
    await act(async () => {
      confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：写入确认');
    expect(container.textContent).toContain('写入规则');
    expect(container.textContent).toContain('覆盖口径');
    expect(container.textContent).toContain('同一考试、同一学生更新原成绩');

    const importButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('写入当前考试'));
    await act(async () => {
      importButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：导入结果');
    expect(container.textContent).toContain('新增');
    expect(container.textContent).toContain('有效');
    expect(onImportSuccess).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
