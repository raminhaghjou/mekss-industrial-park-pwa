import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { ArrowBack as ArrowBackIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { advertisementApi } from '../../services/api/advertisement.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

const categories = [
  { value: 'EQUIPMENT', label: 'تجهیزات' },
  { value: 'SERVICES', label: 'خدمات' },
  { value: 'RAW_MATERIALS', label: 'مواد اولیه' },
  { value: 'JOB_LISTINGS', label: 'فرصت شغلی' },
  { value: 'REAL_ESTATE', label: 'املاک' },
  { value: 'OTHER', label: 'سایر' },
];

const NewAdvertisementPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [form, setForm] = React.useState({
    title: '', category: 'OTHER', province: '', city: '', content: '', contact: '', parkId: '',
  });

  const scopeQuery = useQuery({
    queryKey: ['advertisements', 'creation-scope'],
    queryFn: () => advertisementApi.getCreationScope().then((response) => response.data),
  });

  React.useEffect(() => {
    if (scopeQuery.data?.autoSelectedParkId) {
      setForm((current) => current.parkId ? current : { ...current, parkId: scopeQuery.data.autoSelectedParkId });
    }
  }, [scopeQuery.data?.autoSelectedParkId]);

  const createMutation = useMutation({
    mutationFn: (/** @type {{title: string, category: string, province: string, city: string, content: string, contactInfo: {phone: string}, parkId: string}} */ payload) => advertisementApi.createAdvertisement(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['advertisements'] }),
        queryClient.invalidateQueries({ queryKey: ['analytics', 'dashboard'] }),
      ]);
      showNotification('آگهی با scope معتبر ثبت شد و پس از تایید نمایش داده می‌شود.', 'success');
      navigate('/advertisements');
    },
    onError: (error) => showNotification(getErrorMessage(error, 'ثبت آگهی ناموفق بود.'), 'error'),
  });

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const required = [form.title, form.content, form.contact, form.province, form.city, form.parkId];
    if (required.some((value) => !value.trim())) {
      showNotification('لطفاً همه فیلدهای الزامی و شهرک صنعتی را تکمیل کنید.', 'error');
      return;
    }
    createMutation.mutate({
      title: form.title,
      category: form.category,
      province: form.province,
      city: form.city,
      content: form.content,
      contactInfo: { phone: form.contact },
      parkId: form.parkId,
    });
  };

  const scope = scopeQuery.data;
  const unavailable = scope && !scope.canCreate;

  return (
    <Stack spacing={2.5}>
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/advertisements')}>بازگشت به آگهی‌ها</Button>
      </Box>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 760, width: '100%', mx: 'auto' }}>
        <Typography variant="h5">ثبت آگهی جدید</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>
          شهرک صنعتی از دسترسی واقعی حساب شما تعیین می‌شود و پس از ثبت قابل جابه‌جایی نیست.
        </Typography>

        {scopeQuery.isLoading && <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 180 }}><CircularProgress /></Box>}
        {scopeQuery.isError && (
          <Alert
            severity="error"
            action={<Button color="inherit" startIcon={<RefreshIcon />} onClick={() => scopeQuery.refetch()}>تلاش دوباره</Button>}
          >
            {getErrorMessage(scopeQuery.error, 'دریافت محدوده مجاز ثبت آگهی ناموفق بود.')}
          </Alert>
        )}
        {unavailable && (
          <Alert severity="warning">هیچ شهرک صنعتی فعال و مرتبطی برای حساب شما وجود ندارد؛ ثبت آگهی فعلاً ممکن نیست.</Alert>
        )}

        {!scopeQuery.isLoading && !scopeQuery.isError && !unavailable && (
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField fullWidth required label="عنوان آگهی" value={form.title} onChange={update('title')} margin="normal" inputProps={{ maxLength: 200 }} />
            <TextField select fullWidth required label="دسته‌بندی" value={form.category} onChange={update('category')} margin="normal">
              {categories.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </TextField>
            <TextField
              select
              fullWidth
              required
              label="شهرک صنعتی"
              value={form.parkId}
              onChange={update('parkId')}
              margin="normal"
              disabled={!scope?.requiresSelection}
              helperText={scope?.requiresSelection ? 'یکی از محدوده‌های مجاز حساب را انتخاب کنید.' : 'شهرک مرتبط به‌صورت خودکار تعیین شده است.'}
            >
              {(scope?.parks || []).map((park) => <MenuItem key={park.id} value={park.id}>{park.name} ({park.code})</MenuItem>)}
            </TextField>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField fullWidth required label="استان" value={form.province} onChange={update('province')} margin="normal" />
              <TextField fullWidth required label="شهر" value={form.city} onChange={update('city')} margin="normal" />
            </Box>
            <TextField fullWidth required label="شرح آگهی" multiline minRows={5} value={form.content} onChange={update('content')} margin="normal" inputProps={{ maxLength: 8000 }} />
            <TextField fullWidth required label="شماره تماس" value={form.contact} onChange={update('contact')} margin="normal" inputProps={{ dir: 'ltr', maxLength: 20 }} />
            <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={createMutation.isPending || !form.parkId}>
              {createMutation.isPending ? <CircularProgress size={22} color="inherit" /> : 'ثبت برای بررسی'}
            </Button>
          </Box>
        )}
      </Paper>
    </Stack>
  );
};

export default NewAdvertisementPage;
