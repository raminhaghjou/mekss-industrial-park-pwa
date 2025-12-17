import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';

const mockAnnouncements = [
  { id: 1, title: 'برنامه زمان‌بندی قطعی برق' },
  { id: 2, title: 'فراخوان شرکت در جلسه هیئت امنا' },
];

const ManageAnnouncementsPage = () => {
  const [showForm, setShowForm] = React.useState(false);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          مدیریت اطلاعیه‌ها
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'بستن فرم' : 'ثبت اطلاعیه جدید'}
        </Button>
      </Box>

      {showForm && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>فرم ثبت اطلاعیه</Typography>
          <TextField fullWidth label="عنوان اطلاعیه" margin="normal" />
          <TextField fullWidth label="متن اطلاعیه" multiline rows={4} margin="normal" />
          <Button variant="contained" sx={{ mt: 2 }}>ثبت</Button>
        </Paper>
      )}

      <Paper>
        <List>
          {mockAnnouncements.map((ann) => (
            <ListItem key={ann.id} divider>
              <ListItemText primary={ann.title} />
              <ListItemSecondaryAction>
                <IconButton><EditIcon /></IconButton>
                <IconButton color="error"><DeleteIcon /></IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default ManageAnnouncementsPage;
