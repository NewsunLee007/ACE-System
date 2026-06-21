import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Layers, Loader2, Maximize2, Plus, Save, Settings, Table2, Upload } from 'lucide-react';
import schoolData from '../../data/schoolData';
import FlowModuleSelector from './FlowModuleSelector';

export const getLayerTermLabel = (term) => {
  const text = String(term || '').trim();
  if (!text) return '第一学期';
  return text.includes('学期') ? text : `第${text}学期`;
};

export default function ScoreAnalysisLayerSettings({
  selectedGrade,
  classLayers = [],
  setClassLayers,
  editingLayers,
  setEditingLayers,
  editedClassLayers = [],
  setEditedClassLayers,
  normalizeClassLayers,
  getGradeNumber,
  layerConfig,
  notify,
  onShowImport,
}) {
  const [savingLayers, setSavingLayers] = useState(false);
  const [newClassId, setNewClassId] = useState('');
  const [newLayerCode, setNewLayerCode] = useState('A');
  const [activeModule, setActiveModule] = useState('overview');

  const gradeClasses = useMemo(() => {
    const gradeNum = getGradeNumber(selectedGrade);
    return (schoolData.classes || [])
      .filter(cls => gradeNum && Math.floor(Number(cls.id) / 100) === gradeNum)
      .sort((a, b) => Number(a.id) - Number(b.id));
  }, [getGradeNumber, selectedGrade]);

  const syncDraftLayers = (nextLayers) => {
    setEditedClassLayers(nextLayers);
    const normalized = normalizeClassLayers(nextLayers, selectedGrade);
    const others = (schoolData.classLayers || []).filter(layer => layer.grade_level !== selectedGrade);
    schoolData.classLayers = [...others, ...normalized];
    return normalized;
  };

  const startEditing = () => {
    setEditedClassLayers(classLayers.map(layer => ({ ...layer })));
    setEditingLayers(true);
  };

  const cancelEditing = () => {
    setEditingLayers(false);
    setEditedClassLayers([]);
    setNewClassId('');
    setNewLayerCode('A');
    setActiveModule('overview');
  };

  const saveLayers = async () => {
    setSavingLayers(true);
    try {
      const normalized = normalizeClassLayers(editedClassLayers, selectedGrade);
      const others = (schoolData.classLayers || []).filter(layer => layer.grade_level !== selectedGrade);
      schoolData.classLayers = [...others, ...normalized];
      setClassLayers(normalized);
      setEditingLayers(false);
      setNewClassId('');
      setNewLayerCode('A');
      setActiveModule('overview');
      notify('层次配置已保存', 'success');
    } catch (error) {
      console.error('保存失败:', error);
      notify(`保存失败：${error.message}`, 'error');
    } finally {
      setSavingLayers(false);
    }
  };

  const updateLayerCode = (index, layerCode) => {
    const nextLayers = [...editedClassLayers];
    nextLayers[index] = {
      ...nextLayers[index],
      layer_code: layerCode,
      layer_name: layerConfig[layerCode]?.name || nextLayers[index].layer_name,
    };
    syncDraftLayers(nextLayers);
  };

  const removeLayer = (index) => {
    syncDraftLayers(editedClassLayers.filter((_, currentIndex) => currentIndex !== index));
  };

  const addClassLayer = () => {
    const classId = newClassId ? Number(newClassId) : null;
    if (!classId) return;

    const cls = (schoolData.classes || []).find(item => Number(item.id) === classId);
    const className = cls
      ? (schoolData.formatClassName?.(cls.id) || cls.name || String(cls.id))
      : String(classId);
    const nextClass = {
      id: Date.now(),
      grade_level: selectedGrade,
      class_id: classId,
      class_name: className,
      layer_code: newLayerCode,
      layer_name: layerConfig[newLayerCode].name,
      academic_year: schoolData.getCurrentAcademicYearDisplay?.() || '2024-2025',
      term: '第一学期',
    };
    syncDraftLayers([...editedClassLayers, nextClass]);
    setNewClassId('');
  };

  const rows = editingLayers ? editedClassLayers : classLayers;
  const layerSummary = ['A', 'B', 'C'].map(code => ({
    code,
    name: layerConfig[code]?.name || `${code}层`,
    count: rows.filter(layer => layer.layer_code === code).length,
  }));
  const modules = [
    {
      value: 'overview',
      label: '配置概览',
      desc: `${selectedGrade} · ${rows.length} 个班级`,
      icon: Layers,
      ready: true,
    },
    {
      value: 'details',
      label: '班级明细',
      desc: '查看层次表',
      icon: Table2,
      ready: true,
    },
    {
      value: 'single',
      label: '单班维护',
      desc: editingLayers ? '添加或调整班级' : '需进入编辑',
      icon: Plus,
      ready: editingLayers,
    },
    {
      value: 'import',
      label: '批量导入',
      desc: editingLayers ? 'CSV批量配置' : '需进入编辑',
      icon: Upload,
      ready: editingLayers,
    },
    {
      value: 'all',
      label: '全面铺开',
      desc: editingLayers ? '配置与维护同屏复核' : '概览与明细同屏复核',
      icon: Maximize2,
      ready: true,
    },
  ];
  const activeModuleValue = modules.some(module => module.value === activeModule && module.ready)
    ? activeModule
    : 'overview';
  const activeConfig = modules.find(module => module.value === activeModuleValue) || modules[0];

  useEffect(() => {
    if (activeModule !== activeModuleValue) {
      setActiveModule(activeModuleValue);
    }
  }, [activeModule, activeModuleValue]);

  const renderOverview = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-sm text-slate-500">当前年级</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{selectedGrade}</p>
          <p className="mt-1 text-xs text-slate-500">{editingLayers ? '正在编辑草稿' : '当前生效配置'}</p>
        </div>
        {layerSummary.map(item => (
          <div key={item.code} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">{item.code}层 · {item.name}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{item.count}</p>
            <p className="mt-1 text-xs text-slate-500">班级数</p>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white py-8 text-center text-gray-500">
          <Settings className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <p>暂无层次配置，请点击“编辑配置”后添加或批量导入。</p>
        </div>
      )}
    </div>
  );

  const renderDetails = () => (
    rows.length === 0 ? (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white py-8 text-center text-gray-500">
        <Settings className="mx-auto mb-4 h-12 w-12 text-gray-300" />
        <p>暂无层次配置，请先进入编辑。</p>
      </div>
    ) : (
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">班级</th>
              <th className="px-4 py-3 text-left">层次</th>
              <th className="px-4 py-3 text-left">层次名称</th>
              <th className="px-4 py-3 text-left">学年</th>
              <th className="px-4 py-3 text-left">学期</th>
              {editingLayers && <th className="px-4 py-3 text-center">操作</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((layer, index) => (
              <tr key={layer.id || index}>
                <td className="px-4 py-3 font-medium">{layer.class_name}</td>
                <td className="px-4 py-3">
                  {editingLayers ? (
                    <select
                      value={layer.layer_code}
                      onChange={(event) => updateLayerCode(index, event.target.value)}
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                    >
                      <option value="A">A层（实验班）</option>
                      <option value="B">B层（创新班）</option>
                      <option value="C">C层（平行班）</option>
                    </select>
                  ) : (
                    <span className={`rounded px-2 py-1 text-xs ${
                      layer.layer_code === 'A' ? 'bg-green-100 text-green-700' :
                        layer.layer_code === 'B' ? 'bg-blue-100 text-blue-700' :
                          'bg-orange-100 text-orange-700'
                    }`}>
                      {layer.layer_code}层
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{layer.layer_name}</td>
                <td className="px-4 py-3">{layer.academic_year}</td>
                <td className="px-4 py-3">{getLayerTermLabel(layer.term)}</td>
                {editingLayers && (
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => removeLayer(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      删除
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  );

  const renderSingleEditor = () => (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h4 className="mb-3 font-medium">添加单个班级</h4>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm text-gray-600">班级名称</label>
          <select
            value={newClassId}
            onChange={(event) => setNewClassId(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2"
          >
            <option value="">请选择班级</option>
            {gradeClasses.map(cls => (
              <option key={cls.id} value={cls.id}>
                {schoolData.formatClassName?.(cls.id) || cls.name || cls.id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">层次</label>
          <select
            value={newLayerCode}
            onChange={(event) => setNewLayerCode(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="A">A层（实验班）</option>
            <option value="B">B层（创新班）</option>
            <option value="C">C层（平行班）</option>
          </select>
        </div>
        <button
          type="button"
          onClick={addClassLayer}
          disabled={!newClassId}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          <Plus className="h-4 w-4" />
          添加班级
        </button>
      </div>
    </div>
  );

  const renderImportPanel = () => (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="font-medium text-blue-800">批量导入班级</h4>
          <p className="mt-1 text-sm text-gray-600">支持CSV格式文件导入，适合一次配置全年级班级层次。</p>
        </div>
        <button
          type="button"
          onClick={onShowImport}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <Upload className="h-4 w-4" />
          导入班级
        </button>
      </div>
    </div>
  );

  const renderActiveModule = () => {
    if (activeConfig.value === 'details') return renderDetails();
    if (activeConfig.value === 'single') return renderSingleEditor();
    if (activeConfig.value === 'import') return renderImportPanel();
    if (activeConfig.value === 'all') {
      return (
        <div className="space-y-5">
          <section className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">配置概览</h3>
              <p className="mt-1 text-xs text-slate-500">先核对各层班级数量和当前编辑状态。</p>
            </div>
            {renderOverview()}
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">班级明细</h3>
              <p className="mt-1 text-xs text-slate-500">逐班复核层次、学年和学期。</p>
            </div>
            {renderDetails()}
          </section>

          {editingLayers && (
            <>
              <section className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">单班维护</h3>
                  <p className="mt-1 text-xs text-slate-500">临时补充或调整单个班级。</p>
                </div>
                {renderSingleEditor()}
              </section>

              <section className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">批量导入</h3>
                  <p className="mt-1 text-xs text-slate-500">需要整年级重配时从模板导入。</p>
                </div>
                {renderImportPanel()}
              </section>
            </>
          )}
        </div>
      );
    }
    return renderOverview();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">层次配置工作台</h2>
            <p className="mt-1 text-xs text-slate-500">点击查看配置概况、明细维护、单班维护或批量导入。</p>
          </div>
          <div className="flex gap-2">
          {!editingLayers ? (
            <button
              type="button"
              onClick={startEditing}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <Edit2 className="h-4 w-4" />
              编辑配置
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveLayers}
                disabled={savingLayers}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {savingLayers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                保存配置
              </button>
            </>
          )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            当前：{activeConfig.label}
          </span>
          <span className="text-xs text-slate-500">
            {editingLayers ? '编辑模式' : '查看模式'}
          </span>
        </div>

        <div className="mt-4">
          <FlowModuleSelector
            title="层次配置结果控件"
            hint="点击查看概况、明细、维护或全面铺开"
            modules={modules}
            activeValue={activeModuleValue}
            onChange={setActiveModule}
            scrollTargetId="score-layer-settings-content"
          />
        </div>
      </div>

      <div id="score-layer-settings-content" className="scroll-mt-32 bg-slate-50 p-5">
        {renderActiveModule()}
      </div>
    </div>
  );
}
