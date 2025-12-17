import React from 'react';
import { Box, Typography, Button, Paper, Grid, Card, CardContent, CardActions } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const mockAds = [
  { id: 1, title: 'فروش دستگاه پرس دست دوم', description: 'یک دستگاه پرس هیدرولیک در حد نو به فروش می‌رسد.', contact: '۰۹۱۲۳۴۵۶۷۸۹' },
  { id: 2, title: 'نیازمند نیروی فنی', description: 'به یک نفر نیروی فنی آقا مسلط به برق صنعتی نیازمندیم.', contact: 'داخلی ۱۲۳' },
  { id: 3, title: 'اجاره انبار', description: 'یک سوله ۱۰۰۰ متری جهت اجاره موجود است.', contact: '۰۹۳۵۰۰۰۰۰۰۰' },
];

const AdvertisementsPage = () => {
  const navigate = useNavigate();
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          تابلو آگهی‌ها
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/advertisements/new')}
        >
          ثبت آگهی جدید
        </Button>
      </Box>
      <Grid container spacing={3}>
        {mockAds.map((ad) => (
          <Grid item xs={12} sm={6} md={4} key={ad.id}>
            <Card>
              <CardContent>
                <Typography variant="h5" component="div">
                  {ad.title}
                </Typography>
                <Typography sx={{ mt: 1.5 }} color="text.secondary">
                  {ad.description}
                </Typography>
                <Typography sx={{ mt: 2 }} variant="body2">
                  اطلاعات تماس: {ad.contact}
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small">مشاهده جزئیات</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default AdvertisementsPage;
