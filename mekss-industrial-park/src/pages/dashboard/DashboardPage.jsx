import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, Button, Skeleton, Alert, AlertContent, AlertTitle, AlertDescription, Spinner } from '@heroui/react';
import { Building2, Ticket, Receipt, FileText, AlertTriangle, Megaphone, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { analyticsApi } from '../../services/api/analytics.api';
import { announcementApi } from '../../services/api/announcement.api';
import { advertisementApi } from '../../services/api/advertisement.api';
import { getErrorMessage } from '../../utils/apiError';
import { HomeFeedSlider } from '../../components/dashboard/HomeFeedSlider';

const roleTitles = {
  SUPER_ADMIN: 'داشبورد ادمین کل',
  PARK_MANAGER: 'داشبورد مدیر شهرک',
  FACTORY_OWNER: 'داشبورد مالک واحد صنعتی',
  SECURITY_GUARD: 'داشبورد نگهبان',
  GOVERNMENT_OFFICIAL: 'داشبورد نماینده دولت',
  EMPLOYEE: 'داشبورد',
};

const colorMap = {
  primary: 'bg-gradient-to-br from-[#0f4c81] to-[#1a5f96]',
  success: 'bg-gradient-to-br from-success-500 to-success-600',
  warning: 'bg-gradient-to-br from-warning-500 to-warning-600',
  danger: 'bg-gradient-to-br from-danger-500 to-danger-600',
  secondary: 'bg-gradient-to-br from-slate-500 to-slate-600',
};

const StatCard = ({ icon: Icon, label, value, color = 'primary', onClick, badge = null, index }) => (
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
          <span className="text-2xl font-bold text-foreground">{value}</span>
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
  });

  const feedItems = useMemo(() => {
    const ann = (announcements || []).slice(0, 8).map((item) => ({
      id: `a-${item.id}`,
      kind: 'announcement',
      title: item.title,
      body: item.content,
      href: '/announcements',
    }));
    const ads = (advertisements || []).slice(0, 8).map((item) => ({
      id: `ad-${item.id}`,
      kind: 'ad',
      title: item.title,
      body: item.description || item.content,
      href: '/advertisements',
    }));
    return [...ann, ...ads];
  }, [announcements, advertisements]);

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

  const capabilities = data?.capabilities || [];
  const canManageFactories = capabilities.includes('manage_factories');
  const canApproveGatePasses = capabilities.includes('approve_gate_passes');
  const canApproveRequests = capabilities.includes('approve_requests');
  const canModerateAds = capabilities.includes('moderate_advertisements') || capabilities.includes('manage_advertisements');
  const unpaidTotal = Number(data?.unpaidInvoiceTotal || 0);
  const unpaidCount = Number(data?.unpaidInvoiceCount || 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="page-toolbar">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{roleTitles[user?.role] || 'داشبورد'}</h1>
        {user?.name && (
          <span className="text-sm text-foreground-500">خوش آمدید، {user.name}</span>
        )}
      </div>

      {unpaidTotal > 0 && (
        <button
          type="button"
          onClick={() => navigate('/invoices')}
          className="flex w-full items-start gap-3 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3.5 text-start transition hover:bg-danger-100/80 animate-slide-up"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" />
          <div>
            <p className="font-semibold text-danger-800">بدهی معوق دارید</p>
            <p className="mt-1 text-sm text-danger-700">
              {unpaidCount.toLocaleString('fa-IR')} قبض پرداخت‌نشده به مجموع{' '}
              {unpaidTotal.toLocaleString('fa-IR')} ریال. برای پرداخت اینجا کلیک کنید.
            </p>
          </div>
        </button>
      )}

      <HomeFeedSlider items={feedItems} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <StatCard
          index={0}
          icon={Building2}
          label="واحدهای صنعتی"
          value={data?.factories ?? 0}
          color="primary"
          onClick={canManageFactories ? () => navigate('/admin/factories') : undefined}
        />

        <StatCard
          index={1}
          icon={Ticket}
          label="برگ‌های خروج"
          value={data?.gatePasses ?? 0}
          color="success"
          badge={data?.pendingWork?.gatePasses ? `${data.pendingWork.gatePasses} در انتظار` : undefined}
          onClick={canApproveGatePasses ? () => navigate('/admin/gate-passes') : () => navigate('/gate-passes')}
        />

        <StatCard
          index={2}
          icon={Receipt}
          label="قبض‌ها"
          value={data?.invoices ?? 0}
          color="secondary"
          onClick={() => navigate('/invoices')}
        />

        <StatCard
          index={3}
          icon={FileText}
          label="درخواست‌ها"
          value={data?.requests ?? 0}
          color="warning"
          badge={data?.pendingWork?.requests ? `${data.pendingWork.requests} در انتظار` : undefined}
          onClick={canApproveRequests ? () => navigate('/admin/requests') : () => navigate('/requests')}
        />

        <StatCard
          index={4}
          icon={AlertTriangle}
          label="هشدارهای اضطراری باز"
          value={data?.openEmergencies ?? 0}
          color="danger"
          onClick={() => navigate('/emergency')}
        />

        {canModerateAds && (
          <StatCard
            index={5}
            icon={Megaphone}
            label="آگهی‌های در انتظار تایید"
            value={data?.pendingWork?.advertisements ?? 0}
            color="primary"
            onClick={() => navigate(user?.role === 'SUPER_ADMIN' ? '/superadmin/advertisements' : '/admin/advertisements')}
          />
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
