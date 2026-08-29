import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import { Add as AddIcon, ReceiptOutlined as ReceiptOutlineIcon } from '@mui/icons-material';
import { invoiceApi } from '../../services/api/invoice.api';
import { EmptyState } from '../../components/common/EmptyState';
import { getErrorMessage } from '../../utils/apiError';

const statusColors = { PENDING: 'warning', PAID: 'success', OVERDUE: 'error', CANCELLED: 'default' };
const statusLabels = { PENDING: 'پرداخت نشده', PAID: 'پرداخت شده', OVERDUE: 'سررسید گذشته', CANCELLED: 'لغو شده' };

const ManageInvoicesPage = () => {
  const navigate = useNavigate();
  const [tab, setTab] = React.useState(0);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['invoices', 'managed'],
    queryFn: () => invoiceApi.getInvoices().then((res) => res.data),
  });

  const invoices = data || [];
  const filteredInvoices = invoices.filter((inv) => {
    if (tab === 0) return true;
    if (tab === 1) return inv.status === 'PENDING' || inv.status === 'OVERDUE';
    if (tab === 2) return inv.status === 'PAID';
    return false;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">مدیریت قبض‌ها</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/admin/invoices/create')}>
          صدور قبض جدید
        </Button>
      </Box>
      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)}>
            <Tab label="همه" />
            <Tab label="پرداخت نشده" />
            <Tab label="پرداخت شده" />
          </Tabs>
        </Box>
        {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
        {isError && <Alert severity="error" sx={{ m: 2 }}>{getErrorMessage(error, 'دریافت قبض‌ها ناموفق بود.')}</Alert>}
        {!isLoading && !isError && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>شماره قبض</TableCell>
                  <TableCell>واحد صنعتی</TableCell>
                  <TableCell>شرح</TableCell>
                  <TableCell>مبلغ (ریال)</TableCell>
                  <TableCell>وضعیت</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInvoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <EmptyState
                        icon={<ReceiptOutlineIcon fontSize="medium" />}
                        title="قبضی برای نمایش وجود ندارد"
                        description="قبض‌های صادرشده برای واحدهای صنعتی در این فهرست نمایش داده می‌شوند."
                      />
                    </TableCell>
                  </TableRow>
                )}
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.factory?.name || '—'}</TableCell>
                    <TableCell>{invoice.description}</TableCell>
                    <TableCell>{Number(invoice.totalAmount).toLocaleString('fa-IR')}</TableCell>
                    <TableCell>
                      <Chip label={statusLabels[invoice.status] || invoice.status} color={statusColors[invoice.status] || 'default'} size="small" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      <Tooltip title="ویرایش و حذف قبض پس از صدور، به دلیل جلوگیری از مغایرت مالی، در این نسخه پشتیبانی نمی‌شود.">
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          قبض‌های صادر شده قابل ویرایش یا حذف نیستند.
        </Typography>
      </Tooltip>
    </Box>
  );
};

export default ManageInvoicesPage;
