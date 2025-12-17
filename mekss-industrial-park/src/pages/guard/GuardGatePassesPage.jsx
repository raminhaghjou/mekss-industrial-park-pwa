import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  InputAdornment,
  Grid,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, QrCodeScanner as QrCodeScannerIcon } from '@mui/icons-material';

const mockApprovedPasses = [
  { id: 'GP-103', factory: 'تولیدی پوشاک تابان', driverName: 'رضا محمدی', plateNumber: '۵۵ب۶۶۶ ایران ۲۲', createdAt: '۱۴۰۲/۰۳/۳۰', status: 'APPROVED' },
  { id: 'GP-104', factory: 'صنایع غذایی بهاران', driverName: 'سارا موسوی', plateNumber: '۱۱ج۲۲۲ ایران ۴۴', createdAt: '۱۴۰۲/۰۴/۰۲', status: 'APPROVED' },
];

const GuardGatePassesPage = () => {
    const navigate = useNavigate();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        برگ‌های خروج در انتظار تایید نهایی
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6}>
                <TextField
                    fullWidth
                    label="جستجو بر اساس شماره پلاک یا شناسه برگ خروج"
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                    }}
                />
            </Grid>
            <Grid item xs={12} sm={6}>
                 <Button fullWidth variant="contained" startIcon={<QrCodeScannerIcon />}>
                    اسکن QR کد
                </Button>
            </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>شناسه</TableCell>
              <TableCell>واحد صنعتی</TableCell>
              <TableCell>نام راننده</TableCell>
              <TableCell>شماره پلاک</TableCell>
              <TableCell align="center">عملیات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockApprovedPasses.map((pass) => (
              <TableRow key={pass.id}>
                <TableCell>{pass.id}</TableCell>
                <TableCell>{pass.factory}</TableCell>
                <TableCell>{pass.driverName}</TableCell>
                <TableCell>{pass.plateNumber}</TableCell>
                <TableCell align="center">
                  <Button
                    variant="outlined"
                    onClick={() => navigate(`/guard/gate-passes/${pass.id}/verify`)}
                  >
                    بررسی و تایید خروج
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default GuardGatePassesPage;
