import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner, Alert, AlertContent, AlertTitle, AlertDescription } from '@heroui/react';
import { Camera, Flashlight, FlashlightOff, ImageUp, RotateCcw, ScanLine, X, ZoomIn } from 'lucide-react';
import { useLivePlateScanner } from '../../hooks/useLivePlateScanner';
import { DEFAULT_GUIDE, roiBoxToView } from '../../services/anpr/samplerCore';
import { ENGINE_LABELS } from '../../services/anpr/scannerMachine';
import { displayIranLicensePlate } from '../../utils/iranLicensePlate';

const hasLiveCamera = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);

const MODE_BADGE = {
  socket: { label: 'زنده', className: 'bg-emerald-600' },
  http: { label: 'HTTP', className: 'bg-amber-600' },
  device: { label: 'روی دستگاه', className: 'bg-sky-700' },
  manual: { label: 'دستی', className: 'bg-slate-600' },
};

function lockFeedback() {
  try {
    navigator.vibrate?.([60, 40, 60]);
  } catch {
    /* unsupported */
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1320;
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.17);
    osc.onended = () => ctx.close();
  } catch {
    /* autoplay policy */
  }
}

/**
 * Continuous plate scanner: frames stream to the server over Socket.IO (HTTP / on-device fallbacks),
 * results are fused across frames and the locked plate plus its matched exit pass are reported
 * through `onDecision` within a fraction of a second.
 *
 * @param {{
 *   onDecision?: (decision: object, controls: { rescan: () => void, confirm: Function }) => void,
 *   onCancel?: () => void,
 * }} props
 */
