import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { gatePassApi } from '../../services/api/gatePass.api';
import { anprApi } from '../../services/api/anpr.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { semanticFilter } from '../../utils/semanticSearch';
import { displayIranLicensePlate, isCompleteIranLicensePlate, normalizeIranPlate } from '../../utils/iranLicensePlate';
import IranPlateOcrCamera from '../../components/gate-pass/IranPlateOcrCamera';
import IranLicensePlateInput from '../../components/common/IranLicensePlateInput';
import GatePassQuickVerifyCard from '../../components/gate-pass/GatePassQuickVerifyCard';
import { gatePassStatusLabels as statusLabel } from '../../constants/persianLabels';
import { gatePassNumber } from '../../utils/gatePassPrint';
import { extractGatePassCode, matchesGatePassNumber } from '../../utils/gatePassCode';

const SCANNER_REGION_ID = 'mekss-qr-scanner';
const MIN_SEARCH_LEN = 3;

const canonicalizePlate = (value) => normalizeIranPlate(value).plate || String(value || '').trim();

export const ScanQrPage = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [plateCameraOpen, setPlateCameraOpen] = useState(false);
  const [plateCode, setPlateCode] = useState('');
  const [plateFilledByScan, setPlateFilledByScan] = useState(false);
  const [decision, setDecision] = useState(null);
  const [selectedPassId, setSelectedPassId] = useState(null);
  const scanControlsRef = useRef(null);
  const scannerRef = useRef(null);
  const handlingScanRef = useRef(false);

  const passesQuery = useQuery({
    queryKey: ['gate-passes', 'scan-search'],
    queryFn: () => gatePassApi.getGatePasses().then((res) => res.data || []),
  });

  const lookup = useMutation({
    mutationFn: (qr) => {
      const token = extractGatePassCode(qr);
      if (token.length < MIN_SEARCH_LEN) return Promise.reject(new Error('کد QR یا شماره برگ خروج معتبر نیست'));
      return gatePassApi.getByQr(token).then((res) => res.data);
    },
    onSuccess: (pass) => {
      showNotification('برگ خروج یافت شد', 'success');
      navigate(`/guard/gate-passes/${pass.id}/verify`);
    },
    onError: (error) => showNotification(getErrorMessage(error, error?.response ? 'کد QR معتبر نیست' : error?.message || 'کد QR معتبر نیست'), 'error'),
  });

  const plateLookup = useMutation({
    mutationFn: (plate) => gatePassApi.getByPlate(canonicalizePlate(plate)).then((res) => res.data),
    onSuccess: (pass) => {
      showNotification('برگ خروج مرتبط با پلاک یافت شد', 'success');
      navigate(`/guard/gate-passes/${pass.id}/verify`);
    },
    onError: (error) => showNotification(getErrorMessage(error, 'برگ خروجی برای این پلاک یافت نشد'), 'error'),
  });

  const applyDecision = useCallback((next) => {
    setDecision(next);
    const outcome = next?.match?.outcome;
    setSelectedPassId(outcome === 'MATCHED' ? next.match.gatePasses?.[0]?.id || null : null);
    if (next?.plate) {
      setPlateCode(next.plate);
      setPlateFilledByScan(true);
    }
  }, []);

  /** Manual / corrected plate: matched with the same confusion-aware matcher as the camera. */
  const manualMatch = useMutation({
    mutationFn: (plate) => anprApi.match({ plate: canonicalizePlate(plate), engine: 'MANUAL' }).then((res) => res.data),
    onSuccess: (result) => {
      applyDecision(result);
      setPlateFilledByScan(false);
    },
    onError: (error, plate) => {
      if (!error?.response) plateLookup.mutate(plate);
      else showNotification(getErrorMessage(error, 'تطبیق پلاک ناموفق بود'), 'error');
    },
  });

  const onScanDecision = useCallback((next, controls) => {
    scanControlsRef.current = controls;
    applyDecision(next);
    const outcome = next?.match?.outcome;
    const label = displayIranLicensePlate(next.plate);
    if (outcome === 'MATCHED') showNotification(`پلاک ${label} — برگ خروج یافت شد`, 'success');
    else if (outcome === 'SUGGESTED') showNotification(`پلاک ${label} خوانده شد؛ برگ خروج مشابه پیشنهاد شد`, 'warning');
    else showNotification(`پلاک ${label} خوانده شد؛ برگ خروج بازی یافت نشد`, 'error');
  }, [applyDecision, showNotification]);

  const scanNext = () => {
    setDecision(null);
    setSelectedPassId(null);
    setPlateCode('');
    setPlateFilledByScan(false);
    scanControlsRef.current?.rescan();
  };

  const onPassDecided = (kind, pass) => {
    const readPlate = decision?.plate;
    if (decision?.readId) {
      scanControlsRef.current?.confirm?.({
        plate: kind === 'verified' ? pass.licensePlate || readPlate : readPlate,
        gatePassId: pass.id,
      });
    }
    scanNext();
  };

  const selectedPass = useMemo(
    () => decision?.match?.gatePasses?.find((p) => p.id === selectedPassId) || null,
    [decision, selectedPassId],
  );

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

  const notifyRef = useRef(showNotification);
  notifyRef.current = showNotification;
  const handleDecodedRef = useRef(null);
  handleDecodedRef.current = async (decodedText) => {
    if (handlingScanRef.current) return;
    handlingScanRef.current = true;
    const value = extractGatePassCode(decodedText);
    setCode(value);
    await stopScanner();
    if (!value) {
      handlingScanRef.current = false;
      showNotification('محتوای QR قابل شناسایی نیست', 'error');
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
    setPlateCameraOpen(false);
    await stopScanner();
    setScanning(true);
  };

  // Start only after the scanner region is rendered visible: html5-qrcode sizes its viewfinder from the
  // element, and a still-hidden (0px) region yields an empty scan box that never decodes.
  useEffect(() => {
    if (!scanning || scannerRef.current) return;
    const scanner = new Html5Qrcode(SCANNER_REGION_ID, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      useBarCodeDetectorIfSupported: true,
    });
    scannerRef.current = scanner;
    const config = {
      fps: 15,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const edge = Math.max(160, Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.8));
        return { width: Math.min(edge, viewfinderWidth), height: Math.min(edge, viewfinderHeight) };
      },
      disableFlip: false,
    };
    const onDecoded = (decoded) => handleDecodedRef.current?.(decoded);
    const onFrameError = () => {};
    // stopScanner() clears the ref; a start that resolves afterwards must release the camera itself.
    const cancelled = () => scannerRef.current !== scanner;

    (async () => {
      try {
        await scanner.start({ facingMode: 'environment' }, config, onDecoded, onFrameError);
        if (cancelled() && scanner.isScanning) scanner.stop().catch(() => undefined);
      } catch (firstError) {
        // Desktops / some phones have no "environment" camera: fall back to the last listed camera.
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cancelled()) return;
          if (!cameras?.length) throw firstError;
          await scanner.start(cameras[cameras.length - 1].id, config, onDecoded, onFrameError);
          if (cancelled() && scanner.isScanning) scanner.stop().catch(() => undefined);
        } catch (error) {
          if (cancelled()) return;
          scannerRef.current = null;
          setScanning(false);
          const message = error?.name === 'NotAllowedError' || /permission/i.test(String(error))
            ? 'اجازه دسترسی به دوربین داده نشد.'
            : getErrorMessage(error, 'دسترسی به دوربین ممکن نشد');
          setCameraError(message);
          notifyRef.current(message, 'error');
        }
      }
    })();
  }, [scanning]);

  useEffect(() => () => {
    stopScanner();
  }, []);

  const searchResults = useMemo(() => {
    const query = code.trim();
    if (query.length < MIN_SEARCH_LEN) return [];
    const passes = Array.isArray(passesQuery.data) ? passesQuery.data : [];
    const byNumber = passes.filter((pass) => matchesGatePassNumber(pass, query));
    const semantic = semanticFilter(passes, query, (pass) => [
      gatePassNumber(pass),
      pass.qrCode,
      pass.licensePlate,
      displayIranLicensePlate(pass.licensePlate),
      pass.driverName,
      pass.id,
      pass.factory?.name,
      pass.cargoType,
      pass.vehicleType,
      statusLabel[pass.status],
      'مجوز',
      'برگ خروج',
      'پلاک',
    ]);
    return [...new Set([...byNumber, ...semantic])].slice(0, 12);
  }, [code, passesQuery.data]);

  const submitExact = (event) => {
    event.preventDefault();
    const value = code.trim();
    if (!value) {
      showNotification('کد QR یا عبارت جستجو را وارد کنید', 'error');
      return;
    }
    const passes = Array.isArray(passesQuery.data) ? passesQuery.data : [];
    const numberMatches = passes.filter((pass) => matchesGatePassNumber(pass, value));
    if (numberMatches.length === 1) {
      openPass(numberMatches[0]);
      return;
    }
    if (value.length >= MIN_SEARCH_LEN && searchResults.length === 1) {
      openPass(searchResults[0]);
      return;
    }
    if (numberMatches.length > 1) {
      showNotification('چند برگ خروج با این شماره پیدا شد؛ از فهرست نتایج انتخاب کنید', 'warning');
      return;
    }
    lookup.mutate(value);
  };

  const openPlateCamera = async () => {
    await stopScanner();
    setPlateCameraOpen(true);
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
              <h1 className="text-xl font-bold">اسکن کد QR / پلاک</h1>
              <p className="mt-0.5 text-xs text-foreground-500">
                QR با دوربین، یا پلاک ایران با OCR تخصصی روی دستگاه.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {!scanning ? (
              <Button
                variant="primary"
                className="h-12 font-bold"
                onPress={startScanner}
                isDisabled={lookup.isPending || plateCameraOpen}
              >
                <Camera className="h-5 w-5" />
                اسکن QR با دوربین
              </Button>
            ) : (
              <Button variant="secondary" className="h-11 font-bold" onPress={stopScanner}>
                <X className="h-4 w-4" />
                توقف اسکن QR
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
                  placeholder="شماره برگ (مثلاً ۳ رقم اول)، MEKSS-... یا پلاک / نام راننده"
                  className="rounded-xl pe-10 font-mono"
                  autoComplete="off"
                />
              </div>
            </div>
            <Button type="submit" variant="primary" className="h-12 font-bold" isDisabled={lookup.isPending}>
              {lookup.isPending ? <Spinner size="sm" /> : 'جستجو و تایید خروج'}
            </Button>
          </form>

          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-default-300 p-4">
            <Label className="text-xs font-bold">تشخیص زنده پلاک ایران</Label>
            <p className="text-[11px] text-foreground-500">
              دوربین را به سمت پلاک بگیرید؛ پلاک به‌صورت خودکار خوانده و برگ خروج مربوط بلافاصله نمایش داده می‌شود.
              در صورت قطع شبکه، خواندن روی همین دستگاه انجام می‌شود.
            </p>

            {!plateCameraOpen ? (
              <Button variant="secondary" className="font-bold" onPress={openPlateCamera} isDisabled={scanning}>
                <Camera className="h-4 w-4" />
                شروع اسکن زنده پلاک
              </Button>
            ) : (
              <IranPlateOcrCamera onCancel={() => setPlateCameraOpen(false)} onDecision={onScanDecision} />
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!isCompleteIranLicensePlate(plateCode)) {
                  showNotification('پلاک را کامل وارد کنید', 'error');
                  return;
                }
                if (decision?.readId && plateCode !== decision.plate) {
                  scanControlsRef.current?.confirm?.({ plate: plateCode });
                }
                manualMatch.mutate(plateCode);
              }}
              className="flex flex-col gap-2"
            >
              <IranLicensePlateInput
                label={plateFilledByScan ? 'پلاک خوانده‌شده (قابل اصلاح)' : 'ورود / اصلاح دستی پلاک'}
                value={plateCode}
                highlight={plateFilledByScan}
                onChange={(next) => {
                  setPlateCode(next);
                  setPlateFilledByScan(false);
                }}
              />
              <Button type="submit" variant="tertiary" className="font-bold" isDisabled={manualMatch.isPending || plateLookup.isPending}>
                {manualMatch.isPending || plateLookup.isPending ? <Spinner size="sm" /> : 'تطبیق پلاک با برگ خروج باز'}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {decision && (
        <PlateMatchResult
          decision={decision}
          selectedPass={selectedPass}
          onSelect={setSelectedPassId}
          onDecided={onPassDecided}
          onOpenDetails={(pass) => navigate(`/guard/gate-passes/${pass.id}/verify`)}
          onScanNext={scanNext}
        />
      )}

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
                      <span className="font-bold text-foreground">
                        {pass.factory?.name || 'واحد نامشخص'}
                        <span className="ms-2 font-mono text-[11px] font-normal text-foreground-500" dir="ltr">#{gatePassNumber(pass)}</span>
                      </span>
                      <span className="text-[11px] text-foreground-500">
                        {statusLabel[pass.status] || pass.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground-600">
                      <span>راننده: {pass.driverName || '—'}</span>
                      <span className="font-mono" dir="ltr">پلاک: {displayIranLicensePlate(pass.licensePlate)}</span>
                    </div>
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

function PlateMatchResult({ decision, selectedPass, onSelect, onDecided, onOpenDetails, onScanNext }) {
  const outcome = decision.match?.outcome;
  const passes = decision.match?.gatePasses || [];
  const suggestions = decision.match?.suggestions || [];
  const plateLabel = displayIranLicensePlate(decision.plate);

  if (selectedPass) {
    return (
      <div className="flex flex-col gap-2">
        {outcome === 'MATCHED' && passes.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {passes.map((pass) => (
              <Button key={pass.id} size="sm" variant={pass.id === selectedPass.id ? 'primary' : 'secondary'} onPress={() => onSelect(pass.id)}>
                {pass.factory?.name || pass.id}
              </Button>
            ))}
          </div>
        )}
        <GatePassQuickVerifyCard
          pass={selectedPass}
          scannedPlate={decision.plate}
          onDecided={onDecided}
          onOpenDetails={onOpenDetails}
        />
      </div>
    );
  }

  if (outcome === 'SUGGESTED' && suggestions.length) {
    return (
      <Card className="rounded-2xl border-2 border-amber-400/70" data-testid="plate-suggestions">
        <CardContent className="gap-3 p-4">
          <p className="text-sm font-bold">
            پلاک «<span dir="ltr" className="font-mono">{plateLabel}</span>» دقیقاً یافت نشد. آیا منظور شما یکی از این‌ها بود؟
          </p>
          <ul className="flex flex-col gap-2">
            {suggestions.map((s) => {
              const pass = passes.find((p) => p.id === s.gatePassId);
              return (
                <li key={s.gatePassId}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.gatePassId)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-default-200 bg-default-50 px-4 py-3 text-right transition hover:border-[var(--color-brand)]"
                  >
                    <span className="font-mono font-bold" dir="ltr">{displayIranLicensePlate(s.plate)}</span>
                    <span className="text-xs text-foreground-600">
                      {pass?.factory?.name || ''} {pass?.driverName ? `· ${pass.driverName}` : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Button variant="tertiary" onPress={onScanNext}>هیچ‌کدام — اسکن مجدد</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Alert status="danger" data-testid="plate-not-found">
      <AlertContent>
        <AlertTitle>برگ خروج بازی برای این پلاک یافت نشد</AlertTitle>
        <AlertDescription>
          پلاک «<span dir="ltr" className="font-mono">{plateLabel}</span>»
          {decision.offline ? ' به‌صورت آفلاین خوانده شد؛ پس از اتصال شبکه دوباره تطبیق دهید.' : ' در برگ‌های خروج باز این شهرک نیست. پلاک را بررسی و در صورت نیاز اصلاح کنید.'}
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

export default ScanQrPage;
