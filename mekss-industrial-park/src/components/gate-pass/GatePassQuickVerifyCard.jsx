import { useState } from 'react';
import { Alert, AlertContent, AlertDescription, AlertTitle, Button, Card, CardContent, Spinner } from '@heroui/react';
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldCheck } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { canDecideGatePass, useGatePassDecision } from '../../hooks/useGatePassDecision';
import { cargoTypeLabels, gatePassStatusLabels, labelFor, vehicleTypeLabels } from '../../constants/persianLabels';
import { IRAN_PLATE_TYPES, displayIranLicensePlate, iranPlateTypeOf } from '../../utils/iranLicensePlate';

function Field({ label, children, wide = false, mono = false }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-xl bg-default-50 px-3 py-2 dark:bg-default-100/30 ${wide ? 'col-span-2' : ''}`}>
      <span className="text-[10px] font-medium text-foreground-500">{label}</span>
      <span className={`text-sm font-bold text-foreground ${mono ? 'font-mono tracking-wide' : ''}`} dir={mono ? 'ltr' : undefined}>
        {children || '—'}
      </span>
    </div>
  );
}

/**
 * Inline exit-pass card shown as soon as a plate locks, so the guard can compare the vehicle
 * and approve/deny without leaving the scanner.
 *
 * @param {{
 *   pass: object,
 *   scannedPlate?: string,
 *   onDecided?: (kind: 'verified'|'denied', pass: object) => void,
 *   onOpenDetails?: (pass: object) => void,
 * }} props
 */
export default function GatePassQuickVerifyCard({ pass, scannedPlate, onDecided, onOpenDetails }) {
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [denyOpen, setDenyOpen] = useState(false);
  const { plateLabel, verifyMutation, denyMutation, isBusy } = useGatePassDecision(pass?.id, {
    licensePlate: pass?.licensePlate,
    onVerified: (updated) => {
      setVerifyOpen(false);
      onDecided?.('verified', updated || pass);
    },
    onDenied: (updated) => {
      setDenyOpen(false);
      onDecided?.('denied', updated || pass);
    },
  });

  if (!pass) return null;
  const plateType = pass.plateType || iranPlateTypeOf(pass.licensePlate);
  const typeMeta = plateType ? IRAN_PLATE_TYPES[plateType] : null;
  const canDecide = canDecideGatePass(pass);
  const plateMismatch = Boolean(scannedPlate && pass.licensePlate && scannedPlate !== pass.licensePlate);

  return (
    <Card className="rounded-3xl border-2 border-emerald-400/70 shadow-md" data-testid="quick-verify-card">
      <CardContent className="gap-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-2xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/40">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">{pass.factory?.name || 'برگ خروج'}</h2>
              <p className="text-[11px] text-foreground-500">{labelFor(gatePassStatusLabels, pass.status)}</p>
            </div>
          </div>
          {onOpenDetails && (
            <Button size="sm" variant="ghost" onPress={() => onOpenDetails(pass)} className="text-xs">
              <ExternalLink className="h-3.5 w-3.5" />
              جزئیات کامل
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="شماره پلاک" mono>{plateLabel}</Field>
          <Field label="نوع پلاک">
            {typeMeta ? (
              <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px]" style={{ background: typeMeta.bg, color: typeMeta.fg }}>
                {typeMeta.label}
              </span>
            ) : null}
          </Field>
          <Field label="نام راننده">{pass.driverName}</Field>
          <Field label="کد ملی راننده" mono>{pass.driverNationalId}</Field>
          <Field label="نوع خودرو">{labelFor(vehicleTypeLabels, pass.vehicleType)}</Field>
          <Field label="نوع بار">{labelFor(cargoTypeLabels, pass.cargoType)}</Field>
          <Field label="تاریخ خروج">{pass.exitDate ? new Date(pass.exitDate).toLocaleDateString('fa-IR') : ''}</Field>
          <Field label="تلفن راننده" mono>{pass.driverPhone}</Field>
          {pass.cargoDescription ? <Field label="توضیحات بار" wide>{pass.cargoDescription}</Field> : null}
        </div>

        {plateMismatch && (
          <Alert status="warning">
            <AlertContent>
              <AlertTitle>پلاک خوانده‌شده کمی متفاوت است</AlertTitle>
              <AlertDescription>
                دوربین «{displayIranLicensePlate(scannedPlate)}» را خواند؛ پلاک خودرو را با «{plateLabel}» مقایسه کنید.
              </AlertDescription>
            </AlertContent>
          </Alert>
        )}

        {canDecide ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" className="h-12 font-bold" onPress={() => setVerifyOpen(true)} isDisabled={isBusy}>
              {verifyMutation.isPending ? <Spinner size="sm" /> : <CheckCircle2 className="h-5 w-5" />}
              تایید و ثبت خروج
            </Button>
            <Button variant="secondary" className="h-12 font-bold" onPress={() => setDenyOpen(true)} isDisabled={isBusy}>
              <AlertTriangle className="h-5 w-5" />
              رد / مغایرت
            </Button>
          </div>
        ) : (
          <Alert status="warning">
            <AlertContent>
              <AlertTitle>این برگ خروج قبلاً رسیدگی شده</AlertTitle>
              <AlertDescription>وضعیت: {labelFor(gatePassStatusLabels, pass.status)}</AlertDescription>
            </AlertContent>
          </Alert>
        )}
      </CardContent>

      <ConfirmDialog
        open={verifyOpen}
        title="تایید خروج"
        description={`با تایید این عملیات، خروج خودرو با پلاک «${plateLabel}» ثبت نهایی می‌شود. آیا اطمینان دارید؟`}
        confirmLabel="تایید خروج"
        confirmColor="primary"
        loading={verifyMutation.isPending}
        onConfirm={() => verifyMutation.mutate()}
        onClose={() => setVerifyOpen(false)}
      />
      <ConfirmDialog
        open={denyOpen}
        title="رد برگ خروج"
        description="لطفا دلیل رد یا مغایرت را ذکر کنید."
        requireReason
        reasonLabel="دلیل"
        confirmLabel="ثبت رد"
        confirmColor="danger"
        loading={denyMutation.isPending}
        onConfirm={(reason) => denyMutation.mutate(reason)}
        onClose={() => setDenyOpen(false)}
      />
    </Card>
  );
}
