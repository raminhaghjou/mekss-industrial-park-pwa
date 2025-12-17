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
  IconButton,
  Tooltip,
  TextField,
  Tabs,
  Tab,
} from '@mui/material';
import { CheckCircle as ApproveIcon, Cancel as RejectIcon, Visibility as ViewIcon } from '@mui/icons-material';

const mockGatePasses = [
  { id: 'GP-101', factory: 'واحد صنعتی پولاد', driverName: 'علی رضایی', plateNumber: '۱۲ع۳۴۵ ایران ۶۷', createdAt: '۱۴۰۲/۰۴/۰۲', status: 'PENDING' },
  { id: 'GP-102', factory: 'کارخانه پلاستیک سازی نوین', driverName: 'مریم حسینی', plateNumber: '۸۸د۴۴۴ ایران ۱۱', createdAt: '۱۴۰۲/۰۴/۰۱', status: 'PENDING' },
  { id: 'GP-103', factory: 'تولیدی پوشاک تابان', driverName: 'رضا محمدی', plateNumber: '۵۵ب۶۶۶ ایران ۲۲', createdAt: '۱۴۰۲/۰۳/۳۰', status: 'APPROVED' },
];

const ApproveGatePassesPage = () => {
  const [tab, setTab] = React.useState(0);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const handleApprove = (passId) => {
    alert(`برگ خروج ${passId} تایید شد.`);
  };

  const handleReject = (passId) => {
    const reason = prompt("لطفا دلیل رد درخواست را وارد کنید:");
    if (reason) {
      alert(`برگ خروج ${passId} به دلیل "${reason}" رد شد.`);
    }
  };

  const filteredPasses = mockGatePasses.filter(p => {
      if(tab === 0) return p.status === 'PENDING';
      if(tab === 1) return p.status !== 'PENDING';
      return false;
  })

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        تایید برگ‌های خروج
      </Typography>
      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tab} onChange={handleTabChange}>
                <Tab label="در انتظار تایید" />
                <Tab label="تاریخچه" />
            </Tabs>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>شناسه</TableCell>
                <TableCell>واحد صنعتی</TableCell>
                <TableCell>نام راننده</TableCell>
                <TableCell>شماره پلاک</TableCell>
                <TableCell>تاریخ درخواست</TableCell>
                <TableCell align="center">عملیات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPasses.map((pass) => (
                <TableRow key={pass.id}>
                  <TableCell>{pass.id}</TableCell>
                  <TableCell>{pass.factory}</TableCell>
                  <TableCell>{pass.driverName}</TableCell>
                  <TableCell>{pass.plateNumber}</TableCell>
                  <TableCell>{pass.createdAt}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="مشاهده جزئیات">
                      <IconButton><ViewIcon /></IconButton>
                    </Tooltip>
                    {pass.status === 'PENDING' && (
                      <>
                        <Tooltip title="تایید">
                          <IconButton color="success" onClick={() => handleApprove(pass.id)}><ApproveIcon /></IconButton>
                        </Tooltip>
                        <Tooltip title="رد کردن">
                          <IconButton color="error" onClick={() => handleReject(pass.id)}><RejectIcon /></IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default ApproveGatePassesPage;
