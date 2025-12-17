import React from 'react';
import { Box, Typography, Button, Paper, Alert } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

const EmergencyPage = () => {

  const handleEmergencyClick = () => {
    const isConfirmed = window.confirm(
      "آیا از اعلام وضعیت اضطراری اطمینان دارید؟ این عمل بلافاصله به مدیر شهرک و نگهبانی اطلاع‌رسانی خواهد کرد."
    );
    if (isConfirmed) {
      // TODO: Implement API call to trigger emergency alert
      alert("وضعیت اضطراری با موفقیت اعلام شد. تیم‌های مربوطه در اسرع وقت به محل اعزام خواهند شد.");
    }
  };

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant="h4" gutterBottom color="error.main">
        اعلام وضعیت اضطراری (امداد و حریق)
      </Typography>
      <Paper sx={{ p: 4, maxWidth: 600, margin: 'auto' }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <strong>توجه:</strong> از این دکمه فقط در مواقع اضطراری واقعی مانند آتش‌سوزی، حوادث صنعتی، یا نیاز فوری به امداد پزشکی استفاده کنید. استفاده نادرست از این سیستم پیگرد قانونی خواهد داشت.
        </Alert>
        <Button
          variant="contained"
          color="error"
          size="large"
          startIcon={<WarningIcon />}
          onClick={handleEmergencyClick}
          sx={{
            height: 80,
            fontSize: '1.5rem',
            fontWeight: 'bold',
          }}
        >
          اعلام خطر
        </Button>
      </Paper>
    </Box>
  );
};

export default EmergencyPage;
