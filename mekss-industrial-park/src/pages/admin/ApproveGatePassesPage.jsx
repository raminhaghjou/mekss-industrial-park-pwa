import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card, CardContent, Chip, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription, Button, Input, Label,
} from '@heroui/react';
import { Ticket, CheckCircle2, XCircle, Clock3, User, Car, CalendarClock, Download } from 'lucide-react';
import { gatePassApi } from '../../services/api/gatePass.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { gatePassStatusLabels as statusLabels } from '../../constants/persianLabels';
import { displayIranLicensePlate } from '../../utils/iranLicensePlate';

const TABS = [
  {
    id: 'pending',
    label: 'در انتظار نگهبان',
    match: (status) => status === 'PENDING' || status === 'APPROVED',
    emptyTitle: 'برگ خروجی در انتظار تایید نگهبان نیست',
    emptyDescription: 'به محض ثبت برگ خروج توسط واحد صنعتی، اینجا نمایش داده می‌شود.',
  },
  {
    id: 'approved',
    label: 'تایید شده',
    match: (status) => status === 'COMPLETED',
    emptyTitle: 'خروج تایید‌شده‌ای نیست',
    emptyDescription: 'مواردی که نگهبان تایید کند در این بخش می‌آیند.',
  },
  {
    id: 'rejected',
    label: 'رد شده',
    match: (status) => status === 'REJECTED' || status === 'EXPIRED',
    emptyTitle: 'مورد رد‌شده‌ای نیست',
    emptyDescription: 'برگ‌های رد یا منقضی‌شده اینجا دیده می‌شوند.',
  },
];

const displayStatus = (status) => {
  if (status === 'COMPLETED') return 'تایید خروج';
  if (status === 'APPROVED') return 'آماده تایید نگهبان';
  return statusLabels[status] || status;
};

const statusTone = {
  PENDING: { chip: 'warning', bar: 'bg-warning-500', icon: Clock3 },
  APPROVED: { chip: 'accent', bar: 'bg-primary', icon: Clock3 },
  COMPLETED: { chip: 'success', bar: 'bg-success-500', icon: CheckCircle2 },
  REJECTED: { chip: 'danger', bar: 'bg-danger-500', icon: XCircle },
  EXPIRED: { chip: 'default', bar: 'bg-default-400', icon: Clock3 },
};

