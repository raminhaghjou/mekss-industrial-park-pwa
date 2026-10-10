import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Button,
  Input,
  Label,
  Chip,
  Select,
  SelectTrigger,
  SelectValue,
  SelectIndicator,
  SelectPopover,
  ListBox,
  ListBoxItem,
  Skeleton,
  Alert,
  AlertContent,
  AlertTitle,
  AlertDescription,
  Spinner,
} from '@heroui/react';
import {
  Wallet,
  CreditCard,
  ShieldCheck,
  Ticket,
  TrendingUp,
  History,
  CheckCircle2,
  XCircle,
  Clock3,
  Ban,
  Landmark,
  Sparkles,
  X,
} from 'lucide-react';
import { factoryApi } from '../../services/api/factory.api';
import { useAuth } from '../../providers/AuthProvider';
import { useActiveFactory } from '../../providers/ActiveFactoryProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';
import { amountInputToNumber, formatAmountInput } from '../../utils/amountFormat';
import { numberToPersianWords } from '../../utils/persianWords';
import { useGatePassWallet } from '../../hooks/useGatePassWallet';
import { EmptyState } from '../../components/common/EmptyState';

const formatMoney = (value) => Number(value || 0).toLocaleString('fa-IR', { maximumFractionDigits: 0 });
const formatDateTime = (value) => (value
  ? new Date(value).toLocaleString('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short' })
  : '—');

const PRESET_AMOUNTS = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000];
const DEFAULT_MIN = 10_000;
const DEFAULT_MAX = 2_000_000_000;

const TOP_UP_STATUS = {
  VERIFIED: { label: 'موفق', color: 'success', icon: CheckCircle2 },
  INITIATED: { label: 'در انتظار پرداخت', color: 'warning', icon: Clock3 },
  FAILED: { label: 'ناموفق', color: 'danger', icon: XCircle },
  CANCELLED: { label: 'لغو شده', color: 'default', icon: Ban },
};

const StatTile = ({ icon, label, value, hint }) => {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-white/75">{label}</p>
        <p className="truncate text-base font-bold tabular-nums">{value}</p>
        {hint ? <p className="text-[10px] text-white/65">{hint}</p> : null}
      </div>
    </div>
  );
};

