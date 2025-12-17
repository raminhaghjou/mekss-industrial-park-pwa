import React, { useState } from 'react';
import { Box, Typography, Button, Paper, Tabs, Tab } from '@mui/material';
import { useNavigate } from 'react-router-dom';

// Mock Data - Replace with API call
const mockInvoices = [
  { id: 'INV-001', title: ' قبض برق - خرداد ۱۴۰۲', amount: '۱,۵۰۰,۰۰۰', dueDate: '۱۴۰۲/۰۴/۱۰', status: 'UNPAID' },
  { id: 'INV-002', title: 'هزینه شارژ و نگهداری', amount: '۵,۰۰۰,۰۰۰', dueDate: '۱۴۰۲/۰۴/۱۵', status: 'UNPAID' },
  { id: 'INV-003', title: 'قبض آب - اردیبهشت ۱۴۰۲', amount: '۷۵۰,۰۰۰', dueDate: '۱۴۰۲/۰۳/۱۰', status: 'PAID' },
  { id: 'INV-004', title: 'قبض گاز - اردیبهشت ۱۴۰۲', amount: '۲,۲۰۰,۰۰۰', dueDate: '۱۴۰۲/۰۳/۱۲', status: 'PAID' },
];

// Reusable InvoiceList component (can be moved to its own file)
const InvoiceList = ({ invoices }) => {
    const navigate = useNavigate();

    if(!invoices || invoices.length === 0) {
        return <Typography sx={{p: 2}}>هیچ قبضی برای نمایش وجود ندارد.</Typography>
    }

  return (
    <Box>
      {invoices.map((invoice) => (
        <Paper key={invoice.id} sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6">{invoice.title}</Typography>
            <Typography color="text.secondary">مبلغ: {invoice.amount} ریال</Typography>
            <Typography color="text.secondary">مهلت پرداخت: {invoice.dueDate}</Typography>
          </Box>
          <Box sx={{textAlign: 'right'}}>
            {invoice.status === 'UNPAID' ? (
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

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const unpaidInvoices = mockInvoices.filter(inv => inv.status === 'UNPAID');
  const paidInvoices = mockInvoices.filter(inv => inv.status === 'PAID');

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        مدیریت قبض‌ها
      </Typography>

      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="invoice status tabs">
            <Tab label={`پرداخت نشده (${unpaidInvoices.length})`} />
            <Tab label={`پرداخت شده (${paidInvoices.length})`} />
          </Tabs>
        </Box>

        {tabValue === 0 && (
            <Box sx={{p: 2}}>
                <InvoiceList invoices={unpaidInvoices} />
            </Box>
        )}
        {tabValue === 1 && (
            <Box sx={{p: 2}}>
                <InvoiceList invoices={paidInvoices} />
            </Box>
        )}

      </Paper>
    </Box>
  );
};

export default InvoicesPage;
