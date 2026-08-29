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
  Tabs,
  Tab,
  CircularProgress,
  Alert,
} from '@mui/material';
import { CheckCircle as ApproveIcon, Cancel as RejectIcon, ConfirmationNumberOutlined as GatePassOutlineIcon } from '@mui/icons-material';
import { gatePassApi } from '../../services/api/gatePass.api';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { getErrorMessage } from '../../utils/apiError';

const ApproveGatePassesPage = () => {
  const [tab, setTab] = React.useState(0);
  const [approveTarget, setApproveTarget] = React.useState(null);
  const [rejectTarget, setRejectTarget] = React.useState(null);
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['gate-passes', 'managed'],
    queryFn: () => gatePassApi.getGatePasses().then((res) => res.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['gate-passes', 'managed'] });

  const approveMutation = useMutation({
    mutationFn: (/** @type {string} */ id) => gatePassApi.approveGatePass(id),
    onSuccess: () => { showNotification('برگ خروج با موفقیت تایید شد.', 'success'); setApproveTarget(null); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'تایید برگ خروج ناموفق بود.'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (/** @type {{id: string, reason: string}} */ { id, reason }) => gatePassApi.rejectGatePass(id, { reason }),
    onSuccess: () => { showNotification('برگ خروج رد شد.', 'success'); setRejectTarget(null); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'رد برگ خروج ناموفق بود.'), 'error'),
  });

  const passes = data || [];
  const filteredPasses = passes.filter((p) => (tab === 0 ? p.status === 'PENDING' : p.status !== 'PENDING'));

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        تایید برگ‌های خروج
      </Typography>
      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)}>
            <Tab label="در انتظار تایید" />
            <Tab label="تاریخچه" />
          </Tabs>
        </Box>
        {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
        {isError && <Alert severity="error" sx={{ m: 2 }}>{getErrorMessage(error, 'دریافت برگ‌های خروج ناموفق بود.')}</Alert>}
        {!isLoading && !isError && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>واحد صنعتی</TableCell>
                  <TableCell>نام راننده</TableCell>
                  <TableCell>شماره پلاک</TableCell>
                  <TableCell>تاریخ خروج</TableCell>
                  <TableCell align="center">عملیات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPasses.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <EmptyState
                        icon={<GatePassOutlineIcon fontSize="medium" />}
                        title={tab === 0 ? 'برگ خروجی در انتظار تایید نیست' : 'تاریخچه‌ای برای نمایش وجود ندارد'}
                        description={tab === 0 ? 'به محض ثبت برگ خروج جدید توسط واحدهای صنعتی، برای بررسی اینجا نمایش داده می‌شود.' : undefined}
                      />
                    </TableCell>
                  </TableRow>
                )}
                {filteredPasses.map((pass) => (
                  <TableRow key={pass.id}>
                    <TableCell>{pass.factory?.name || '—'}</TableCell>
                    <TableCell>{pass.driverName}</TableCell>
                    <TableCell>{pass.licensePlate}</TableCell>
                    <TableCell>{new Date(pass.exitDate).toLocaleDateString('fa-IR')}</TableCell>
                    <TableCell align="center">
                      {pass.status === 'PENDING' && (
                        <>
                          <Tooltip title="تایید">
                            <span>
                              <IconButton color="success" onClick={() => setApproveTarget(pass.id)} disabled={approveMutation.isPending}>
                                <ApproveIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="رد کردن">
                            <span>
                              <IconButton color="error" onClick={() => setRejectTarget(pass.id)}>
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
        title="تایید برگ خروج"
        description="با تایید این برگ خروج، اجازه تردد برای واحد صنعتی صادر می‌شود. آیا اطمینان دارید؟"
        confirmLabel="تایید"
        confirmColor="primary"
        loading={approveMutation.isPending}
        onConfirm={() => approveMutation.mutate(approveTarget)}
        onClose={() => setApproveTarget(null)}
      />
      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="رد برگ خروج"
        description="لطفا دلیل رد این برگ خروج را وارد کنید."
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

export default ApproveGatePassesPage;
