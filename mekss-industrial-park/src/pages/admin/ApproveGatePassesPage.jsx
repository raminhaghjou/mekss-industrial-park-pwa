import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card, CardContent, Chip, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription, Button, Input, Label, Spinner,
} from '@heroui/react';
import {
  Ticket, CheckCircle2, XCircle, Clock3, User, Car, CalendarClock, Download, ShieldCheck, Package, Phone, IdCard,
  Truck, Send, Building2, FileText,
} from 'lucide-react';
import { gatePassApi } from '../../services/api/gatePass.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { AuthenticatedImage } from '../../components/common/AuthenticatedImage';
import { useNotification } from '../../providers/NotificationProvider';
import {
  cargoTypeLabels,
  gatePassRejectionStage,
  gatePassStatusLabels as statusLabels,
  labelFor,
  vehicleTypeLabels,
} from '../../constants/persianLabels';
import { saveBlob } from '../../services/api/files.api';
import { csvLine } from '../../utils/csv';
import { displayIranLicensePlate } from '../../utils/iranLicensePlate';
import JalaliDatePicker from '../../components/common/JalaliDatePicker';
import { digitsOnly } from '../../utils/digits';

const TABS = [
  {
    id: 'pending',
    label: 'در انتظار تایید شما',
    match: (status) => status === 'PENDING',
    emptyTitle: 'برگ خروجی در انتظار تایید شما نیست',
    emptyDescription: 'به محض ثبت برگ خروج توسط واحد صنعتی، اینجا نمایش داده می‌شود و اعلان آن برایتان ارسال می‌گردد.',
  },
  {
    id: 'guard',
    label: 'ارسال‌شده به نگهبانی',
    match: (status) => status === 'APPROVED',
    emptyTitle: 'برگی در انتظار نگهبانی نیست',
    emptyDescription: 'برگ‌هایی که تایید کنید تا زمان بررسی نگهبانی در این بخش می‌مانند.',
  },
  {
    id: 'completed',
    label: 'خروج تاییدشده',
    match: (status) => status === 'COMPLETED',
    emptyTitle: 'خروج تاییدشده‌ای نیست',
    emptyDescription: 'مواردی که نگهبانی خروجشان را تایید کند در این بخش می‌آیند.',
  },
  {
    id: 'rejected',
    label: 'رد شده',
    match: (status) => status === 'REJECTED' || status === 'EXPIRED',
    emptyTitle: 'مورد رد‌شده‌ای نیست',
    emptyDescription: 'برگ‌های رد یا منقضی‌شده اینجا دیده می‌شوند.',
  },
];

const statusTone = {
  PENDING: { chip: 'warning', bar: 'bg-warning-500', icon: Clock3 },
  APPROVED: { chip: 'accent', bar: 'bg-primary', icon: ShieldCheck },
  COMPLETED: { chip: 'success', bar: 'bg-success-500', icon: CheckCircle2 },
  REJECTED: { chip: 'danger', bar: 'bg-danger-500', icon: XCircle },
  EXPIRED: { chip: 'default', bar: 'bg-default-400', icon: Clock3 },
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fa-IR-u-ca-persian') : '—');

const rejectionLabel = (pass) => {
  const stage = gatePassRejectionStage(pass);
  if (stage === 'guard') return 'دلیل رد نگهبانی: ';
  if (stage === 'park') return 'دلیل رد مدیر شهرک: ';
  return 'یادداشت: ';
};

const exportCsv = (rows) => {
  const header = ['واحد', 'راننده', 'کدملی', 'تلفن راننده', 'پلاک', 'نوع بار', 'نوع خودرو', 'تاریخ خروج', 'وضعیت', 'صادرکننده', 'تایید مدیر شهرک', 'زمان تایید مدیر شهرک', 'نگهبان', 'زمان تصمیم نگهبان', 'دلیل رد'];
  const lines = rows.map((pass) => csvLine([
    pass.factory?.name || '',
    pass.driverName || '',
    pass.driverNationalId || '',
    pass.driverPhone || '',
    displayIranLicensePlate(pass.licensePlate) || pass.licensePlate || '',
    labelFor(cargoTypeLabels, pass.cargoType),
    labelFor(vehicleTypeLabels, pass.vehicleType),
    formatDate(pass.exitDate),
    statusLabels[pass.status] || pass.status || '',
    pass.createdBy?.name || '',
    pass.approvedBy?.name || '',
    formatDateTime(pass.approvedAt),
    pass.verifiedBy?.name || '',
    formatDateTime(pass.verifiedAt),
    pass.status === 'REJECTED' ? pass.notes || '' : '',
  ]));
  const csv = `\uFEFF${[header.join(','), ...lines].join('\n')}`;
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `park-gate-passes-${new Date().toISOString().slice(0, 10)}.csv`);
};

