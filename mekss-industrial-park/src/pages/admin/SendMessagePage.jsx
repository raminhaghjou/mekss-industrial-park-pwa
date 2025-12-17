import React from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Select,
  InputLabel,
  FormControl,
  MenuItem,
} from '@mui/material';

const mockFactories = [
  'واحد صنعتی پولاد',
  'کارخانه پلاستیک سازی نوین',
  'تولیدی پوشاک تابان',
];

const SendMessagePage = () => {
    const [selectedFactories, setSelectedFactories] = React.useState([]);

    const handleFactoryChange = (event) => {
        setSelectedFactories(event.target.value);
    };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('پیام با موفقیت برای واحدهای انتخاب شده ارسال شد.');
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        ارسال پیام گروهی
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>انتخاب گیرندگان</InputLabel>
                <Select
                  multiple
                  value={selectedFactories}
                  onChange={handleFactoryChange}
                  input={<OutlinedInput label="انتخاب گیرندگان" />}
                  renderValue={(selected) => selected.join(', ')}
                >
                  {mockFactories.map((name) => (
                    <MenuItem key={name} value={name}>
                      <Checkbox checked={selectedFactories.indexOf(name) > -1} />
                      <ListItemText primary={name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth required label="موضوع پیام" />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth required label="متن پیام" multiline rows={6} />
            </Grid>
            <Grid item xs={12} sx={{textAlign: 'right'}}>
              <Button type="submit" variant="contained">
                ارسال پیام
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default SendMessagePage;
