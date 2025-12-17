import React from 'react';
import { Box, Typography, Paper, FormGroup, FormControlLabel, Switch, Divider } from '@mui/material';

export const SettingsPage = () => {
  // Mock state for settings
  const [settings, setSettings] = React.useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    darkMode: false,
  });

  const handleChange = (event) => {
    setSettings({
      ...settings,
      [event.target.name]: event.target.checked,
    });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        تنظیمات حساب
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          تنظیمات اطلاع‌رسانی
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={settings.emailNotifications}
                onChange={handleChange}
                name="emailNotifications"
              />
            }
            label="دریافت اعلان از طریق ایمیل"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.smsNotifications}
                onChange={handleChange}
                name="smsNotifications"
              />
            }
            label="دریافت اعلان از طریق پیامک"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.pushNotifications}
                onChange={handleChange}
                name="pushNotifications"
              />
            }
            label="دریافت اعلان Push"
          />
        </FormGroup>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          تنظیمات ظاهری
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={settings.darkMode}
                onChange={handleChange}
                name="darkMode"
              />
            }
            label="حالت تاریک"
          />
        </FormGroup>
      </Paper>
    </Box>
  );
};

export default SettingsPage;
