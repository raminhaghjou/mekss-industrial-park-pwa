import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  CircularProgress,
  Alert,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { factoryApi } from '../../services/api/factory.api';
import { invoiceApi } from '../../services/api/invoice.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

const CreateInvoicePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  const [factoryId, setFactoryId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [taxAmount, setTaxAmount] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');

  const { data: factories, isLoading: loadingFactories, isError: factoriesError } = useQuery({
    queryKey: ['factories', 'managed'],
    queryFn: () => factoryApi.getFactories().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (/** @type {{factoryId: string, description: string, amount: number, taxAmount: number, dueDate: string}} */ payload) => invoiceApi.createInvoice(payload),
    onSuccess: () => {
      showNotification('قبض با موفقیت صادر شد.', 'success');
      queryClient.invalidateQueries({ queryKey: ['invoices', 'managed'] });
      navigate('/admin/invoices');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'صدور قبض ناموفق بود.'), 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!factoryId || !description.trim() || !amount || !dueDate) {
      showNotification('لطفا تمام فیلدهای الزامی را پر کنید.', 'error');
      return;
    }
    createMutation.mutate({
      factoryId,
      description,
      amount: Number(amount),
      taxAmount: taxAmount ? Number(taxAmount) : 0,
      dueDate,
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/invoices')}>
          بازگشت
        </Button>
      </Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          فرم صدور قبض جدید
        </Typography>
        {factoriesError && <Alert severity="error" sx={{ mb: 2 }}>دریافت لیست واحدهای صنعتی ناموفق بود.</Alert>}
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel id="factory-select-label">انتخاب واحد صنعتی</InputLabel>
                <Select
                  labelId="factory-select-label"
                  value={factoryId}
                  onChange={(e) => setFactoryId(e.target.value)}
                  label="انتخاب واحد صنعتی"
                  disabled={loadingFactories}
                >
                  {(factories || []).map((factory) => (
                    <MenuItem key={factory.id} value={factory.id}>{factory.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="شرح قبض" value={description} onChange={(e) => setDescription(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth required label="مبلغ (ریال)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField fullWidth label="مبلغ مالیات (ریال)" type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="مهلت پرداخت" type="date" InputLabelProps={{ shrink: true }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Grid>
            <Grid item xs={12} sx={{ textAlign: 'right' }}>
              <Button type="submit" variant="contained" disabled={createMutation.isPending}>
                {createMutation.isPending ? <CircularProgress size={22} /> : 'صدور قبض'}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default CreateInvoicePage;
