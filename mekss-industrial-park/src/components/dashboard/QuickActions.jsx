import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';
import {
  Card,
  CardContent,
  CardHeader,
  Grid,
  Button,
  Typography,
  Box,
} from '@mui/material';
import {
  Add as AddIcon,
  ConfirmationNumber as ConfirmationNumberIcon,
  Assignment as AssignmentIcon,
  Campaign as CampaignIcon,
  Business as BusinessIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const StyledCard = styled(Card)(({ theme }) => ({
  height: '100%',
}));

const ActionButton = styled(Button)(({ theme }) => ({
  height: '120px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  textAlign: 'center',
  gap: theme.spacing(1),
}));

export const QuickActions = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const getQuickActions = () => {
    const actions = [];

    // Common actions
    actions.push({
      title: 'ایجاد مجوز تردد',
      icon: <ConfirmationNumberIcon sx={{ fontSize: 32 }} />,
      path: '/gate-passes/create',
      color: 'primary',
      roles: ['FACTORY_OWNER', 'PARK_MANAGER', 'ADMIN'],
    });

    actions.push({
      title: 'ثبت درخواست',
      icon: <AssignmentIcon sx={{ fontSize: 32 }} />,
      path: '/requests/create',
      color: 'secondary',
      roles: ['FACTORY_OWNER', 'PARK_MANAGER', 'ADMIN'],
    });

    // Role-specific actions
    if (user?.role === 'PARK_MANAGER' || user?.role === 'ADMIN') {
      actions.push({
        title: 'ثبت کارخانه جدید',
        icon: <BusinessIcon sx={{ fontSize: 32 }} />,
        path: '/factories/create',
        color: 'success',
        roles: ['PARK_MANAGER', 'ADMIN'],
      });

      actions.push({
        title: 'اطلاعیه جدید',
        icon: <CampaignIcon sx={{ fontSize: 32 }} />,
        path: '/announcements/create',
        color: 'info',
        roles: ['PARK_MANAGER', 'ADMIN'],
      });

      actions.push({
        title: 'هشدار اضطراری',
        icon: <WarningIcon sx={{ fontSize: 32 }} />,
        path: '/emergency/create',
        color: 'error',
        roles: ['PARK_MANAGER', 'ADMIN', 'SECURITY_GUARD'],
      });
    }

    // Filter by user role
    return actions.filter(action => 
      !action.roles || action.roles.includes(user?.role)
    );
  };

  const quickActions = getQuickActions();

  if (quickActions.length === 0) {
    return null;
  }

  return (
    <StyledCard>
      <CardHeader title="عملیات سریع" />
      <CardContent>
        <Grid container spacing={2}>
          {quickActions.map((action, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
              <ActionButton
                variant="outlined"
                color={action.color}
                onClick={() => navigate(action.path)}
                startIcon={action.icon}
              >
                <Typography variant="body2" fontWeight="medium">
                  {action.title}
                </Typography>
              </ActionButton>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </StyledCard>
  );
};