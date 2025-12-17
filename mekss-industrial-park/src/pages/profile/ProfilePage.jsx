import React from 'react';
import { Box, Typography, Paper, TextField, Button, Grid, Avatar } from '@mui/material';
import { useAuth } from '../../providers/AuthProvider';

export const ProfilePage = () => {
  const { user } = useAuth();

  // Mock data for profile - replace with actual user data and state management
  const [profile, setProfile] = React.useState({
    name: user?.name || 'نام کاربر',
    email: user?.email || 'user@example.com',
    phoneNumber: user?.phoneNumber || '09123456789',
    company: 'شرکت نمونه',
    role: user?.role || 'نقش کاربر',
  });

  const handleChange = (event) => {
    setProfile({
      ...profile,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    // TODO: Implement profile update logic using API call
    console.log('Updated Profile:', profile);
    alert('پروفایل با موفقیت به‌روزرسانی شد!');
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
              <Avatar
                sx={{ width: 120, height: 120, fontSize: '3rem' }}
                alt={profile.name}
                src="/path/to/avatar.jpg" // Add a path to a user's avatar if available
              >
                {profile.name.charAt(0)}
              </Avatar>
            </Grid>
            <Grid item xs={12} sm={9}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="نام و نام خانوادگی"
                        name="name"
                        value={profile.name}
                        onChange={handleChange}
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="شماره تلفن"
                        name="phoneNumber"
                        value={profile.phoneNumber}
                        onChange={handleChange}
                        variant="outlined"
                        disabled // Phone number might not be editable
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="ایمیل"
                        name="email"
                        type="email"
                        value={profile.email}
                        onChange={handleChange}
                        variant="outlined"
                      />
                    </Grid>
                     <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="شرکت/واحد صنعتی"
                        name="company"
                        value={profile.company}
                        onChange={handleChange}
                        variant="outlined"
                      />
                    </Grid>
                </Grid>
            </Grid>
            <Grid item xs={12} sx={{ mt: 2, textAlign: 'right' }}>
              <Button type="submit" variant="contained" color="primary">
                ذخیره تغییرات
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default ProfilePage;
