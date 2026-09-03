import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

const DISMISS_KEY = 'mekss-install-dismissed-at';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches
  || /** @type {Navigator & { standalone?: boolean }} */ (window.navigator).standalone === true;

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
    <div className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-50 animate-slide-up rounded-2xl border border-default-200 bg-background/95 p-4 shadow-2xl backdrop-blur-lg lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-sm">
      {showIosHint ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium leading-6 text-foreground">
            برای نصب در آیفون: دکمهٔ اشتراک‌گذاری Safari را بزنید و «افزودن به صفحهٔ اصلی» را انتخاب کنید.
          </p>
          <button
            type="button"
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-[#0f4c81] hover:bg-primary-50"
            onClick={handleDismiss}
          >
            <Share className="h-4 w-4" />
            متوجه شدم
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-sm leading-6 text-foreground-600">
            MEKSS را نصب کنید تا مثل اپ موبایل اجرا شود.
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-[#0f4c81] px-3 text-sm font-semibold text-white hover:bg-[#0c3d68]"
              onClick={handleInstallClick}
            >
              <Download className="h-4 w-4" />
              نصب
            </button>
            <button
              type="button"
              className="touch-target rounded-xl text-foreground-400 hover:bg-default-100"
              onClick={handleDismiss}
              aria-label="بستن"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstallPrompt;
