import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';

const mockInvoices = [
  { id: 'INV-101', factory: 'واحد صنعتی پولاد', title: 'قبض برق', amount: '۱,۵۰۰,۰۰۰', status: 'UNPAID' },
  { id: 'INV-102', factory: 'کارخانه پلاستیک سازی نوین', title: 'شارژ و نگهداری', amount: '۵,۰۰۰,۰۰۰', status: 'UNPAID' },
  { id: 'INV-103', factory: 'تولیدی پوشاک تابان', title: 'قبض آب', amount: '۷۵۰,۰۰۰', status: 'PAID' },
  { id: 'INV-104', factory: 'واحد صنعتی پولاد', title: 'شارژ و نگهداری', amount: '۵,۰۰۰,۰۰۰', status: 'PAID' },
];

const statusColors = { UNPAID: 'warning', PAID: 'success' };
const statusLabels = { UNPAID: 'پرداخت نشده', PAID: 'پرداخت شده' };

const ManageInvoicesPage = () => {
  const [tab, setTab] = React.useState(0);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const filteredInvoices = mockInvoices.filter(inv => {
      if(tab === 0) return true; // All
      if(tab === 1) return inv.status === 'UNPAID';
      if(tab === 2) return inv.status === 'PAID';
      return false;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          مدیریت قبض‌ها
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          // onClick={() => navigate('/admin/invoices/create')} // Add navigation later
        >
          صدور قبض جدید
        </Button>
      </Box>
      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tab} onChange={handleTabChange}>
                <Tab label="همه" />
                <Tab label="پرداخت نشده" />
                <Tab label="پرداخت شده" />
            </Tabs>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>شناسه</TableCell>
                <TableCell>واحد صنعتی</TableCell>
                <TableCell>عنوان</TableCell>
                <TableCell>مبلغ (ریال)</TableCell>
                <TableCell>وضعیت</TableCell>
                <TableCell align="center">عملیات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{invoice.id}</TableCell>
                  <TableCell>{invoice.factory}</TableCell>
                  <TableCell>{invoice.title}</TableCell>
                  <TableCell>{invoice.amount}</TableCell>
                  <TableCell>
                    <Chip label={statusLabels[invoice.status]} color={statusColors[invoice.status]} size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small"><EditIcon /></IconButton>
                    <IconButton size="small" color="error"><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default ManageInvoicesPage;
