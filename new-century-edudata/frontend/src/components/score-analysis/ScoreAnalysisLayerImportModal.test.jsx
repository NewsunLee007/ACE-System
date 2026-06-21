import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import schoolData from '../../data/schoolData';
import ScoreAnalysisLayerImportModal, { parseLayerImportCsv } from './ScoreAnalysisLayerImportModal';

const layerConfig = {
  A: { name: '实验班' },
  B: { name: '创新班' },
  C: { name: '平行班' },
};

describe('ScoreAnalysisLayerImportModal helpers', () => {
  const originalClasses = schoolData.classes;
  const originalClassLayers = schoolData.classLayers;
  const originalFormatClassName = schoolData.formatClassName;
  const originalAcademicYear = schoolData.getCurrentAcademicYearDisplay;
  const originalFileReader = global.FileReader;

  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    schoolData.classes = [
      { id: 701, name: '701班' },
      { id: 702, name: '702班' },
    ];
    schoolData.classLayers = [];
    schoolData.formatClassName = (id) => `${id}班`;
    schoolData.getCurrentAcademicYearDisplay = () => '2026-2027';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    schoolData.classes = originalClasses;
    schoolData.classLayers = originalClassLayers;
    schoolData.formatClassName = originalFormatClassName;
    schoolData.getCurrentAcademicYearDisplay = originalAcademicYear;
    global.FileReader = originalFileReader;
  });

  it('parses valid CSV rows and skips classes already in the draft config', () => {
    const result = parseLayerImportCsv({
      text: '班级名称,层次代码\n701班,A\n"702班",B',
      selectedGrade: '7年级',
      existingLayers: [{ class_id: 701 }],
      classes: [
        { id: 701, name: '701班' },
        { id: 702, name: '702班' },
      ],
      formatClassName: (id) => `${id}班`,
      currentAcademicYear: '2026-2027',
      layerConfig,
    });

    expect(result.errors).toEqual([]);
    expect(result.newClasses).toHaveLength(2);
    expect(result.uniqueNewClasses).toEqual([
      expect.objectContaining({
        class_id: 702,
        class_name: '702班',
        layer_code: 'B',
        layer_name: '创新班',
        academic_year: '2026-2027',
      }),
    ]);
    expect(result.duplicateCount).toBe(1);
  });

  it('reports invalid layer codes and unmatched classes', () => {
    const result = parseLayerImportCsv({
      text: '班级名称,层次代码\n701班,D\n999班,A',
      selectedGrade: '7年级',
      classes: [{ id: 701, name: '701班' }],
      layerConfig,
    });

    expect(result.uniqueNewClasses).toEqual([]);
    expect(result.errors).toEqual([
      '第1行：层次代码必须是A、B、C',
      '第2行：无法匹配班级ID（请用701/701班等格式）',
    ]);
  });

  it('stages CSV upload behind template, upload, review and apply steps', () => {
    const setEditedClassLayers = jest.fn();
    const normalizeClassLayers = jest.fn((layers) => layers);
    const notify = jest.fn();
    const onClose = jest.fn();
    global.FileReader = class {
      readAsText() {
        this.onload({ target: { result: '班级名称,层次代码\n701班,A' } });
      }
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisLayerImportModal
          selectedGrade="7年级"
          editedClassLayers={[]}
          setEditedClassLayers={setEditedClassLayers}
          normalizeClassLayers={normalizeClassLayers}
          layerConfig={layerConfig}
          notify={notify}
          onClose={onClose}
        />
      );
    });

    expect(container.textContent).toContain('当前：模板说明');
    expect(container.textContent).toContain('层次导入结果控件');
    expect(container.textContent).toContain('选择文件');
    expect(container.textContent).not.toContain('应用导入');

    const uploadStep = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('上传文件'));
    act(() => {
      uploadStep.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：上传文件');
    expect(container.textContent).toContain('点击选择文件或拖拽到此处');

    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ name: 'layers.csv' }],
    });
    act(() => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('当前：导入校验');
    expect(container.textContent).toContain('可导入');
    expect(container.textContent).toContain('701班');
    expect(notify).toHaveBeenCalledWith('已识别 1 个可导入班级，请确认应用', 'info');

    const applyButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('应用导入'));
    act(() => {
      applyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(normalizeClassLayers).toHaveBeenCalledWith(
      [expect.objectContaining({ class_id: 701, layer_code: 'A' })],
      '7年级'
    );
    expect(setEditedClassLayers).toHaveBeenCalledWith([
      expect.objectContaining({ class_id: 701, layer_code: 'A' }),
    ]);
    expect(notify).toHaveBeenCalledWith('成功导入 1 个班级', 'success');
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
