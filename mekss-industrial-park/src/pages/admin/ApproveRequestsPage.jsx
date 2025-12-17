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
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import { CheckCircle as ApproveIcon, Cancel as RejectIcon, Visibility as ViewIcon } from '@mui/icons-material';

const mockRequests = [
  { id: 'REQ-101', factory: 'واحد صنعتی پولاد', type: 'تعمیرات', subject: 'درخواست تعمیر آسفالت', date: '۱۴۰۲/۰۳/۱۵', status: 'APPROVED' },
  { id: 'REQ-102', factory: 'کارخانه پلاستیک سازی نوین', type: 'خدمات', subject: 'درخواست نیروی نظافت', date: '۱۴۰۲/۰۴/۰۱', status: 'PENDING' },
  { id: 'REQ-103', factory: 'تولیدی پوشاک تابان', type: 'مجوز', subject: 'درخواست مجوز ورود ماشین‌آلات', date: '۱۴۰۲/۰۳/۲۰', status: 'REJECTED' },
];

const statusColors = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'error' };
const statusLabels = { PENDING: 'در انتظار', APPROVED: 'تایید شده', REJECTED: 'رد شده' };

const ApproveRequestsPage = () => {
    const [tab, setTab] = React.useState(0);

    const handleTabChange = (event, newValue) => {
        setTab(newValue);
    };

    const filteredRequests = mockRequests.filter(req => {
        if(tab === 0) return req.status === 'PENDING';
        if(tab === 1) return req.status !== 'PENDING';
        return false;
    });

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        تایید درخواست‌ها
      </Typography>
      <Paper>
         <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tab} onChange={handleTabChange}>
                <Tab label="در انتظار بررسی" />
                <Tab label="تاریخچه" />
            </Tabs>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>شناسه</TableCell>
                <TableCell>واحد صنعتی</TableCell>
                <TableCell>موضوع</TableCell>
                <TableCell>تاریخ</TableCell>
                <TableCell>وضعیت</TableCell>
                <TableCell align="center">عملیات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRequests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>{req.id}</TableCell>
                  <TableCell>{req.factory}</TableCell>
                  <TableCell>{req.subject}</TableCell>
                  <TableCell>{req.date}</TableCell>
                  <TableCell>
                    <Chip label={statusLabels[req.status]} color={statusColors[req.status]} size="small" />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="مشاهده جزئیات">
                      <IconButton><ViewIcon /></IconButton>
                    </Tooltip>
                    {req.status === 'PENDING' && (
                      <>
                        <Tooltip title="تایید">
                          <IconButton color="success"><ApproveIcon /></IconButton>
                        </Tooltip>
                        <Tooltip title="رد کردن">
                          <IconButton color="error"><RejectIcon /></IconButton>
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

export default ApproveRequestsPage;
