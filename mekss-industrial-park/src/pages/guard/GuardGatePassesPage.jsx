import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Button,
  Input,
  Spinner,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Label,
  Chip,
} from '@heroui/react';
import {
  Search,
  ShieldCheck,
  Eye,
  CheckCircle2,
  XCircle,
  Clock3,
  Building2,
  User,
  Car,
  CalendarClock,
} from 'lucide-react';
import { gatePassApi } from '../../services/api/gatePass.api';
import { getErrorMessage } from '../../utils/apiError';
import { EmptyState } from '../../components/common/EmptyState';
import { semanticFilter } from '../../utils/semanticSearch';
import { displayIranLicensePlate } from '../../utils/iranLicensePlate';
import { gatePassStatusLabels as statusLabels } from '../../constants/persianLabels';

const TABS = [
  {
    id: 'pending',
    label: 'در انتظار',
    match: (status) => status === 'PENDING' || status === 'APPROVED',
    emptyTitle: 'برگ خروجی در انتظار تایید نیست',
    emptyDescription: 'به محض ثبت برگ خروج توسط واحد صنعتی، اینجا نمایش داده می‌شود.',
  },
  {
    id: 'approved',
    label: 'تایید شده',
    match: (status) => status === 'COMPLETED',
    emptyTitle: 'هنوز خروجی تایید نشده',
    emptyDescription: 'برگ‌هایی که خروجشان را تایید کنید در این لیست می‌آیند.',
  },
  {
    id: 'rejected',
    label: 'رد شده',
    match: (status) => status === 'REJECTED' || status === 'EXPIRED',
    emptyTitle: 'مورد رد‌شده‌ای ثبت نشده',
    emptyDescription: 'برگ‌هایی که رد یا منقضی شوند اینجا نمایش داده می‌شوند.',
  },
];

const displayStatus = (status) => {
  if (status === 'COMPLETED') return 'تایید خروج';
  if (status === 'APPROVED') return 'آماده تایید نگهبان';
  return statusLabels[status] || status;
};

const statusTone = {
  PENDING: {
    chip: 'warning',
    bar: 'bg-warning-500',
    soft: 'bg-warning-50 text-warning-800 dark:bg-warning-950/40 dark:text-warning-200',
    icon: Clock3,
  },
  APPROVED: {
    chip: 'accent',
    bar: 'bg-primary',
    soft: 'bg-primary-50 text-primary-800 dark:bg-primary-950/40 dark:text-primary-200',
    icon: ShieldCheck,
  },
  COMPLETED: {
    chip: 'success',
    bar: 'bg-success-500',
    soft: 'bg-success-50 text-success-800 dark:bg-success-950/40 dark:text-success-200',
    icon: CheckCircle2,
  },
  REJECTED: {
    chip: 'danger',
    bar: 'bg-danger-500',
    soft: 'bg-danger-50 text-danger-800 dark:bg-danger-950/40 dark:text-danger-200',
    icon: XCircle,
  },
  EXPIRED: {
    chip: 'default',
    bar: 'bg-default-400',
    soft: 'bg-default-100 text-foreground-600 dark:bg-white/10',
    icon: Clock3,
  },
};

const GuardGatePassesPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [tab, setTab] = React.useState('pending');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['gate-passes', 'guard'],
    queryFn: () => gatePassApi.getGatePasses().then((res) => res.data),
    refetchOnMount: 'always',
  });

  const list = data || [];

  const counts = React.useMemo(() => ({
    pending: list.filter((pass) => TABS[0].match(pass.status)).length,
    approved: list.filter((pass) => TABS[1].match(pass.status)).length,
    rejected: list.filter((pass) => TABS[2].match(pass.status)).length,
  }), [list]);

  const activeTab = TABS.find((item) => item.id === tab) || TABS[0];

  const filteredPasses = React.useMemo(() => {
    const byTab = list.filter((pass) => activeTab.match(pass.status));
    const sorted = [...byTab].sort((a, b) => {
      const aTime = new Date(a.verifiedAt || a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.verifiedAt || b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
    return semanticFilter(sorted, search, (pass) => [
      pass.licensePlate,
      displayIranLicensePlate(pass.licensePlate),
      pass.id,
      pass.driverName,
      pass.factory?.name,
      pass.cargoType,
      pass.notes,
      displayStatus(pass.status),
      statusLabels[pass.status],
      'مجوز',
      'پلاک',
      'تایید',
      'رد',
    ]);
  }, [list, search, activeTab]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="page-toolbar">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">تایید برگ‌های خروج</h1>
          <p className="mt-1 text-sm text-foreground-500">
            صف انتظار، موارد تایید‌شده و رد‌شده را جدا ببینید.
          </p>
        </div>
      </div>

      <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10">
        <CardContent className="p-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-foreground-600">جست‌وجو</Label>
            <div className="relative flex items-center">
              <Search className="absolute right-3 h-4 w-4 text-default-400 pointer-events-none" />
              <Input
                placeholder="پلاک، راننده، واحد صنعتی یا دلیل رد..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                variant="primary"
                className="pr-9 rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {TABS.map((item) => {
          const active = tab === item.id;
          const count = counts[item.id] || 0;
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
              <p className="mt-1 text-xl font-bold tabular-nums">{count.toLocaleString('fa-IR')}</p>
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="flex min-h-[220px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {isError && (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{getErrorMessage(error, 'دریافت برگ‌های خروج ناموفق بود.')}</AlertDescription>
            <Button size="sm" variant="secondary" className="mt-2 rounded-xl" onPress={() => refetch()} isDisabled={isFetching}>
              تلاش دوباره
            </Button>
          </AlertContent>
        </Alert>
      )}

      {!isLoading && !isError && filteredPasses.length === 0 && (
        <Card className="border border-default-200 dark:border-white/10">
          <CardContent>
            <EmptyState
              icon={<ShieldCheck className="h-6 w-6" />}
              title={activeTab.emptyTitle}
              description={activeTab.emptyDescription}
            />
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && filteredPasses.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredPasses.map((pass) => {
            const tone = statusTone[pass.status] || statusTone.PENDING;
            const StatusIcon = tone.icon;
            const decisionAt = pass.verifiedAt || pass.updatedAt || pass.exitDate;
            const pending = tab === 'pending';
            return (
              <Card
                key={pass.id}
                className="overflow-hidden border border-default-200 shadow-sm rounded-2xl dark:border-white/10"
              >
                <CardContent className="p-0">
                  <div className="flex">
                    <div className={`w-1.5 shrink-0 ${tone.bar}`} aria-hidden />
                    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-bold text-foreground">{pass.factory?.name || 'واحد صنعتی'}</h2>
                            <Chip color={tone.chip} size="sm" variant="soft" className="font-semibold">
                              {displayStatus(pass.status)}
                            </Chip>
                          </div>
                          <p className="mt-1 text-xs text-foreground-500">
                            {decisionAt ? new Date(decisionAt).toLocaleString('fa-IR') : '—'}
                          </p>
                        </div>
                        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone.soft}`}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {pending ? 'نیاز به بررسی' : displayStatus(pass.status)}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="flex items-start gap-2 rounded-xl bg-default-50 px-3 py-2.5 dark:bg-white/5">
                          <User className="mt-0.5 h-4 w-4 shrink-0 text-foreground-400" />
                          <div className="min-w-0">
                            <p className="text-[11px] text-foreground-500">راننده</p>
                            <p className="truncate text-sm font-semibold text-foreground">{pass.driverName || '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 rounded-xl bg-default-50 px-3 py-2.5 dark:bg-white/5">
                          <Car className="mt-0.5 h-4 w-4 shrink-0 text-foreground-400" />
                          <div className="min-w-0">
                            <p className="text-[11px] text-foreground-500">پلاک</p>
                            <p className="truncate font-mono text-sm font-semibold text-foreground" dir="ltr">
                              {displayIranLicensePlate(pass.licensePlate)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 rounded-xl bg-default-50 px-3 py-2.5 dark:bg-white/5">
                          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-foreground-400" />
                          <div className="min-w-0">
                            <p className="text-[11px] text-foreground-500">تاریخ خروج</p>
                            <p className="truncate text-sm font-semibold text-foreground">
                              {pass.exitDate ? new Date(pass.exitDate).toLocaleString('fa-IR') : '—'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {(pass.cargoDescription || pass.notes) && (
                        <div className="rounded-xl border border-default-100 bg-background px-3 py-2.5 text-sm text-foreground-600 dark:border-white/5">
                          {pass.cargoDescription ? (
                            <p className="line-clamp-2">
                              <span className="font-medium text-foreground">بار: </span>
                              {pass.cargoDescription}
                            </p>
                          ) : null}
                          {pass.notes ? (
                            <p className={`${pass.cargoDescription ? 'mt-1.5' : ''} line-clamp-2`}>
                              <span className="font-medium text-foreground">
                                {pass.status === 'REJECTED' ? 'دلیل رد: ' : 'یادداشت: '}
                              </span>
                              {pass.notes}
                            </p>
                          ) : null}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-foreground-400">
                          <Building2 className="h-3.5 w-3.5" />
                          {pass.verifiedBy?.name
                            ? `رسیدگی‌کننده: ${pass.verifiedBy.name}`
                            : pending
                              ? 'هنوز رسیدگی نشده'
                              : '—'}
                        </div>
                        <Button
                          size="sm"
                          variant={pending ? 'primary' : 'secondary'}
                          onPress={() => navigate(`/guard/gate-passes/${pass.id}/verify`)}
                          className="rounded-xl font-bold flex items-center gap-2"
                        >
                          {pending ? <ShieldCheck className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {pending ? 'بررسی و تایید خروج' : 'مشاهده جزئیات'}
                        </Button>
                      </div>
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

export default GuardGatePassesPage;
