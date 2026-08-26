import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Box, Typography, Paper, Button, Grid, Divider, Alert, CircularProgress } from '@mui/material';
import { ArrowBack as ArrowBackIcon, CreditCard as CreditCardIcon } from '@mui/icons-material';
import { invoiceApi } from '../../services/api/invoice.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

const InvoicePaymentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const { data: invoices, isLoading, isError } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.getInvoices().then((res) => res.data),
  });

  const invoice = (invoices || []).find((inv) => inv.id === id);

  const payMutation = useMutation({
    mutationFn: () => invoiceApi.startPayment(id, `${id}-${Date.now()}`),
    onSuccess: (res) => {
      const { paymentUrl } = res.data;
      if (paymentUrl) {
        window.location.href = paymentUrl;
      } else {
        showNotification('پرداخت با موفقیت شروع شد.', 'success');
        navigate('/invoices');
      }
    },
    onError: (err) => showNotification(getErrorMessage(err, 'شروع پرداخت ناموفق بود.'), 'error'),
  });

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (isError || !invoice) {
    return (
      <Box>
        <Alert severity="error">قبض مورد نظر یافت نشد.</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/invoices')} sx={{ mt: 2 }}>
          بازگشت به لیست قبض‌ها
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/invoices')}>
          بازگشت
        </Button>
      </Box>
      <Paper sx={{ p: 4, maxWidth: 700, margin: 'auto' }}>
        <Typography variant="h4" gutterBottom align="center">
          پرداخت قبض
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <Grid container spacing={2}>
          <Grid item xs={6}><Typography variant="body1"><strong>شماره قبض:</strong></Typography></Grid>
          <Grid item xs={6}><Typography variant="body1" align="right">{invoice.invoiceNumber}</Typography></Grid>

          <Grid item xs={6}><Typography variant="body1"><strong>شرح:</strong></Typography></Grid>
          <Grid item xs={6}><Typography variant="body1" align="right">{invoice.description}</Typography></Grid>

          <Grid item xs={6}><Typography variant="body1"><strong>مهلت پرداخت:</strong></Typography></Grid>
          <Grid item xs={6}><Typography variant="body1" align="right">{new Date(invoice.dueDate).toLocaleDateString('fa-IR')}</Typography></Grid>

          <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

          <Grid item xs={6}><Typography variant="h6"><strong>مبلغ قابل پرداخت:</strong></Typography></Grid>
          <Grid item xs={6}>
            <Typography variant="h6" align="right" color="primary.main">
              {Number(invoice.totalAmount).toLocaleString('fa-IR')} ریال
            </Typography>
          </Grid>
        </Grid>

        {invoice.status === 'PAID' ? (
          <Alert severity="success" sx={{ mt: 4 }}>این قبض قبلا پرداخت شده است.</Alert>
        ) : (
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={payMutation.isPending ? <CircularProgress size={22} color="inherit" /> : <CreditCardIcon />}
              onClick={() => payMutation.mutate()}
              disabled={payMutation.isPending}
            >
              پرداخت آنلاین
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default InvoicePaymentPage;
