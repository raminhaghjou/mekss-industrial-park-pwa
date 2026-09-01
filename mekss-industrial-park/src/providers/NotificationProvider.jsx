import { createContext, useContext, useState, useCallback } from 'react';
import { addToast } from '@heroui/toast';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const showNotification = useCallback((message, severity = 'info') => {
    addToast({
      title: message,
      color: severity === 'error' ? 'danger' : severity === 'success' ? 'success' : severity === 'warning' ? 'warning' : 'primary',
    });
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
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
