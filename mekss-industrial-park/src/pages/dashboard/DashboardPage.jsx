import { useMemo } from 'react';
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
  UserCheck,
  LineChart,
  Wallet,
  Factory,
  MessageSquare,
  Bell,
  LayoutDashboard,
  Landmark,
} from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { analyticsApi } from '../../services/api/analytics.api';
import { announcementApi } from '../../services/api/announcement.api';
import { advertisementApi } from '../../services/api/advertisement.api';
import { getErrorMessage } from '../../utils/apiError';
import { HomeFeedSlider } from '../../components/dashboard/HomeFeedSlider';
import { GatePassWalletSettingCard } from '../../components/settings/GatePassWalletSettingCard';

const roleTitles = {
  SUPER_ADMIN: 'داشبورد ادمین کل',
  PARK_MANAGER: 'داشبورد مدیر شهرک',
  FACTORY_OWNER: 'داشبورد مالک واحد صنعتی',
  SECURITY_GUARD: 'داشبورد نگهبان',
  GOVERNMENT_OFFICIAL: 'داشبورد نماینده دولت',
  EMPLOYEE: 'داشبورد کارمند',
};

const roleSubtitles = {
  SUPER_ADMIN: 'نظارت سراسری بر شهرک‌ها، کاربران و پیکربندی سامانه',
  PARK_MANAGER: 'مدیریت واحدها، درخواست‌ها، قبض‌ها و تاییدهای شهرک',
  FACTORY_OWNER: 'مدیریت واحد صنعتی، برگ خروج، قبض و درخواست‌ها',
  SECURITY_GUARD: 'تایید خروج، اسکن QR و رسیدگی به هشدارهای اضطراری',
  GOVERNMENT_OFFICIAL: 'مشاهده گزارش‌ها، اطلاعیه‌ها و شاخص‌های شهرک',
  EMPLOYEE: 'دسترسی به درخواست‌ها، پیام‌ها و اطلاعیه‌های واحد',
};

const colorMap = {
  primary: 'bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-hover)]',
  success: 'bg-gradient-to-br from-success-500 to-success-600',
  warning: 'bg-gradient-to-br from-warning-500 to-warning-600',
  danger: 'bg-gradient-to-br from-danger-500 to-danger-600',
  secondary: 'bg-gradient-to-br from-slate-500 to-slate-600',
};

