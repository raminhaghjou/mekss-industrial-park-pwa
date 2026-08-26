import React from 'react';
import { Box, Typography } from '@mui/material';
import { AdvertisementModerationBoard } from '../../components/advertisements/AdvertisementModerationBoard';

const ApproveAdvertisementsPage = () => (
  <Box>
    <Typography variant="h4" gutterBottom>
      تایید آگهی‌ها
    </Typography>
    <AdvertisementModerationBoard />
  </Box>
);

export default ApproveAdvertisementsPage;
