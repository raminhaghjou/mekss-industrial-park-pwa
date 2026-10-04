import { useEffect, useState } from 'react';
import {
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalHeading,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
} from '@heroui/react';
import { CheckCircle2, Printer } from 'lucide-react';
import { useNotification } from '../../providers/NotificationProvider';
import {
  GATE_PASS_PRINT_FORMATS,
  gatePassNumber,
  gatePassPrintRows,
  gatePassQrDataUrl,
  printGatePass,
} from '../../utils/gatePassPrint';

export const GatePassPrintDialog = ({ pass, title = 'برگ خروج', issued = false, onClose }) => {
  const { showNotification } = useNotification();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrFailed, setQrFailed] = useState(false);
  const [printing, setPrinting] = useState('');
  const qrCode = pass?.qrCode || '';

  useEffect(() => {
    let cancelled = false;
    setQrDataUrl('');
    setQrFailed(false);
    if (!qrCode) return undefined;
    gatePassQrDataUrl(qrCode, 280)
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrFailed(true); });
    return () => { cancelled = true; };
  }, [qrCode]);

  if (!pass) return null;

  const handlePrint = async (format) => {
    setPrinting(format);
    try {
      const opened = await printGatePass(pass, format);
      if (!opened) showNotification('پنجرهٔ چاپ باز نشد؛ فایل HTML برگ خروج دانلود شد', 'warning');
    } catch {
      showNotification('آماده‌سازی نسخهٔ چاپی ناموفق بود', 'error');
    } finally {
      setPrinting('');
    }
  };

  return (
    <ModalBackdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose?.()} variant="blur">
      <ModalContainer size="md">
        <ModalDialog
          aria-label={title}
          className="max-h-[min(92dvh,44rem)] overflow-y-auto rounded-2xl border border-default-200 bg-background p-4 sm:p-6 dark:border-white/10"
          data-testid="gate-pass-print-dialog"
        >
          <ModalHeader className="flex flex-col gap-1 text-lg font-bold text-foreground">
            <ModalHeading className="flex items-center gap-2">
              {issued && <CheckCircle2 className="h-5 w-5 text-success-500" />}
              {title}
            </ModalHeading>
            <span className="text-xs font-normal text-foreground-500">شماره برگ: <span dir="ltr">{gatePassNumber(pass)}</span></span>
          </ModalHeader>
          <ModalBody className="gap-4">
            <div className="flex flex-col items-center gap-2">
              {qrCode ? (
                qrDataUrl ? (
                  <img src={qrDataUrl} alt="کد QR برگ خروج" className="h-44 w-44 rounded-xl border border-default-200 bg-white p-2" data-testid="gate-pass-qr" />
                ) : qrFailed ? (
                  <p className="text-xs text-danger-600">ساخت کد QR ناموفق بود.</p>
                ) : (
                  <Spinner size="sm" />
                )
              ) : (
                <p className="text-xs text-foreground-500">این برگ کد QR ندارد؛ نگهبان با پلاک یا شماره برگ جستجو می‌کند.</p>
              )}
            </div>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-xl border border-default-200 p-3 text-sm sm:grid-cols-2 dark:border-white/10">
              {gatePassPrintRows(pass).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2 border-b border-default-100 py-1 last:border-0 dark:border-white/5">
                  <dt className="text-foreground-500">{label}</dt>
                  <dd className="text-end font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </ModalBody>
          <ModalFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="tertiary" onPress={() => onClose?.()} className="w-full rounded-xl font-medium sm:w-auto">
              {issued ? 'ادامه' : 'بستن'}
            </Button>
            {Object.entries(GATE_PASS_PRINT_FORMATS).map(([format, { label }]) => (
              <Button
                key={format}
                variant={format === 'a5' ? 'primary' : 'secondary'}
                onPress={() => handlePrint(format)}
                isDisabled={Boolean(printing)}
                className="w-full gap-2 rounded-xl font-bold sm:w-auto"
              >
                {printing === format ? <Spinner size="sm" color="current" /> : <Printer className="h-4 w-4" />}
                {label}
              </Button>
            ))}
          </ModalFooter>
        </ModalDialog>
      </ModalContainer>
    </ModalBackdrop>
  );
};

export default GatePassPrintDialog;
