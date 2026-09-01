import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Skeleton, Alert } from '@heroui/react';
import { Building2, Ticket, Receipt, FileText, AlertTriangle, Megaphone, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../providers/AuthProvider';
import { analyticsApi } from '../../services/api/analytics.api';
import { getErrorMessage } from '../../utils/apiError';

const roleTitles = {
  SUPER_ADMIN: 'داشبورد ادمین کل',
  PARK_MANAGER: 'داشبورد مدیر شهرک',
  FACTORY_OWNER: 'داشبورد مالک واحد صنعتی',
  SECURITY_GUARD: 'داشبورد نگهبان',
  GOVERNMENT_OFFICIAL: 'داشبورد نماینده دولت',
  EMPLOYEE: 'داشبورد',
};

const colorMap = {
  primary: 'bg-gradient-to-br from-primary-500 to-primary-600',
  success: 'bg-gradient-to-br from-success-500 to-success-600',
  warning: 'bg-gradient-to-br from-warning-500 to-warning-600',
  danger: 'bg-gradient-to-br from-danger-500 to-danger-600',
  secondary: 'bg-gradient-to-br from-secondary-500 to-secondary-600',
};

const StatCard = ({ icon: Icon, label, value, color = 'primary', onClick, badge, index }) => (
  <Card
    className={`cursor-${onClick ? 'pointer' : 'default'} animate-slide-up p-4`}
    style={{ animationDelay: `${index * 70}ms` }}
    isPressable={!!onClick}
    onPress={onClick}
  >
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
  </Card>
);

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => analyticsApi.getDashboardData().then((res) => res.data),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48 rounded-lg" />
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
      <Alert
        color="danger"
        title="خطا در دریافت اطلاعات"
      >
        <p>{getErrorMessage(error, 'دریافت اطلاعات داشبورد ناموفق بود.')}</p>
        <Button
          color="danger"
          variant="solid"
          size="sm"
          className="mt-2"
          onClick={() => refetch()}
          isLoading={isFetching}
        >
          تلاش دوباره
        </Button>
      </Alert>
    );
  }

  const capabilities = data?.capabilities || [];
  const canManageFactories = capabilities.includes('manage_factories');
  const canApproveGatePasses = capabilities.includes('approve_gate_passes');
  const canApproveRequests = capabilities.includes('approve_requests');
  const canModerateAds = capabilities.includes('moderate_advertisements') || capabilities.includes('manage_advertisements');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{roleTitles[user?.role] || 'داشبورد'}</h1>
        {user?.name && (
          <span className="text-sm text-foreground-500">خوش آمدید، {user.name}</span>
        )}
      </div>

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
