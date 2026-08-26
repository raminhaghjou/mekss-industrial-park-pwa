import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper, Tabs, Tab, CircularProgress, Alert } from '@mui/material';
import { invoiceApi } from '../../services/api/invoice.api';
import { getErrorMessage } from '../../utils/apiError';

const InvoiceList = ({ invoices }) => {
  const navigate = useNavigate();

  if (!invoices || invoices.length === 0) {
    return <Typography sx={{ p: 2 }}>هیچ قبضی برای نمایش وجود ندارد.</Typography>;
  }

  return (
    <Box>
      {invoices.map((invoice) => (
        <Paper key={invoice.id} sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">{invoice.description}</Typography>
            <Typography color="text.secondary">مبلغ: {Number(invoice.totalAmount).toLocaleString('fa-IR')} ریال</Typography>
            <Typography color="text.secondary">مهلت پرداخت: {new Date(invoice.dueDate).toLocaleDateString('fa-IR')}</Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            {invoice.status === 'PENDING' || invoice.status === 'OVERDUE' ? (
              <Button variant="contained" color="primary" onClick={() => navigate(`/invoices/pay/${invoice.id}`)}>
                پرداخت
              </Button>
            ) : (
              <Typography color="success.main">پرداخت شده</Typography>
            )}
          </Box>
        </Paper>
      ))}
    </Box>
  );
};

const InvoicesPage = () => {
  const [tabValue, setTabValue] = useState(0);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoiceApi.getInvoices().then((res) => res.data),
  });

  const invoices = data || [];
  const unpaidInvoices = invoices.filter((inv) => inv.status === 'PENDING' || inv.status === 'OVERDUE');
  const paidInvoices = invoices.filter((inv) => inv.status === 'PAID');

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        مدیریت قبض‌ها
      </Typography>

      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">{getErrorMessage(error, 'دریافت قبض‌ها ناموفق بود.')}</Alert>}

      {!isLoading && !isError && (
        <Paper>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)} aria-label="invoice status tabs">
              <Tab label={`پرداخت نشده (${unpaidInvoices.length})`} />
              <Tab label={`پرداخت شده (${paidInvoices.length})`} />
            </Tabs>
          </Box>
          {tabValue === 0 && <Box sx={{ p: 2 }}><InvoiceList invoices={unpaidInvoices} /></Box>}
          {tabValue === 1 && <Box sx={{ p: 2 }}><InvoiceList invoices={paidInvoices} /></Box>}
        </Paper>
      )}
    </Box>
  );
};

export default InvoicesPage;
