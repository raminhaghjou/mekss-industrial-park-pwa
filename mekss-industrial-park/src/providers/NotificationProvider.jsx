import { createContext, useContext, useCallback, useMemo } from 'react';
import { Toast, toast } from '@heroui/react';

const NotificationContext = createContext(null);

const ERROR_TIMEOUT_MS = 8000;
const DEFAULT_TIMEOUT_MS = 5000;

/** Toasts must stay above open modals (both use z-50; the modal portal would otherwise cover them). */
const TOAST_REGION_STYLE = { zIndex: 1000 };

export const NotificationProvider = ({ children }) => {
  const showNotification = useCallback((message, severity = 'info') => {
    const text = typeof message === 'string' ? message : String(message ?? '');
    if (!text.trim()) return;
    const options = { timeout: severity === 'error' ? ERROR_TIMEOUT_MS : DEFAULT_TIMEOUT_MS };
    if (severity === 'error') toast.danger(text, options);
    else if (severity === 'success') toast.success(text, options);
    else if (severity === 'warning') toast.warning(text, options);
    else toast.info(text, options);
  }, []);

  const value = useMemo(() => ({ showNotification }), [showNotification]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Toast.Provider placement="top" style={TOAST_REGION_STYLE} />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationProvider;
