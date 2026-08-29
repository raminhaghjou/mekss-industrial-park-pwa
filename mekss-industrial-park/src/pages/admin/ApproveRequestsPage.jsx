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
  IconButton,
  Tooltip,
  Chip,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
} from '@mui/material';
import { CheckCircle as ApproveIcon, Cancel as RejectIcon, AssignmentOutlined as RequestOutlineIcon } from '@mui/icons-material';
import { requestApi } from '../../services/api/request.api';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { getErrorMessage } from '../../utils/apiError';
import { requestStatusLabels as statusLabels } from '../../constants/persianLabels';

const statusColors = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'error', CANCELLED: 'default' };

const ApproveRequestsPage = () => {
  const [tab, setTab] = React.useState(0);
  const [approveTarget, setApproveTarget] = React.useState(null);
  const [rejectTarget, setRejectTarget] = React.useState(null);
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['requests', 'managed'],
    queryFn: () => requestApi.getRequests().then((res) => res.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['requests', 'managed'] });

  const approveMutation = useMutation({
    mutationFn: (/** @type {string} */ id) => requestApi.approveRequest(id),
    onSuccess: () => { showNotification('درخواست با موفقیت تایید شد.', 'success'); setApproveTarget(null); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'تایید درخواست ناموفق بود.'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (/** @type {{id: string, reason: string}} */ { id, reason }) => requestApi.rejectRequest(id, { reason }),
    onSuccess: () => { showNotification('درخواست رد شد.', 'success'); setRejectTarget(null); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'رد درخواست ناموفق بود.'), 'error'),
  });

  const requests = data || [];
  const filteredRequests = requests.filter((req) => (tab === 0 ? req.status === 'PENDING' : req.status !== 'PENDING'));

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        تایید درخواست‌ها
      </Typography>
      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)}>
            <Tab label="در انتظار بررسی" />
            <Tab label="تاریخچه" />
          </Tabs>
        </Box>
        {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
        {isError && <Alert severity="error" sx={{ m: 2 }}>{getErrorMessage(error, 'دریافت درخواست‌ها ناموفق بود.')}</Alert>}
        {!isLoading && !isError && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>واحد صنعتی</TableCell>
                  <TableCell>موضوع</TableCell>
                  <TableCell>تاریخ</TableCell>
                  <TableCell>وضعیت</TableCell>
                  <TableCell align="center">عملیات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRequests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <EmptyState
                        icon={<RequestOutlineIcon fontSize="medium" />}
                        title={tab === 0 ? 'درخواستی در انتظار بررسی نیست' : 'تاریخچه‌ای برای نمایش وجود ندارد'}
                        description={tab === 0 ? 'درخواست‌های جدید واحدهای صنعتی برای بررسی در این بخش نمایش داده می‌شوند.' : undefined}
                      />
                    </TableCell>
                  </TableRow>
                )}
                {filteredRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{req.factory?.name || '—'}</TableCell>
                    <TableCell>{req.title}</TableCell>
                    <TableCell>{new Date(req.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                    <TableCell>
                      <Chip label={statusLabels[req.status] || req.status} color={statusColors[req.status] || 'default'} size="small" />
                    </TableCell>
                    <TableCell align="center">
                      {req.status === 'PENDING' && (
                        <>
                          <Tooltip title="تایید">
                            <span>
                              <IconButton color="success" onClick={() => setApproveTarget(req.id)} disabled={approveMutation.isPending}>
                                <ApproveIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="رد کردن">
                            <span>
                              <IconButton color="error" onClick={() => setRejectTarget(req.id)}>
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
      </Paper>
      <ConfirmDialog
        open={Boolean(approveTarget)}
        title="تایید درخواست"
        description="با تایید این درخواست، نتیجه برای متقاضی نهایی می‌شود. آیا اطمینان دارید؟"
        confirmLabel="تایید"
        confirmColor="primary"
        loading={approveMutation.isPending}
        onConfirm={() => approveMutation.mutate(approveTarget)}
        onClose={() => setApproveTarget(null)}
      />
      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="رد درخواست"
        description="لطفا دلیل رد این درخواست را وارد کنید."
        requireReason
        reasonLabel="دلیل رد"
        confirmLabel="رد کردن"
        confirmColor="error"
        loading={rejectMutation.isPending}
        onConfirm={(reason) => rejectMutation.mutate({ id: rejectTarget, reason })}
        onClose={() => setRejectTarget(null)}
      />
    </Box>
  );
};

export default ApproveRequestsPage;
