import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';

const CreateGatePassForm = ({ handleBack }) => {
  const [formData, setFormData] = useState({
    driverName: '',
    plateNumber: '',
    description: '',
  });
  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState({ name: '', quantity: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleItemChange = (e) => {
    setCurrentItem({ ...currentItem, [e.target.name]: e.target.value });
  };

  const handleAddItem = () => {
    if (currentItem.name && currentItem.quantity) {
      setItems([...items, currentItem]);
      setCurrentItem({ name: '', quantity: '' });
    }
  };

  const handleRemoveItem = (indexToRemove) => {
    setItems(items.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Implement API call to submit the form data
    console.log({ ...formData, items });
    alert('برگ خروج با موفقیت ثبت و برای تایید ارسال شد.');
    handleBack(); // Go back to the list view
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={handleBack} sx={{ ml: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5">
          فرم ایجاد برگ خروج جدید
        </Typography>
      </Box>
      <Box component="form" onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              label="نام راننده"
              name="driverName"
              value={formData.driverName}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              label="شماره پلاک"
              name="plateNumber"
              value={formData.plateNumber}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              label="توضیحات کلی"
              name="description"
              multiline
              rows={3}
              value={formData.description}
              onChange={handleChange}
            />
          </Grid>

          {/* Items Section */}
          <Grid item xs={12}>
            <Typography variant="h6">اقلام</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1, mb: 2 }}>
              <TextField
                label="نام کالا"
                name="name"
                value={currentItem.name}
                onChange={handleItemChange}
                size="small"
              />
              <TextField
                label="تعداد/مقدار"
                name="quantity"
                value={currentItem.quantity}
                onChange={handleItemChange}
                size="small"
              />
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddItem}
              >
                افزودن
              </Button>
            </Box>
            {items.length > 0 && (
              <List dense>
                {items.map((item, index) => (
                  <ListItem key={index} divider>
                    <ListItemText primary={item.name} secondary={`مقدار: ${item.quantity}`} />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" aria-label="delete" onClick={() => handleRemoveItem(index)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Grid>

          <Grid item xs={12} sx={{ textAlign: 'right' }}>
            <Button type="submit" variant="contained">
              ثبت و ارسال برای تایید
            </Button>
            <Button variant="text" onClick={handleBack} sx={{ ml: 2 }}>
              انصراف
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Paper>
  );
};

export default CreateGatePassForm;
