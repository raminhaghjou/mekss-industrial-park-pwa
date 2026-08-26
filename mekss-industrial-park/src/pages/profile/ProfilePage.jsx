import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Box, Typography, Paper, TextField, Button, Grid, Avatar, CircularProgress } from '@mui/material';
import { useAuth } from '../../providers/AuthProvider';
import { useNotification } from '../../providers/NotificationProvider';
import { authApi } from '../../services/api/auth.api';
import { getErrorMessage } from '../../utils/apiError';

const roleLabels = {
  SUPER_ADMIN: 'ادمین کل', PARK_MANAGER: 'مدیر شهرک', FACTORY_OWNER: 'مالک واحد صنعتی',
  SECURITY_GUARD: 'نگهبان', GOVERNMENT_OFFICIAL: 'نماینده دولت', EMPLOYEE: 'کارمند',
};

export const ProfilePage = () => {
  const { user, checkAuth } = useAuth();
  const { showNotification } = useNotification();

  const [profile, setProfile] = React.useState({ name: user?.name || '', email: user?.email || '' });

  const updateMutation = useMutation({
    mutationFn: (/** @type {{name: string, email: string}} */ payload) => authApi.updateProfile(payload),
    onSuccess: async () => {
      showNotification('پروفایل با موفقیت به‌روزرسانی شد.', 'success');
      await checkAuth();
    },
    onError: (err) => showNotification(getErrorMessage(err, 'به‌روزرسانی پروفایل ناموفق بود.'), 'error'),
  });

  const handleChange = (event) => setProfile({ ...profile, [event.target.name]: event.target.value });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!profile.name.trim()) {
      showNotification('نام نمی‌تواند خالی باشد.', 'error');
      return;
    }
    updateMutation.mutate(profile);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        ویرایش پروفایل
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} sm={3} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Avatar sx={{ width: 120, height: 120, fontSize: '3rem' }} alt={profile.name}>
                {profile.name?.charAt(0)}
              </Avatar>
            </Grid>
            <Grid item xs={12} sm={9}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth required label="نام و نام خانوادگی" name="name" value={profile.name} onChange={handleChange} variant="outlined" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="شماره تلفن" value={user?.phoneNumber || ''} variant="outlined" disabled />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="ایمیل" name="email" type="email" value={profile.email} onChange={handleChange} variant="outlined" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="نقش" value={roleLabels[user?.role] || user?.role || ''} variant="outlined" disabled />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} sx={{ mt: 2, textAlign: 'right' }}>
              <Button type="submit" variant="contained" color="primary" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <CircularProgress size={22} color="inherit" /> : 'ذخیره تغییرات'}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default ProfilePage;
