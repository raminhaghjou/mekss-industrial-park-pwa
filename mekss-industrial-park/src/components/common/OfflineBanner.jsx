import { useEffect, useState } from 'react';
import { Alert } from '@mui/material';

/**
 * Persian offline indicator. Shown whenever the browser reports it has lost
 * connectivity, so admin/data-mutating actions are visibly untrustworthy
 * until a reconnect is confirmed. Purely informational; it does not block
 * navigation or cache anything itself.
 */
export const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <Alert
      severity="warning"
      variant="filled"
      role="status"
      sx={{ borderRadius: 0, justifyContent: 'center', position: 'sticky', top: 0, zIndex: (theme) => theme.zIndex.appBar + 1 }}
    >
      اتصال اینترنت برقرار نیست. اطلاعات نمایش داده‌شده ممکن است قدیمی باشد و ثبت/ویرایش تا اتصال دوباره امکان‌پذیر نیست.
    </Alert>
  );
};

export default OfflineBanner;
