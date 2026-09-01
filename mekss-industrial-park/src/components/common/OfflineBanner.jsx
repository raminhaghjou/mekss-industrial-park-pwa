import { useState, useEffect } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineBanner = () => {
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    }
  }, [isOnline]);

  if (isOnline && !wasOffline) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up">
      {!isOnline ? (
        <div className="rounded-lg bg-danger-500 px-4 py-3 text-white shadow-lg">
          <p className="font-medium">اتصال به اینترنت قطع شد</p>
          <p className="text-sm opacity-90">برخی اطلاعات ممکن است به‌روز نباشند.</p>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg bg-success-500 px-4 py-3 text-white shadow-lg">
          <p className="font-medium">اتصال برقرار شد</p>
          <button onClick={() => setWasOffline(false)} className="text-sm underline">
            بستن
          </button>
        </div>
      )}
    </div>
  );
};

export default OfflineBanner;
