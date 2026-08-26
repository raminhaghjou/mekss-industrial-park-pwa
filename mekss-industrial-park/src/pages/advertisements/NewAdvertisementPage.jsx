import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Paper, TextField, Button, MenuItem, CircularProgress } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
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

  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState('OTHER');
  const [province, setProvince] = React.useState('');
  const [city, setCity] = React.useState('');
  const [content, setContent] = React.useState('');
  const [contact, setContact] = React.useState('');

  const createMutation = useMutation({
    mutationFn: (/** @type {{title: string, category: string, province: string, city: string, content: string, contactInfo: {phone: string}}} */ payload) => advertisementApi.createAdvertisement(payload),
    onSuccess: () => {
      showNotification('آگهی شما پس از تایید مدیر شهرک، نمایش داده خواهد شد.', 'success');
      queryClient.invalidateQueries({ queryKey: ['advertisements'] });
      navigate('/advertisements');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت آگهی ناموفق بود.'), 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !contact.trim() || !province.trim() || !city.trim()) {
      showNotification('لطفا تمام فیلدهای الزامی را پر کنید.', 'error');
      return;
    }
    createMutation.mutate({ title, category, province, city, content, contactInfo: { phone: contact } });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/advertisements')}>
          بازگشت به آگهی‌ها
        </Button>
      </Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          فرم ثبت آگهی جدید
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField fullWidth required label="عنوان آگهی" value={title} onChange={(e) => setTitle(e.target.value)} margin="normal" />
          <TextField select fullWidth required label="دسته‌بندی" value={category} onChange={(e) => setCategory(e.target.value)} margin="normal">
            {categories.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
          <TextField fullWidth required label="استان" value={province} onChange={(e) => setProvince(e.target.value)} margin="normal" />
          <TextField fullWidth required label="شهر" value={city} onChange={(e) => setCity(e.target.value)} margin="normal" />
          <TextField fullWidth required label="شرح آگهی" multiline rows={5} value={content} onChange={(e) => setContent(e.target.value)} margin="normal" />
          <TextField fullWidth required label="اطلاعات تماس (تلفن، داخلی و...)" value={contact} onChange={(e) => setContact(e.target.value)} margin="normal" />
          <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={createMutation.isPending}>
            {createMutation.isPending ? <CircularProgress size={22} /> : 'ثبت آگهی'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default NewAdvertisementPage;
