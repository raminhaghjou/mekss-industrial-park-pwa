import { useEffect, useState } from 'react';
import { useAuth } from '../../providers/AuthProvider';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  Chip,
  Skeleton,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  ConfirmationNumber as ConfirmationNumberIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { analyticsApi } from '../../services/api/analytics.api';

const StyledCard = styled(Card)(({ theme }) => ({
  height: 400,
  display: 'flex',
  flexDirection: 'column',
}));

const StyledCardContent = styled(CardContent)(({ theme }) => ({
  flexGrow: 1,
  overflow: 'auto',
  padding: theme.spacing(2),
}));

const getActivityIcon = (type) => {
  switch (type) {
    case 'REQUEST':
      return <AssignmentIcon />;
    case 'GATE_PASS':
      return <ConfirmationNumberIcon />;
    case 'INVOICE':
      return <ReceiptIcon />;
    case 'EMERGENCY':
      return <WarningIcon />;
    default:
      return <AssignmentIcon />;
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'APPROVED':
    case 'COMPLETED':
    case 'PAID':
      return 'success';
    case 'REJECTED':
    case 'CANCELLED':
    case 'FAILED':
      return 'error';
    default:
      return 'default';
  }
};

export const RecentActivity = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentActivity();
  }, [user]);

  const fetchRecentActivity = async () => {
    try {
      setLoading(true);
      const response = await analyticsApi.getRecentActivity({
        parkId: user?.parkId,
        factoryId: user?.factoryId,
        limit: 10,
      });
      setActivities(response.data);
    } catch (error) {
      console.error('Failed to fetch recent activity:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <StyledCard>
        <CardHeader title="فعالیت‌های اخیر" />
        <StyledCardContent>
          {[1, 2, 3, 4, 5].map((item) => (
            <Box key={item} sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
              <Box sx={{ flexGrow: 1 }}>
                <Skeleton variant="text" width="80%" height={20} />
                <Skeleton variant="text" width="60%" height={16} />
              </Box>
            </Box>
          ))}
        </StyledCardContent>
      </StyledCard>
    );
  }

  return (
    <StyledCard>
      <CardHeader title="فعالیت‌های اخیر" />
      <StyledCardContent>
        {activities.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            فعالیتی یافت نشد
          </Typography>
        ) : (
          <List sx={{ py: 0 }}>
            {activities.map((activity, index) => (
              <ListItem key={index} sx={{ px: 0, py: 1 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {getActivityIcon(activity.type)}
                </ListItemIcon>
                <ListItemText
                  primary={activity.action}
                  secondary={new Date(activity.timestamp).toLocaleDateString('fa-IR')}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
                <Chip
                  label={activity.status}
                  size="small"
                  color={getStatusColor(activity.status)}
                  variant="outlined"
                />
              </ListItem>
            ))}
          </List>
        )}
      </StyledCardContent>
    </StyledCard>
  );
};