const StatCard = ({ icon: Icon, label, value, color = 'primary', onClick, badge = null, index }) => {
  const displayValue = typeof value === 'number'
    ? value.toLocaleString('fa-IR')
    : (value ?? '—');

  return (
    <Card
      className={`${onClick ? 'cursor-pointer' : ''} animate-slide-up p-4`}
      style={{ animationDelay: `${index * 70}ms` }}
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white ${colorMap[color]}`}>
            <Icon className="h-7 w-7" />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-2xl font-bold text-foreground">{displayValue}</span>
            <span className="text-sm text-foreground-500">{label}</span>
          </div>
          {badge && (
            <span className="rounded-full bg-warning-100 px-2 py-1 text-xs font-medium text-warning-700">{badge}</span>
          )}
          {onClick && !badge && (
            <ChevronLeft className="h-5 w-5 text-default-400" />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const QuickAction = ({ icon: Icon, title, description, onClick, tone = 'primary' }) => {
  const toneClass = {
    primary: 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]',
    success: 'bg-success-50 text-success-700',
    warning: 'bg-warning-50 text-warning-700',
    danger: 'bg-danger-50 text-danger-700',
    secondary: 'bg-default-100 text-foreground-600',
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-2xl border border-default-200 bg-content1 p-4 text-start transition hover:border-[var(--color-brand)]/40 hover:bg-default-50 dark:border-white/10"
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-foreground-500">{description}</p>
      </div>
      <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-default-400" />
    </button>
  );
};

const buildRoleWorkspace = (role, data, navigate) => {
  const pendingPasses = data?.pendingWork?.gatePasses || 0;
  const pendingRequests = data?.pendingWork?.requests || 0;
  const pendingAds = data?.pendingWork?.advertisements || 0;
  const openEmergencies = data?.openEmergencies || 0;

  const workspaces = {
    SECURITY_GUARD: {
      stats: [
        {
          icon: ShieldCheck,
          label: 'برگ خروج در انتظار',
          value: pendingPasses,
          color: 'success',
          badge: pendingPasses ? `${pendingPasses.toLocaleString('fa-IR')} مورد` : undefined,
          onClick: () => navigate('/guard/gate-passes'),
        },
        {
          icon: Ticket,
          label: 'کل برگ‌های خروج',
          value: data?.gatePasses ?? 0,
          color: 'primary',
          onClick: () => navigate('/guard/gate-passes'),
        },
        {
          icon: AlertTriangle,
          label: 'هشدار اضطراری باز',
          value: openEmergencies,
          color: 'danger',
          onClick: () => navigate('/emergency'),
        },
        {
          icon: ScanLine,
          label: 'اسکن QR',
          value: 'آماده',
          color: 'secondary',
          onClick: () => navigate('/guard/scan'),
        },
      ].map((item, index) => ({ ...item, index })),
      actions: [
        { icon: ShieldCheck, title: 'تایید برگ خروج', description: 'بررسی و تایید/رد خروج خودروهای در صف', onClick: () => navigate('/guard/gate-passes'), tone: 'success' },
        { icon: ScanLine, title: 'اسکن QR', description: 'خواندن سریع برگ خروج با دوربین', onClick: () => navigate('/guard/scan'), tone: 'primary' },
        { icon: AlertTriangle, title: 'هشدار اضطراری', description: 'ثبت یا پیگیری وضعیت اضطراری گیت', onClick: () => navigate('/emergency'), tone: 'danger' },
      ],
    },
    FACTORY_OWNER: {
      stats: [
        {
          icon: Receipt,
          label: 'قبض‌ها',
          value: data?.invoices ?? 0,
          color: 'secondary',
          onClick: () => navigate('/invoices'),
        },
        {
          icon: Ticket,
          label: 'برگ‌های خروج',
          value: data?.gatePasses ?? 0,
          color: 'success',
          badge: pendingPasses ? `${pendingPasses.toLocaleString('fa-IR')} در انتظار` : undefined,
          onClick: () => navigate('/gate-passes'),
        },
        {
          icon: FileText,
          label: 'درخواست‌ها',
          value: data?.requests ?? 0,
          color: 'warning',
          badge: pendingRequests ? `${pendingRequests.toLocaleString('fa-IR')} در انتظار` : undefined,
          onClick: () => navigate('/requests'),
        },
        {
          icon: Building2,
          label: 'واحدهای صنعتی',
          value: data?.factories ?? 0,
          color: 'primary',
          onClick: () => navigate('/factory/register'),
        },
      ].map((item, index) => ({ ...item, index })),
      actions: [
        { icon: Ticket, title: 'ثبت برگ خروج', description: 'صدور مجوز خروج خودرو و محموله', onClick: () => navigate('/gate-passes'), tone: 'success' },
        { icon: Receipt, title: 'قبض‌های من', description: 'مشاهده و پرداخت بدهی‌های معوق', onClick: () => navigate('/invoices'), tone: 'warning' },
        { icon: Factory, title: 'ثبت واحد صنعتی', description: 'ثبت یا پیگیری واحد صنعتی جدید', onClick: () => navigate('/factory/register'), tone: 'primary' },
        { icon: Wallet, title: 'کیف پول خروج', description: 'موجودی و شارژ کیف پول برگ خروج', onClick: () => navigate('/factory/wallet'), tone: 'secondary' },
        { icon: UserCheck, title: 'پرسنل واحد', description: 'مدیریت دسترسی کارکنان واحد', onClick: () => navigate('/factory/staff'), tone: 'secondary' },
        { icon: LineChart, title: 'نرخ بازار', description: 'مشاهده نرخ ارز، طلا و تتر', onClick: () => navigate('/market-rates'), tone: 'primary' },
      ],
    },
    PARK_MANAGER: {
      stats: [
        {
          icon: Building2,
          label: 'واحدهای صنعتی',
          value: data?.factories ?? 0,
          color: 'primary',
          onClick: () => navigate('/admin/factories'),
        },
        {
          icon: Receipt,
          label: 'بدهی واحدها',
          value: Number(data?.unitsUnpaidInvoiceTotal || 0).toLocaleString('fa-IR'),
          color: 'danger',
          badge: Number(data?.unitsWithDebtCount || 0)
            ? `${Number(data.unitsWithDebtCount).toLocaleString('fa-IR')} واحد بدهکار`
            : undefined,
          onClick: () => navigate('/admin/finance'),
        },
        {
          icon: Ticket,
          label: 'برگ‌های خروج',
          value: data?.gatePasses ?? 0,
          color: 'success',
          badge: pendingPasses ? `${pendingPasses.toLocaleString('fa-IR')} در انتظار نگهبان` : undefined,
          onClick: () => navigate('/admin/gate-passes'),
        },
        {
          icon: FileText,
          label: 'درخواست‌ها',
          value: data?.requests ?? 0,
          color: 'warning',
          badge: pendingRequests ? `${pendingRequests.toLocaleString('fa-IR')} در انتظار` : undefined,
          onClick: () => navigate('/admin/requests'),
        },
      ].map((item, index) => ({ ...item, index })),
      actions: [
        { icon: UserCheck, title: 'تایید ثبت‌نام‌ها', description: 'بررسی درخواست عضویت مالکان و پرسنل', onClick: () => navigate('/admin/registrations'), tone: 'warning' },
        { icon: Building2, title: 'مدیریت واحدها', description: 'مشاهده و تایید واحدهای صنعتی شهرک', onClick: () => navigate('/admin/factories'), tone: 'primary' },
        { icon: FileText, title: 'درخواست‌های شهرک', description: 'رسیدگی به درخواست‌های واحدها', onClick: () => navigate('/admin/requests'), tone: 'success' },
        { icon: Receipt, title: 'حسابداری و مالی', description: 'مطالبات واحدها، قبض‌ها و پیگیری مالی', onClick: () => navigate('/admin/finance'), tone: 'secondary' },
        { icon: Bell, title: 'اطلاعیه‌ها', description: 'انتشار اطلاعیه رسمی برای واحدها', onClick: () => navigate('/admin/announcements'), tone: 'primary' },
        { icon: LineChart, title: 'نرخ بازار', description: 'نرخ‌های به‌روز ارز و کالا', onClick: () => navigate('/market-rates'), tone: 'secondary' },
      ],
    },
    SUPER_ADMIN: {
      stats: [
        {
          icon: Landmark,
          label: 'شهرک‌ها / واحدها',
          value: data?.factories ?? 0,
          color: 'primary',
          onClick: () => navigate('/superadmin/parks'),
        },
        {
          icon: Users,
          label: 'کاربران و دسترسی',
          value: data?.requests ?? 0,
          color: 'secondary',
          onClick: () => navigate('/superadmin/users'),
        },
        {
          icon: Megaphone,
          label: 'آگهی در انتظار',
          value: pendingAds,
          color: 'warning',
          onClick: () => navigate('/superadmin/advertisements'),
        },
        {
          icon: AlertTriangle,
          label: 'هشدار اضطراری باز',
          value: openEmergencies,
          color: 'danger',
          onClick: () => navigate('/emergency'),
        },
      ].map((item, index) => ({ ...item, index })),
      actions: [
        { icon: Landmark, title: 'مدیریت شهرک‌ها', description: 'ایجاد و پیکربندی شهرک‌های صنعتی', onClick: () => navigate('/superadmin/parks'), tone: 'primary' },
        { icon: Users, title: 'مدیریت کاربران', description: 'نقش‌ها، تایید و وضعیت حساب‌ها', onClick: () => navigate('/superadmin/users'), tone: 'secondary' },
        { icon: Megaphone, title: 'آگهی‌های سراسری', description: 'نظارت و تایید آگهی‌ها', onClick: () => navigate('/superadmin/advertisements'), tone: 'warning' },
        { icon: LineChart, title: 'نرخ بازار', description: 'به‌روزرسانی و ویرایش نرخ‌ها', onClick: () => navigate('/market-rates'), tone: 'success' },
      ],
    },
    GOVERNMENT_OFFICIAL: {
      stats: [
        {
          icon: Building2,
          label: 'واحدهای صنعتی',
          value: data?.factories ?? 0,
          color: 'primary',
          onClick: () => navigate('/admin/reports'),
        },
        {
          icon: Ticket,
          label: 'برگ‌های خروج',
          value: data?.gatePasses ?? 0,
          color: 'success',
          onClick: () => navigate('/admin/reports'),
        },
        {
          icon: LineChart,
          label: 'نرخ بازار',
          value: '—',
          color: 'secondary',
          onClick: () => navigate('/market-rates'),
        },
        {
          icon: Bell,
          label: 'اطلاعیه‌ها',
          value: '—',
          color: 'warning',
          onClick: () => navigate('/announcements'),
        },
      ].map((item, index) => ({ ...item, index, value: item.value === '—' ? '—' : item.value })),
      actions: [
        { icon: LayoutDashboard, title: 'گزارش‌ها', description: 'شاخص‌ها و عملکرد شهرک صنعتی', onClick: () => navigate('/admin/reports'), tone: 'primary' },
        { icon: LineChart, title: 'نرخ بازار', description: 'نرخ ارز، طلا، تتر و کالا', onClick: () => navigate('/market-rates'), tone: 'success' },
        { icon: Bell, title: 'اطلاعیه‌ها', description: 'مشاهده اطلاعیه‌های رسمی', onClick: () => navigate('/announcements'), tone: 'secondary' },
        { icon: MessageSquare, title: 'پیام‌ها', description: 'ارتباط با مدیریت شهرک', onClick: () => navigate('/messages'), tone: 'secondary' },
      ],
    },
    EMPLOYEE: {
      stats: [
        {
          icon: FileText,
          label: 'درخواست‌های من',
          value: data?.requests ?? 0,
          color: 'warning',
          onClick: () => navigate('/requests'),
        },
        {
          icon: MessageSquare,
          label: 'پیام‌ها',
          value: '—',
          color: 'primary',
          onClick: () => navigate('/messages'),
        },
        {
          icon: Bell,
          label: 'اطلاعیه‌ها',
          value: '—',
          color: 'secondary',
          onClick: () => navigate('/announcements'),
        },
        {
          icon: AlertTriangle,
          label: 'هشدار اضطراری',
          value: openEmergencies,
          color: 'danger',
          onClick: () => navigate('/emergency'),
        },
      ].map((item, index) => ({ ...item, index, value: item.value === '—' ? '—' : item.value })),
      actions: [
        { icon: FileText, title: 'ثبت درخواست', description: 'مرخصی، ماموریت و سایر درخواست‌ها', onClick: () => navigate('/requests'), tone: 'warning' },
        { icon: MessageSquare, title: 'پیام‌ها', description: 'گفتگو با مدیریت واحد و شهرک', onClick: () => navigate('/messages'), tone: 'primary' },
        { icon: Bell, title: 'اطلاعیه‌ها', description: 'آخرین اطلاعیه‌های رسمی', onClick: () => navigate('/announcements'), tone: 'secondary' },
      ],
    },
  };

  return workspaces[role] || workspaces.EMPLOYEE;
};

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => analyticsApi.getDashboardData().then((res) => res.data),
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements', 'feed'],
    queryFn: () => announcementApi.getAnnouncements().then((res) => res.data),
  });

  const { data: advertisements = [] } = useQuery({
    queryKey: ['advertisements', 'feed'],
    queryFn: () => advertisementApi.getPublicAdvertisements().then((res) => res.data),
    enabled: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER'].includes(user?.role),
  });

  const announcementsHref = user?.role === 'PARK_MANAGER' || user?.role === 'SUPER_ADMIN'
    ? '/admin/announcements'
    : '/announcements';

  const feedItems = useMemo(() => (
    (advertisements || []).slice(0, 6).map((item) => ({
      id: `ad-${item.id}`,
      kind: 'ad',
      title: item.title,
      body: item.description || item.content,
      href: '/advertisements',
    }))
  ), [advertisements]);

  const featuredAnnouncements = useMemo(() => {
    return [...(announcements || [])]
      .sort((a, b) => {
        const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
        if (pinDiff !== 0) return pinDiff;
        return Number(b.priority || 0) - Number(a.priority || 0);
      })
      .slice(0, 3);
  }, [announcements]);

  const workspace = useMemo(
    () => buildRoleWorkspace(user?.role, data, navigate),
    [user?.role, data, navigate],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
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
  const showAds = feedItems.length > 0 && ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER'].includes(user?.role);

  return (
    <div className="flex flex-col gap-6">
      <div className="page-toolbar">
        <div>
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">{roleTitles[user?.role] || 'داشبورد'}</h1>
          <p className="mt-1 text-sm text-foreground-500">
            {roleSubtitles[user?.role] || 'خلاصه وضعیت و دسترسی‌های شما'}
            {user?.name ? ` — خوش آمدید، ${user.name}` : ''}
          </p>
        </div>
      </div>

      {showPersonalDebt && (
        <button
          type="button"
          onClick={() => navigate('/invoices')}
          className="flex w-full items-start gap-3 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3.5 text-start transition hover:bg-danger-100/80 animate-slide-up"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" />
          <div>
            <p className="font-semibold text-danger-800">
              {user?.role === 'PARK_MANAGER' ? 'بدهی معوق شهرک' : 'بدهی معوق دارید'}
            </p>
            <p className="mt-1 text-sm text-danger-700">
              {unpaidCount.toLocaleString('fa-IR')} قبض پرداخت‌نشده به مجموع{' '}
              {unpaidTotal.toLocaleString('fa-IR')} ریال
              {user?.role === 'PARK_MANAGER' ? ' (صادر شده توسط ادمین برای این شهرک). ' : '. '}
              برای پرداخت اینجا کلیک کنید.
            </p>
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

      {showAds && <HomeFeedSlider items={feedItems} />}

      {user?.role === 'SUPER_ADMIN' && <GatePassWalletSettingCard />}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">دسترسی‌های سریع نقش شما</h2>
          <p className="text-xs text-foreground-500">فقط ابزارهای مرتبط با نقش فعلی نمایش داده می‌شود</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {workspace.actions.map((action) => (
            <QuickAction key={action.title} {...action} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-foreground">شاخص‌های کاری</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {workspace.stats.map((stat) => (
            <StatCard
              key={`${stat.label}-${stat.index}`}
              {...stat}
              value={stat.value === '—' ? '—' : stat.value}
            />
          ))}
        </div>
      </section>

      {featuredAnnouncements.length > 0 && (
        <Card className="border border-default-200 shadow-sm rounded-2xl dark:border-white/10 animate-slide-up">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
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
                مشاهده همه
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
    </div>
  );
};

export default DashboardPage;
