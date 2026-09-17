import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BellRing, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@heroui/react';
import { useAuth } from './AuthProvider';
import { emergencyApi } from '../services/api/emergency.api';
import { createEmergencySiren } from '../utils/emergencySiren';

const STORAGE_KEY = 'mekss.emergency.silenced';
const EmergencyAlarmContext = createContext(null);

const severityLabel = {
  CRITICAL: 'بحرانی',
  HIGH: 'بالا',
  MEDIUM: 'متوسط',
  LOW: 'کم',
};

const readSilenced = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeSilenced = (ids) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore quota / private mode failures
  }
};

const EmergencyAlarmOverlay = ({ alert, soundBlocked, onEnableSound, onMute, onDismiss, muted }) => {
  if (!alert) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="emergency-alarm-title"
      aria-describedby="emergency-alarm-body"
    >
      <div className="emergency-alarm-pulse absolute inset-0 bg-danger-600/25 pointer-events-none" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border-2 border-danger-400 bg-danger-50 text-danger-950 shadow-2xl dark:bg-danger-950 dark:text-danger-50">
        <div className="absolute inset-x-0 top-0 h-1.5 animate-pulse bg-danger-500" />
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-danger-600 text-white shadow-lg">
              <AlertTriangle className="h-7 w-7 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-wide text-danger-700 dark:text-danger-300">
                هشدار اضطراری شهرک
                {alert.park?.name ? ` · ${alert.park.name}` : ''}
              </p>
              <h2 id="emergency-alarm-title" className="mt-1 text-xl font-black leading-8 sm:text-2xl">
                {alert.title}
              </h2>
              <p className="mt-1 text-xs text-danger-700/80 dark:text-danger-200/80">
                شدت: {severityLabel[alert.severity] || alert.severity}
                {' · '}
                {new Date(alert.createdAt).toLocaleString('fa-IR')}
              </p>
            </div>
          </div>

          <p id="emergency-alarm-body" className="rounded-2xl bg-white/70 p-4 text-sm leading-7 text-danger-900 dark:bg-black/20 dark:text-danger-50">
            {alert.description}
          </p>

          {soundBlocked && (
            <button
              type="button"
              onClick={onEnableSound}
              className="flex items-center justify-center gap-2 rounded-2xl border border-danger-300 bg-white px-4 py-3 text-sm font-bold text-danger-800 transition hover:bg-danger-100"
            >
              <Volume2 className="h-4 w-4" />
              فعال‌سازی آژیر صوتی
            </button>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="danger"
              className="flex-1 rounded-2xl font-bold"
              onPress={onDismiss}
            >
              متوجه شدم — قطع آژیر
            </Button>
            <Button
              variant="secondary"
              className="rounded-2xl font-medium"
              onPress={onMute}
            >
              {muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {muted ? 'روشن کردن صدا' : 'بی‌صدا'}
            </Button>
          </div>

          <p className="text-center text-[11px] text-danger-700/70 dark:text-danger-200/70">
            تا رفع رسمی وضعیت اضطراری، این هشدار برای همه افراد شهرک فعال می‌ماند.
          </p>
        </div>
      </div>
      <style>{`
        @keyframes emergencyPulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.4; }
        }
        .emergency-alarm-pulse {
          animation: emergencyPulse 1.1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export const EmergencyAlarmProvider = ({ children }) => {
  const { user } = useAuth();
  const sirenRef = useRef(null);
  const [silencedIds, setSilencedIds] = useState(() => readSilenced());
  const [muted, setMuted] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);

  useEffect(() => {
    sirenRef.current = createEmergencySiren();
    return () => {
      sirenRef.current?.stop();
    };
  }, []);

  const { data: activeAlerts = [] } = useQuery({
    queryKey: ['emergency', 'active'],
    queryFn: () => emergencyApi.getActiveEmergencies().then((res) => res.data || []),
    enabled: Boolean(user),
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 2_000,
  });

  const activeAlert = useMemo(() => {
    const open = (activeAlerts || []).filter((item) => !silencedIds.includes(item.id));
    return open[0] || null;
  }, [activeAlerts, silencedIds]);

  useEffect(() => {
    const activeIds = new Set((activeAlerts || []).map((item) => item.id));
    setSilencedIds((prev) => {
      const next = prev.filter((id) => activeIds.has(id));
      if (next.length !== prev.length) writeSilenced(next);
      return next.length === prev.length ? prev : next;
    });
  }, [activeAlerts]);

  useEffect(() => {
    const siren = sirenRef.current;
    if (!siren) return undefined;

    if (!activeAlert || muted) {
      siren.stop();
      setSoundBlocked(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const started = await siren.start();
      if (!cancelled) setSoundBlocked(!started);
    })();

    if (typeof window !== 'undefined' && 'Notification' in window) {
      const showBrowserNotification = () => {
        try {
          // eslint-disable-next-line no-new
          new window.Notification(`هشدار اضطراری: ${activeAlert.title}`, {
            body: activeAlert.description,
            tag: `emergency-${activeAlert.id}`,
            requireInteraction: true,
          });
        } catch {
          // best-effort desktop notification
        }
      };
      if (window.Notification.permission === 'granted') {
        showBrowserNotification();
      } else if (window.Notification.permission !== 'denied') {
        window.Notification.requestPermission().then((permission) => {
          if (permission === 'granted') showBrowserNotification();
        });
      }
    }

    return () => {
      cancelled = true;
      siren.stop();
    };
  }, [activeAlert, muted]);

  const dismiss = useCallback(() => {
    if (!activeAlert) return;
    setSilencedIds((prev) => {
      const next = prev.includes(activeAlert.id) ? prev : [...prev, activeAlert.id];
      writeSilenced(next);
      return next;
    });
    sirenRef.current?.stop();
  }, [activeAlert]);

  const enableSound = useCallback(async () => {
    setMuted(false);
    const started = await sirenRef.current?.start();
    setSoundBlocked(!started);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (next) sirenRef.current?.stop();
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    activeAlert,
    activeCount: (activeAlerts || []).length,
    dismiss,
  }), [activeAlert, activeAlerts, dismiss]);

  return (
    <EmergencyAlarmContext.Provider value={value}>
      {children}
      <EmergencyAlarmOverlay
        alert={activeAlert}
        soundBlocked={soundBlocked}
        muted={muted}
        onEnableSound={enableSound}
        onMute={toggleMute}
        onDismiss={dismiss}
      />
      {Boolean(user) && (activeAlerts || []).length > 0 && !activeAlert && (
        <button
          type="button"
          onClick={() => {
            const latest = activeAlerts[0];
            if (!latest) return;
            setSilencedIds((prev) => {
              const next = prev.filter((id) => id !== latest.id);
              writeSilenced(next);
              return next;
            });
            setMuted(false);
          }}
          className="fixed bottom-24 left-4 z-[9990] flex items-center gap-2 rounded-full bg-danger-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg sm:bottom-6"
        >
          <BellRing className="h-4 w-4" />
          وضعیت اضطراری فعال
        </button>
      )}
    </EmergencyAlarmContext.Provider>
  );
};

export const useEmergencyAlarm = () => useContext(EmergencyAlarmContext);

export default EmergencyAlarmProvider;
