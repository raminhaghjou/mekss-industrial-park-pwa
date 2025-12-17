import React from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, Divider, Alert } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

const mockAlarms = [
  { id: 1, factory: 'واحد صنعتی پولاد', time: '۱۴۰۲/۰۴/۰۲ - ساعت ۱۴:۳۰', type: 'اعلام حریق' },
  { id: 2, factory: 'کارخانه پلاستیک سازی نوین', time: '۱۴۰۲/۰۳/۲۸ - ساعت ۰۹:۱۵', type: 'نیاز به امداد پزشکی' },
];

const GuardEmergencyPage = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom color="error.main">
        مشاهده اعلام حریق و شرایط اضطراری
      </Typography>
      <Alert severity="error" icon={<WarningIcon fontSize="inherit" />} sx={{ mb: 3 }}>
        در صورت مشاهده هشدار جدید، بلافاصله اقدامات لازم را انجام داده و با مدیریت تماس بگیرید.
      </Alert>
      <Paper>
        <List>
          {mockAlarms.map((alarm, index) => (
            <React.Fragment key={alarm.id}>
              <ListItem>
                <ListItemText
                  primary={<Typography variant="h6" color="error.main">{alarm.type} در {alarm.factory}</Typography>}
                  secondary={`زمان اعلام: ${alarm.time}`}
                />
              </ListItem>
              {index < mockAlarms.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default GuardEmergencyPage;
