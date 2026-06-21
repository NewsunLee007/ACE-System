import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const inferType = (message) => {
  const text = String(message || '');
  if (/失败|错误|异常|无法|不能|缺少/.test(text)) return 'error';
  if (/请选择|请输入|不能为空|至少|需要|请先/.test(text)) return 'warning';
  if (/成功|完成|已保存|已发送|已导出|已更新|已删除|已添加/.test(text)) return 'success';
  return 'info';
};

const getToastClassName = (type) => {
  if (type === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (type === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (type === 'error') return 'border-red-200 bg-red-50 text-red-900';
  return 'border-blue-200 bg-blue-50 text-blue-900';
};

const getIcon = (type) => {
  if (type === 'success') return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />;
  if (type === 'warning') return <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />;
  if (type === 'error') return <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />;
  return <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const notify = useCallback((input, explicitType, options = {}) => {
    const payload = typeof input === 'object' && input !== null
      ? input
      : { message: input, type: explicitType, ...options };
    const message = String(payload.message ?? '').trim();
    if (!message) return null;

    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const type = payload.type || inferType(message);
    const duration = Number.isFinite(Number(payload.duration))
      ? Number(payload.duration)
      : type === 'error' ? 5200 : 3400;

    setToasts(current => [
      { id, message, type },
      ...current.filter(toast => toast.message !== message).slice(0, 3)
    ]);

    window.setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  useEffect(() => {
    const handleNotify = (event) => notify(event.detail || {});
    window.addEventListener('app:notify', handleNotify);

    const previousNotify = window.__aceNotify;
    const previousAlert = window.alert;
    const bridgedAlert = (message) => notify({ message, type: inferType(message) });

    window.__aceNotify = notify;
    window.alert = bridgedAlert;

    return () => {
      window.removeEventListener('app:notify', handleNotify);
      if (window.__aceNotify === notify) window.__aceNotify = previousNotify;
      if (window.alert === bridgedAlert) window.alert = previousAlert;
    };
  }, [notify]);

  const value = useMemo(() => ({
    notify,
    success: (message, options) => notify(message, 'success', options),
    warning: (message, options) => notify(message, 'warning', options),
    error: (message, options) => notify(message, 'error', options),
    info: (message, options) => notify(message, 'info', options)
  }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg ${getToastClassName(toast.type)}`}
          >
            <div className="flex items-start gap-3">
              {getIcon(toast.type)}
              <div className="min-w-0 flex-1 leading-5">{toast.message}</div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded p-0.5 text-current opacity-60 hover:bg-black/5 hover:opacity-100"
                aria-label="关闭通知"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      notify: () => null,
      success: () => null,
      warning: () => null,
      error: () => null,
      info: () => null
    };
  }
  return context;
};
