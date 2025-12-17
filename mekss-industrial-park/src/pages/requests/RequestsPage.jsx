import React from 'react';
import { Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const mockRequests = [
  { id: 'REQ-001', type: 'تعمیرات', subject: 'درخواست تعمیر آسفالت', status: 'APPROVED', date: '۱۴۰۲/۰۳/۱۵' },
  { id: 'REQ-002', type: 'خدمات', subject: 'درخواست نیروی نظافت', status: 'PENDING', date: '۱۴۰۲/۰۴/۰۱' },
  { id: 'REQ-003', type: 'مجوز', subject: 'درخواست مجوز ورود ماشین‌آلات', status: 'REJECTED', date: '۱۴۰۲/۰۳/۲۰' },
];

const statusColors = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'error' };
const statusLabels = { PENDING: 'در انتظار', APPROVED: 'تایید شده', REJECTED: 'رد شده' };

const RequestsPage = () => {
    const navigate = useNavigate();
  return (
    <Box>
       <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          درخواست‌های من
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/requests/new/general')} // Navigate to a general request form
        >
          ثبت درخواست جدید
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>شناسه</TableCell>
              <TableCell>نوع</TableCell>
              <TableCell>موضوع</TableCell>
              <TableCell>تاریخ</TableCell>
              <TableCell>وضعیت</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockRequests.map((req) => (
              <TableRow key={req.id}>
                <TableCell>{req.id}</TableCell>
                <TableCell>{req.type}</TableCell>
                <TableCell>{req.subject}</TableCell>
                <TableCell>{req.date}</TableCell>
                <TableCell>
                  <Chip label={statusLabels[req.status]} color={statusColors[req.status]} size="small" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default RequestsPage;
