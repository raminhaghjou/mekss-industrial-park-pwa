import { useMemo, useState } from 'react';
import { toJalaali } from 'jalaali-js';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, Button, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription, Spinner } from '@heroui/react';
import {
  Building2,
  Ticket,
  Receipt,
  FileText,
  AlertTriangle,
  Megaphone,
  ChevronLeft,
  ShieldCheck,
  ScanLine,
  Users,
  LineChart,
  MessageSquare,
  Bell,
  Landmark,
  Ban,
  CalendarDays,
  Flame,
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { analyticsApi } from '../../services/api/analytics.api';
import { announcementApi } from '../../services/api/announcement.api';
import { messageApi } from '../../services/api/message.api';
import { getErrorMessage } from '../../utils/apiError';
import { HomeFeedSlider } from '../../components/dashboard/HomeFeedSlider';
import { BannerCarousel } from '../../components/dashboard/BannerCarousel';
import { GatePassWalletSettingCard } from '../../components/settings/GatePassWalletSettingCard';
import { FeaturedServices } from '../../components/home/FeaturedServices';
import { ServiceGrid } from '../../components/home/ServiceGrid';
import { ServiceSearch } from '../../components/home/ServiceSearch';
import { JALALI_MONTHS, JALALI_WEEKDAYS, toFaDigits } from '../../utils/jalali';
import { publicApi } from '../../services/api/public.api';
import { invoiceDueInfo } from '../../utils/invoiceDue';
import { useGatePassWallet } from '../../hooks/useGatePassWallet';
import { roleLabels } from '../../constants/persianLabels';
import { featuredServicesForRole, searchServices, servicesForRole } from '../../constants/appServices';

const FIRE_ROLES = ['FACTORY_OWNER', 'PARK_MANAGER', 'SECURITY_GUARD'];

const colorMap = {
  primary: 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  danger: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  secondary: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
};

const StatCard = ({ icon, label, value, color = 'primary', onClick, badge = null }) => {
  const Icon = icon;
  const displayValue = typeof value === 'number' ? value.toLocaleString('fa-IR') : (value ?? '—');

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-[10.5rem] snap-start items-center gap-3 rounded-2xl bg-content1 p-3 text-start ring-1 ring-default-200/70 transition hover:ring-[var(--color-brand)]/40 active:scale-[0.98] motion-reduce:transform-none sm:min-w-0 dark:ring-white/10"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colorMap[color]}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg font-bold leading-6 text-foreground tabular-nums">{displayValue}</span>
        <span className="truncate text-xs text-foreground-500">{label}</span>
        {badge && <span className="mt-0.5 truncate text-[11px] font-medium text-amber-600 dark:text-amber-300">{badge}</span>}
      </span>
    </button>
  );
};

