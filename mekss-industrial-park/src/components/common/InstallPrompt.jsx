import { useEffect, useState } from 'react';
import { Snackbar, Button, IconButton } from '@mui/material';
import { Close as CloseIcon, GetApp as GetAppIcon } from '@mui/icons-material';

const DISMISS_KEY = 'mekss-install-dismissed-at';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // one week

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

/**
 * Renders a non-blocking Persian install affordance only when the browser has
 * fired a valid `beforeinstallprompt` event and the app is not already
 * installed. `prompt()` is only ever called from this user gesture (the
 * button click), never automatically, and dismissal is remembered so the
 * banner does not reappear on every visit.
 */
export const InstallPrompt = () => {
  const [deferredEvent, setDeferredEvent] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone()) return undefined;

    const lastDismissed = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    const recentlyDismissed = Date.now() - lastDismissed < DISMISS_COOLDOWN_MS;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredEvent(event);
      if (!recentlyDismissed) setOpen(true);
    };
    const handleAppInstalled = () => {
      setDeferredEvent(null);
      setOpen(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredEvent) return;
    setOpen(false);
    await deferredEvent.prompt();
    // The event is single-use regardless of outcome (accepted or dismissed).
    setDeferredEvent(null);
  };

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  };

  return (
    <Snackbar
      open={open && Boolean(deferredEvent)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      message="سامانه MEKSS را روی دستگاه خود نصب کنید تا سریع‌تر و مثل یک اپلیکیشن مستقل اجرا شود."
      action={
        <>
          <Button color="inherit" size="small" startIcon={<GetAppIcon />} onClick={handleInstallClick}>
            نصب
          </Button>
          <IconButton size="small" color="inherit" onClick={handleDismiss} aria-label="بستن">
            <CloseIcon fontSize="small" />
          </IconButton>
        </>
      }
    />
  );
};

export default InstallPrompt;
