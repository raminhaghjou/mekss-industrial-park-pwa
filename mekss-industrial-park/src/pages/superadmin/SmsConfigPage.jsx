import React from 'react';
import { Box, Typography, Paper, TextField, Button, Grid, Alert } from '@mui/material';

const SmsConfigPage = () => {
  const [config, setConfig] = React.useState({
    apiKey: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    senderNumber: '100020003000',
    providerUrl: 'https://api.sms-provider.com/v1/send',
  });

  const handleChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
      e.preventDefault();
      alert('تنظیمات پیامک با موفقیت ذخیره شد.');
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        تنظیمات پنل پیامک
      </Typography>
      <Alert severity="info" sx={{mb: 3}}>
          این تنظیمات برای ارسال پیامک‌های OTP، اطلاع‌رسانی‌ها و هشدارها استفاده می‌شود.
      </Alert>
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="آدرس سرویس‌دهنده (API URL)"
                name="providerUrl"
                value={config.providerUrl}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField
                fullWidth
                required
                label="کلید دسترسی (API Key)"
                name="apiKey"
                value={config.apiKey}
                onChange={handleChange}
                type="password"
              />
            </Grid>
             <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                required
                label="شماره فرستنده"
                name="senderNumber"
                value={config.senderNumber}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12} sx={{textAlign: 'right'}}>
                <Button type="submit" variant="contained">ذخیره تنظیمات</Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default SmsConfigPage;
