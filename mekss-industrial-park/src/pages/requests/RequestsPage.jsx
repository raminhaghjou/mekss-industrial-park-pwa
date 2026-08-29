import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert } from '@mui/material';
import { Add as AddIcon, AssignmentOutlined as RequestOutlineIcon } from '@mui/icons-material';
import { requestApi } from '../../services/api/request.api';
import { getErrorMessage } from '../../utils/apiError';
import { requestStatusLabels as statusLabels, requestTypeLabels as typeLabels } from '../../constants/persianLabels';
import { EmptyState } from '../../components/common/EmptyState';

const statusColors = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'error', CANCELLED: 'default' };

const RequestsPage = () => {
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['requests'],
    queryFn: () => requestApi.getRequests().then((res) => res.data),
  });

  const requests = data || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">درخواست‌های من</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/requests/new/general')}>
          ثبت درخواست جدید
        </Button>
      </Box>
      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">{getErrorMessage(error, 'دریافت درخواست‌ها ناموفق بود.')}</Alert>}
      {!isLoading && !isError && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>نوع</TableCell>
                <TableCell>موضوع</TableCell>
                <TableCell>تاریخ</TableCell>
                <TableCell>وضعیت</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyState
                      icon={<RequestOutlineIcon fontSize="medium" />}
                      title="هنوز درخواستی ثبت نکرده‌اید"
                      description="با دکمه «ثبت درخواست جدید» می‌توانید اولین درخواست خود را ارسال کنید."
                    />
                  </TableCell>
                </TableRow>
              )}
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>{typeLabels[req.type] || req.type}</TableCell>
                  <TableCell>{req.title}</TableCell>
                  <TableCell>{new Date(req.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                  <TableCell><Chip label={statusLabels[req.status] || req.status} color={statusColors[req.status] || 'default'} size="small" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default RequestsPage;
