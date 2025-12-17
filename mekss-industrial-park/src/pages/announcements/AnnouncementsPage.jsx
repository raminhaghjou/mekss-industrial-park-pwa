import React from 'react';
import { Box, Typography, Paper, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const mockAnnouncements = [
  { id: 1, title: 'برنامه زمان‌بندی قطعی برق', content: 'به اطلاع می‌رساند به دلیل تعمیرات شبکه، برق شهرک در روز سه‌شنبه از ساعت ۱۰ تا ۱۴ قطع خواهد بود.', date: '۱۴۰۲/۰۴/۰۱' },
  { id: 2, title: 'فراخوان شرکت در جلسه هیئت امنا', content: 'جلسه هیئت امنا در تاریخ ۱۴۰۲/۰۴/۱۰ در سالن اجتماعات برگزار خواهد شد.', date: '۱۴۰۲/۰۳/۲۵' },
  { id: 3, title: 'هشدار ایمنی', content: 'لطفا نکات ایمنی مربوط به جوشکاری را در محوطه باز رعایت فرمایید.', date: '۱۴۰۲/۰۳/۲۰' },
];

const AnnouncementsPage = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        اطلاعیه‌ها
      </Typography>
      {mockAnnouncements.map((ann) => (
        <Accordion key={ann.id}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls={`panel${ann.id}-content`}
            id={`panel${ann.id}-header`}
          >
            <Typography sx={{ width: '70%', flexShrink: 0 }}>{ann.title}</Typography>
            <Typography sx={{ color: 'text.secondary' }}>{ann.date}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography>
              {ann.content}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default AnnouncementsPage;
