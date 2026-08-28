import React from 'react';
import { Box, Typography } from '@mui/material';
import { AdvertisementModerationBoard } from '../../components/advertisements/AdvertisementModerationBoard';

const SuperAdminAdsPage = () => (
  <Box>
    <Typography variant="h4" gutterBottom>
      تایید آگهی‌ها (ادمین کل)
    </Typography>
    <AdvertisementModerationBoard showParkFilter />
  </Box>
);

export default SuperAdminAdsPage;
