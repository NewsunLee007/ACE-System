import React, { useState, useEffect } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

/**
 * 智能导入弹窗组件
 * @param {boolean} isOpen - 是否显示
 * @param {function} onClose - 关闭回调
 * @param {function} onConfirm - 确认导入回调
 * @param {array} previewData - 预览数据 [{ type: 'new'|'update', data: {}, existingData: {} }]
 * @param {string} title - 弹窗标题
 * @param {array} columns - 列定义 [{ key: 'name', label: '姓名' }]
 */
const SmartImportModal = ({ isOpen, onClose, onConfirm, previewData, title, columns }) => {
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    if (isOpen && previewData) {
      // 默认全选
      setSelectedItems(previewData.map((_, index) => index));
    }
  }, [isOpen, previewData]);

  if (!isOpen || !previewData) return null;

  const newItems = previewData.filter(item => item.type === 'new');
  const updateItems = previewData.filter(item => item.type === 'update');

  const toggleSelect = (index) => {
    setSelectedItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === previewData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(previewData.map((_, index) => index));
    }
  };

  const handleConfirm = () => {
    const selectedData = selectedItems.map(index => previewData[index]);
    onConfirm(selectedData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{title}</h2>
            <p className="text-sm text-gray-500 mt-1">
              新增 <span className="text-green-600 font-semibold">{newItems.length}</span> 条，
              更新 <span className="text-blue-600 font-semibold">{updateItems.length}</span> 条，
              已选 <span className="text-purple-600 font-semibold">{selectedItems.length}</span> 条
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === previewData.length && previewData.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                {columns.map(col => (
                  <th key={col.key} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {previewData.map((item, index) => (
                <tr 
                  key={index} 
                  className={`hover:bg-gray-50 ${selectedItems.includes(index) ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(index)}
                      onChange={() => toggleSelect(index)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {item.type === 'new' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        新增
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        <RefreshCw className="w-3 h-3 mr-1" />
                        更新
                      </span>
                    )}
                  </td>
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-sm text-gray-900">
                      {item.type === 'update' && item.changes?.includes(col.key) ? (
                        <div>
                          <span className="text-gray-400 line-through text-xs block">
                            {item.existingData[col.key] || '-'}
                          </span>
                          <span className="text-blue-600 font-medium">
                            {item.data[col.key] || '-'}
                          </span>
                        </div>
                      ) : (
                        item.data[col.key] || '-'
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedItems.length === 0}
            className={`px-4 py-2 rounded-lg ${
              selectedItems.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            确认导入 ({selectedItems.length})
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartImportModal;
