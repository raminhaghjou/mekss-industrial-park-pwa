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
  IconButton,
  Tooltip,
} from '@mui/material';
import { Visibility as VisibilityIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';

const statusColors = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

const statusLabels = {
  PENDING: 'در انتظار',
  APPROVED: 'تایید شده',
  REJECTED: 'رد شده',
};

const GatePassList = ({ passes }) => {
  if (!passes || passes.length === 0) {
    return <p>هیچ برگ خروجی برای نمایش وجود ندارد.</p>;
  }

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>شناسه</TableCell>
            <TableCell>نام راننده</TableCell>
            <TableCell>شماره پلاک</TableCell>
            <TableCell>توضیحات</TableCell>
            <TableCell>تاریخ ایجاد</TableCell>
            <TableCell>وضعیت</TableCell>
            <TableCell align="center">عملیات</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {passes.map((pass) => (
            <TableRow
              key={pass.id}
              sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
            >
              <TableCell component="th" scope="row">
                {pass.id}
              </TableCell>
              <TableCell>{pass.driverName}</TableCell>
              <TableCell>{pass.plateNumber}</TableCell>
              <TableCell>{pass.description}</TableCell>
              <TableCell>{pass.createdAt}</TableCell>
              <TableCell>
                <Chip
                  label={statusLabels[pass.status]}
                  color={statusColors[pass.status]}
                  size="small"
                />
              </TableCell>
              <TableCell align="center">
                <Tooltip title="مشاهده جزئیات">
                  <IconButton size="small">
                    <VisibilityIcon />
                  </IconButton>
                </Tooltip>
                {pass.status === 'PENDING' && (
                  <>
                    <Tooltip title="ویرایش">
                      <IconButton size="small">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="حذف">
                      <IconButton size="small" color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default GatePassList;
