import React from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, LocationCityOutlined as ParkOutlineIcon } from '@mui/icons-material';
import { parkApi } from '../../services/api/park.api';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { getErrorMessage } from '../../utils/apiError';

const emptyForm = { code: '', name: '', province: '', city: '', address: '', phoneNumber: '', guardPhone: '', email: '' };

const ManageParksPage = () => {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = React.useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['parks', 'managed'],
    queryFn: () => parkApi.getParks().then((res) => res.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['parks', 'managed'] });

  const closeForm = () => { setFormOpen(false); setEditing(null); setForm(emptyForm); };

  const createMutation = useMutation({
    mutationFn: (/** @type {typeof emptyForm} */ payload) => parkApi.createPark(payload),
    onSuccess: () => { showNotification('شهرک صنعتی با موفقیت ثبت شد.', 'success'); closeForm(); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت شهرک صنعتی ناموفق بود.'), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (/** @type {{id: string, payload: any}} */ { id, payload }) => parkApi.updatePark(id, payload),
    onSuccess: () => { showNotification('شهرک صنعتی با موفقیت ویرایش شد.', 'success'); closeForm(); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'ویرایش شهرک صنعتی ناموفق بود.'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (/** @type {string} */ id) => parkApi.deletePark(id),
    onSuccess: () => { showNotification('شهرک صنعتی حذف شد.', 'success'); setDeleteTarget(null); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'حذف شهرک صنعتی ناموفق بود. ممکن است واحدهای صنعتی وابسته داشته باشد.'), 'error'),
  });

  const startCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const startEdit = (park) => {
    setEditing(park);
    setForm({ code: park.code, name: park.name, province: park.province, city: park.city, address: park.address, phoneNumber: park.phoneNumber, guardPhone: park.guardPhone, email: park.email || '' });
    setFormOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const required = editing ? ['name', 'province', 'city', 'address', 'phoneNumber', 'guardPhone'] : ['code', 'name', 'province', 'city', 'address', 'phoneNumber', 'guardPhone'];
    if (required.some((field) => !form[field]?.trim())) {
      showNotification('لطفا تمام فیلدهای الزامی را پر کنید.', 'error');
      return;
    }
    if (editing) {
      const updatePayload = { ...form };
      delete updatePayload.code;
      updateMutation.mutate({ id: editing.id, payload: updatePayload });
    } else {
      createMutation.mutate(form);
    }
  };

  const parks = data?.items || [];
  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">مدیریت شهرک‌های صنعتی</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>افزودن شهرک جدید</Button>
      </Box>

      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">{getErrorMessage(error, 'دریافت لیست شهرک‌ها ناموفق بود.')}</Alert>}
      {!isLoading && !isError && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>کد</TableCell>
                <TableCell>نام شهرک</TableCell>
                <TableCell>موقعیت</TableCell>
                <TableCell>مدیر(ها)</TableCell>
                <TableCell>وضعیت</TableCell>
                <TableCell align="center">عملیات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={<ParkOutlineIcon fontSize="medium" />}
                      title="هنوز شهرک صنعتی ثبت نشده است"
                      description="با دکمه «افزودن شهرک جدید» می‌توانید اولین شهرک صنعتی را ثبت کنید."
                    />
                  </TableCell>
                </TableRow>
              )}
              {parks.map((park) => (
                <TableRow key={park.id}>
                  <TableCell>{park.code}</TableCell>
                  <TableCell>{park.name}</TableCell>
                  <TableCell>{park.province} - {park.city}</TableCell>
                  <TableCell>{park.managers?.map((m) => m.name).join('، ') || '—'}</TableCell>
                  <TableCell><Chip label={park.status === 'ACTIVE' ? 'فعال' : 'غیرفعال'} color={park.status === 'ACTIVE' ? 'success' : 'default'} size="small" /></TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => startEdit(park)}><EditIcon /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(park.id)}><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={formOpen} onClose={closeForm} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'ویرایش شهرک صنعتی' : 'افزودن شهرک صنعتی'}</DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              {!editing && (
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth required label="کد شهرک" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                </Grid>
              )}
              <Grid item xs={12} sm={editing ? 12 : 6}>
                <TextField fullWidth required label="نام شهرک" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="استان" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="شهر" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth required label="آدرس" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="تلفن شهرک" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="تلفن نگهبانی" value={form.guardPhone} onChange={(e) => setForm({ ...form, guardPhone: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="ایمیل (اختیاری)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeForm} disabled={saving}>انصراف</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={22} /> : editing ? 'ذخیره تغییرات' : 'ثبت شهرک'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف شهرک صنعتی"
        description="این عملیات فقط زمانی موفق است که شهرک واحد صنعتی، نگهبان یا اطلاعیه وابسته نداشته باشد."
        confirmLabel="حذف"
        confirmColor="error"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
};

export default ManageParksPage;
