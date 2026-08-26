import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Grid, Typography, Box, Card, CardContent, CardActionArea, CircularProgress, Alert, Chip } from '@mui/material';
import {
  Business as BusinessIcon,
  ConfirmationNumber as ConfirmationNumberIcon,
  Receipt as ReceiptIcon,
  Assignment as AssignmentIcon,
  Warning as WarningIcon,
  AdUnits as AdUnitsIcon,
} from '@mui/icons-material';
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

const StatCard = ({ icon, label, value, color = 'primary.main', onClick, badge = undefined }) => (
  <Grid item xs={12} sm={6} md={3}>
    <Card>
      <CardActionArea onClick={onClick} disabled={!onClick} sx={{ height: '100%' }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ color, fontSize: 40, display: 'flex' }}>{icon}</Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4">{value}</Typography>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
          </Box>
          {Boolean(badge) && <Chip label={badge} color="warning" size="small" />}
        </CardContent>
      </CardActionArea>
    </Card>
  </Grid>
);

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => analyticsApi.getDashboardData().then((res) => res.data),
  });

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;
  }

  if (isError) {
    return <Alert severity="error">{getErrorMessage(error, 'دریافت اطلاعات داشبورد ناموفق بود.')}</Alert>;
  }

  const capabilities = data?.capabilities || [];
  const canManageFactories = capabilities.includes('manage_factories');
  const canApproveGatePasses = capabilities.includes('approve_gate_passes');
  const canApproveRequests = capabilities.includes('approve_requests');
  const canModerateAds = capabilities.includes('moderate_advertisements') || capabilities.includes('manage_advertisements');

  return (
    <Box>
      <Typography variant="h4" gutterBottom>{roleTitles[user?.role] || 'داشبورد'}</Typography>
      <Grid container spacing={3}>
        <StatCard
          icon={<BusinessIcon fontSize="inherit" />}
          label="واحدهای صنعتی"
          value={data?.factories ?? 0}
          onClick={canManageFactories ? () => navigate('/admin/factories') : undefined}
        />
        <StatCard
          icon={<ConfirmationNumberIcon fontSize="inherit" />}
          label="برگ‌های خروج"
          value={data?.gatePasses ?? 0}
          badge={data?.pendingWork?.gatePasses ? `${data.pendingWork.gatePasses} در انتظار` : undefined}
          onClick={canApproveGatePasses ? () => navigate('/admin/gate-passes') : () => navigate('/gate-passes')}
        />
        <StatCard
          icon={<ReceiptIcon fontSize="inherit" />}
          label="قبض‌ها"
          value={data?.invoices ?? 0}
          onClick={() => navigate('/invoices')}
        />
        <StatCard
          icon={<AssignmentIcon fontSize="inherit" />}
          label="درخواست‌ها"
          value={data?.requests ?? 0}
          badge={data?.pendingWork?.requests ? `${data.pendingWork.requests} در انتظار` : undefined}
          onClick={canApproveRequests ? () => navigate('/admin/requests') : () => navigate('/requests')}
        />
        <StatCard
          icon={<WarningIcon fontSize="inherit" />}
          label="هشدارهای اضطراری باز"
          value={data?.openEmergencies ?? 0}
          color="error.main"
          onClick={() => navigate('/emergency')}
        />
        {canModerateAds && (
          <StatCard
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
