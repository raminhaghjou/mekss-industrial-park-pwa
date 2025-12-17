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
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { CheckCircle as ApproveIcon, Cancel as RejectIcon, Edit as EditIcon } from '@mui/icons-material';

const mockFactories = [
  { id: 'F-01', name: 'واحد صنعتی پولاد', manager: 'آقای کریمی', status: 'ACTIVE' },
  { id: 'F-02', name: 'کارخانه پلاستیک سازی نوین', manager: 'خانم مرادی', status: 'PENDING' },
  { id: 'F-03', name: 'تولیدی پوشاک تابان', manager: 'آقای احمدی', status: 'ACTIVE' },
  { id: 'F-04', name: 'صنایع غذایی بهاران', manager: 'آقای حسینی', status: 'INACTIVE' },
];

const statusColors = { PENDING: 'warning', ACTIVE: 'success', INACTIVE: 'default' };
const statusLabels = { PENDING: 'در انتظار تایید', ACTIVE: 'فعال', INACTIVE: 'غیرفعال' };

const ManageFactoriesPage = () => {
  const handleApprove = (factoryId) => {
    alert(`واحد صنعتی با شناسه ${factoryId} تایید شد.`);
  };

  const handleReject = (factoryId) => {
    alert(`درخواست ثبت‌نام واحد صنعتی با شناسه ${factoryId} رد شد.`);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        مدیریت واحدهای صنعتی
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>شناسه</TableCell>
              <TableCell>نام واحد</TableCell>
              <TableCell>نام مدیر</TableCell>
              <TableCell>وضعیت</TableCell>
              <TableCell align="center">عملیات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockFactories.map((factory) => (
              <TableRow key={factory.id}>
                <TableCell>{factory.id}</TableCell>
                <TableCell>{factory.name}</TableCell>
                <TableCell>{factory.manager}</TableCell>
                <TableCell>
                  <Chip label={statusLabels[factory.status]} color={statusColors[factory.status]} size="small" />
                </TableCell>
                <TableCell align="center">
                  {factory.status === 'PENDING' ? (
                    <>
                      <Tooltip title="تایید ثبت‌نام">
                        <IconButton color="success" onClick={() => handleApprove(factory.id)}>
                          <ApproveIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="رد کردن">
                        <IconButton color="error" onClick={() => handleReject(factory.id)}>
                          <RejectIcon />
                        </IconButton>
                      </Tooltip>
                    </>
                  ) : (
                    <Tooltip title="ویرایش جزئیات">
                      <IconButton>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ManageFactoriesPage;
