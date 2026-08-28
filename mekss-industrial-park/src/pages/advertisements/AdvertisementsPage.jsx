import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Grid, Card, CardContent, CircularProgress, Alert } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { advertisementApi } from '../../services/api/advertisement.api';
import { useAuth } from '../../providers/AuthProvider';
import { getErrorMessage } from '../../utils/apiError';

const categoryLabels = {
  EQUIPMENT: 'تجهیزات', SERVICES: 'خدمات', RAW_MATERIALS: 'مواد اولیه', JOB_LISTINGS: 'فرصت شغلی', REAL_ESTATE: 'املاک', OTHER: 'سایر',
};

const advertisementCategoryKey = (advertisement) => advertisement.category?.key || advertisement.category;

const AdvertisementsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER'].includes(user?.role);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['advertisements', 'public'],
    queryFn: () => advertisementApi.getPublicAdvertisements().then((res) => res.data),
  });

  const ads = data || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">تابلو آگهی‌ها</Typography>
        {canCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/advertisements/new')}>
            ثبت آگهی جدید
          </Button>
        )}
      </Box>
      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">{getErrorMessage(error, 'دریافت آگهی‌ها ناموفق بود.')}</Alert>}
      {!isLoading && !isError && ads.length === 0 && <Typography color="text.secondary">هیچ آگهی تایید‌شده‌ای برای نمایش وجود ندارد.</Typography>}
      {!isLoading && !isError && ads.length > 0 && (
        <Grid container spacing={3}>
          {ads.map((ad) => (
            <Grid item xs={12} sm={6} md={4} key={ad.id}>
              <Card>
                <CardContent>
                  <Typography variant="h5" component="div">{ad.title}</Typography>
                  <Typography sx={{ mt: 1.5 }} color="text.secondary">{categoryLabels[advertisementCategoryKey(ad)] || advertisementCategoryKey(ad)} — {ad.city}</Typography>
                  <Typography sx={{ mt: 1.5 }}>{ad.content}</Typography>
                  {(ad.contactInfo?.phone || ad.contactInfo?.phoneNumber) && (
                    <Typography sx={{ mt: 2 }} variant="body2" dir="ltr">اطلاعات تماس: {ad.contactInfo.phone || ad.contactInfo.phoneNumber}</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default AdvertisementsPage;
