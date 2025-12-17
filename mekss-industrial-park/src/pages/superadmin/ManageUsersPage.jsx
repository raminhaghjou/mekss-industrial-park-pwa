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
  TextField,
  InputAdornment,
} from '@mui/material';
import { Edit as EditIcon, Block as BlockIcon, Search as SearchIcon } from '@mui/icons-material';

const mockUsers = [
  { id: 'U-001', name: 'علی کریمی', role: 'PARK_MANAGER', park: 'شهرک صنعتی شماره یک', status: 'ACTIVE' },
  { id: 'U-002', name: 'مریم رضایی', role: 'FACTORY_MANAGER', park: 'شهرک صنعتی شماره یک', status: 'ACTIVE' },
  { id: 'U-003', name: 'رضا محمدی', role: 'SECURITY_GUARD', park: 'شهرک صنعتی شماره دو', status: 'ACTIVE' },
  { id: 'U-004', name: 'حسین احمدی', role: 'FACTORY_MANAGER', park: 'شهرک صنعتی شماره دو', status: 'INACTIVE' },
];

const roleLabels = { PARK_MANAGER: 'مدیر شهرک', FACTORY_MANAGER: 'مدیر واحد', SECURITY_GUARD: 'نگهبان' };
const statusColors = { ACTIVE: 'success', INACTIVE: 'default' };
const statusLabels = { ACTIVE: 'فعال', INACTIVE: 'غیرفعال' };


const ManageUsersPage = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        مدیریت کاربران
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
            fullWidth
            label="جستجو بر اساس نام، نقش یا شهرک"
            InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
            }}
        />
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>شناسه</TableCell>
              <TableCell>نام کاربر</TableCell>
              <TableCell>نقش</TableCell>
              <TableCell>شهرک</TableCell>
              <TableCell>وضعیت</TableCell>
              <TableCell align="center">عملیات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.id}</TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>{roleLabels[user.role] || user.role}</TableCell>
                <TableCell>{user.park}</TableCell>
                <TableCell>
                  <Chip label={statusLabels[user.status]} color={statusColors[user.status]} size="small" />
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small"><EditIcon /></IconButton>
                  {user.status === 'ACTIVE' && <IconButton size="small" color="error"><BlockIcon /></IconButton>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ManageUsersPage;
