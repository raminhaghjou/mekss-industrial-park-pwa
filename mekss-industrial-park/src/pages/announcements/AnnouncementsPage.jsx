import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails, CircularProgress, Alert } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { announcementApi } from '../../services/api/announcement.api';
import { getErrorMessage } from '../../utils/apiError';

const AnnouncementsPage = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['announcements', 'public'],
    queryFn: () => announcementApi.getAnnouncements().then((res) => res.data),
  });

  const announcements = data || [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        اطلاعیه‌ها
      </Typography>
      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">{getErrorMessage(error, 'دریافت اطلاعیه‌ها ناموفق بود.')}</Alert>}
      {!isLoading && !isError && announcements.length === 0 && (
        <Typography color="text.secondary">هیچ اطلاعیه‌ای برای نمایش وجود ندارد.</Typography>
      )}
      {announcements.map((ann) => (
        <Accordion key={ann.id}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls={`panel${ann.id}-content`} id={`panel${ann.id}-header`}>
            <Typography sx={{ width: '70%', flexShrink: 0 }}>{ann.title}</Typography>
            <Typography sx={{ color: 'text.secondary' }}>{new Date(ann.createdAt).toLocaleDateString('fa-IR')}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography>{ann.content}</Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default AnnouncementsPage;
