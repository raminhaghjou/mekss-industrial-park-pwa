import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
} from '@mui/material';

const mockAds = [
  { id: 1, title: 'فروش دستگاه پرس دست دوم', status: 'PENDING' },
  { id: 2, title: 'نیازمند نیروی فنی', status: 'PENDING' },
  { id: 3, title: 'اجاره انبار', status: 'APPROVED' },
];

const ApproveAdvertisementsPage = () => {
  const [tab, setTab] = React.useState(0);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const filteredAds = mockAds.filter(ad => {
    if(tab === 0) return ad.status === 'PENDING';
    if(tab === 1) return ad.status !== 'PENDING';
    return false;
  });

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        تایید آگهی‌ها
      </Typography>
      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={handleTabChange}>
            <Tab label="در انتظار تایید" />
            <Tab label="تاریخچه" />
          </Tabs>
        </Box>
        <Box sx={{p: 2}}>
          <Grid container spacing={3}>
            {filteredAds.map((ad) => (
              <Grid item xs={12} sm={6} md={4} key={ad.id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">{ad.title}</Typography>
                  </CardContent>
                  <CardActions>
                    <Button size="small">مشاهده</Button>
                    {ad.status === 'PENDING' && (
                        <>
                         <Button size="small" color="success">تایید</Button>
                         <Button size="small" color="error">رد</Button>
                        </>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default ApproveAdvertisementsPage;
