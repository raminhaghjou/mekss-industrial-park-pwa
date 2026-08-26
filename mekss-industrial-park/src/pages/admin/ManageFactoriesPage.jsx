import React from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { CheckCircle as ApproveIcon, Cancel as RejectIcon } from '@mui/icons-material';
import { factoryApi } from '../../services/api/factory.api';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { getErrorMessage } from '../../utils/apiError';

const statusColors = { PENDING: 'warning', ACTIVE: 'success', INACTIVE: 'default', SUSPENDED: 'error' };
const statusLabels = { PENDING: 'در انتظار تایید', ACTIVE: 'فعال', INACTIVE: 'غیرفعال', SUSPENDED: 'معلق' };

const ManageFactoriesPage = () => {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = React.useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['factories', 'managed'],
    queryFn: () => factoryApi.getFactories().then((res) => res.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['factories', 'managed'] });

  const approveMutation = useMutation({
    mutationFn: (/** @type {string} */ factoryId) => factoryApi.updateFactory(factoryId, { status: 'ACTIVE', isApproved: true }),
    onSuccess: () => { showNotification('واحد صنعتی با موفقیت تایید شد.', 'success'); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'تایید واحد صنعتی ناموفق بود.'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (/** @type {{factoryId: string, reason: string}} */ { factoryId, reason }) => factoryApi.updateFactory(factoryId, { status: 'INACTIVE', isApproved: false, description: reason }),
    onSuccess: () => { showNotification('درخواست ثبت‌نام واحد صنعتی رد شد.', 'success'); setRejectTarget(null); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'رد درخواست ناموفق بود.'), 'error'),
  });

  const factories = data || [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        مدیریت واحدهای صنعتی
      </Typography>
      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">{getErrorMessage(error, 'دریافت لیست واحدهای صنعتی ناموفق بود.')}</Alert>}
      {!isLoading && !isError && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>نام واحد</TableCell>
                <TableCell>نام مدیر</TableCell>
                <TableCell>شهرک</TableCell>
                <TableCell>وضعیت</TableCell>
                <TableCell align="center">عملیات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {factories.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center">هیچ واحد صنعتی‌ای برای نمایش وجود ندارد.</TableCell></TableRow>
              )}
              {factories.map((factory) => (
                <TableRow key={factory.id}>
                  <TableCell>{factory.name}</TableCell>
                  <TableCell>{factory.manager?.name || '—'}</TableCell>
                  <TableCell>{factory.park?.name || '—'}</TableCell>
                  <TableCell>
                    <Chip label={statusLabels[factory.status] || factory.status} color={statusColors[factory.status] || 'default'} size="small" />
                  </TableCell>
                  <TableCell align="center">
                    {factory.status === 'PENDING' && (
                      <>
                        <Tooltip title="تایید ثبت‌نام">
                          <span>
                            <IconButton color="success" onClick={() => approveMutation.mutate(factory.id)} disabled={approveMutation.isPending}>
                              <ApproveIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="رد کردن">
                          <span>
                            <IconButton color="error" onClick={() => setRejectTarget(factory.id)}>
                              <RejectIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="رد ثبت‌نام واحد صنعتی"
        description="لطفا دلیل رد این ثبت‌نام را وارد کنید. این دلیل برای مالک واحد صنعتی ارسال خواهد شد."
        requireReason
        reasonLabel="دلیل رد"
        confirmLabel="رد کردن"
        confirmColor="error"
        loading={rejectMutation.isPending}
        onConfirm={(reason) => rejectMutation.mutate({ factoryId: rejectTarget, reason })}
        onClose={() => setRejectTarget(null)}
      />
    </Box>
  );
};

export default ManageFactoriesPage;
