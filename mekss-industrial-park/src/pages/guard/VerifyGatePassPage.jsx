import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Divider,
  Alert,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, CheckCircle as ApproveIcon, Cancel as RejectIcon } from '@mui/icons-material';

const mockPassDetails = {
  id: 'GP-103',
  factory: 'تولیدی پوشاک تابان',
  driverName: 'رضا محمدی',
  plateNumber: '۵۵ب۶۶۶ ایران ۲۲',
  createdAt: '۱۴۰۲/۰۳/۳۰',
  approvedBy: 'مدیر شهرک',
  description: 'خروج محصول نهایی',
  items: [
      { name: 'پوشاک فصل بهار', quantity: '۲۰۰ کارتن' },
  ]
};

const VerifyGatePassPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const handleApproveExit = () => {
    alert(`خروج خودرو با پلاک ${mockPassDetails.plateNumber} با موفقیت ثبت شد.`);
    navigate('/guard/gate-passes');
  };

  const handleRejectExit = () => {
    const reason = prompt("لطفا دلیل مغایرت و عدم اجازه خروج را ذکر کنید:");
    if (reason) {
      alert(`گزارش مغایرت برای برگ خروج ${id} ثبت و به مدیر شهرک ارجاع داده شد.`);
      navigate('/guard/gate-passes');
    }
  };

  return (
    <Box>
       <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/guard/gate-passes')}>
          بازگشت به لیست
        </Button>
      </Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          بررسی جزئیات و تایید خروج (شناسه: {id})
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
                <Typography><strong>واحد صنعتی:</strong> {mockPassDetails.factory}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
                 <Typography><strong>تاریخ صدور:</strong> {mockPassDetails.createdAt}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
                <Typography><strong>نام راننده:</strong> {mockPassDetails.driverName}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
                 <Typography><strong>شماره پلاک:</strong> {mockPassDetails.plateNumber}</Typography>
            </Grid>
            <Grid item xs={12}>
                <Typography><strong>توضیحات:</strong> {mockPassDetails.description}</Typography>
            </Grid>
             <Grid item xs={12}>
                <Typography variant="h6">لیست اقلام:</Typography>
                <List dense>
                    {mockPassDetails.items.map((item, index) => (
                        <ListItem key={index}>
                            <ListItemText primary={item.name} secondary={`مقدار: ${item.quantity}`} />
                        </ListItem>
                    ))}
                </List>
            </Grid>
        </Grid>
        <Divider sx={{ my: 3 }} />
        <Alert severity="info" sx={{ mb: 3 }}>
            لطفا اطلاعات نمایش داده شده را با مشخصات خودرو و بار تطبیق دهید.
        </Alert>
        <Box sx={{ textAlign: 'center', display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<ApproveIcon />}
            onClick={handleApproveExit}
          >
            ثبت خروج
          </Button>
           <Button
            variant="contained"
            color="error"
            size="large"
            startIcon={<RejectIcon />}
            onClick={handleRejectExit}
          >
            اعلام مغایرت
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default VerifyGatePassPage;
