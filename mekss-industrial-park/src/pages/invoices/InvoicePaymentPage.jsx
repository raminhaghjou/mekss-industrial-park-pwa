import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Button, Grid, Divider, Alert } from '@mui/material';
import { ArrowBack as ArrowBackIcon, CreditCard as CreditCardIcon } from '@mui/icons-material';

// Mock Data - Find the invoice based on ID from URL params
const mockInvoices = [
  { id: 'INV-001', title: ' قبض برق - خرداد ۱۴۰۲', amount: '۱,۵۰۰,۰۰۰', dueDate: '۱۴۰۲/۰۴/۱۰', status: 'UNPAID' },
  { id: 'INV-002', title: 'هزینه شارژ و نگهداری', amount: '۵,۰۰۰,۰۰۰', dueDate: '۱۴۰۲/۰۴/۱۵', status: 'UNPAID' },
];

const InvoicePaymentPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const invoice = mockInvoices.find(inv => inv.id === id);

  if (!invoice) {
    return (
      <Box>
        <Alert severity="error">قبض مورد نظر یافت نشد.</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/invoices')} sx={{ mt: 2 }}>
          بازگشت به لیست قبض‌ها
        </Button>
      </Box>
    );
  }

  const handlePayment = () => {
    // Simulate payment process
    alert(`شبیه‌سازی پرداخت قبض ${invoice.id} به مبلغ ${invoice.amount} ریال. در حالت واقعی به درگاه پرداخت متصل می‌شوید.`);
    navigate('/invoices');
  };

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
          <Grid item xs={6}>
            <Typography variant="body1"><strong>شناسه قبض:</strong></Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body1" align="right">{invoice.id}</Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="body1"><strong>عنوان:</strong></Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body1" align="right">{invoice.title}</Typography>
          </Grid>

          <Grid item xs={6}>
            <Typography variant="body1"><strong>مهلت پرداخت:</strong></Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body1" align="right">{invoice.dueDate}</Typography>
          </Grid>

          <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

          <Grid item xs={6}>
            <Typography variant="h6"><strong>مبلغ قابل پرداخت:</strong></Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="h6" align="right" color="primary.main">
              {invoice.amount} ریال
            </Typography>
          </Grid>
        </Grid>

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<CreditCardIcon />}
            onClick={handlePayment}
          >
            پرداخت آنلاین
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default InvoicePaymentPage;
