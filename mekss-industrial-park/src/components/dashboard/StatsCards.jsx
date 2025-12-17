import { useEffect, useState } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import { 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  Box,
  Skeleton 
} from '@mui/material';
import {
  Business as BusinessIcon,
  ConfirmationNumber as ConfirmationNumberIcon,
  Receipt as ReceiptIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { analyticsApi } from '../../services/api/analytics.api';

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[8],
  },
}));

const IconWrapper = styled(Box)(({ theme, color }) => ({
  width: 60,
  height: 60,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: `${color}20`,
  color: color,
}));

export const StatsCards = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await analyticsApi.getDashboardData({
        parkId: user?.parkId,
        factoryId: user?.factoryId,
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatsConfig = () => {
    const baseStats = [
      {
        title: 'تعداد کارخانه‌ها',
        icon: <BusinessIcon />,
        color: '#1976d2',
        key: 'totalFactories',
      },
      {
        title: 'مجوزهای تردد فعال',
        icon: <ConfirmationNumberIcon />,
        color: '#dc004e',
        key: 'activeGatePasses',
      },
      {
        title: 'فاکتورهای این ماه',
        icon: <ReceiptIcon />,
        color: '#4caf50',
        key: 'monthlyInvoices',
      },
      {
        title: 'درخواست‌های در انتظار',
        icon: <AssignmentIcon />,
        color: '#ff9800',
        key: 'pendingRequests',
      },
    ];

    // Filter based on user role
    if (user?.role === 'SECURITY_GUARD') {
      return baseStats.filter(stat => 
        stat.key === 'activeGatePasses' || stat.key === 'pendingRequests'
      );
    }

    return baseStats;
  };

  const statsConfig = getStatsConfig();

  if (loading) {
    return (
      <Grid container spacing={3}>
        {statsConfig.map((_, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <StyledCard>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Skeleton variant="circular" width={60} height={60} />
                  <Box sx={{ flexGrow: 1, mr: 2 }}>
                    <Skeleton variant="text" width="80%" height={32} />
                    <Skeleton variant="text" width="60%" height={24} />
                  </Box>
                </Box>
              </CardContent>
            </StyledCard>
          </Grid>
        ))}
      </Grid>
    );
  }

  return (
    <Grid container spacing={3}>
      {statsConfig.map((stat, index) => {
        const value = stats?.[stat.key] || 0;
        
        return (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <StyledCard>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <IconWrapper color={stat.color}>
                    {stat.icon}
                  </IconWrapper>
                  <Box sx={{ flexGrow: 1, mr: 2 }}>
                    <Typography variant="h4" component="div" fontWeight="bold">
                      {value.toLocaleString('fa-IR')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.title}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </StyledCard>
          </Grid>
        );
      })}
    </Grid>
  );
};