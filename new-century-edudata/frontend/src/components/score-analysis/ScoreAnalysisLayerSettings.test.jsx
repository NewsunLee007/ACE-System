import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import schoolData from '../../data/schoolData';
import ScoreAnalysisLayerSettings, { getLayerTermLabel } from './ScoreAnalysisLayerSettings';

const layerConfig = {
  A: { name: '实验班' },
  B: { name: '创新班' },
  C: { name: '平行班' },
};

const clickButton = (container, label) => {
  const button = Array.from(container.querySelectorAll('button'))
    .find(item => item.textContent.includes(label));
  expect(button).toBeTruthy();
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('ScoreAnalysisLayerSettings', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    schoolData.classes = [
      { id: 701, name: '701班' },
      { id: 702, name: '702班' },
    ];
    schoolData.classLayers = [];
    schoolData.formatClassName = (id) => `${id}班`;
    schoolData.getCurrentAcademicYearDisplay = () => '2026-2027';
  });

  it('formats existing and numeric semester labels cleanly', () => {
    expect(getLayerTermLabel('第一学期')).toBe('第一学期');
    expect(getLayerTermLabel('2')).toBe('第2学期');
  });

  it('starts editing and saves normalized layers through parent handlers', () => {
    const setClassLayers = jest.fn();
    const setEditingLayers = jest.fn();
    const setEditedClassLayers = jest.fn();
    const notify = jest.fn();
    const normalizeClassLayers = jest.fn(layers => layers);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisLayerSettings
          selectedGrade="7年级"
          classLayers={[{
            id: 1,
            grade_level: '7年级',
            class_id: 701,
            class_name: '701班',
            layer_code: 'A',
            layer_name: '实验班',
            academic_year: '2026-2027',
            term: '第一学期',
          }]}
          setClassLayers={setClassLayers}
          editingLayers
          setEditingLayers={setEditingLayers}
          editedClassLayers={[{
            id: 1,
            grade_level: '7年级',
            class_id: 701,
            class_name: '701班',
            layer_code: 'A',
            layer_name: '实验班',
            academic_year: '2026-2027',
            term: '第一学期',
          }]}
          setEditedClassLayers={setEditedClassLayers}
          normalizeClassLayers={normalizeClassLayers}
          getGradeNumber={() => 7}
          layerConfig={layerConfig}
          notify={notify}
          onShowImport={jest.fn()}
        />
      );
    });

    const saveButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent.includes('保存配置'));
    act(() => {
      saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(normalizeClassLayers).toHaveBeenCalled();
    expect(setClassLayers).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ class_id: 701 }),
    ]));
    expect(setEditingLayers).toHaveBeenCalledWith(false);
    expect(notify).toHaveBeenCalledWith('层次配置已保存', 'success');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps details and maintenance actions behind workflow modules', () => {
    const onShowImport = jest.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisLayerSettings
          selectedGrade="7年级"
          classLayers={[{
            id: 1,
            grade_level: '7年级',
            class_id: 701,
            class_name: '701班',
            layer_code: 'A',
            layer_name: '实验班',
            academic_year: '2026-2027',
            term: '第一学期',
          }]}
          setClassLayers={jest.fn()}
          editingLayers
          setEditingLayers={jest.fn()}
          editedClassLayers={[{
            id: 1,
            grade_level: '7年级',
            class_id: 701,
            class_name: '701班',
            layer_code: 'A',
            layer_name: '实验班',
            academic_year: '2026-2027',
            term: '第一学期',
          }]}
          setEditedClassLayers={jest.fn()}
          normalizeClassLayers={layers => layers}
          getGradeNumber={() => 7}
          layerConfig={layerConfig}
          notify={jest.fn()}
          onShowImport={onShowImport}
        />
      );
    });

    expect(container.textContent).toContain('层次配置工作台');
    expect(container.textContent).toContain('层次配置结果控件');
    expect(container.textContent).toContain('当前：配置概览');
    expect(container.textContent).not.toContain('学年');
    expect(container.textContent).not.toContain('添加单个班级');

    clickButton(container, '班级明细');
    expect(container.textContent).toContain('当前：班级明细');
    expect(container.textContent).toContain('学年');
    expect(container.textContent).toContain('701班');

    clickButton(container, '单班维护');
    expect(container.textContent).toContain('当前：单班维护');
    expect(container.textContent).toContain('添加单个班级');

    clickButton(container, '批量导入');
    expect(container.textContent).toContain('当前：批量导入');
    expect(container.textContent).toContain('导入班级');
    clickButton(container, '导入班级');
    expect(onShowImport).toHaveBeenCalledTimes(1);

    clickButton(container, '全面铺开');
    expect(container.textContent).toContain('当前：全面铺开');
    expect(container.textContent).toContain('当前年级');
    expect(container.textContent).toContain('班级明细');
    expect(container.textContent).toContain('学年');
    expect(container.textContent).toContain('单班维护');
    expect(container.textContent).toContain('添加单个班级');
    expect(container.textContent).toContain('批量导入');
    expect(container.textContent).toContain('导入班级');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('scrolls to layer content when switching workflow modules', () => {
    jest.useFakeTimers();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ScoreAnalysisLayerSettings
          selectedGrade="7年级"
          classLayers={[{
            id: 1,
            grade_level: '7年级',
            class_id: 701,
            class_name: '701班',
            layer_code: 'A',
            layer_name: '实验班',
            academic_year: '2026-2027',
            term: '第一学期',
          }]}
          setClassLayers={jest.fn()}
          editingLayers
          setEditingLayers={jest.fn()}
          editedClassLayers={[{
            id: 1,
            grade_level: '7年级',
            class_id: 701,
            class_name: '701班',
            layer_code: 'A',
            layer_name: '实验班',
            academic_year: '2026-2027',
            term: '第一学期',
          }]}
          setEditedClassLayers={jest.fn()}
          normalizeClassLayers={layers => layers}
          getGradeNumber={() => 7}
          layerConfig={layerConfig}
          notify={jest.fn()}
          onShowImport={jest.fn()}
        />
      );
    });

    expect(container.querySelector('#score-layer-settings-content')).toBeTruthy();
    clickButton(container, '班级明细');
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    act(() => {
      root.unmount();
    });
    container.remove();
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    jest.useRealTimers();
  });

  it('returns protected edit modules to overview when editing ends', () => {
    const layer = {
      id: 1,
      grade_level: '7年级',
      class_id: 701,
      class_name: '701班',
      layer_code: 'A',
      layer_name: '实验班',
      academic_year: '2026-2027',
      term: '第一学期',
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const renderSettings = (editingLayers) => {
      root.render(
        <ScoreAnalysisLayerSettings
          selectedGrade="7年级"
          classLayers={[layer]}
          setClassLayers={jest.fn()}
          editingLayers={editingLayers}
          setEditingLayers={jest.fn()}
          editedClassLayers={editingLayers ? [layer] : []}
          setEditedClassLayers={jest.fn()}
          normalizeClassLayers={layers => layers}
          getGradeNumber={() => 7}
          layerConfig={layerConfig}
          notify={jest.fn()}
          onShowImport={jest.fn()}
        />
      );
    };

    act(() => {
      renderSettings(true);
    });
    clickButton(container, '单班维护');
    expect(container.textContent).toContain('当前：单班维护');
    expect(container.textContent).toContain('添加单个班级');

    act(() => {
      renderSettings(false);
    });

    expect(container.textContent).toContain('当前：配置概览');
    expect(container.textContent).not.toContain('添加单个班级');
    expect(container.textContent).toContain('需进入编辑');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
