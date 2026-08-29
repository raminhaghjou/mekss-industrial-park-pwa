import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Grid, Typography, Box, Card, CardContent, CardActionArea, Alert, Chip, Skeleton, Stack } from '@mui/material';
import {
  Business as BusinessIcon,
  ConfirmationNumber as ConfirmationNumberIcon,
  Receipt as ReceiptIcon,
  Assignment as AssignmentIcon,
  Warning as WarningIcon,
  AdUnits as AdUnitsIcon,
  ChevronLeft as ChevronLeftIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
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

const StatCard = ({ icon, label, value, color = 'primary.main', onClick, badge = undefined, index = 0 }) => (
  <Grid item xs={12} sm={6} md={3}>
    <Card
      sx={{
        height: '100%',
        opacity: 0,
        animation: `mekssCardIn 460ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 70}ms both`,
      }}
    >
      <CardActionArea onClick={onClick} disabled={!onClick} sx={{ height: '100%' }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2.5 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 52,
              height: 52,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 3,
              fontSize: 26,
              color,
              background: (theme) => {
                const paletteKey = color.split('.')[0];
                const base = theme.palette[paletteKey]?.main || theme.palette.primary.main;
                return `linear-gradient(155deg, ${alpha(base, 0.16)}, ${alpha(base, 0.06)})`;
              },
            }}
          >
            {icon}
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h4" fontWeight={800}>{value}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{label}</Typography>
          </Box>
          {Boolean(badge) && <Chip label={badge} color="warning" size="small" sx={{ fontWeight: 700 }} />}
          {Boolean(onClick) && !badge && (
            <ChevronLeftIcon fontSize="small" sx={{ color: 'text.disabled', flexShrink: 0 }} />
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  </Grid>
);

const StatCardSkeleton = ({ index = 0 }) => (
  <Grid item xs={12} sm={6} md={3}>
    <Card sx={{ height: '100%', opacity: 0, animation: `mekssFadeInUp 320ms ease ${index * 60}ms both` }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2.5 }}>
        <Skeleton variant="rounded" width={52} height={52} sx={{ borderRadius: 3, flexShrink: 0 }} />
        <Box sx={{ flexGrow: 1 }}>
          <Skeleton variant="text" width="45%" height={34} />
          <Skeleton variant="text" width="70%" height={20} />
        </Box>
      </CardContent>
    </Card>
  </Grid>
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
      <Box>
        <Skeleton variant="text" width={220} height={44} sx={{ mb: 2 }} />
        <Grid container spacing={3}>
          {[0, 1, 2, 3].map((index) => <StatCardSkeleton key={index} index={index} />)}
        </Grid>
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert
        severity="error"
        action={(
          <Chip
            label={isFetching ? 'در حال تلاش...' : 'تلاش دوباره'}
            onClick={() => refetch()}
            disabled={isFetching}
            size="small"
            sx={{ cursor: 'pointer', fontWeight: 700 }}
          />
        )}
      >
        {getErrorMessage(error, 'دریافت اطلاعات داشبورد ناموفق بود.')}
      </Alert>
    );
  }

  const capabilities = data?.capabilities || [];
  const canManageFactories = capabilities.includes('manage_factories');
  const canApproveGatePasses = capabilities.includes('approve_gate_passes');
  const canApproveRequests = capabilities.includes('approve_requests');
  const canModerateAds = capabilities.includes('moderate_advertisements') || capabilities.includes('manage_advertisements');

  return (
    <Box>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 2.5, flexWrap: 'wrap', gap: 0.5 }}>
        <Typography variant="h4" fontWeight={800}>{roleTitles[user?.role] || 'داشبورد'}</Typography>
        <Typography variant="body2" color="text.secondary">
          {user?.name ? `خوش آمدید، ${user.name}` : ''}
        </Typography>
      </Stack>
      <Grid container spacing={3}>
        <StatCard
          index={0}
          icon={<BusinessIcon fontSize="inherit" />}
          label="واحدهای صنعتی"
          value={data?.factories ?? 0}
          onClick={canManageFactories ? () => navigate('/admin/factories') : undefined}
        />
        <StatCard
          index={1}
          icon={<ConfirmationNumberIcon fontSize="inherit" />}
          label="برگ‌های خروج"
          value={data?.gatePasses ?? 0}
          badge={data?.pendingWork?.gatePasses ? `${data.pendingWork.gatePasses} در انتظار` : undefined}
          onClick={canApproveGatePasses ? () => navigate('/admin/gate-passes') : () => navigate('/gate-passes')}
        />
        <StatCard
          index={2}
          icon={<ReceiptIcon fontSize="inherit" />}
          label="قبض‌ها"
          value={data?.invoices ?? 0}
          onClick={() => navigate('/invoices')}
        />
        <StatCard
          index={3}
          icon={<AssignmentIcon fontSize="inherit" />}
          label="درخواست‌ها"
          value={data?.requests ?? 0}
          badge={data?.pendingWork?.requests ? `${data.pendingWork.requests} در انتظار` : undefined}
          onClick={canApproveRequests ? () => navigate('/admin/requests') : () => navigate('/requests')}
        />
        <StatCard
          index={4}
          icon={<WarningIcon fontSize="inherit" />}
          label="هشدارهای اضطراری باز"
          value={data?.openEmergencies ?? 0}
          color="error.main"
          onClick={() => navigate('/emergency')}
        />
        {canModerateAds && (
          <StatCard
            index={5}
            icon={<AdUnitsIcon fontSize="inherit" />}
            label="آگهی‌های در انتظار تایید"
            value={data?.pendingWork?.advertisements ?? 0}
            onClick={() => navigate(user?.role === 'SUPER_ADMIN' ? '/superadmin/advertisements' : '/admin/advertisements')}
          />
        )}
      </Grid>
    </Box>
  );
};

export default DashboardPage;
