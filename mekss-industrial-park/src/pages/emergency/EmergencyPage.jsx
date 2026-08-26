import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { emergencyApi } from '../../services/api/emergency.api';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { getErrorMessage } from '../../utils/apiError';

const EmergencyPage = () => {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const createMutation = useMutation({
    mutationFn: () => emergencyApi.createEmergency({ title: 'اعلام وضعیت اضطراری', description: 'اعلام وضعیت اضطراری توسط کاربر از طریق اپلیکیشن.', severity: 'CRITICAL' }),
    onSuccess: () => {
      showNotification('وضعیت اضطراری با موفقیت اعلام شد. تیم‌های مربوطه در اسرع وقت به محل اعزام خواهند شد.', 'success');
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['emergencies'] });
    },
    onError: (err) => showNotification(getErrorMessage(err, 'اعلام وضعیت اضطراری ناموفق بود. لطفا با نگهبانی تماس بگیرید.'), 'error'),
  });

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h4" gutterBottom color="error.main">
        اعلام وضعیت اضطراری (امداد و حریق)
      </Typography>
      <Paper sx={{ p: 4, maxWidth: 600, margin: 'auto' }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>توجه:</strong> از این دکمه فقط در مواقع اضطراری واقعی مانند آتش‌سوزی، حوادث صنعتی، یا نیاز فوری به امداد پزشکی استفاده کنید. استفاده نادرست از این سیستم پیگرد قانونی خواهد داشت.
        </Alert>
        <Button
          variant="contained"
          color="error"
          size="large"
          startIcon={createMutation.isPending ? <CircularProgress size={22} color="inherit" /> : <WarningIcon />}
          onClick={() => setConfirmOpen(true)}
          disabled={createMutation.isPending}
          sx={{ height: 80, fontSize: '1.5rem', fontWeight: 'bold' }}
        >
          اعلام خطر
        </Button>
      </Paper>
      <ConfirmDialog
        open={confirmOpen}
        title="تایید اعلام وضعیت اضطراری"
        description="آیا از اعلام وضعیت اضطراری اطمینان دارید؟ این عمل بلافاصله به مدیر شهرک و نگهبانی اطلاع‌رسانی خواهد کرد."
        confirmLabel="بله، اعلام خطر"
        confirmColor="error"
        loading={createMutation.isPending}
        onConfirm={() => createMutation.mutate()}
        onClose={() => setConfirmOpen(false)}
      />
    </Box>
  );
};

export default EmergencyPage;