const Detail = ({ icon, label, children, mono = false, wide = false }) => {
  const Icon = icon;
  return (
    <div className={`flex items-start gap-2 rounded-xl bg-default-50 px-3 py-2.5 dark:bg-white/5 ${wide ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground-400" />
      <div className="min-w-0">
        <p className="text-[11px] text-foreground-500">{label}</p>
        <p className={`text-sm font-semibold text-foreground ${mono ? 'font-mono' : ''} ${wide ? 'whitespace-pre-wrap leading-relaxed' : 'truncate'}`} dir={mono ? 'ltr' : undefined}>
          {children || '—'}
        </p>
      </div>
    </div>
  );
};

/** Three-step progress: unit submission → park manager review → guard exit decision. */
const ReviewTimeline = ({ pass }) => {
  const rejectedAt = gatePassRejectionStage(pass);
  const steps = [
    { title: 'ثبت توسط واحد', who: pass.createdBy?.name, at: pass.createdAt, state: 'done' },
    {
      title: 'تایید مدیر شهرک',
      who: pass.approvedBy?.name,
      at: pass.approvedAt,
      state: pass.status === 'PENDING' ? 'current' : rejectedAt === 'park' ? 'rejected' : 'done',
    },
    {
      title: 'بررسی نگهبانی',
      who: pass.verifiedBy?.name,
      at: pass.verifiedAt,
      state: pass.status === 'COMPLETED'
        ? 'done'
        : rejectedAt === 'guard'
          ? 'rejected'
          : pass.status === 'APPROVED'
            ? 'current'
            : 'waiting',
    },
  ];
  const dot = {
    done: 'bg-success-500 text-white',
    current: 'bg-warning-500 text-white animate-pulse',
    rejected: 'bg-danger-500 text-white',
    waiting: 'bg-default-200 text-foreground-500',
  };
  return (
    <ol className="grid grid-cols-3 gap-2">
      {steps.map((step, index) => (
        <li key={step.title} className="flex flex-col items-center gap-1 text-center">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${dot[step.state]}`}>
            {step.state === 'rejected' ? <XCircle className="h-4 w-4" /> : step.state === 'done' ? <CheckCircle2 className="h-4 w-4" /> : (index + 1).toLocaleString('fa-IR')}
          </span>
          <span className="text-[11px] font-semibold text-foreground">{step.title}</span>
          <span className="text-[10px] leading-4 text-foreground-500">
            {step.state === 'waiting' || (step.state === 'current' && !step.at)
              ? (step.state === 'current' ? 'در انتظار' : '—')
              : [step.who, formatDateTime(step.at)].filter(Boolean).join(' · ')}
          </span>
        </li>
      ))}
    </ol>
  );
};

