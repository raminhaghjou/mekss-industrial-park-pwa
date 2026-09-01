import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

const DISMISS_KEY = 'mekss-install-dismissed-at';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches;

const isIosDevice = () =>
  /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

const isSafari = () => {
  const agent = window.navigator.userAgent;
  return /Safari/i.test(agent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(agent);
};

export const InstallPrompt = () => {
  const [deferredEvent, setDeferredEvent] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const lastDismissed = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    const recentlyDismissed = Date.now() - lastDismissed < DISMISS_COOLDOWN_MS;
    const shouldShowIosHint = isIosDevice() && isSafari() && !recentlyDismissed;
    
    let iosHintTimer;

    if (shouldShowIosHint) {
      setShowIosHint(true);
      iosHintTimer = window.setTimeout(() => setOpen(true), 1800);
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredEvent(event);
      setShowIosHint(false);
      if (!recentlyDismissed) setOpen(true);
    };

    const handleAppInstalled = () => {
      setDeferredEvent(null);
      setShowIosHint(false);
      setOpen(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      if (iosHintTimer) window.clearTimeout(iosHintTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredEvent) return;
    setOpen(false);
    await deferredEvent.prompt();
    setDeferredEvent(null);
  };

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  };

  const nativePromptAvailable = Boolean(deferredEvent);

  if (!open || (!nativePromptAvailable && !showIosHint)) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up rounded-xl bg-background/95 p-4 shadow-2xl backdrop-blur-lg border border-default-200 md:bottom-4 md:left-auto md:right-4 md:max-w-sm">
      {showIosHint ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">
            برای نصب در آیفون: دکمهٔ اشتراک‌گذاری Safari را بزنید و «افزودن به صفحهٔ اصلی» را انتخاب کنید.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-primary-500 hover:bg-primary-50" onClick={handleDismiss}>
              <Share className="h-4 w-4" />
              متوجه شدم
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-foreground-600">
            MEKSS را نصب کنید تا سریع‌تر اجرا شود.
          </p>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 rounded-lg bg-primary-500 px-3 py-1.5 text-sm text-white hover:bg-primary-600" onClick={handleInstallClick}>
              <Download className="h-4 w-4" />
              نصب
            </button>
            <button className="rounded-lg p-1.5 text-foreground-400 hover:bg-default-100" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstallPrompt;
