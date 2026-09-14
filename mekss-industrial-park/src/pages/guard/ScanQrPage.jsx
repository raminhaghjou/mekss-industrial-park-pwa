import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Input,
  Button,
  Label,
  Spinner,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
} from '@heroui/react';
import { Camera, QrCode, ScanLine, Search, X } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { gatePassApi } from '../../services/api/gatePass.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { semanticFilter } from '../../utils/semanticSearch';

const SCANNER_REGION_ID = 'mekss-qr-scanner';
const MIN_SEARCH_LEN = 4;

const statusLabel = {
  PENDING: 'در انتظار',
  APPROVED: 'تایید شده',
  REJECTED: 'رد شده',
  COMPLETED: 'تکمیل شده',
  EXPIRED: 'منقضی شده',
  VERIFIED: 'تایید نهایی',
  DENIED: 'رد خروج',
};

export const ScanQrPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef(null);
  const handlingScanRef = useRef(false);

  const passesQuery = useQuery({
    queryKey: ['gate-passes', 'scan-search'],
    queryFn: () => gatePassApi.getGatePasses().then((res) => res.data || []),
  });

  const lookup = useMutation({
    mutationFn: (qr) => gatePassApi.getByQr(String(qr).trim()).then((res) => res.data),
    onSuccess: (pass) => {
      showNotification('برگ خروج یافت شد', 'success');
      navigate(`/guard/gate-passes/${pass.id}/verify`);
    },
    onError: (error) => showNotification(getErrorMessage(error, 'کد QR معتبر نیست'), 'error'),
  });

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
    } catch {
      /* already stopped */
    }
    try {
      await scanner.clear();
    } catch {
      /* ignore */
    }
  };

  const openPass = (pass) => {
    if (!pass?.id) return;
    showNotification('برگ خروج انتخاب شد', 'success');
    navigate(`/guard/gate-passes/${pass.id}/verify`);
  };

  const handleDecoded = async (decodedText) => {
    if (handlingScanRef.current) return;
    handlingScanRef.current = true;
    const value = String(decodedText || '').trim();
    setCode(value);
    await stopScanner();
    if (!value) {
      handlingScanRef.current = false;
      return;
    }
    lookup.mutate(value, {
      onSettled: () => {
        handlingScanRef.current = false;
      },
    });
  };

  const startScanner = async () => {
    setCameraError('');
    handlingScanRef.current = false;
    await stopScanner();
    setScanning(true);

    // Wait one frame so the scanner container is mounted.
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));

    try {
      const scanner = new Html5Qrcode(SCANNER_REGION_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
            return { width: edge, height: edge };
          },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decoded) => {
          handleDecoded(decoded);
        },
        () => {
          /* ignore frame decode misses */
        },
      );
    } catch (error) {
      setScanning(false);
      scannerRef.current = null;
      const message = getErrorMessage(error, 'دسترسی به دوربین ممکن نشد');
      setCameraError(message);
      showNotification(message, 'error');
    }
  };

  useEffect(() => () => {
    stopScanner();
  }, []);

  const searchResults = useMemo(() => {
    const query = code.trim();
    if (query.length < MIN_SEARCH_LEN) return [];
    const passes = Array.isArray(passesQuery.data) ? passesQuery.data : [];
    return semanticFilter(passes, query, (pass) => [
      pass.qrCode,
      pass.licensePlate,
      pass.driverName,
      pass.id,
      pass.factory?.name,
      pass.cargoType,
      pass.vehicleType,
      statusLabel[pass.status],
      'مجوز',
      'برگ خروج',
      'پلاک',
    ]).slice(0, 12);
  }, [code, passesQuery.data]);

  const submitExact = (event) => {
    event.preventDefault();
    const value = code.trim();
    if (!value) {
      showNotification('کد QR یا عبارت جستجو را وارد کنید', 'error');
      return;
    }
    if (value.length >= MIN_SEARCH_LEN && searchResults.length === 1) {
      openPass(searchResults[0]);
      return;
    }
    lookup.mutate(value);
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 animate-fade-in">
      <Card className="rounded-3xl border border-default-200 shadow-sm">
        <CardContent className="gap-6 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
              <ScanLine className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">اسکن کد QR</h1>
              <p className="mt-0.5 text-xs text-foreground-500">
                دوربین را باز کنید یا با وارد کردن حداقل ۴ کاراکتر، برگ خروج را جستجو کنید.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {!scanning ? (
              <Button
                variant="primary"
                className="h-12 font-bold"
                onPress={startScanner}
                isDisabled={lookup.isPending}
              >
                <Camera className="h-5 w-5" />
                اسکن با دوربین
              </Button>
            ) : (
              <Button variant="secondary" className="h-11 font-bold" onPress={stopScanner}>
                <X className="h-4 w-4" />
                توقف اسکن
              </Button>
            )}

            <div
              id={SCANNER_REGION_ID}
              className={scanning
                ? 'overflow-hidden rounded-2xl border border-default-200 bg-black/90 min-h-[260px]'
                : 'hidden'}
            />

            {cameraError && (
              <Alert status="danger">
                <AlertContent>
                  <AlertTitle>خطای دوربین</AlertTitle>
                  <AlertDescription>{cameraError}</AlertDescription>
                </AlertContent>
              </Alert>
            )}
          </div>

          <form onSubmit={submitExact} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">کد QR یا جستجوی برگ خروج</Label>
              <div className="relative">
                <QrCode className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-400" />
                <Input
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="MEKSS-... یا پلاک / نام راننده"
                  className="rounded-xl pe-10 font-mono"
                  autoComplete="off"
                />
              </div>
              <p className="text-[11px] text-foreground-400">
                با وارد کردن ۴ تا ۵ حرف یا رقم، نتایج مرتبط در لیست زیر نمایش داده می‌شود.
              </p>
            </div>
            <Button type="submit" variant="primary" className="h-12 font-bold" isDisabled={lookup.isPending}>
              {lookup.isPending ? <Spinner size="sm" /> : 'جستجو و تایید خروج'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {code.trim().length >= MIN_SEARCH_LEN && (
        <Card className="rounded-2xl border border-default-200">
          <CardContent className="gap-3 p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Search className="h-4 w-4 text-[var(--color-brand)]" />
              نتایج جستجو
              {passesQuery.isFetching && <Spinner size="sm" />}
            </div>

            {passesQuery.isError && (
              <Alert status="danger">
                <AlertContent>
                  <AlertTitle>خطا</AlertTitle>
                  <AlertDescription>
                    {getErrorMessage(passesQuery.error, 'دریافت برگ‌های خروج ناموفق بود')}
                  </AlertDescription>
                </AlertContent>
              </Alert>
            )}

            {!passesQuery.isLoading && searchResults.length === 0 && (
              <p className="py-4 text-center text-sm text-foreground-400">موردی یافت نشد.</p>
            )}

            <ul className="flex flex-col gap-2">
              {searchResults.map((pass) => (
                <li key={pass.id}>
                  <button
                    type="button"
                    onClick={() => openPass(pass)}
                    className="flex w-full flex-col gap-1 rounded-xl border border-default-200 bg-default-50 px-4 py-3 text-right transition hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground">{pass.factory?.name || 'واحد نامشخص'}</span>
                      <span className="text-[11px] text-foreground-500">
                        {statusLabel[pass.status] || pass.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground-600">
                      <span>راننده: {pass.driverName || '—'}</span>
                      <span className="font-mono" dir="ltr">پلاک: {pass.licensePlate || '—'}</span>
                    </div>
                    {pass.qrCode && (
                      <span className="truncate font-mono text-[11px] text-foreground-400" dir="ltr">
                        {pass.qrCode}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ScanQrPage;