/** Park manager review queue: approve (→ guard) or reject with a reason. */
export const ApproveGatePassesPage = () => {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [tab, setTab] = useState('pending');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [plate, setPlate] = useState('');
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['gate-passes', 'managed', fromDate, toDate, nationalId, plate],
    queryFn: () => gatePassApi.getGatePasses({
      fromDate: fromDate || undefined,
      toDate: toDate ? `${toDate}T23:59:59.999` : undefined,
      driverNationalId: nationalId || undefined,
      licensePlate: plate || undefined,
    }).then((res) => res.data),
    refetchOnMount: 'always',
    refetchInterval: 60_000,
  });

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['gate-passes'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);

  const approveMutation = useMutation({
    mutationFn: (id) => gatePassApi.approveGatePass(id),
    onSuccess: async () => {
      showNotification('برگ خروج تایید شد و برای نگهبانی ارسال گردید.', 'success');
      setApproveTarget(null);
      await refresh();
    },
    onError: async (err) => {
      showNotification(getErrorMessage(err, 'تایید برگ خروج ناموفق بود.'), 'error');
      await refresh();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => gatePassApi.rejectGatePass(id, { reason }),
    onSuccess: async () => {
      showNotification('برگ خروج رد شد و دلیل آن برای مدیر واحد ارسال گردید.', 'success');
      setRejectTarget(null);
      await refresh();
    },
    onError: async (err) => {
      showNotification(getErrorMessage(err, 'رد برگ خروج ناموفق بود.'), 'error');
      await refresh();
    },
  });

  const passes = useMemo(() => data || [], [data]);
  const activeTab = TABS.find((item) => item.id === tab) || TABS[0];
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((item) => [item.id, passes.filter((p) => item.match(p.status)).length])),
    [passes],
  );

  const filteredPasses = useMemo(() => (
    [...passes]
      .filter((p) => activeTab.match(p.status))
      .sort((a, b) => {
        if (activeTab.id === 'pending') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        const aTime = new Date(a.verifiedAt || a.approvedAt || a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.verifiedAt || b.approvedAt || b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      })
  ), [passes, activeTab]);

  const busy = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">بررسی و تایید برگ‌های خروج</h1>
          <p className="text-sm text-foreground-500 mt-1">
            برگ‌های ثبت‌شده توسط واحدهای صنعتی ابتدا باید توسط شما تایید شوند تا برای نگهبانی ارسال گردند.
          </p>
        </div>
        <Button
          variant="tertiary"
          className="gap-2 rounded-xl"
          onPress={() => exportCsv(filteredPasses)}
          isDisabled={!filteredPasses.length}
        >
          <Download className="h-4 w-4" />
          خروجی Excel
        </Button>
      </div>

      <Card className="rounded-2xl border border-default-200 dark:border-white/10">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">از تاریخ خروج</Label>
            <JalaliDatePicker compact value={fromDate} onChange={setFromDate} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">تا تاریخ خروج</Label>
            <JalaliDatePicker compact value={toDate} onChange={setToDate} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">کد ملی راننده</Label>
            <Input dir="ltr" value={nationalId} onChange={(e) => setNationalId(digitsOnly(e.target.value, 10))} className="rounded-xl" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">پلاک</Label>
            <Input dir="ltr" value={plate} onChange={(e) => setPlate(e.target.value)} className="rounded-xl" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {TABS.map((item) => {
          const active = tab === item.id;
          const urgent = item.id === 'pending' && counts.pending > 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`relative rounded-2xl border px-3 py-3 text-start transition ${
                active
                  ? 'border-primary bg-primary text-white shadow-md shadow-primary/20'
                  : 'border-default-200 bg-background text-foreground hover:bg-default-50 dark:border-white/10'
              }`}
            >
              {urgent && !active ? <span className="absolute left-3 top-3 h-2.5 w-2.5 animate-pulse rounded-full bg-warning-500" /> : null}
              <p className={`text-xs font-medium ${active ? 'text-white/80' : 'text-foreground-500'}`}>{item.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{(counts[item.id] || 0).toLocaleString('fa-IR')}</p>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا در دریافت اطلاعات</AlertTitle>
            <AlertDescription>{getErrorMessage(error, 'دریافت برگ‌های خروج ناموفق بود.')}</AlertDescription>
            <Button size="sm" variant="secondary" className="mt-2 rounded-xl" onPress={() => refetch()} isDisabled={isFetching}>
              تلاش دوباره
            </Button>
          </AlertContent>
        </Alert>
      ) : filteredPasses.length === 0 ? (
        <Card className="border border-default-200 dark:border-white/10">
          <CardContent>
            <EmptyState
              icon={<Ticket className="h-6 w-6" />}
              title={activeTab.emptyTitle}
              description={activeTab.emptyDescription}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredPasses.map((pass) => {
            const tone = statusTone[pass.status] || statusTone.PENDING;
            const StatusIcon = tone.icon;
            const awaitingMe = pass.status === 'PENDING';
            return (
              <Card key={pass.id} className="overflow-hidden border border-default-200 shadow-sm rounded-2xl dark:border-white/10">
                <CardContent className="p-0">
                  <div className="flex">
                    <div className={`w-1.5 shrink-0 ${tone.bar}`} aria-hidden />
                    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 className="text-base font-bold text-foreground">{pass.factory?.name || '—'}</h2>
                          <p className="mt-1 text-xs text-foreground-500">
                            ثبت: {formatDateTime(pass.createdAt) || '—'}
                            {pass.createdBy?.name ? ` · ${pass.createdBy.name}` : ''}
                            {pass.createdBy?.phoneNumber ? ` (${pass.createdBy.phoneNumber})` : ''}
                          </p>
                        </div>
                        <Chip color={tone.chip} size="sm" variant="soft" className="font-semibold gap-1">
                          <StatusIcon className="h-3.5 w-3.5" />
                          {statusLabels[pass.status] || pass.status}
                        </Chip>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <Detail icon={User} label="نام راننده">{pass.driverName}</Detail>
                        <Detail icon={IdCard} label="کد ملی راننده" mono>{pass.driverNationalId}</Detail>
                        <Detail icon={Phone} label="تلفن راننده" mono>{pass.driverPhone}</Detail>
                        <Detail icon={Car} label="پلاک" mono>{displayIranLicensePlate(pass.licensePlate)}</Detail>
                        <Detail icon={Truck} label="نوع خودرو">{labelFor(vehicleTypeLabels, pass.vehicleType)}</Detail>
                        <Detail icon={Package} label="نوع بار">{labelFor(cargoTypeLabels, pass.cargoType)}</Detail>
                        <Detail icon={CalendarClock} label="تاریخ خروج">{formatDate(pass.exitDate)}</Detail>
                        <Detail icon={Building2} label="واحد صنعتی">{pass.factory?.name}</Detail>
                        <Detail icon={FileText} label="شماره برگ" mono>{pass.id?.slice(-8).toUpperCase()}</Detail>
                        {pass.cargoDescription ? <Detail icon={Package} label="توضیحات بار" wide>{pass.cargoDescription}</Detail> : null}
                      </div>

                      {pass.licensePlatePhoto ? (
                        <div className="flex items-center gap-3 rounded-xl border border-default-100 p-2 dark:border-white/5">
                          <AuthenticatedImage
                            fileId={pass.licensePlatePhoto}
                            alt="تصویر پلاک"
                            className="h-16 w-28 rounded-lg object-cover"
                            fallback={<span className="text-xs text-foreground-400">تصویر پلاک در دسترس نیست</span>}
                          />
                          <span className="text-xs text-foreground-500">تصویر پلاک ثبت‌شده توسط واحد</span>
                        </div>
                      ) : null}

                      <div className="rounded-xl border border-default-100 px-3 py-3 dark:border-white/5">
                        <ReviewTimeline pass={pass} />
                      </div>

                      {pass.status === 'REJECTED' && pass.notes ? (
                        <p className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-800 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200">
                          <span className="font-semibold">{rejectionLabel(pass)}</span>
                          {pass.notes}
                        </p>
                      ) : null}

                      {awaitingMe ? (
                        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-default-100 pt-3 dark:border-white/5">
                          <Button
                            variant="secondary"
                            className="rounded-xl font-bold gap-2"
                            isDisabled={busy}
                            onPress={() => setRejectTarget(pass)}
                          >
                            <XCircle className="h-4 w-4" />
                            رد برگ خروج
                          </Button>
                          <Button
                            variant="primary"
                            className="rounded-xl font-bold gap-2"
                            isDisabled={busy}
                            onPress={() => setApproveTarget(pass)}
                          >
                            {approveMutation.isPending && approveTarget?.id === pass.id ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
                            تایید و ارسال به نگهبانی
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(approveTarget)}
        title="تایید برگ خروج"
        description={approveTarget
          ? `برگ خروج واحد «${approveTarget.factory?.name || ''}» برای راننده ${approveTarget.driverName} با پلاک ${displayIranLicensePlate(approveTarget.licensePlate)} تایید و برای نگهبانی ارسال می‌شود. ادامه می‌دهید؟`
          : ''}
        confirmLabel="تایید و ارسال"
        confirmColor="primary"
        loading={approveMutation.isPending}
        onConfirm={() => approveTarget && approveMutation.mutate(approveTarget.id)}
        onClose={() => setApproveTarget(null)}
      />
      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="رد برگ خروج"
        description="دلیل رد را بنویسید؛ این دلیل برای مدیر واحد صنعتی ارسال می‌شود تا برگ را اصلاح کند."
        requireReason
        reasonLabel="دلیل رد"
        confirmLabel="ثبت رد"
        confirmColor="danger"
        loading={rejectMutation.isPending}
        onConfirm={(reason) => rejectTarget && rejectMutation.mutate({ id: rejectTarget.id, reason })}
        onClose={() => setRejectTarget(null)}
      />
    </div>
  );
};

export default ApproveGatePassesPage;
