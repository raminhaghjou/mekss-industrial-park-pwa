import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Paper, Grid, Alert, Chip, CircularProgress } from '@mui/material';
import { smsApi } from '../../services/api/sms.api';
import { getErrorMessage } from '../../utils/apiError';

const providerLabels = { mock: 'شبیه‌سازی (محیط توسعه)', kavenegar: 'کاوه‌نگار' };

const SmsConfigPage = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['sms', 'health'],
    queryFn: () => smsApi.getHealth().then((res) => res.data),
  });

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        وضعیت سرویس پیامک
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        به دلایل امنیتی، کلید دسترسی و سایر اطلاعات محرمانه سرویس پیامک فقط از طریق متغیرهای محیطی سرور تنظیم می‌شوند و در مرورگر نمایش داده نمی‌شوند.
        این صفحه فقط وضعیت پیکربندی را نشان می‌دهد.
      </Alert>
      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">{getErrorMessage(error, 'دریافت وضعیت سرویس پیامک ناموفق بود.')}</Alert>}
      {!isLoading && !isError && data && (
        <Paper sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary">سرویس‌دهنده</Typography>
              <Typography variant="h6">{providerLabels[data.provider] || data.provider}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary">وضعیت پیکربندی</Typography>
              <Chip label={data.configured ? 'پیکربندی شده' : 'پیکربندی نشده'} color={data.configured ? 'success' : 'error'} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="text.secondary">شماره فرستنده</Typography>
              <Typography variant="h6">{data.maskedSender || '—'}</Typography>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default SmsConfigPage;
