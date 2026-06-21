import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [request, setRequest] = useState(null);

  const close = useCallback((value) => {
    setRequest(current => {
      if (current?.resolve) current.resolve(value);
      return null;
    });
  }, []);

  const confirm = useCallback((input) => new Promise(resolve => {
    const options = typeof input === 'string' ? { message: input } : input || {};
    setRequest({
      title: options.title || '确认操作',
      message: options.message || '',
      confirmText: options.confirmText || '确认',
      cancelText: options.cancelText || '取消',
      danger: options.danger !== false,
      resolve
    });
  }), []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {request && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start gap-3 border-b border-slate-200 p-5">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                request.danger ? 'bg-red-50' : 'bg-blue-50'
              }`}>
                <AlertTriangle className={`h-5 w-5 ${request.danger ? 'text-red-600' : 'text-blue-600'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900">{request.title}</h2>
                {request.message && (
                  <p className="mt-1 whitespace-pre-line break-words text-sm leading-5 text-slate-600">
                    {request.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="关闭确认弹窗"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex justify-end gap-3 bg-slate-50 px-5 py-4">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {request.cancelText}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`rounded-lg px-4 py-2 text-sm text-white ${
                  request.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {request.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    return { confirm: async () => false };
  }
  return context;
};
