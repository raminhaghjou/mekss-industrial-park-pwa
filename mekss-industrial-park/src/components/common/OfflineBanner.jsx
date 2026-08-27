import { useEffect, useState } from 'react';
import { Alert } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Persian offline indicator. Mutations are blocked separately by the shared
 * Axios client; when connectivity returns, active server state is refreshed
 * so stale cached data is not presented as current.
 */
export const OfflineBanner = () => {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void queryClient.invalidateQueries({ refetchType: 'active' });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient]);

  if (isOnline) return null;

  return (
    <Alert
      severity="warning"
      variant="filled"
      role="status"
      aria-live="polite"
      sx={{
        borderRadius: 0,
        justifyContent: 'center',
        position: 'relative',
        zIndex: (theme) => theme.zIndex.appBar + 1,
        '& .MuiAlert-message': { textAlign: 'center' },
      }}
    >
      اتصال اینترنت برقرار نیست. اطلاعات ممکن است قدیمی باشد؛ ثبت و ویرایش پس از اتصال دوباره فعال می‌شود.
    </Alert>
  );
};

export default OfflineBanner;
