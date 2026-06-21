export const notify = (message, type = 'info', options = {}) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent('app:notify', {
    detail: {
      message: String(message ?? ''),
      type,
      ...options
    }
  }));
};

export const notifySuccess = (message, options) => notify(message, 'success', options);
export const notifyWarning = (message, options) => notify(message, 'warning', options);
export const notifyError = (message, options) => notify(message, 'error', options);
