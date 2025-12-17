import { useEffect } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { Grid, Paper, Typography, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
// import { StatsCards } from '../../components/dashboard/StatsCards';
// import { RecentActivity } from '../../components/dashboard/RecentActivity';
// import { QuickActions } from '../../components/dashboard/QuickActions';
// import { ChartContainer } from '../../components/dashboard/ChartContainer';

const DashboardContainer = styled(Box)(({ theme }) => ({
  flexGrow: 1,
}));

export const DashboardPage = () => {
  const { user } = useAuth();

  const getDashboardContent = () => {
    switch (user?.role) {
      case 'SUPER_ADMIN':
        return <AdminDashboard />;
      case 'PARK_MANAGER':
        return <ParkManagerDashboard />;
      case 'FACTORY_MANAGER':
        return <FactoryManagerDashboard />;
      case 'SECURITY_GUARD':
        return <SecurityGuardDashboard />;
      default:
        return <DefaultDashboard />;
    }
  };

  return (
    <DashboardContainer>
      {getDashboardContent()}
    </DashboardContainer>
  );
};

// Placeholder Dashboards
const AdminDashboard = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}><Typography variant="h4">داشبورد ادمین کل</Typography></Grid>
      {/* Add Admin specific widgets here */}
    </Grid>
);
const ParkManagerDashboard = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}><Typography variant="h4">داشبورد مدیر شهرک</Typography></Grid>
      {/* Add Park Manager specific widgets here */}
    </Grid>
);
const FactoryManagerDashboard = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}><Typography variant="h4">داشبورد مدیر واحد صنعتی</Typography></Grid>
      {/* Add Factory Manager specific widgets here */}
    </Grid>
);
const SecurityGuardDashboard = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}><Typography variant="h4">داشبورد نگهبان</Typography></Grid>
      {/* Add Guard specific widgets here */}
    </Grid>
);
const DefaultDashboard = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h4">داشبورد</Typography>
        <Typography variant="body1">به سامانه مدیریت شهرک صنعتی مکث خوش آمدید.</Typography>
      </Grid>
    </Grid>
);

export default DashboardPage;
