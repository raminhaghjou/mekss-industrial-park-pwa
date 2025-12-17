import React from 'react';
import { Box, Typography, Paper, Grid, MenuItem, TextField, Button } from '@mui/material';

const ReportsPage = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        گزارش‌گیری
      </Typography>

      {/* Filter Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>فیلترها</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField select fullWidth label="نوع گزارش" defaultValue="financial">
              <MenuItem value="financial">مالی</MenuItem>
              <MenuItem value="gatepass">تردد</MenuItem>
              <MenuItem value="requests">درخواست‌ها</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="از تاریخ" type="date" InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="تا تاریخ" type="date" InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12}>
            <Button variant="contained">ایجاد گزارش</Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Report Display Section */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>نمایش گزارش</Typography>
        <Box sx={{height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
           <Typography color="text.secondary">
             (بخش نمایش نمودارها)
           </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default ReportsPage;
