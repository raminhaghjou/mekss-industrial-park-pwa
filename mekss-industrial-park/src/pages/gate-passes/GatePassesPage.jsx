import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Button, Paper, Tabs, Tab, CircularProgress, Alert } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { gatePassApi } from '../../services/api/gatePass.api';
import { getErrorMessage } from '../../utils/apiError';
import GatePassList from '../../components/gate-pass/GatePassList';
import CreateGatePassForm from '../../components/gate-pass/CreateGatePassForm';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`gate-pass-tabpanel-${index}`} aria-labelledby={`gate-pass-tab-${index}`}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const GatePassesPage = () => {
  const [tabValue, setTabValue] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['gate-passes'],
    queryFn: () => gatePassApi.getGatePasses().then((res) => res.data),
  });

  const toggleCreateForm = () => setShowCreateForm(!showCreateForm);

  if (showCreateForm) {
    return <CreateGatePassForm handleBack={toggleCreateForm} />;
  }

  const passes = data || [];
  const pendingPasses = passes.filter((p) => p.status === 'PENDING');
  const approvedPasses = passes.filter((p) => p.status === 'APPROVED');
  const rejectedPasses = passes.filter((p) => p.status === 'REJECTED');

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">مدیریت برگ خروج</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={toggleCreateForm}>
          ایجاد برگ خروج جدید
        </Button>
      </Box>

      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">{getErrorMessage(error, 'دریافت برگ‌های خروج ناموفق بود.')}</Alert>}

      {!isLoading && !isError && (
        <Paper>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={(_, value) => setTabValue(value)} aria-label="gate pass status tabs">
              <Tab label={`در انتظار تایید (${pendingPasses.length})`} />
              <Tab label={`تایید شده (${approvedPasses.length})`} />
              <Tab label={`رد شده (${rejectedPasses.length})`} />
              <Tab label="تاریخچه" />
            </Tabs>
          </Box>
          <TabPanel value={tabValue} index={0}><GatePassList passes={pendingPasses} /></TabPanel>
          <TabPanel value={tabValue} index={1}><GatePassList passes={approvedPasses} /></TabPanel>
          <TabPanel value={tabValue} index={2}><GatePassList passes={rejectedPasses} /></TabPanel>
          <TabPanel value={tabValue} index={3}><GatePassList passes={passes} /></TabPanel>
        </Paper>
      )}
    </Box>
  );
};

export default GatePassesPage;