const buildRoleStats = (role, data, navigate) => {
  const pendingPasses = data?.pendingWork?.gatePasses || 0;
  const pendingRequests = data?.pendingWork?.requests || 0;
  const pendingAds = data?.pendingWork?.advertisements || 0;
  const openEmergencies = data?.openEmergencies || 0;
  const pendingLabel = (count, suffix = 'در انتظار') => (count ? `${count.toLocaleString('fa-IR')} ${suffix}` : undefined);

  const stats = {
    SECURITY_GUARD: [
      { icon: ShieldCheck, label: 'برگ خروج در انتظار', value: pendingPasses, color: 'success', onClick: () => navigate('/guard/gate-passes') },
      { icon: Ticket, label: 'کل برگ‌های خروج', value: data?.gatePasses ?? 0, color: 'primary', onClick: () => navigate('/guard/gate-passes') },
      { icon: AlertTriangle, label: 'هشدار اضطراری باز', value: openEmergencies, color: 'danger', onClick: () => navigate('/emergency') },
      { icon: ScanLine, label: 'اسکن QR', value: 'آماده', color: 'secondary', onClick: () => navigate('/guard/scan') },
    ],
    FACTORY_OWNER: [
      { icon: Receipt, label: 'قبض‌ها', value: data?.invoices ?? 0, color: 'warning', onClick: () => navigate('/invoices') },
      { icon: Ticket, label: 'برگ‌های خروج', value: data?.gatePasses ?? 0, color: 'success', badge: pendingLabel(pendingPasses), onClick: () => navigate('/gate-passes') },
      { icon: FileText, label: 'درخواست‌ها', value: data?.requests ?? 0, color: 'secondary', badge: pendingLabel(pendingRequests), onClick: () => navigate('/requests') },
      { icon: Building2, label: 'واحدهای صنعتی', value: data?.factories ?? 0, color: 'primary', onClick: () => navigate('/factory/register') },
    ],
    PARK_MANAGER: [
      { icon: Building2, label: 'واحدهای صنعتی', value: data?.factories ?? 0, color: 'primary', onClick: () => navigate('/admin/factories') },
      {
        icon: Receipt,
        label: 'بدهی واحدها (ریال)',
        value: Number(data?.unitsUnpaidInvoiceTotal || 0).toLocaleString('fa-IR'),
        color: 'danger',
        badge: pendingLabel(Number(data?.unitsWithDebtCount || 0), 'واحد بدهکار'),
        onClick: () => navigate('/admin/finance'),
      },
      { icon: Ticket, label: 'برگ‌های خروج', value: data?.gatePasses ?? 0, color: 'success', badge: pendingLabel(pendingPasses, 'در انتظار تایید شما'), onClick: () => navigate('/admin/gate-passes') },
      { icon: FileText, label: 'درخواست‌ها', value: data?.requests ?? 0, color: 'warning', badge: pendingLabel(pendingRequests), onClick: () => navigate('/admin/requests') },
    ],
    SUPER_ADMIN: [
      { icon: Landmark, label: 'شهرک‌ها / واحدها', value: data?.factories ?? 0, color: 'primary', onClick: () => navigate('/superadmin/parks') },
      { icon: Users, label: 'کاربران و دسترسی', value: data?.requests ?? 0, color: 'secondary', onClick: () => navigate('/superadmin/users') },
      { icon: Megaphone, label: 'آگهی در انتظار', value: pendingAds, color: 'warning', onClick: () => navigate('/superadmin/advertisements') },
      { icon: AlertTriangle, label: 'هشدار اضطراری باز', value: openEmergencies, color: 'danger', onClick: () => navigate('/emergency') },
    ],
    GOVERNMENT_OFFICIAL: [
      { icon: Building2, label: 'واحدهای صنعتی', value: data?.factories ?? 0, color: 'primary', onClick: () => navigate('/admin/reports') },
      { icon: Ticket, label: 'برگ‌های خروج', value: data?.gatePasses ?? 0, color: 'success', onClick: () => navigate('/admin/reports') },
      { icon: LineChart, label: 'نرخ بازار', value: '—', color: 'secondary', onClick: () => navigate('/market-rates') },
      { icon: Bell, label: 'اطلاعیه‌ها', value: '—', color: 'warning', onClick: () => navigate('/announcements') },
    ],
    EMPLOYEE: [
      { icon: FileText, label: 'درخواست‌های من', value: data?.requests ?? 0, color: 'warning', onClick: () => navigate('/requests') },
      { icon: MessageSquare, label: 'پیام‌ها', value: '—', color: 'primary', onClick: () => navigate('/messages') },
      { icon: Bell, label: 'اطلاعیه‌ها', value: '—', color: 'secondary', onClick: () => navigate('/announcements') },
      { icon: AlertTriangle, label: 'هشدار اضطراری', value: openEmergencies, color: 'danger', onClick: () => navigate('/emergency') },
    ],
  };

  return stats[role] || stats.EMPLOYEE;
};

