import React from 'react';
import { Box, Typography, Paper, FormGroup, FormControlLabel, Switch, Alert } from '@mui/material';
import { useTheme } from '../../providers/ThemeProvider';

export const SettingsPage = () => {
  const { mode, toggleMode } = useTheme();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        تنظیمات حساب
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          تنظیمات ظاهری
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={<Switch checked={mode === 'dark'} onChange={toggleMode} />}
            label="حالت تاریک"
          />
        </FormGroup>
        <Alert severity="info" sx={{ mt: 3 }}>
          تنظیمات اطلاع‌رسانی ایمیل و پیامک در این نسخه از سامانه هنوز پیاده‌سازی نشده و به‌زودی ارائه خواهد شد.
        </Alert>
      </Paper>
    </Box>
  );
};

export default SettingsPage;