export const FactoryWalletPage = () => {
  const { user } = useAuth();
  const { activeFactoryId, activeFactory, factories } = useActiveFactory();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const isStaff = ['SUPER_ADMIN', 'PARK_MANAGER'].includes(user?.role);
  const { setting: walletSetting, walletRequired } = useGatePassWallet(user?.role);
  const paramFactoryId = searchParams.get('factoryId') || '';
  const [managerFactoryId, setManagerFactoryId] = useState(paramFactoryId);
  const [amount, setAmount] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [managedFactories, setManagedFactories] = useState([]);
  const [result, setResult] = useState(() => {
    const topup = searchParams.get('topup');
    if (topup !== 'success' && topup !== 'failed') return null;
    return { status: topup, amount: Number(searchParams.get('amount') || 0), ref: searchParams.get('ref') || '' };
  });

  const factoryId = isStaff ? (managerFactoryId || paramFactoryId) : (paramFactoryId && factories.some((f) => f.id === paramFactoryId) ? paramFactoryId : activeFactoryId);

  useEffect(() => {
    if (!searchParams.get('topup')) return;
    const next = new URLSearchParams(searchParams);
    ['topup', 'amount', 'ref'].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
    queryClient.invalidateQueries({ queryKey: ['factory-wallet'] });
  }, [searchParams, setSearchParams, queryClient]);

  const managedQuery = useQuery({
    queryKey: ['factories', 'wallet-scope'],
    queryFn: async () => {
      const res = await factoryApi.getManagedFactories({ page: 1, pageSize: 100 });
      const items = res.data?.items || res.data || [];
      setManagedFactories(items);
      if (!managerFactoryId && (paramFactoryId || items[0]?.id)) {
        setManagerFactoryId(paramFactoryId || items[0].id);
      }
      return items;
    },
    enabled: isStaff,
  });

  const { data: wallet, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['factory-wallet', factoryId],
    queryFn: () => factoryApi.getWallet(factoryId).then((res) => res.data),
    enabled: Boolean(factoryId),
  });

  const minTopUp = Number(wallet?.minTopUp || DEFAULT_MIN);
  const maxTopUp = Number(wallet?.maxTopUp || DEFAULT_MAX);
  const fee = Number(wallet?.fee || 0);
  const balance = Number(wallet?.balance || 0);
  const amountValue = amountInputToNumber(amount);
  const amountError = !amount
    ? ''
    : !Number.isInteger(amountValue) || amountValue < minTopUp
      ? `حداقل مبلغ شارژ ${formatMoney(minTopUp)} ریال است.`
      : amountValue > maxTopUp
        ? `حداکثر مبلغ هر پرداخت ${formatMoney(maxTopUp)} ریال است.`
        : '';
  const amountValid = Boolean(amount) && !amountError;

  const preview = useMemo(() => {
    if (!amountValid) return null;
    const after = balance + amountValue;
    return {
      after,
      passesAdded: fee > 0 ? Math.floor(amountValue / fee) : null,
      passesAfter: fee > 0 ? Math.floor(after / fee) : null,
    };
  }, [amountValid, amountValue, balance, fee]);

  const payMutation = useMutation({
    mutationFn: (value) => factoryApi.startWalletPayment(factoryId, value).then((res) => res.data),
    onSuccess: (data) => {
      if (!data?.paymentUrl) {
        showNotification('آدرس درگاه پرداخت دریافت نشد.', 'error');
        return;
      }
      showNotification('در حال انتقال به درگاه پرداخت...', 'info');
      window.location.assign(data.paymentUrl);
    },
    onError: (err) => showNotification(getErrorMessage(err, 'اتصال به درگاه پرداخت ناموفق بود'), 'error'),
  });

  const manualMutation = useMutation({
    mutationFn: (value) => factoryApi.topUpWallet(factoryId, value),
    onSuccess: () => {
      showNotification('شارژ دستی کیف پول ثبت شد و به مدیر واحد اطلاع داده شد.', 'success');
      setManualAmount('');
      queryClient.invalidateQueries({ queryKey: ['factory-wallet', factoryId] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'شارژ کیف پول ناموفق بود'), 'error'),
  });

  const topUps = wallet?.topUps || [];
  const lastSuccess = topUps.find((row) => row.status === 'VERIFIED');
  const factoryName = wallet?.name || activeFactory?.name || '';
  const manualValue = amountInputToNumber(manualAmount);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">کیف پول برگ خروج</h1>
          <p className="mt-1 text-sm text-foreground-500">
            موجودی را آنلاین و به هر مبلغ دلخواه شارژ کنید؛ هزینه صدور هر برگ خروج از همین کیف پول کسر می‌شود.
          </p>
        </div>
        {wallet?.paymentProvider === 'mock' ? (
          <Chip size="sm" variant="soft" color="warning" className="font-semibold">درگاه آزمایشی</Chip>
        ) : null}
      </div>

      {result && (
        <div
          role="status"
          className={`relative flex items-start gap-3 rounded-2xl border p-4 ${
            result.status === 'success'
              ? 'border-success-200 bg-success-50 text-success-800 dark:border-success-900 dark:bg-success-950/30 dark:text-success-200'
              : 'border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200'
          }`}
        >
          {result.status === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" />}
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-bold">
              {result.status === 'success' ? 'پرداخت موفق بود و کیف پول شارژ شد' : 'پرداخت انجام نشد'}
            </p>
            <p className="mt-1 leading-6">
              {result.status === 'success'
                ? `مبلغ ${formatMoney(result.amount)} ریال به موجودی اضافه شد.${result.ref ? ` کد پیگیری: ${result.ref}` : ''}`
                : 'پرداخت لغو شد یا تایید نشد. اگر مبلغی از حساب شما کسر شده باشد، حداکثر ظرف ۷۲ ساعت توسط بانک بازگردانده می‌شود.'}
            </p>
          </div>
          <button type="button" aria-label="بستن" className="rounded-lg p-1 opacity-70 hover:opacity-100" onClick={() => setResult(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {walletSetting && !walletRequired && (
        <Alert status="accent">
          <AlertContent>
            <AlertTitle>کسر هزینه برگ خروج فعلاً غیرفعال است</AlertTitle>
            <AlertDescription>برگ خروج در حال حاضر بدون کسر هزینه ثبت می‌شود. موجودی شارژشده محفوظ می‌ماند و پس از فعال‌شدن، از همین کیف پول کسر خواهد شد.</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {isStaff && (
        <div className="flex flex-col gap-1 sm:max-w-sm">
          <Label className="text-xs">انتخاب واحد صنعتی</Label>
          <Select
            value={factoryId}
            onChange={(val) => setManagerFactoryId(String(val || ''))}
            isDisabled={managedQuery.isLoading}
            className="rounded-xl"
            placeholder="واحد صنعتی"
          >
            <SelectTrigger><SelectValue /><SelectIndicator /></SelectTrigger>
            <SelectPopover>
              <ListBox>
                {(managedFactories.length ? managedFactories : managedQuery.data || []).map((factory) => (
                  <ListBoxItem key={factory.id} id={factory.id}>{factory.name}</ListBoxItem>
                ))}
              </ListBox>
            </SelectPopover>
          </Select>
        </div>
      )}

      {!isStaff && !activeFactory && factories.length === 0 && (
        <Alert status="warning">
          <AlertContent>
            <AlertTitle>واحدی یافت نشد</AlertTitle>
            <AlertDescription>برای مشاهده کیف پول ابتدا واحد صنعتی ثبت کنید.</AlertDescription>
          </AlertContent>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <Skeleton className="h-56 rounded-3xl lg:col-span-5" />
          <Skeleton className="h-80 rounded-3xl lg:col-span-3" />
          <Skeleton className="h-80 rounded-3xl lg:col-span-2" />
        </div>
      ) : isError ? (
        <Alert status="danger">
          <AlertContent>
            <AlertTitle>خطا</AlertTitle>
            <AlertDescription>{getErrorMessage(error, 'دریافت موجودی ناموفق بود')}</AlertDescription>
            <Button size="sm" variant="secondary" className="mt-2 rounded-xl" onPress={() => refetch()}>تلاش دوباره</Button>
          </AlertContent>
        </Alert>
      ) : wallet ? (
        <>
          <div
            className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg sm:p-8"
            style={{
              backgroundColor: 'var(--color-brand)',
              backgroundImage: 'linear-gradient(135deg, var(--color-brand) 0%, color-mix(in srgb, var(--color-brand) 55%, #0f172a) 100%)',
            }}
          >
            <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-20 right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <div className="relative flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                    <Wallet className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-sm text-white/80">موجودی کیف پول</p>
                    <p className="text-lg font-semibold">{factoryName}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {walletRequired ? 'فعال برای صدور برگ خروج' : 'ذخیره برای برگ‌های آینده'}
                </span>
              </div>
              <div>
                <p className="text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">
                  {formatMoney(balance)}
                  <span className="ms-2 text-base font-medium text-white/80">ریال</span>
                </p>
                <p className="mt-1 text-sm text-white/75">معادل {formatMoney(Math.floor(balance / 10))} تومان</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile icon={Ticket} label="هزینه هر برگ خروج" value={fee > 0 ? `${formatMoney(fee)} ریال` : 'رایگان'} />
                <StatTile
                  icon={TrendingUp}
                  label="برگ خروج قابل صدور"
                  value={wallet.passesRemaining === null || wallet.passesRemaining === undefined ? 'نامحدود' : `${formatMoney(wallet.passesRemaining)} برگ`}
                />
                <StatTile
                  icon={History}
                  label="آخرین شارژ موفق"
                  value={lastSuccess ? `${formatMoney(lastSuccess.amount)} ریال` : '—'}
                  hint={lastSuccess ? formatDateTime(lastSuccess.verifiedAt || lastSuccess.createdAt) : undefined}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="rounded-3xl border border-default-200 shadow-sm lg:col-span-3 dark:border-white/10">
              <CardContent className="gap-5 p-5 sm:p-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
                    <CreditCard className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-bold">شارژ آنلاین کیف پول</h2>
                    <p className="text-xs text-foreground-500">مبلغ دلخواه را انتخاب یا وارد کنید و از درگاه امن بانکی پرداخت کنید.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PRESET_AMOUNTS.filter((preset) => preset >= minTopUp && preset <= maxTopUp).map((preset) => {
                    const active = amountValue === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(formatAmountInput(String(preset)))}
                        className={`rounded-2xl border px-3 py-3 text-start transition ${
                          active
                            ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] ring-2 ring-[var(--color-brand)]/30'
                            : 'border-default-200 hover:border-[var(--color-brand)] hover:bg-default-50 dark:border-white/10'
                        }`}
                      >
                        <p className="text-sm font-bold tabular-nums">{formatMoney(preset)} <span className="text-[11px] font-medium text-foreground-500">ریال</span></p>
                        <p className="mt-0.5 text-[11px] text-foreground-500">
                          {fee > 0 ? `≈ ${formatMoney(Math.floor(preset / fee))} برگ خروج` : `${formatMoney(preset / 10)} تومان`}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="wallet-amount" className="text-xs font-semibold">مبلغ دلخواه (ریال)</Label>
                  <div className="relative">
                    <Input
                      id="wallet-amount"
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      value={amount}
                      onChange={(e) => setAmount(formatAmountInput(e.target.value))}
                      className="h-12 w-full rounded-xl pe-16 text-lg font-bold tabular-nums"
                      placeholder="مثلاً 3/000/000"
                    />
                    <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-foreground-400">ریال</span>
                  </div>
                  {amountError ? (
                    <p className="text-[11px] text-danger-600">{amountError}</p>
                  ) : amountValid ? (
                    <p className="text-[11px] leading-5 text-foreground-500">
                      {numberToPersianWords(amountValue)} ریال · معادل {formatMoney(Math.floor(amountValue / 10))} تومان
                    </p>
                  ) : (
                    <p className="text-[11px] text-foreground-500">
                      حداقل {formatMoney(minTopUp)} و حداکثر {formatMoney(maxTopUp)} ریال در هر پرداخت
                    </p>
                  )}
                </div>

                {preview && (
                  <div className="grid gap-2 rounded-2xl border border-default-100 bg-default-50 p-4 text-sm dark:border-white/5 dark:bg-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-500">مبلغ قابل پرداخت</span>
                      <span className="font-bold tabular-nums">{formatMoney(amountValue)} ریال</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-500">موجودی پس از شارژ</span>
                      <span className="font-bold tabular-nums text-success-700 dark:text-success-300">{formatMoney(preview.after)} ریال</span>
                    </div>
                    {preview.passesAfter !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-foreground-500">برگ خروج قابل صدور پس از شارژ</span>
                        <span className="font-bold tabular-nums">{formatMoney(preview.passesAfter)} برگ</span>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  variant="primary"
                  className="h-12 w-full rounded-2xl text-base font-bold shadow-md shadow-primary/20"
                  isDisabled={!amountValid || payMutation.isPending || !factoryId}
                  onPress={() => payMutation.mutate(amountValue)}
                >
                  {payMutation.isPending ? <Spinner size="sm" /> : (
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      {amountValid ? `پرداخت ${formatMoney(amountValue)} ریال و شارژ` : 'پرداخت و شارژ کیف پول'}
                    </span>
                  )}
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-foreground-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-success-600" />
                  پرداخت از طریق درگاه امن شاپرک انجام می‌شود و پس از تایید بانک، موجودی بلافاصله افزایش می‌یابد.
                </p>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4 lg:col-span-2">
              {isStaff && (
                <Card className="rounded-3xl border border-default-200 shadow-sm dark:border-white/10">
                  <CardContent className="gap-3 p-5">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-5 w-5 text-[var(--color-brand)]" />
                      <h2 className="font-bold">شارژ دستی (مدیریت)</h2>
                    </div>
                    <p className="text-[11px] leading-5 text-foreground-500">
                      برای مبالغی که نقدی یا با واریز بانکی دریافت شده‌اند. در تاریخچه با عنوان «دستی» ثبت و به مدیر واحد اطلاع داده می‌شود.
                    </p>
                    <Input
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      aria-label="مبلغ شارژ دستی (ریال)"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(formatAmountInput(e.target.value))}
                      className="rounded-xl font-mono"
                      placeholder="مبلغ به ریال"
                    />
                    <Button
                      variant="secondary"
                      className="rounded-xl font-bold"
                      isDisabled={!(manualValue > 0) || manualMutation.isPending || !factoryId}
                      onPress={() => manualMutation.mutate(manualValue)}
                    >
                      {manualMutation.isPending ? <Spinner size="sm" /> : 'ثبت شارژ دستی'}
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card className="rounded-3xl border border-default-200 shadow-sm dark:border-white/10">
                <CardContent className="gap-3 p-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[var(--color-brand)]" />
                    <h2 className="font-bold">راهنمای کیف پول</h2>
                  </div>
                  <ul className="flex flex-col gap-2 text-[12px] leading-6 text-foreground-600">
                    <li>• با هر برگ خروج ثبت‌شده، {fee > 0 ? `${formatMoney(fee)} ریال` : 'هزینه تعیین‌شده'} از موجودی کسر می‌شود.</li>
                    <li>• اگر موجودی کافی نباشد، ثبت برگ خروج تا شارژ مجدد امکان‌پذیر نیست.</li>
                    <li>• پس از پرداخت موفق، رسید با کد پیگیری در تاریخچه و پیامک برای شما ثبت می‌شود.</li>
                    <li>• پرداخت ناموفق هیچ تغییری در موجودی ایجاد نمی‌کند.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="rounded-3xl border border-default-200 shadow-sm dark:border-white/10">
            <CardContent className="gap-4 p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-[var(--color-brand)]" />
                <h2 className="font-bold">تاریخچه شارژ</h2>
              </div>
              {topUps.length === 0 ? (
                <EmptyState
                  icon={<Wallet className="h-6 w-6" />}
                  title="هنوز شارژی ثبت نشده"
                  description="پس از اولین شارژ، رسید آن با مبلغ، تاریخ و کد پیگیری در اینجا نمایش داده می‌شود."
                />
              ) : (
                <ul className="divide-y divide-default-100 dark:divide-white/5">
                  {topUps.map((row) => {
                    const tone = TOP_UP_STATUS[row.status] || TOP_UP_STATUS.INITIATED;
                    const ToneIcon = tone.icon;
                    return (
                      <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            row.status === 'VERIFIED' ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300' : 'bg-default-100 text-foreground-500 dark:bg-white/10'
                          }`}
                          >
                            {row.method === 'MANUAL' ? <Landmark className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold tabular-nums">
                              {row.status === 'VERIFIED' ? '+' : ''}{formatMoney(row.amount)} <span className="text-[11px] font-medium text-foreground-500">ریال</span>
                            </p>
                            <p className="truncate text-[11px] text-foreground-500">
                              {row.method === 'MANUAL' ? 'شارژ دستی' : 'پرداخت آنلاین'}
                              {' · '}
                              {formatDateTime(row.verifiedAt || row.createdAt)}
                              {row.initiatedBy?.name ? ` · ${row.initiatedBy.name}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Chip size="sm" variant="soft" color={tone.color} className="gap-1 font-semibold">
                            <ToneIcon className="h-3.5 w-3.5" />
                            {tone.label}
                          </Chip>
                          {row.referenceId ? (
                            <span className="font-mono text-[10px] text-foreground-400" dir="ltr">Ref: {row.referenceId}</span>
                          ) : row.balanceAfter !== null && row.balanceAfter !== undefined ? (
                            <span className="text-[10px] text-foreground-400">موجودی پس از شارژ: {formatMoney(row.balanceAfter)}</span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
};

export default FactoryWalletPage;
