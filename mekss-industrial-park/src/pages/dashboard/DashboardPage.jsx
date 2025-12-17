import { useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { Grid, Paper, Typography, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { DashboardLayout } from '../../layouts/DashboardLayout';
import { StatsCards } from '../../components/dashboard/StatsCards';
import { RecentActivity } from '../../components/dashboard/RecentActivity';
import { QuickActions } from '../../components/dashboard/QuickActions';
import { ChartContainer } from '../../components/dashboard/ChartContainer';

const DashboardContainer = styled(Box)(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
}));

export const DashboardPage = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();

  useEffect(() => {
    if (user) {
      showNotification(`خوش آمدید، ${user.name}!`, 'success');
    }
  }, [user, showNotification]);

  const getDashboardContent = () => {
    switch (user?.role) {
      case 'ADMIN':
        return <AdminDashboard />;
      case 'PARK_MANAGER':
        return <ParkManagerDashboard />;
      case 'FACTORY_OWNER':
        return <FactoryOwnerDashboard />;
      case 'SECURITY_GUARD':
        return <SecurityGuardDashboard />;
      case 'GOVERNMENT_OFFICIAL':
        return <GovernmentOfficialDashboard />;
      default:
        return <DefaultDashboard />;
    }
  };

  return (
    <DashboardLayout>
      <DashboardContainer>
        {getDashboardContent()}
      </DashboardContainer>
    </DashboardLayout>
  );
};

// Admin Dashboard
const AdminDashboard = () => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h4" gutterBottom>
          داشبورد مدیریت سیستم
        </Typography>
      </Grid>
      
      <Grid item xs={12}>
        <StatsCards />
      </Grid>
      
      <Grid item xs={12} md={8}>
        <ChartContainer />
      </Grid>
      
      <Grid item xs={12} md={4}>
        <RecentActivity />
      </Grid>
      
      <Grid item xs={12}>
        <QuickActions />
      </Grid>
    </Grid>
  );
};

// Park Manager Dashboard
const ParkManagerDashboard = () => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h4" gutterBottom>
          داشبورد مدیر پارک
        </Typography>
      </Grid>
      
      <Grid item xs={12}>
        <StatsCards />
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3, height: 300 }}>
          <Typography variant="h6" gutterBottom>
            کارخانه‌های تحت مدیریت
          </Typography>
          {/* Add factory management component here */}
        </Paper>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <RecentActivity />
      </Grid>
    </Grid>
  );
};

// Factory Owner Dashboard
const FactoryOwnerDashboard = () => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h4" gutterBottom>
          داشبورد مالک کارخانه
        </Typography>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3, height: 200 }}>
          <Typography variant="h6" gutterBottom>
            آخرین مجوزهای تردد
          </Typography>
          {/* Add gate passes component here */}
        </Paper>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 3, height: 200 }}>
          <Typography variant="h6" gutterBottom>
            فاکتورهای اخیر
          </Typography>
          {/* Add invoices component here */}
        </Paper>
      </Grid>
    </Grid>
  );
};

// Security Guard Dashboard
const SecurityGuardDashboard = () => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h4" gutterBottom>
          داشبورد نگهبان
        </Typography>
      </Grid>
      
      <Grid item xs={12}>
        <Paper sx={{ p: 3, height: 400 }}>
          <Typography variant="h6" gutterBottom>
            اسکنر QR کد
          </Typography>
          {/* Add QR scanner component here */}
        </Paper>
      </Grid>
    </Grid>
  );
};

// Government Official Dashboard
const GovernmentOfficialDashboard = () => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h4" gutterBottom>
          داشبورد نماینده دولت
        </Typography>
      </Grid>
      
      <Grid item xs={12}>
        <AnalyticsPage />
      </Grid>
    </Grid>
  );
};

// Default Dashboard
const DefaultDashboard = () => {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h4" gutterBottom>
          داشبورد
        </Typography>
        <Typography variant="body1">
          لطفاً برای مشاهده اطلاعات مربوطه، وارد سیستم شوید.
        </Typography>
      </Grid>
    </Grid>
  );
};