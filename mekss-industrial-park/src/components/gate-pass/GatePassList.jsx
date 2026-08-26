import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
} from '@mui/material';

const statusColors = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
  COMPLETED: 'info',
  EXPIRED: 'default',
};

const statusLabels = {
  PENDING: 'در انتظار',
  APPROVED: 'تایید شده',
  REJECTED: 'رد شده',
  COMPLETED: 'تکمیل شده',
  EXPIRED: 'منقضی شده',
};

const GatePassList = ({ passes }) => {
  if (!passes || passes.length === 0) {
    return <Typography color="text.secondary" sx={{ p: 2 }}>هیچ برگ خروجی برای نمایش وجود ندارد.</Typography>;
  }

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="gate pass list">
        <TableHead>
          <TableRow>
            <TableCell>نام راننده</TableCell>
            <TableCell>شماره پلاک</TableCell>
            <TableCell>نوع بار</TableCell>
            <TableCell>تاریخ خروج</TableCell>
            <TableCell>وضعیت</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {passes.map((pass) => (
            <TableRow key={pass.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
              <TableCell component="th" scope="row">{pass.driverName}</TableCell>
              <TableCell>{pass.licensePlate}</TableCell>
              <TableCell>{pass.cargoDescription || pass.cargoType}</TableCell>
              <TableCell>{new Date(pass.exitDate).toLocaleDateString('fa-IR')}</TableCell>
              <TableCell>
                <Chip label={statusLabels[pass.status] || pass.status} color={statusColors[pass.status] || 'default'} size="small" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default GatePassList;
