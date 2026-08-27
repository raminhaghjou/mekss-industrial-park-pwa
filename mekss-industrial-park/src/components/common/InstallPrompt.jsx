import { useEffect, useState } from 'react';
import { Snackbar, Button, IconButton } from '@mui/material';
import {
  Close as CloseIcon,
  GetApp as GetAppIcon,
  IosShare as IosShareIcon,
} from '@mui/icons-material';

const DISMISS_KEY = 'mekss-install-dismissed-at';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  /** @type {{ standalone?: boolean }} */ (window.navigator).standalone === true;

const isIosDevice = () =>
  /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

const isSafari = () => {
  const agent = window.navigator.userAgent;
  return /Safari/i.test(agent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(agent);
};

/**
 * Native install prompt for supporting browsers and a concise Safari-specific
 * Add to Home Screen hint on iOS, where `beforeinstallprompt` is unavailable.
 */
export const InstallPrompt = () => {
  const [deferredEvent, setDeferredEvent] = useState(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) return undefined;

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

  return (
    <Snackbar
      open={open && (nativePromptAvailable || showIosHint)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      message={
        showIosHint
          ? 'برای نصب در آیفون: دکمهٔ اشتراک‌گذاری Safari را بزنید و «افزودن به صفحهٔ اصلی» را انتخاب کنید.'
          : 'MEKSS را نصب کنید تا سریع‌تر و مانند یک اپ مستقل اجرا شود.'
      }
      action={
        <>
          {nativePromptAvailable ? (
            <Button color="inherit" size="small" startIcon={<GetAppIcon />} onClick={handleInstallClick}>
              نصب
            </Button>
          ) : (
            <Button color="inherit" size="small" startIcon={<IosShareIcon />} onClick={handleDismiss}>
              متوجه شدم
            </Button>
          )}
          <IconButton size="small" color="inherit" onClick={handleDismiss} aria-label="بستن راهنمای نصب">
            <CloseIcon fontSize="small" />
          </IconButton>
        </>
      }
      ContentProps={{ role: 'status', 'aria-live': 'polite' }}
      sx={{
        bottom: { xs: 'calc(72px + env(safe-area-inset-bottom))', sm: 24 },
        '& .MuiSnackbarContent-root': { flexWrap: 'nowrap' },
      }}
    />
  );
};

export default InstallPrompt;
