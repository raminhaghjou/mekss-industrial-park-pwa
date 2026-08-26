import { createContext, useContext, useState } from 'react';
import { Snackbar, Alert } from '@mui/material';

/** @typedef {'error' | 'info' | 'success' | 'warning'} NotificationSeverity */

const NotificationContext = createContext(
  /** @type {{ showNotification: (message: string, severity?: NotificationSeverity, autoHideDuration?: number) => void, hideNotification: () => void } | null} */ (null),
);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState(
    /** @type {{ open: boolean, message: string, severity: NotificationSeverity, autoHideDuration: number }} */ ({
      open: false,
      message: '',
      severity: 'info',
      autoHideDuration: 6000,
    }),
  );

  /**
   * @param {string} message
   * @param {NotificationSeverity} [severity]
   * @param {number} [autoHideDuration]
   */
  const showNotification = (message, severity = 'info', autoHideDuration = 6000) => {
    setNotification({
      open: true,
      message,
      severity,
      autoHideDuration,
    });
  };

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    hideNotification();
  };

  const value = {
    showNotification,
    hideNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Snackbar
        open={notification.open}
        autoHideDuration={notification.autoHideDuration}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        dir="rtl"
      >
        <Alert
          onClose={handleClose}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
};