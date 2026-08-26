import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Paper, TextField, Button, MenuItem, CircularProgress, Alert } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { requestApi } from '../../services/api/request.api';
import { factoryApi } from '../../services/api/factory.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

const requestTypeMap = {
  repair: 'OTHER',
  services: 'OTHER',
  permit: 'CONSTRUCTION_PERMIT',
  general: 'OTHER',
  MISSION: 'MISSION',
  TRANSFER: 'TRANSFER',
  DAILY_LEAVE: 'DAILY_LEAVE',
  HOURLY_LEAVE: 'HOURLY_LEAVE',
  LOAN: 'LOAN',
  SETTLEMENT: 'SETTLEMENT',
  CONSTRUCTION_PERMIT: 'CONSTRUCTION_PERMIT',
  FINAL_INSPECTION: 'FINAL_INSPECTION',
  APPOINTMENT: 'APPOINTMENT',
  OTHER: 'OTHER',
};

const requestTypes = [
  { value: 'MISSION', label: 'ماموریت' },
  { value: 'TRANSFER', label: 'انتقال' },
  { value: 'DAILY_LEAVE', label: 'مرخصی روزانه' },
  { value: 'HOURLY_LEAVE', label: 'مرخصی ساعتی' },
  { value: 'LOAN', label: 'وام' },
  { value: 'SETTLEMENT', label: 'تسویه حساب' },
  { value: 'CONSTRUCTION_PERMIT', label: 'مجوز ساخت' },
  { value: 'FINAL_INSPECTION', label: 'بازرسی نهایی' },
  { value: 'APPOINTMENT', label: 'وقت ملاقات' },
  { value: 'OTHER', label: 'سایر' },
];

const NewRequestPage = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  const [requestType, setRequestType] = React.useState(requestTypeMap[type] || 'OTHER');
  const [factoryId, setFactoryId] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [description, setDescription] = React.useState('');

  const { data: factories, isLoading: loadingFactories, isError: factoriesError } = useQuery({
    queryKey: ['factories', 'managed'],
    queryFn: () => factoryApi.getFactories().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (/** @type {{factoryId: string, type: string, title: string, description: string}} */ payload) => requestApi.createRequest(payload),
    onSuccess: () => {
      showNotification('درخواست شما با موفقیت ثبت شد.', 'success');
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      navigate('/requests');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت درخواست ناموفق بود.'), 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!factoryId || !subject.trim() || !description.trim()) {
      showNotification('لطفا تمام فیلدهای الزامی را پر کنید.', 'error');
      return;
    }
    createMutation.mutate({ factoryId, type: requestType, title: subject, description });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/requests')}>
          بازگشت به لیست
        </Button>
      </Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          فرم ثبت درخواست جدید
        </Typography>
        {factoriesError && <Alert severity="error" sx={{ mb: 2 }}>دریافت لیست واحدهای صنعتی ناموفق بود.</Alert>}
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField select fullWidth required label="واحد صنعتی" value={factoryId} onChange={(e) => setFactoryId(e.target.value)} margin="normal" disabled={loadingFactories}>
            {(factories || []).map((factory) => <MenuItem key={factory.id} value={factory.id}>{factory.name}</MenuItem>)}
          </TextField>
          <TextField select fullWidth required label="نوع درخواست" value={requestType} onChange={(e) => setRequestType(e.target.value)} margin="normal">
            {requestTypes.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </TextField>
          <TextField fullWidth required label="موضوع" value={subject} onChange={(e) => setSubject(e.target.value)} margin="normal" />
          <TextField fullWidth required label="شرح درخواست" multiline rows={5} value={description} onChange={(e) => setDescription(e.target.value)} margin="normal" />
          <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={createMutation.isPending}>
            {createMutation.isPending ? <CircularProgress size={22} /> : 'ثبت درخواست'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default NewRequestPage;
