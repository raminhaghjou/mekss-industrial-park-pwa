import { useEffect, useState } from 'react';

/**
 * Tracks browser connectivity via the `online`/`offline` window events.
 * Shared across pages that must block/disable mutating actions while
 * offline, since offline writes could otherwise appear to succeed locally
 * without ever reaching the server.
 * @returns {boolean} whether the browser currently reports connectivity
 */
export const useOnlineStatus = () => {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
};

export default useOnlineStatus;
