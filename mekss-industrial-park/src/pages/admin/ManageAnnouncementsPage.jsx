import React from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { announcementApi } from '../../services/api/announcement.api';
import { parkApi } from '../../services/api/park.api';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { getErrorMessage } from '../../utils/apiError';
import { queryKeys } from '../../services/queryKeys';

const emptyForm = { title: '', content: '', isGlobal: false, isPinned: false, priority: '0', parkId: '', expiresAt: '' };

const toDateInputValue = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

const ManageAnnouncementsPage = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = React.useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: queryKeys.announcements.managed(),
    queryFn: () => announcementApi.getManagedAnnouncements().then((res) => res.data),
  });

  const { data: parksData } = useQuery({
    queryKey: queryKeys.parks.all(),
    queryFn: () => parkApi.getParks().then((res) => res.data),
    enabled: isSuperAdmin && showForm,
  });
  const parks = Array.isArray(parksData) ? parksData : parksData?.items || [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.announcements.managed() });

  const resetForm = () => { setForm(emptyForm); setEditing(null); setShowForm(false); };

  const createMutation = useMutation({
    mutationFn: (/** @type {object} */ payload) => announcementApi.createAnnouncement(payload),
    onSuccess: () => { showNotification('اطلاعیه با موفقیت ثبت شد.', 'success'); resetForm(); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت اطلاعیه ناموفق بود.'), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (/** @type {{id: string, payload: object}} */ { id, payload }) => announcementApi.updateAnnouncement(id, payload),
    onSuccess: () => { showNotification('اطلاعیه با موفقیت ویرایش شد.', 'success'); resetForm(); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'ویرایش اطلاعیه ناموفق بود.'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (/** @type {string} */ id) => announcementApi.deleteAnnouncement(id),
    onSuccess: () => { showNotification('اطلاعیه حذف شد.', 'success'); setDeleteTarget(null); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'حذف اطلاعیه ناموفق بود.'), 'error'),
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      showNotification('عنوان و متن اطلاعیه الزامی است.', 'error');
      return;
    }
    const basePayload = {
      title: form.title,
      content: form.content,
      isGlobal: form.isGlobal,
      isPinned: form.isPinned,
      priority: Number(form.priority) || 0,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: basePayload });
    } else {
      createMutation.mutate({ ...basePayload, parkId: form.isGlobal ? undefined : form.parkId || undefined });
    }
  };

  const startEdit = (announcement) => {
    setEditing(announcement);
    setForm({
      title: announcement.title,
      content: announcement.content,
      isGlobal: Boolean(announcement.isGlobal),
      isPinned: Boolean(announcement.isPinned),
      priority: String(announcement.priority ?? 0),
      parkId: announcement.parkId || '',
      expiresAt: toDateInputValue(announcement.expiresAt),
    });
    setShowForm(true);
  };

  const announcements = data || [];
  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">مدیریت اطلاعیه‌ها</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { if (showForm) { resetForm(); } else { setShowForm(true); } }}
        >
          {showForm ? 'بستن فرم' : 'ثبت اطلاعیه جدید'}
        </Button>
      </Box>

      {showForm && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>{editing ? 'ویرایش اطلاعیه' : 'فرم ثبت اطلاعیه'}</Typography>
          <Box component="form" onSubmit={handleSubmit}>
            <TextField fullWidth required label="عنوان اطلاعیه" margin="normal" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <TextField fullWidth required label="متن اطلاعیه" multiline rows={4} margin="normal" value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }} alignItems={{ sm: 'center' }}>
              <FormControlLabel
                control={<Checkbox checked={form.isGlobal} onChange={(e) => setForm((f) => ({ ...f, isGlobal: e.target.checked, parkId: e.target.checked ? '' : f.parkId }))} />}
                label="نمایش سراسری (همه شهرک‌ها)"
              />
              <FormControlLabel
                control={<Checkbox checked={form.isPinned} onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))} />}
                label="سنجاق‌شده (نمایش در ابتدای فهرست)"
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="اولویت"
                type="number"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                sx={{ width: { sm: 160 } }}
              />
              <TextField
                label="تاریخ انقضا (اختیاری)"
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                sx={{ width: { sm: 220 } }}
              />
              {!editing && isSuperAdmin && !form.isGlobal && (
                <FormControl sx={{ minWidth: { sm: 220 } }}>
                  <InputLabel id="announcement-park-label">شهرک صنعتی هدف</InputLabel>
                  <Select
                    labelId="announcement-park-label"
                    label="شهرک صنعتی هدف"
                    value={form.parkId}
                    onChange={(e) => setForm((f) => ({ ...f, parkId: e.target.value }))}
                  >
                    <MenuItem value="">بدون شهرک مشخص</MenuItem>
                    {parks.map((park) => (
                      <MenuItem key={park.id} value={park.id}>{park.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? <CircularProgress size={22} /> : editing ? 'ذخیره تغییرات' : 'ثبت'}
              </Button>
              <Button onClick={resetForm} disabled={saving}>انصراف</Button>
            </Stack>
          </Box>
        </Paper>
      )}

      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">{getErrorMessage(error, 'دریافت اطلاعیه‌ها ناموفق بود.')}</Alert>}
      {!isLoading && !isError && (
        <Paper>
          <List>
            {announcements.length === 0 && <ListItem><ListItemText primary="هیچ اطلاعیه‌ای ثبت نشده است." /></ListItem>}
            {announcements.map((ann) => (
              <ListItem key={ann.id} divider>
                <ListItemText
                  primary={(
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <span>{ann.title}</span>
                      {ann.isPinned && <Chip size="small" color="warning" label="سنجاق‌شده" />}
                      {ann.isGlobal ? <Chip size="small" color="info" label="سراسری" /> : <Chip size="small" label="شهرک‌محور" />}
                    </Stack>
                  )}
                  secondary={new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(ann.createdAt))}
                />
                <ListItemSecondaryAction>
                  <IconButton onClick={() => startEdit(ann)}><EditIcon /></IconButton>
                  <IconButton color="error" onClick={() => setDeleteTarget(ann.id)}><DeleteIcon /></IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="حذف اطلاعیه"
        description="این اطلاعیه برای همیشه حذف خواهد شد. آیا اطمینان دارید؟"
        confirmLabel="حذف"
        confirmColor="error"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
};

export default ManageAnnouncementsPage;
