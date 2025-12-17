import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, TextField, Button, MenuItem } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

const requestTypes = [
  { value: 'repair', label: 'تعمیرات' },
  { value: 'services', label: 'خدمات' },
  { value: 'permit', label: 'مجوز' },
  { value: 'general', label: 'عمومی' },
];

const NewRequestPage = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const [requestType, setRequestType] = React.useState(type || 'general');
  const [subject, setSubject] = React.useState('');
  const [description, setDescription] = React.useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log({ type: requestType, subject, description });
    alert('درخواست شما با موفقیت ثبت شد.');
    navigate('/requests');
  };

  return (
    <Box>
       <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/requests')}>
          بازگشت به لیست
        </Button>
      </Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          فرم ثبت درخواست جدید
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            select
            fullWidth
            required
            label="نوع درخواست"
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
            margin="normal"
          >
            {requestTypes.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            required
            label="موضوع"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            required
            label="شرح درخواست"
            multiline
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            margin="normal"
          />
          <Button type="submit" variant="contained" sx={{ mt: 2 }}>
            ثبت درخواست
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default NewRequestPage;
