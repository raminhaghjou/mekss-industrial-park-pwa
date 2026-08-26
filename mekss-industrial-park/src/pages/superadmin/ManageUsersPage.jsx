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
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Button,
} from '@mui/material';
import { Edit as EditIcon, Block as BlockIcon, CheckCircle as CheckCircleIcon, Search as SearchIcon, Add as AddIcon, DeleteForever as DeleteIcon, LockReset as LockResetIcon } from '@mui/icons-material';
import { userApi } from '../../services/api/user.api';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { getErrorMessage } from '../../utils/apiError';

const roleLabels = { SUPER_ADMIN: 'ادمین کل', PARK_MANAGER: 'مدیر شهرک', FACTORY_OWNER: 'مالک واحد صنعتی', SECURITY_GUARD: 'نگهبان', GOVERNMENT_OFFICIAL: 'نماینده دولت', EMPLOYEE: 'کارمند' };
const roles = Object.keys(roleLabels);
const emptyForm = { phoneNumber: '', name: '', password: '', email: '', role: 'EMPLOYEE' };

const ManageUsersPage = () => {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [resetTarget, setResetTarget] = React.useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['users', 'managed', search],
    queryFn: () => userApi.getUsers({ search: search || undefined }).then((res) => res.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users', 'managed'] });
  const closeForm = () => { setFormOpen(false); setEditing(null); setForm(emptyForm); };

  const createMutation = useMutation({
    mutationFn: (/** @type {typeof emptyForm} */ payload) => userApi.createUser(payload),
    onSuccess: () => { showNotification('کاربر با موفقیت ایجاد شد.', 'success'); closeForm(); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'ایجاد کاربر ناموفق بود.'), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (/** @type {{id: string, payload: any}} */ { id, payload }) => userApi.updateUser(id, payload),
    onSuccess: () => { showNotification('کاربر با موفقیت ویرایش شد.', 'success'); closeForm(); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'ویرایش کاربر ناموفق بود.'), 'error'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (/** @type {{id: string, isActive: boolean}} */ { id, isActive }) => (isActive ? userApi.activateUser(id) : userApi.deactivateUser(id)),
    onSuccess: (_data, { isActive }) => { showNotification(isActive ? 'کاربر فعال شد.' : 'کاربر غیرفعال شد.', 'success'); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'تغییر وضعیت کاربر ناموفق بود.'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (/** @type {string} */ id) => userApi.deleteUser(id),
    onSuccess: () => { showNotification('کاربر حذف شد.', 'success'); setDeleteTarget(null); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'حذف کاربر ناموفق بود.'), 'error'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (/** @type {{id: string, newPassword: string}} */ { id, newPassword }) => userApi.resetPassword(id, newPassword),
    onSuccess: () => { showNotification('رمز عبور کاربر بازنشانی شد.', 'success'); setResetTarget(null); },
    onError: (err) => showNotification(getErrorMessage(err, 'بازنشانی رمز عبور ناموفق بود.'), 'error'),
  });

  const startCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const startEdit = (user) => { setEditing(user); setForm({ phoneNumber: user.phoneNumber, name: user.name, password: '', email: user.email || '', role: user.role }); setFormOpen(true); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) {
      const payload = /** @type {any} */ ({ ...form });
      delete payload.phoneNumber;
      if (!payload.password) delete payload.password;
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      if (!form.phoneNumber || !form.name || !form.password) { showNotification('لطفا فیلدهای الزامی را پر کنید.', 'error'); return; }
      createMutation.mutate(form);
    }
  };

  const users = data?.items || [];
  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">مدیریت کاربران</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>افزودن کاربر جدید</Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          label="جستجو بر اساس نام، تلفن یا ایمیل"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        />
      </Paper>

      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">{getErrorMessage(error, 'دریافت لیست کاربران ناموفق بود.')}</Alert>}
      {!isLoading && !isError && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>نام کاربر</TableCell>
                <TableCell>تلفن</TableCell>
                <TableCell>نقش</TableCell>
                <TableCell>وضعیت</TableCell>
                <TableCell align="center">عملیات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 && <TableRow><TableCell colSpan={5} align="center">هیچ کاربری یافت نشد.</TableCell></TableRow>}
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.phoneNumber}</TableCell>
                  <TableCell>{roleLabels[user.role] || user.role}</TableCell>
                  <TableCell>
                    <Chip label={user.isActive ? 'فعال' : 'غیرفعال'} color={user.isActive ? 'success' : 'default'} size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => startEdit(user)}><EditIcon /></IconButton>
                    <IconButton size="small" onClick={() => setResetTarget(user.id)}><LockResetIcon /></IconButton>
                    {user.isActive ? (
                      <IconButton size="small" color="warning" onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: false })}><BlockIcon /></IconButton>
                    ) : (
                      <IconButton size="small" color="success" onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: true })}><CheckCircleIcon /></IconButton>
                    )}
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(user.id)}><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={formOpen} onClose={closeForm} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'ویرایش کاربر' : 'افزودن کاربر جدید'}</DialogTitle>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required disabled={Boolean(editing)} label="شماره تلفن" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth required label="نام و نام خانوادگی" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel>نقش</InputLabel>
                  <Select value={form.role} label="نقش" onChange={(e) => setForm({ ...form, role: e.target.value })}>
                    {roles.map((role) => <MenuItem key={role} value={role}>{roleLabels[role]}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="ایمیل (اختیاری)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth required={!editing} label={editing ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور'} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeForm} disabled={saving}>انصراف</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? <CircularProgress size={22} /> : editing ? 'ذخیره تغییرات' : 'ایجاد کاربر'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف کاربر"
        description="این عملیات فقط زمانی موفق است که کاربر واحد صنعتی یا شهرک وابسته نداشته باشد. حذف آخرین ادمین کل فعال مجاز نیست."
        confirmLabel="حذف"
        confirmColor="error"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="بازنشانی رمز عبور"
        description="رمز عبور جدید کاربر را وارد کنید. کاربر پس از ورود موظف به تغییر آن خواهد بود."
        requireReason
        reasonMultiline={false}
        reasonType="password"
        reasonLabel="رمز عبور جدید"
        confirmLabel="بازنشانی"
        loading={resetPasswordMutation.isPending}
        onConfirm={(newPassword) => resetPasswordMutation.mutate({ id: resetTarget, newPassword })}
        onClose={() => setResetTarget(null)}
      />
    </Box>
  );
};

export default ManageUsersPage;
