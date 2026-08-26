import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Paper, Grid, MenuItem, TextField, Button, CircularProgress, Alert, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { reportApi } from '../../services/api/report.api';
import { getErrorMessage } from '../../utils/apiError';

const typeLabels = { financial: 'مالی', gatepass: 'تردد', requests: 'درخواست‌ها' };
const statusLabels = {
  PENDING: 'در انتظار', PAID: 'پرداخت شده', OVERDUE: 'سررسید گذشته', CANCELLED: 'لغو شده',
  APPROVED: 'تایید شده', REJECTED: 'رد شده', COMPLETED: 'تکمیل شده', EXPIRED: 'منقضی شده',
};

const ReportsPage = () => {
  const [type, setType] = React.useState('financial');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [submittedFilters, setSubmittedFilters] = React.useState({ type: 'financial', from: '', to: '' });

  const { data, isLoading, isError, error, isFetched } = useQuery({
    queryKey: ['reports', submittedFilters],
    queryFn: () => reportApi.getReport(submittedFilters.type, submittedFilters.from || undefined, submittedFilters.to || undefined).then((res) => res.data),
  });

  const handleGenerate = () => setSubmittedFilters({ type, from, to });

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        گزارش‌گیری
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>فیلترها</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField select fullWidth label="نوع گزارش" value={type} onChange={(e) => setType(e.target.value)}>
              <MenuItem value="financial">مالی</MenuItem>
              <MenuItem value="gatepass">تردد</MenuItem>
              <MenuItem value="requests">درخواست‌ها</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="از تاریخ" type="date" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="تا تاریخ" type="date" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          </Grid>
          <Grid item xs={12}>
            <Button variant="contained" onClick={handleGenerate}>ایجاد گزارش</Button>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>نمایش گزارش: {typeLabels[submittedFilters.type]}</Typography>
        {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
        {isError && <Alert severity="error">{getErrorMessage(error, 'دریافت گزارش ناموفق بود.')}</Alert>}
        {!isLoading && !isError && isFetched && data?.type === 'financial' && (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}><Typography>تعداد قبض‌ها: {data.count}</Typography></Grid>
            <Grid item xs={12} sm={4}><Typography>جمع مبلغ: {data.totalAmount.toLocaleString('fa-IR')} ریال</Typography></Grid>
            <Grid item xs={12} sm={4}><Typography>مبلغ پرداخت‌شده: {data.paidAmount.toLocaleString('fa-IR')} ریال</Typography></Grid>
          </Grid>
        )}
        {!isLoading && !isError && isFetched && (data?.type === 'gatepass' || data?.type === 'requests') && (
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>وضعیت</TableCell><TableCell align="left">تعداد</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {data.byStatus.length === 0 && <TableRow><TableCell colSpan={2} align="center">داده‌ای برای نمایش وجود ندارد.</TableCell></TableRow>}
              {data.byStatus.map((row) => (
                <TableRow key={row.status}>
                  <TableCell>{statusLabels[row.status] || row.status}</TableCell>
                  <TableCell align="left">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          خروجی فایل قابل دانلود برای گزارش‌ها در این نسخه پشتیبانی نمی‌شود.
        </Typography>
      </Paper>
    </Box>
  );
};

export default ReportsPage;
