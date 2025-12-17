import React from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Select,
  InputLabel,
  FormControl,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

const mockFactories = [
  'واحد صنعتی پولاد',
  'کارخانه پلاستیک سازی نوین',
  'تولیدی پوشاک تابان',
  'صنایع غذایی بهاران',
];

const CreateInvoicePage = () => {
  const navigate = useNavigate();
  const [selectedFactories, setSelectedFactories] = React.useState([]);
  const [title, setTitle] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');

  const handleFactoryChange = (event) => {
    const {
      target: { value },
    } = event;
    setSelectedFactories(
      typeof value === 'string' ? value.split(',') : value,
    );
  };

  const handleSelectAll = (event) => {
      if (event.target.checked) {
          setSelectedFactories(mockFactories);
          return;
      }
      setSelectedFactories([]);
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log({ factories: selectedFactories, title, amount, dueDate });
    alert('قبض برای واحدهای انتخاب شده با موفقیت صادر شد.');
    // navigate('/admin/invoices');
  };

  return (
    <Box>
       <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} /*onClick={() => navigate('/admin/invoices')}*/>
          بازگشت
        </Button>
      </Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          فرم صدور قبض جدید
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel id="factory-select-label">انتخاب واحد صنعتی (ها)</InputLabel>
                <Select
                  labelId="factory-select-label"
                  multiple
                  value={selectedFactories}
                  onChange={handleFactoryChange}
                  input={<OutlinedInput label="انتخاب واحد صنعتی (ها)" />}
                  renderValue={(selected) => selected.join(', ')}
                >
                 <MenuItem value="all">
                    <Checkbox checked={selectedFactories.length === mockFactories.length} onChange={handleSelectAll} />
                    <ListItemText primary="انتخاب همه" />
                  </MenuItem>
                  {mockFactories.map((name) => (
                    <MenuItem key={name} value={name}>
                      <Checkbox checked={selectedFactories.indexOf(name) > -1} />
                      <ListItemText primary={name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="عنوان قبض" value={title} onChange={e => setTitle(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="مبلغ (ریال)" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth required label="مهلت پرداخت" type="date" InputLabelProps={{ shrink: true }} value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </Grid>
            <Grid item xs={12} sx={{textAlign: 'right'}}>
              <Button type="submit" variant="contained">
                صدور قبض
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default CreateInvoicePage;
