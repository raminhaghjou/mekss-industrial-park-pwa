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
  TextField,
  MenuItem,
} from '@mui/material';

const mockAds = [
  { id: 1, title: 'فروش دستگاه پرس دست دوم', park: 'شهرک صنعتی شماره یک', status: 'PENDING' },
  { id: 2, title: 'نیازمند نیروی فنی', park: 'شهرک صنعتی شماره دو', status: 'PENDING' },
  { id: 3, title: 'اجاره انبار', park: 'شهرک صنعتی شماره یک', status: 'APPROVED' },
];

const SuperAdminAdsPage = () => {
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
        تایید آگهی‌ها (ادمین کل)
      </Typography>

       <Paper sx={{ p: 2, mb: 3 }}>
        <TextField select fullWidth label="فیلتر بر اساس شهرک صنعتی" defaultValue="all">
            <MenuItem value="all">همه شهرک‌ها</MenuItem>
            <MenuItem value="P-01">شهرک صنعتی شماره یک</MenuItem>
            <MenuItem value="P-02">شهرک صنعتی شماره دو</MenuItem>
        </TextField>
      </Paper>

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
                    <Typography color="text.secondary">{ad.park}</Typography>
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

export default SuperAdminAdsPage;
