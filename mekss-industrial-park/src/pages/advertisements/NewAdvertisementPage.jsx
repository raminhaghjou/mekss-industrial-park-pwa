import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, TextField, Button } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

const NewAdvertisementPage = () => {
  const navigate = useNavigate();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [contact, setContact] = React.useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log({ title, description, contact });
    alert('آگهی شما پس از تایید مدیر شهرک، نمایش داده خواهد شد.');
    navigate('/advertisements');
  };

  return (
    <Box>
       <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/advertisements')}>
          بازگشت به آگهی‌ها
        </Button>
      </Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          فرم ثبت آگهی جدید
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            fullWidth
            required
            label="عنوان آگهی"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            required
            label="شرح آگهی"
            multiline
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            margin="normal"
          />
           <TextField
            fullWidth
            required
            label="اطلاعات تماس (تلفن، داخلی و...)"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            margin="normal"
          />
          <Button type="submit" variant="contained" sx={{ mt: 2 }}>
            ثبت آگهی
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default NewAdvertisementPage;
