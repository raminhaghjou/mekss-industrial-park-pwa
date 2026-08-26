import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Paper, List, ListItem, ListItemText, Divider, Alert, CircularProgress } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { emergencyApi } from '../../services/api/emergency.api';
import { getErrorMessage } from '../../utils/apiError';

const severityLabels = { LOW: 'کم', MEDIUM: 'متوسط', HIGH: 'زیاد', CRITICAL: 'بحرانی' };

const GuardEmergencyPage = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['emergencies'],
    queryFn: () => emergencyApi.getEmergencies().then((res) => res.data),
  });

  const emergencies = data || [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom color="error.main">
        مشاهده اعلام حریق و شرایط اضطراری
      </Typography>
      <Alert severity="error" icon={<WarningIcon fontSize="inherit" />} sx={{ mb: 3 }}>
        در صورت مشاهده هشدار جدید، بلافاصله اقدامات لازم را انجام داده و با مدیریت تماس بگیرید.
      </Alert>
      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">{getErrorMessage(error, 'دریافت هشدارها ناموفق بود.')}</Alert>}
      {!isLoading && !isError && (
        <Paper>
          <List>
            {emergencies.length === 0 && <ListItem><ListItemText primary="هیچ هشدار اضطراری فعالی وجود ندارد." /></ListItem>}
            {emergencies.map((alarm, index) => (
              <React.Fragment key={alarm.id}>
                <ListItem>
                  <ListItemText
                    primary={<Typography variant="h6" color="error.main">{alarm.title} — شدت: {severityLabels[alarm.severity] || alarm.severity}</Typography>}
                    secondary={`زمان اعلام: ${new Date(alarm.createdAt).toLocaleString('fa-IR')} — وضعیت: ${alarm.status === 'RESOLVED' ? 'برطرف شده' : alarm.status === 'ACKNOWLEDGED' ? 'در حال رسیدگی' : 'باز'}`}
                  />
                </ListItem>
                {index < emergencies.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default GuardEmergencyPage;
