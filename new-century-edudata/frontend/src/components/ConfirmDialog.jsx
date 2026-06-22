import React from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmDialog = ({
  open,
  title = '确认操作',
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = true,
  onConfirm,
  onCancel
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${danger ? 'bg-red-50' : 'bg-blue-50'}`}>
            <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-600' : 'text-blue-600'}`} />
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold text-gray-900">{title}</div>
            {message ? <div className="text-sm text-gray-600 mt-1 break-words">{message}</div> : null}
          </div>
        </div>

        <div className="p-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;