export default function IranPlateOcrCamera({ onDecision, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const photoInputRef = useRef(null);
  const [liveSupported] = useState(hasLiveCamera);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [zoom, setZoom] = useState(null);
  const [flash, setFlash] = useState(false);

  const { state, rescan, reconnect, confirm, submitPhoto } = useLivePlateScanner({
    videoRef,
    enabled: liveSupported && cameraReady,
    guide: DEFAULT_GUIDE,
  });

  useEffect(() => {
    if (!liveSupported) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 30 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const [track] = stream.getVideoTracks();
        trackRef.current = track;
        const caps = track?.getCapabilities?.() || {};
        if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
          track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => undefined);
        }
        if (caps.torch) setTorch({ supported: true, on: false });
        if (caps.zoom && caps.zoom.max > caps.zoom.min) {
          const current = track.getSettings?.().zoom ?? caps.zoom.min;
          setZoom({ min: caps.zoom.min, max: Math.min(caps.zoom.max, caps.zoom.min * 5), step: caps.zoom.step || 0.1, value: current });
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraReady(true);
      } catch (error) {
        if (!cancelled) setCameraError(error?.name === 'NotAllowedError' ? 'اجازه دسترسی به دوربین داده نشد.' : (error?.message || 'دسترسی به دوربین ممکن نشد'));
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      trackRef.current = null;
    };
  }, [liveSupported]);

  const controls = useMemo(() => ({ rescan, confirm }), [rescan, confirm]);
  const reportedRef = useRef(null);
  useEffect(() => {
    const decision = state.decision;
    if (!decision || reportedRef.current === decision) return;
    reportedRef.current = decision;
    lockFeedback();
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 450);
    onDecision?.(decision, controls);
    return () => clearTimeout(t);
  }, [state.decision, onDecision, controls]);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorch({ supported: true, on: next });
    } catch {
      setTorch({ supported: false, on: false });
    }
  }, [torch.on]);

  const changeZoom = useCallback((value) => {
    setZoom((z) => (z ? { ...z, value } : z));
    trackRef.current?.applyConstraints({ advanced: [{ zoom: value }] }).catch(() => undefined);
  }, []);

  const handleRescan = () => {
    reportedRef.current = null;
    rescan();
  };

  const live = state.live;
  const best = live?.candidates?.find((c) => c.valid) || live?.candidates?.[0];
  const video = videoRef.current;
  const overlayBox = best && live?.roi && video
    ? roiBoxToView(best.bbox, {
      roi: live.roi,
      encodedW: live.image?.w || live.encoded?.width,
      encodedH: live.image?.h || live.encoded?.height,
      videoW: video.videoWidth,
      videoH: video.videoHeight,
      viewW: video.clientWidth,
      viewH: video.clientHeight,
    })
    : null;
  const fusedConfidence = state.decision?.confidence ?? live?.fused?.confidence ?? 0;
  const liveText = state.decision
    ? displayIranLicensePlate(state.decision.plate)
    : live?.fused?.plate ? displayIranLicensePlate(live.fused.plate) : '';
  const badge = MODE_BADGE[state.mode];
  const engineLabel = state.engine ? ENGINE_LABELS[state.engine] || state.engine : null;

  const statusText = (() => {
    if (cameraError) return '';
    if (!liveSupported) return 'این مرورگر دوربین زنده ندارد؛ از پلاک عکس بگیرید.';
    if (!cameraReady) return 'باز کردن دوربین…';
    if (state.phase === 'connecting') return 'اتصال به سرور تشخیص پلاک…';
    if (state.decision) return state.decision.requiresConfirmation ? 'پلاک خوانده شد — لطفاً تطبیق را تایید کنید' : 'پلاک قفل شد';
    if (state.mode === 'manual') return 'تشخیص خودکار در دسترس نیست — پلاک را دستی وارد کنید';
    if (state.mode === 'device') return 'حالت آفلاین: پردازش روی همین دستگاه';
    return 'پلاک را داخل کادر نگه دارید…';
  })();

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-default-200 bg-default-50/40 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          <ScanLine className="h-4 w-4 text-[var(--color-brand)]" />
          اسکن زنده پلاک
          {badge && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${badge.className}`} data-testid="scan-mode-badge">
              {badge.label}
            </span>
          )}
          {engineLabel && state.mode !== 'manual' && (
            <span className="rounded-full border border-default-300 px-2 py-0.5 text-[10px] text-foreground-600" data-testid="scan-engine-badge">
              {engineLabel}
              {state.latencyMs != null && state.mode !== 'device' ? ` · ${state.latencyMs}ms` : ''}
            </span>
          )}
        </div>
        {onCancel && (
          <Button size="sm" variant="ghost" onPress={onCancel} className="min-w-0 px-2" aria-label="بستن دوربین">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {cameraError && (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطای دوربین</AlertTitle>
            <AlertDescription>{cameraError} می‌توانید از پلاک عکس بگیرید یا آن را دستی وارد کنید.</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {liveSupported && !cameraError && (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="h-[260px] w-full object-cover sm:h-[320px]" playsInline muted autoPlay />

          <div className="pointer-events-none absolute inset-0">
            <div
              className={`absolute rounded-lg border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] transition-colors ${state.decision ? 'border-emerald-400' : 'border-[var(--color-brand)]'}`}
              style={{
                left: `${DEFAULT_GUIDE.x * 100}%`,
                top: `${DEFAULT_GUIDE.y * 100}%`,
                width: `${DEFAULT_GUIDE.w * 100}%`,
                height: `${DEFAULT_GUIDE.h * 100}%`,
              }}
            />
            {overlayBox && !state.decision && (
              <div
                className={`absolute rounded border-2 transition-all duration-100 ${best?.valid ? 'border-emerald-400' : 'border-amber-400'}`}
                style={{
                  left: `${overlayBox.left * 100}%`,
                  top: `${overlayBox.top * 100}%`,
                  width: `${overlayBox.width * 100}%`,
                  height: `${overlayBox.height * 100}%`,
                }}
                data-testid="plate-bbox"
              />
            )}
            {flash && <div className="absolute inset-0 animate-pulse bg-emerald-400/30" />}
            {liveText && (
              <div className="absolute inset-x-0 bottom-2 flex justify-center">
                <span className="rounded-lg bg-black/70 px-3 py-1 font-mono text-base font-bold tracking-wide text-white" dir="ltr">
                  {liveText}
                </span>
              </div>
            )}
          </div>

          {(torch.supported || zoom) && (
            <div className="absolute end-2 top-2 flex flex-col items-center gap-2">
              {torch.supported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className="rounded-full bg-black/60 p-2 text-white"
                  aria-label={torch.on ? 'خاموش کردن چراغ' : 'روشن کردن چراغ'}
                >
                  {torch.on ? <FlashlightOff className="h-4 w-4" /> : <Flashlight className="h-4 w-4" />}
                </button>
              )}
            </div>
          )}

          {!cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
              <Spinner size="sm" /> <span className="ms-2">باز کردن دوربین…</span>
            </div>
          )}
        </div>
      )}

      {zoom && (
        <label className="flex items-center gap-2 text-xs text-foreground-600">
          <ZoomIn className="h-4 w-4" />
          <input
            type="range"
            min={zoom.min}
            max={zoom.max}
            step={zoom.step}
            value={zoom.value}
            onChange={(e) => changeZoom(Number(e.target.value))}
            className="flex-1"
            aria-label="بزرگنمایی"
          />
        </label>
      )}

      {liveSupported && !cameraError && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-default-200" aria-hidden>
          <div
            className={`h-full rounded-full transition-all duration-150 ${fusedConfidence >= 0.97 ? 'bg-emerald-500' : fusedConfidence >= 0.8 ? 'bg-amber-500' : 'bg-rose-500'}`}
            style={{ width: `${Math.round(Math.min(1, fusedConfidence) * 100)}%` }}
          />
        </div>
      )}

      {statusText && <p className="text-center text-xs text-foreground-600" role="status">{statusText}</p>}
      {state.error && <p className="text-center text-xs text-danger">{state.error}</p>}

      <div className="flex flex-wrap gap-2">
        {state.decision && (
          <Button variant="secondary" className="flex-1 font-bold" onPress={handleRescan}>
            <RotateCcw className="h-4 w-4" />
            اسکن خودروی بعدی
          </Button>
        )}
        {!state.decision && state.mode === 'manual' && liveSupported && !cameraError && (
          <Button variant="secondary" className="flex-1 font-bold" onPress={reconnect}>
            <RotateCcw className="h-4 w-4" />
            تلاش دوباره برای اتصال
          </Button>
        )}
        <Button
          variant={liveSupported && !cameraError ? 'tertiary' : 'primary'}
          className="flex-1 font-bold"
          onPress={() => photoInputRef.current?.click()}
        >
          {liveSupported && !cameraError ? <ImageUp className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          عکس گرفتن از پلاک
        </Button>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) {
              reportedRef.current = null;
              submitPhoto(file);
            }
          }}
        />
      </div>
    </div>
  );
}