const greetingForHour = (hour) => {
  if (hour < 5) return 'شب بخیر';
  if (hour < 12) return 'صبح بخیر';
  if (hour < 17) return 'روز بخیر';
  return 'عصر بخیر';
};

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => analyticsApi.getDashboardData().then((res) => res.data),
  });

  const { data: unreadData } = useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: () => messageApi.getUnreadCount().then((res) => res.data),
    refetchInterval: 30_000,
    enabled: Boolean(user),
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements', 'feed'],
    queryFn: () => announcementApi.getAnnouncements().then((res) => res.data),
  });

  const { data: featuredAds = [] } = useQuery({
    queryKey: ['advertisements', 'featured-public'],
    queryFn: () => publicApi.getFeaturedAdvertisements().then((res) => res.data),
  });

  const jalaliToday = useMemo(() => {
    const j = toJalaali(new Date());
    const weekday = JALALI_WEEKDAYS[(new Date().getDay() + 1) % 7];
    return `${weekday} ${toFaDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${toFaDigits(j.jy)}`;
  }, []);
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  const announcementsHref = user?.role === 'PARK_MANAGER' || user?.role === 'SUPER_ADMIN'
    ? '/admin/announcements'
    : '/announcements';

  const feedItems = useMemo(() => (
    (featuredAds || []).slice(0, 6).map((item) => ({
      id: `ad-${item.id}`,
      kind: 'ad',
      title: item.title,
      body: item.content,
      href: '/ads',
    }))
  ), [featuredAds]);

  const featuredAnnouncements = useMemo(() => {
    return [...(announcements || [])]
      .sort((a, b) => {
        const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
        if (pinDiff !== 0) return pinDiff;
        return Number(b.priority || 0) - Number(a.priority || 0);
      })
      .slice(0, 3);
  }, [announcements]);

  const { showWalletUi } = useGatePassWallet(user?.role);
  const services = useMemo(() => servicesForRole(user?.role, { showWalletUi }), [user?.role, showWalletUi]);
  const featured = useMemo(() => featuredServicesForRole(user?.role, { showWalletUi }), [user?.role, showWalletUi]);
  const visibleServices = useMemo(() => searchServices(services, query), [services, query]);
  const stats = useMemo(() => buildRoleStats(user?.role, data, navigate), [user?.role, data, navigate]);

  const badges = useMemo(() => ({
    pendingGatePasses: Number(data?.pendingWork?.gatePasses || 0),
    pendingRequests: Number(data?.pendingWork?.requests || 0),
    pendingAds: Number(data?.pendingWork?.advertisements || 0),
    unpaidInvoices: ['FACTORY_OWNER', 'PARK_MANAGER'].includes(user?.role) ? Number(data?.unpaidInvoiceCount || 0) : 0,
    openEmergencies: Number(data?.openEmergencies || 0),
    unreadMessages: Number(unreadData?.count || 0),
  }), [data, unreadData, user?.role]);

  const openService = (service) => navigate(service.path);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-3xl" />)}
        </div>
        <Skeleton className="h-12 w-full rounded-2xl" />
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert status="danger">
        <AlertContent>
          <AlertTitle>خطا در دریافت اطلاعات</AlertTitle>
          <AlertDescription>{getErrorMessage(error, 'دریافت اطلاعات داشبورد ناموفق بود.')}</AlertDescription>
          <Button
            variant="primary"
            size="sm"
            className="mt-2"
            onPress={() => refetch()}
            isDisabled={isFetching}
          >
            {isFetching ? <Spinner size="sm" /> : 'تلاش دوباره'}
          </Button>
        </AlertContent>
      </Alert>
    );
  }

  const unpaidTotal = Number(data?.unpaidInvoiceTotal || 0);
  const unpaidCount = Number(data?.unpaidInvoiceCount || 0);
  const unitsUnpaidTotal = Number(data?.unitsUnpaidInvoiceTotal || 0);
  const unitsUnpaidCount = Number(data?.unitsUnpaidInvoiceCount || 0);
  const unitsWithDebt = Number(data?.unitsWithDebtCount || 0);
  // Personal debt only — factory owners (unit bills) and park managers (park bills from admin).
  const showPersonalDebt = unpaidTotal > 0 && ['FACTORY_OWNER', 'PARK_MANAGER'].includes(user?.role);
  const unpaidPayable = Number(data?.unpaidPayableTotal ?? unpaidTotal) || unpaidTotal;
  const unpaidInvoices = Array.isArray(data?.unpaidInvoices) ? data.unpaidInvoices : [];
  const nearestDue = unpaidInvoices.length ? invoiceDueInfo(unpaidInvoices[0]) : null;
  const suspendedFactories = Array.isArray(data?.suspendedFactories) ? data.suspendedFactories : [];
  const showAds = feedItems.length > 0;
  const activePark = data?.activePark;
  const searching = query.trim().length > 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--color-brand-soft)] ring-1 ring-[var(--color-brand)]/15">
          {activePark?.logo ? (
            <img src={activePark.logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-6 w-6 text-[var(--color-brand)]" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">
            {greeting}{user?.name ? `، ${user.name}` : ''}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-foreground-500 sm:text-sm">
            <span>{roleLabels[user?.role] || 'کاربر'}</span>
            {activePark?.name && <span aria-hidden="true">·</span>}
            {activePark?.name && <span className="truncate">{activePark.name}</span>}
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {jalaliToday}
            </span>
          </p>
        </div>
        {FIRE_ROLES.includes(user?.role) && (
          <button
            type="button"
            onClick={() => navigate('/emergency', { state: { quickFire: true } })}
            className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-rose-600 px-3 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_-10px_rgba(225,29,72,0.9)] transition hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 active:scale-95 motion-reduce:transform-none"
          >
            <Flame className="h-4 w-4" aria-hidden="true" />
            اعلام حریق
          </button>
        )}
      </header>

      {suspendedFactories.length > 0 && (
        <div
          role="alert"
          data-testid="suspended-factory-banner"
          className="flex w-full items-start gap-3 rounded-2xl border border-danger-300 bg-danger-50 px-4 py-3.5 text-start animate-slide-up"
        >
          <Ban className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" />
          <div className="min-w-0">
            <p className="font-semibold text-danger-800">
              {suspendedFactories.length === 1 ? 'واحد صنعتی شما مسدود شده است' : 'برخی واحدهای صنعتی شما مسدود شده‌اند'}
            </p>
            <ul className="mt-1 flex flex-col gap-1 text-sm text-danger-700">
              {suspendedFactories.map((factory) => (
                <li key={factory.id}>
                  «{factory.name}»{factory.suspendedReason ? ` — دلیل: ${factory.suspendedReason}` : ''}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-danger-700">
              تا رفع مسدودی، ثبت برگ خروج و درخواست جدید برای این واحد امکان‌پذیر نیست. برای پیگیری با مدیریت شهرک تماس بگیرید.
            </p>
          </div>
        </div>
      )}

      {showPersonalDebt && (
        <button
          type="button"
          onClick={() => navigate('/invoices')}
          data-testid="debt-banner"
          className="flex w-full items-start gap-3 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3.5 text-start transition hover:bg-danger-100/80 animate-slide-up"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-danger-800">
              {user?.role === 'PARK_MANAGER' ? 'بدهی معوق شهرک' : 'بدهی معوق دارید'}
            </p>
            <p className="mt-1 text-sm text-danger-700">
              {unpaidCount.toLocaleString('fa-IR')} قبض پرداخت‌نشده به مبلغ قابل پرداخت{' '}
              {unpaidPayable.toLocaleString('fa-IR')} ریال
              {unpaidPayable > unpaidTotal ? ' (شامل جریمهٔ تأخیر)' : ''}
              {user?.role === 'PARK_MANAGER' ? ' — صادر شده توسط ادمین برای این شهرک.' : '.'}
            </p>
            {nearestDue && (
              <p className="mt-1 text-sm font-semibold text-danger-800" data-testid="debt-banner-due">
                مهلت پرداخت: {nearestDue.dateFa}
                {nearestDue.text ? ` — ${nearestDue.text}` : ''}
              </p>
            )}
            {unpaidInvoices.length > 1 && (
              <ul className="mt-2 flex flex-col gap-1 text-xs text-danger-700">
                {unpaidInvoices.slice(0, 3).map((invoice) => {
                  const due = invoiceDueInfo(invoice);
                  return (
                    <li key={invoice.id} className="flex flex-wrap gap-x-2">
                      <span className="font-mono" dir="ltr">{invoice.invoiceNumber}</span>
                      {invoice.factoryName && <span>{invoice.factoryName}</span>}
                      <span>{Number(invoice.payableAmount || 0).toLocaleString('fa-IR')} ریال</span>
                      <span>مهلت {due.dateFa}{due.text ? ` (${due.text})` : ''}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-1 text-xs text-danger-700">برای مشاهده و پرداخت اینجا کلیک کنید.</p>
          </div>
        </button>
      )}

      {user?.role === 'PARK_MANAGER' && unitsUnpaidTotal > 0 && (
        <button
          type="button"
          onClick={() => navigate('/admin/finance')}
          className="flex w-full items-start gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3.5 text-start transition hover:bg-warning-100/70 animate-slide-up"
        >
          <Receipt className="mt-0.5 h-5 w-5 shrink-0 text-warning-700" />
          <div>
            <p className="font-semibold text-warning-900">مطالبات معوق واحدهای صنعتی</p>
            <p className="mt-1 text-sm text-warning-800">
              {unitsWithDebt.toLocaleString('fa-IR')} واحد با{' '}
              {unitsUnpaidCount.toLocaleString('fa-IR')} قبض باز به مجموع{' '}
              {unitsUnpaidTotal.toLocaleString('fa-IR')} ریال. برای مدیریت مالی اینجا کلیک کنید.
            </p>
          </div>
        </button>
      )}

      {!searching && <FeaturedServices services={featured} badges={badges} onOpen={openService} />}

      <ServiceSearch value={query} onChange={setQuery} />

      <ServiceGrid services={visibleServices} badges={badges} onOpen={openService} searching={searching} />

      {!searching && (
        <>
          <section aria-labelledby="dashboard-stats-title" className="flex flex-col gap-2">
            <h2 id="dashboard-stats-title" className="px-1 text-sm font-bold text-foreground">وضعیت امروز</h2>
            <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
            </div>
          </section>

          <BannerCarousel />

          {showAds && <HomeFeedSlider items={feedItems} />}

          {user?.role === 'SUPER_ADMIN' && <GatePassWalletSettingCard />}

          {featuredAnnouncements.length > 0 && (
            <Card className="rounded-3xl border border-default-200 shadow-sm dark:border-white/10">
              <CardContent className="p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
                      <Megaphone className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground">اطلاعیه‌های شهرک</h2>
                      <p className="text-xs text-foreground-500">آخرین اطلاعیه‌های رسمی مدیریت شهرک</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl font-medium"
                    onPress={() => navigate(announcementsHref)}
                  >
                    همه
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-col divide-y divide-default-100 dark:divide-white/5">
                  {featuredAnnouncements.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(announcementsHref)}
                      className="flex flex-col gap-1 py-3 text-start first:pt-0 last:pb-0 hover:opacity-90"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{item.title}</span>
                        {item.isPinned && (
                          <span className="rounded-full bg-warning-100 px-2 py-0.5 text-[10px] font-medium text-warning-700">
                            سنجاق‌شده
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-2 text-sm text-foreground-500">{item.content}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardPage;
