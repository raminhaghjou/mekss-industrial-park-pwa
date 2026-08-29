import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, CheckCircle as ApproveIcon, Cancel as RejectIcon } from '@mui/icons-material';
import { gatePassApi } from '../../services/api/gatePass.api';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { getErrorMessage } from '../../utils/apiError';

const VerifyGatePassPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [denyOpen, setDenyOpen] = React.useState(false);
  const [verifyOpen, setVerifyOpen] = React.useState(false);

  const { data: pass, isLoading, isError } = useQuery({
    queryKey: ['gate-pass', id],
    queryFn: () => gatePassApi.getGatePass(id).then((res) => res.data),
  });

  const verifyMutation = useMutation({
    mutationFn: () => gatePassApi.verifyGatePass(id),
    onSuccess: () => {
      showNotification(`خروج خودرو با پلاک ${pass?.licensePlate} با موفقیت ثبت شد.`, 'success');
      setVerifyOpen(false);
      navigate('/guard/gate-passes');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت خروج ناموفق بود.'), 'error'),
  });

  const denyMutation = useMutation({
    mutationFn: (/** @type {string} */ reason) => gatePassApi.denyGatePassExit(id, { reason }),
    onSuccess: () => {
      showNotification('گزارش مغایرت ثبت و به مدیر شهرک ارجاع داده شد.', 'success');
      navigate('/guard/gate-passes');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت گزارش مغایرت ناموفق بود.'), 'error'),
  });

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (isError || !pass) {
    return (
      <Box>
        <Alert severity="error">برگ خروج مورد نظر یافت نشد.</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/guard/gate-passes')} sx={{ mt: 2 }}>بازگشت به لیست</Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/guard/gate-passes')}>
          بازگشت به لیست
        </Button>
      </Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          بررسی جزئیات و تایید خروج
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}><Typography><strong>واحد صنعتی:</strong> {pass.factory?.name || '—'}</Typography></Grid>
          <Grid item xs={12} sm={6}><Typography><strong>تاریخ خروج:</strong> {new Date(pass.exitDate).toLocaleDateString('fa-IR')}</Typography></Grid>
          <Grid item xs={12} sm={6}><Typography><strong>نام راننده:</strong> {pass.driverName}</Typography></Grid>
          <Grid item xs={12} sm={6}><Typography><strong>شماره پلاک:</strong> {pass.licensePlate}</Typography></Grid>
          <Grid item xs={12}><Typography><strong>توضیحات بار:</strong> {pass.cargoDescription || '—'}</Typography></Grid>
        </Grid>
        <Divider sx={{ my: 3 }} />
        <Alert severity="info" sx={{ mb: 3 }}>
          لطفا اطلاعات نمایش داده شده را با مشخصات خودرو و بار تطبیق دهید.
        </Alert>
        <Box sx={{ textAlign: 'center', display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={verifyMutation.isPending ? <CircularProgress size={22} color="inherit" /> : <ApproveIcon />}
            onClick={() => setVerifyOpen(true)}
            disabled={verifyMutation.isPending || pass.status !== 'APPROVED'}
          >
            ثبت خروج
          </Button>
          <Button
            variant="contained"
            color="error"
            size="large"
            startIcon={<RejectIcon />}
            onClick={() => setDenyOpen(true)}
            disabled={pass.status !== 'APPROVED'}
          >
            اعلام مغایرت
          </Button>
        </Box>
        {pass.status !== 'APPROVED' && (
          <Alert severity="warning" sx={{ mt: 2 }}>این برگ خروج در وضعیت قابل خروج نیست.</Alert>
        )}
      </Paper>
      <ConfirmDialog
        open={verifyOpen}
        title="ثبت خروج"
        description={`با تایید این عملیات، خروج خودرو با پلاک «${pass.licensePlate}» ثبت نهایی می‌شود. آیا اطمینان دارید؟`}
        confirmLabel="ثبت خروج"
        confirmColor="primary"
        loading={verifyMutation.isPending}
        onConfirm={() => verifyMutation.mutate()}
        onClose={() => setVerifyOpen(false)}
      />
      <ConfirmDialog
        open={denyOpen}
        title="اعلام مغایرت"
        description="لطفا دلیل مغایرت و عدم اجازه خروج را ذکر کنید."
        requireReason
        reasonLabel="دلیل مغایرت"
        confirmLabel="ثبت مغایرت"
        confirmColor="error"
        loading={denyMutation.isPending}
        onConfirm={(reason) => denyMutation.mutate(reason)}
        onClose={() => setDenyOpen(false)}
      />
    </Box>
  );
};

export default VerifyGatePassPage;
