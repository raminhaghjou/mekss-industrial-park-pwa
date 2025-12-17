import React, { useState } from 'react';
import { Box, Typography, Button, Paper, Tabs, Tab } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
// Mock Data - Replace with API call
import { mockGatePasses } from '../../_mock/gate-pass';
import GatePassList from '../../components/gate-pass/GatePassList';
import CreateGatePassForm from '../../components/gate-pass/CreateGatePassForm';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const GatePassesPage = () => {
  const [tabValue, setTabValue] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const toggleCreateForm = () => {
    setShowCreateForm(!showCreateForm);
  };

  // Filter passes based on status
  const pendingPasses = mockGatePasses.filter(p => p.status === 'PENDING');
  const approvedPasses = mockGatePasses.filter(p => p.status === 'APPROVED');
  const rejectedPasses = mockGatePasses.filter(p => p.status === 'REJECTED');

  if (showCreateForm) {
    return <CreateGatePassForm handleBack={toggleCreateForm} />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          مدیریت برگ خروج
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={toggleCreateForm}
        >
          ایجاد برگ خروج جدید
        </Button>
      </Box>

      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="gate pass status tabs">
            <Tab label={`در انتظار تایید (${pendingPasses.length})`} />
            <Tab label={`تایید شده (${approvedPasses.length})`} />
            <Tab label={`رد شده (${rejectedPasses.length})`} />
            <Tab label="تاریخچه" />
          </Tabs>
        </Box>
        <TabPanel value={tabValue} index={0}>
          <GatePassList passes={pendingPasses} />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <GatePassList passes={approvedPasses} />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <GatePassList passes={rejectedPasses} />
        </TabPanel>
        <TabPanel value={tabValue} index={3}>
           <Typography>تاریخچه کلی برگ‌های خروج در اینجا نمایش داده می‌شود.</Typography>
           {/* You might want a different component for history with pagination */}
           <GatePassList passes={mockGatePasses} />
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default GatePassesPage;
