import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';

const mockParks = [
  { id: 'P-01', name: 'شهرک صنعتی شماره یک', location: 'تهران', manager: 'آقای محمودی' },
  { id: 'P-02', name: 'شهرک صنعتی شماره دو', location: 'اصفهان', manager: 'آقای رضایی' },
];

const ManageParksPage = () => {
  return (
    <Box>
       <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          مدیریت شهرک‌های صنعتی
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
        >
          افزودن شهرک جدید
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>شناسه</TableCell>
              <TableCell>نام شهرک</TableCell>
              <TableCell>موقعیت</TableCell>
              <TableCell>مدیر</TableCell>
              <TableCell align="center">عملیات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockParks.map((park) => (
              <TableRow key={park.id}>
                <TableCell>{park.id}</TableCell>
                <TableCell>{park.name}</TableCell>
                <TableCell>{park.location}</TableCell>
                <TableCell>{park.manager}</TableCell>
                <TableCell align="center">
                  <IconButton size="small"><EditIcon /></IconButton>
                  <IconButton size="small" color="error"><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ManageParksPage;
