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
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { announcementApi } from '../../services/api/announcement.api';
import { useNotification } from '../../providers/NotificationProvider';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { getErrorMessage } from '../../utils/apiError';

const ManageAnnouncementsPage = () => {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [deleteTarget, setDeleteTarget] = React.useState(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['announcements', 'managed'],
    queryFn: () => announcementApi.getManagedAnnouncements().then((res) => res.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['announcements', 'managed'] });

  const resetForm = () => { setTitle(''); setContent(''); setEditing(null); setShowForm(false); };

  const createMutation = useMutation({
    mutationFn: (/** @type {{title: string, content: string}} */ payload) => announcementApi.createAnnouncement(payload),
    onSuccess: () => { showNotification('اطلاعیه با موفقیت ثبت شد.', 'success'); resetForm(); invalidate(); },
    onError: (err) => showNotification(getErrorMessage(err, 'ثبت اطلاعیه ناموفق بود.'), 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: (/** @type {{id: string, payload: {title: string, content: string}}} */ { id, payload }) => announcementApi.updateAnnouncement(id, payload),
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
    if (!title.trim() || !content.trim()) {
      showNotification('عنوان و متن اطلاعیه الزامی است.', 'error');
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: { title, content } });
    } else {
      createMutation.mutate({ title, content });
    }
  };

  const startEdit = (announcement) => {
    setEditing(announcement);
    setTitle(announcement.title);
    setContent(announcement.content);
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
            <TextField fullWidth required label="عنوان اطلاعیه" margin="normal" value={title} onChange={(e) => setTitle(e.target.value)} />
            <TextField fullWidth required label="متن اطلاعیه" multiline rows={4} margin="normal" value={content} onChange={(e) => setContent(e.target.value)} />
            <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={saving}>
              {saving ? <CircularProgress size={22} /> : editing ? 'ذخیره تغییرات' : 'ثبت'}
            </Button>
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
                <ListItemText primary={ann.title} secondary={new Date(ann.createdAt).toLocaleDateString('fa-IR')} />
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