const exportCsv = (rows) => {
  const header = ['واحد', 'راننده', 'کدملی', 'پلاک', 'نوع بار', 'وضعیت', 'صادرکننده', 'نگهبان', 'زمان تایید'];
  const lines = rows.map((pass) => [
    pass.factory?.name || '',
    pass.driverName || '',
    pass.driverNationalId || '',
    pass.licensePlate || '',
    pass.cargoType || '',
    displayStatus(pass.status),
    pass.createdBy?.name || '',
    pass.verifiedBy?.name || '',
    pass.verifiedAt ? new Date(pass.verifiedAt).toLocaleString('fa-IR') : '',
  ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));
  const csv = `\uFEFF${[header.join(','), ...lines].join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `park-gate-passes-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

/** Park manager view-only list — no approve/reject actions. */
export const ApproveGatePassesPage = () => {
  const [tab, setTab] = useState('pending');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [plate, setPlate] = useState('');
  const [cargoType, setCargoType] = useState('');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['gate-passes', 'managed', fromDate, toDate, nationalId, plate, cargoType],
    queryFn: () => gatePassApi.getGatePasses({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      driverNationalId: nationalId || undefined,
      licensePlate: plate || undefined,
      cargoType: cargoType || undefined,
    }).then((res) => res.data),
    refetchOnMount: 'always',
  });

  const passes = data || [];
  const activeTab = TABS.find((item) => item.id === tab) || TABS[0];
  const counts = useMemo(() => ({
    pending: passes.filter((p) => TABS[0].match(p.status)).length,
    approved: passes.filter((p) => TABS[1].match(p.status)).length,
    rejected: passes.filter((p) => TABS[2].match(p.status)).length,
  }), [passes]);

  const filteredPasses = useMemo(() => (
    [...passes]
      .filter((p) => activeTab.match(p.status))
      .sort((a, b) => {
        const aTime = new Date(a.verifiedAt || a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.verifiedAt || b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      })
  ), [passes, activeTab]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">برگ‌های خروج</h1>
          <p className="text-sm text-foreground-500 mt-1">
            مشاهده وضعیت برگ‌های خروج — تایید فقط توسط نگهبان انجام می‌شود.
          </p>
        </div>
        <Button
          variant="tertiary"
          className="gap-2 rounded-xl"
          onPress={() => exportCsv(filteredPasses)}
          isDisabled={!filteredPasses.length}
        >
          <Download className="h-4 w-4" />
          خروجی / پرینت CSV
        </Button>
      </div>

      <Card className="rounded-2xl border border-default-200 dark:border-white/10">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">از تاریخ</Label>
            <Input type="date" dir="ltr" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-xl" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">تا تاریخ</Label>
            <Input type="date" dir="ltr" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-xl" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">کد ملی راننده</Label>
            <Input dir="ltr" value={nationalId} onChange={(e) => setNationalId(e.target.value.replace(/\D/g, '').slice(0, 10))} className="rounded-xl" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">پلاک</Label>
            <Input dir="ltr" value={plate} onChange={(e) => setPlate(e.target.value)} className="rounded-xl" />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">نوع بار</Label>
            <Input value={cargoType} onChange={(e) => setCargoType(e.target.value)} placeholder="RAW_MATERIALS..." className="rounded-xl" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-2xl border px-3 py-3 text-start transition ${
                active
                  ? 'border-primary bg-primary text-white shadow-md shadow-primary/20'
                  : 'border-default-200 bg-background text-foreground hover:bg-default-50 dark:border-white/10'
              }`}
            >
              <p className={`text-xs font-medium ${active ? 'text-white/80' : 'text-foreground-500'}`}>{item.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{(counts[item.id] || 0).toLocaleString('fa-IR')}</p>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
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
            const decisionAt = pass.verifiedAt || pass.updatedAt || pass.exitDate;
            return (
              <Card key={pass.id} className="overflow-hidden border border-default-200 shadow-sm rounded-2xl dark:border-white/10">
                <CardContent className="p-0">
                  <div className="flex">
                    <div className={`w-1.5 shrink-0 ${tone.bar}`} aria-hidden />
                    <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 className="text-base font-bold text-foreground">{pass.factory?.name || '—'}</h2>
                          <p className="mt-1 text-xs text-foreground-500">
                            {decisionAt ? new Date(decisionAt).toLocaleString('fa-IR') : '—'}
                          </p>
                          <p className="mt-1 text-xs text-foreground-500">
                            صادرکننده: {pass.createdBy?.name || '—'}
                            {pass.verifiedBy?.name ? ` · نگهبان: ${pass.verifiedBy.name}` : ''}
                          </p>
                        </div>
                        <Chip color={tone.chip} size="sm" variant="soft" className="font-semibold gap-1">
                          <StatusIcon className="h-3.5 w-3.5" />
                          {displayStatus(pass.status)}
                        </Chip>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="flex items-center gap-2 rounded-xl bg-default-50 px-3 py-2 text-sm dark:bg-white/5">
                          <User className="h-4 w-4 text-foreground-400" />
                          <span className="font-semibold">{pass.driverName}</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-default-50 px-3 py-2 text-sm dark:bg-white/5">
                          <Car className="h-4 w-4 text-foreground-400" />
                          <span className="font-mono font-semibold" dir="ltr">{displayIranLicensePlate(pass.licensePlate)}</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl bg-default-50 px-3 py-2 text-sm dark:bg-white/5">
                          <CalendarClock className="h-4 w-4 text-foreground-400" />
                          <span className="font-semibold">{new Date(pass.exitDate).toLocaleDateString('fa-IR')}</span>
                        </div>
                      </div>
                      {pass.notes ? (
                        <p className="rounded-xl border border-default-100 px-3 py-2 text-sm text-foreground-600 dark:border-white/5">
                          <span className="font-medium text-foreground">
                            {pass.status === 'REJECTED' ? 'دلیل رد: ' : 'یادداشت: '}
                          </span>
                          {pass.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApproveGatePassesPage;
