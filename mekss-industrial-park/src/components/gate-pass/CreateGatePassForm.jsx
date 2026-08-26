import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  IconButton,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { factoryApi } from '../../services/api/factory.api';
import { gatePassApi } from '../../services/api/gatePass.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

const cargoTypes = [
  { value: 'RAW_MATERIALS', label: 'مواد اولیه' },
  { value: 'FINISHED_GOODS', label: 'محصول نهایی' },
  { value: 'WASTE', label: 'ضایعات' },
  { value: 'SUPPLIES', label: 'ملزومات' },
  { value: 'EQUIPMENT', label: 'تجهیزات' },
  { value: 'OTHER', label: 'سایر' },
];

const vehicleTypes = [
  { value: 'TRUCK', label: 'کامیون' },
  { value: 'VAN', label: 'وانت' },
  { value: 'CAR', label: 'سواری' },
  { value: 'MOTORCYCLE', label: 'موتورسیکلت' },
  { value: 'OTHER', label: 'سایر' },
];

const emptyForm = {
  factoryId: '', cargoType: 'RAW_MATERIALS', cargoDescription: '', driverName: '', driverNationalId: '',
  driverPhone: '', vehicleType: 'TRUCK', licensePlate: '', exitDate: '',
};

const CreateGatePassForm = ({ handleBack }) => {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const { data: factories, isLoading: loadingFactories, isError: factoriesError } = useQuery({
    queryKey: ['factories', 'managed'],
    queryFn: () => factoryApi.getFactories().then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (/** @type {typeof emptyForm} */ payload) => gatePassApi.createGatePass(payload),
    onSuccess: () => {
      showNotification('برگ خروج با موفقیت ثبت و برای تایید ارسال شد.', 'success');
      queryClient.invalidateQueries({ queryKey: ['gate-passes'] });
      handleBack();
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت برگ خروج ناموفق بود.'), 'error'),
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const required = ['factoryId', 'cargoType', 'driverName', 'driverNationalId', 'driverPhone', 'vehicleType', 'licensePlate', 'exitDate'];
    if (required.some((field) => !form[field])) {
      showNotification('لطفا تمام فیلدهای الزامی را پر کنید.', 'error');
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={handleBack} sx={{ ml: 1 }} aria-label="بازگشت به لیست">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5">
          فرم ایجاد برگ خروج جدید
        </Typography>
      </Box>
      {factoriesError && <Alert severity="error" sx={{ mb: 2 }}>دریافت لیست واحدهای صنعتی ناموفق بود.</Alert>}
      <Box component="form" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth required label="واحد صنعتی" name="factoryId" value={form.factoryId} onChange={handleChange} disabled={loadingFactories}>
              {(factories || []).map((factory) => <MenuItem key={factory.id} value={factory.id}>{factory.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth required label="نوع بار" name="cargoType" value={form.cargoType} onChange={handleChange}>
              {cargoTypes.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth required label="نام راننده" name="driverName" value={form.driverName} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth required label="کد ملی راننده" name="driverNationalId" value={form.driverNationalId} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth required label="تلفن راننده" name="driverPhone" value={form.driverPhone} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth required label="نوع خودرو" name="vehicleType" value={form.vehicleType} onChange={handleChange}>
              {vehicleTypes.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth required label="شماره پلاک" name="licensePlate" value={form.licensePlate} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth required label="تاریخ و ساعت خروج" name="exitDate" type="datetime-local" InputLabelProps={{ shrink: true }} value={form.exitDate} onChange={handleChange} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="توضیحات بار (اختیاری)" name="cargoDescription" multiline rows={3} value={form.cargoDescription} onChange={handleChange} />
          </Grid>
          <Grid item xs={12} sx={{ textAlign: 'right' }}>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>
              {createMutation.isPending ? <CircularProgress size={22} /> : 'ثبت و ارسال برای تایید'}
            </Button>
            <Button variant="text" onClick={handleBack} sx={{ ml: 2 }} disabled={createMutation.isPending}>
              انصراف
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};

export default CreateGatePassForm;
