import { useEffect, useRef, useState } from 'react';
import { Button, Spinner, Alert, AlertContent, AlertTitle, AlertDescription, Label } from '@heroui/react';
import { Camera, ScanLine, X, Check } from 'lucide-react';
import IranLicensePlateInput from '../common/IranLicensePlateInput';
import { displayIranLicensePlate, isCompleteIranLicensePlate } from '../../utils/iranLicensePlate';
import { recognizeIranPlate, warmIranPlateOcr, terminateIranPlateOcr } from '../../utils/iranPlateOcr/iranPlateOcrClient';

/**
 * Live camera + Platrix ONNX OCR for Iranian plates.
 * Capture-on-demand (not continuous) to stay smooth on mobile.
 */
export default function IranPlateOcrCamera({
  onPlateRead,
  onCancel,
  initialPlate = '',
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [plate, setPlate] = useState(initialPlate || '');
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus('آماده‌سازی مدل OCR…');
        await warmIranPlateOcr((p) => {
          if (!cancelled) setStatus(p.message || 'بارگذاری مدل…');
        });
        if (!cancelled) {
          setModelReady(true);
          setStatus('مدل آماده است — پلاک را داخل کادر قرار دهید');
        }
      } catch (error) {
        if (!cancelled) {
          setCameraError(error?.message || 'بارگذاری مدل OCR ناموفق بود');
          setStatus('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
      } catch (error) {
        setCameraError(error?.message || 'دسترسی به دوربین ممکن نشد');
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  useEffect(() => () => {
    // Keep worker warm across opens; terminate only on full unmount of page if needed.
  }, []);

  const captureAndRead = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady || busy) return;
    setBusy(true);
    setMeta(null);
    setStatus('ثبت فریم…');
    try {
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);

      const result = await recognizeIranPlate(canvas, {
        onProgress: (p) => setStatus(p.message || 'در حال پردازش…'),
      });

      if (result?.valid && result.plate) {
        setPlate(result.plate);
        setMeta(result);
        setStatus(`خوانده شد: ${displayIranLicensePlate(result.plate)}`);
      } else if (result?.raw) {
        setPlate('');
        setMeta(result);
        setStatus(`نتیجه خام: ${result.raw} — لطفاً دستی اصلاح کنید`);
      } else {
        setStatus('پلاک خوانده نشد — دوباره تلاش کنید یا دستی وارد کنید');
      }
    } catch (error) {
      setStatus(error?.message || 'خطا در OCR');
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!isCompleteIranLicensePlate(plate)) return;
    onPlateRead?.(plate, meta);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-default-200 bg-default-50/40 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          <ScanLine className="h-4 w-4 text-[var(--color-brand)]" />
          خواندن پلاک با دوربین (OCR)
        </div>
        {onCancel && (
          <Button size="sm" variant="ghost" onPress={onCancel} className="min-w-0 px-2">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <p className="text-[11px] leading-5 text-foreground-500">
        مدل تخصصی پلاک ایران (Platrix YOLO+CRNN) روی دستگاه شما اجرا می‌شود؛ پردازش در پس‌زمینه است تا صفحه هنگ نکند.
      </p>

      {cameraError ? (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{cameraError}</AlertDescription>
          </AlertContent>
        </Alert>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            className="h-[240px] w-full object-cover sm:h-[300px]"
            playsInline
            muted
            autoPlay
          />
          {/* Plate guide overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[22%] w-[78%] rounded-md border-2 border-[var(--color-brand)] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          {!cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
              <Spinner size="sm" /> <span className="ms-2">باز کردن دوربین…</span>
            </div>
          )}
        </div>
      )}

      {status && (
        <p className="text-center text-xs text-foreground-600">{status}</p>
      )}

      <Button
        variant="primary"
        className="h-11 font-bold"
        onPress={captureAndRead}
        isDisabled={!cameraReady || !modelReady || busy}
      >
        {busy ? <Spinner size="sm" /> : <Camera className="h-4 w-4" />}
        {busy ? 'در حال خواندن…' : 'عکس بگیر و پلاک را بخوان'}
      </Button>

      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-default-300 p-3">
        <Label className="text-xs font-bold">نتیجه (قابل اصلاح)</Label>
        <IranLicensePlateInput value={plate} onChange={setPlate} />
        {meta?.confidence != null && (
          <p className="text-[11px] text-foreground-500" dir="ltr">
            confidence≈{(meta.confidence * 100).toFixed(0)}%
            {meta.detectorHits != null ? ` · detections=${meta.detectorHits}` : ''}
          </p>
        )}
        <Button
          variant="secondary"
          className="font-bold"
          onPress={confirm}
          isDisabled={!isCompleteIranLicensePlate(plate)}
        >
          <Check className="h-4 w-4" />
          استفاده از این پلاک
        </Button>
      </div>
    </div>
  );
}

export { terminateIranPlateOcr };
