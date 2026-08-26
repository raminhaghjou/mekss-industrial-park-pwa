import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
  CircularProgress,
  Alert,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { gatePassApi } from '../../services/api/gatePass.api';
import { getErrorMessage } from '../../utils/apiError';

const GuardGatePassesPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['gate-passes', 'guard'],
    queryFn: () => gatePassApi.getGatePasses().then((res) => res.data),
  });

  const approvedPasses = (data || []).filter((pass) => pass.status === 'APPROVED').filter((pass) => {
    if (!search.trim()) return true;
    const query = search.trim();
    return pass.licensePlate.includes(query) || pass.id.includes(query);
  });

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        برگ‌های خروج در انتظار تایید نهایی
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="جستجو بر اساس شماره پلاک یا شناسه برگ خروج"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            />
          </Grid>
        </Grid>
      </Paper>

      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">{getErrorMessage(error, 'دریافت برگ‌های خروج ناموفق بود.')}</Alert>}
      {!isLoading && !isError && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>واحد صنعتی</TableCell>
                <TableCell>نام راننده</TableCell>
                <TableCell>شماره پلاک</TableCell>
                <TableCell align="center">عملیات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {approvedPasses.length === 0 && (
                <TableRow><TableCell colSpan={4} align="center">هیچ برگ خروج تایید‌شده‌ای برای نمایش وجود ندارد.</TableCell></TableRow>
              )}
              {approvedPasses.map((pass) => (
                <TableRow key={pass.id}>
                  <TableCell>{pass.factory?.name || '—'}</TableCell>
                  <TableCell>{pass.driverName}</TableCell>
                  <TableCell>{pass.licensePlate}</TableCell>
                  <TableCell align="center">
                    <Button variant="outlined" onClick={() => navigate(`/guard/gate-passes/${pass.id}/verify`)}>
                      بررسی و تایید خروج
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default GuardGatePassesPage;
