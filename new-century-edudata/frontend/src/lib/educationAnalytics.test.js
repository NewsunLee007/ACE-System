import { buildExamAnalytics } from './educationAnalytics';

describe('buildExamAnalytics layered benchmarks', () => {
  const exam = {
    id: 1,
    subjects: ['总分'],
    subject_scores: { 总分: 100 },
    full_score: 100,
  };

  const layers = [
    { class_id: 701, class_name: '701班', layer_code: 'A' },
    { class_id: 702, class_name: '702班', layer_code: 'A' },
    { class_id: 703, class_name: '703班', layer_code: 'C' },
    { class_id: 704, class_name: '704班', layer_code: 'C' },
  ];

  const rows = [
    { exam_id: 1, class_id: 701, total_score: 100, scores: { 总分: 100 }, is_valid: true },
    { exam_id: 1, class_id: 701, total_score: 90, scores: { 总分: 90 }, is_valid: true },
    { exam_id: 1, class_id: 702, total_score: 80, scores: { 总分: 80 }, is_valid: true },
    { exam_id: 1, class_id: 702, total_score: 70, scores: { 总分: 70 }, is_valid: true },
    { exam_id: 1, class_id: 703, total_score: 60, scores: { 总分: 60 }, is_valid: true },
    { exam_id: 1, class_id: 703, total_score: 50, scores: { 总分: 50 }, is_valid: true },
    { exam_id: 1, class_id: 704, total_score: 80, scores: { 总分: 80 }, is_valid: true },
    { exam_id: 1, class_id: 704, total_score: 70, scores: { 总分: 70 }, is_valid: true },
  ];

  it('computes class differences against both current range and same layer', () => {
    const analytics = buildExamAnalytics({ exam, rows, layers, layerCode: 'all' });

    const class701 = analytics.classRows.find(row => row.classId === 701);
    const class704 = analytics.classRows.find(row => row.classId === 704);

    expect(class701.mean).toBe(95);
    expect(class701.rangeDiff).toBe(20);
    expect(class701.sameLayerMean).toBe(85);
    expect(class701.sameLayerDiff).toBe(10);

    expect(class704.mean).toBe(75);
    expect(class704.rangeDiff).toBe(0);
    expect(class704.sameLayerMean).toBe(65);
    expect(class704.sameLayerDiff).toBe(10);
  });
});
