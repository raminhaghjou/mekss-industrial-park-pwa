import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  CircularProgress,
  Alert,
} from '@mui/material';
import { factoryApi } from '../../services/api/factory.api';
import { messageApi } from '../../services/api/message.api';
import { useNotification } from '../../providers/NotificationProvider';
import { getErrorMessage } from '../../utils/apiError';

const SendMessagePage = () => {
  const { showNotification } = useNotification();
  const [selectedManagerIds, setSelectedManagerIds] = React.useState([]);
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');

  const { data: factories, isLoading, isError } = useQuery({
    queryKey: ['factories', 'managed'],
    queryFn: () => factoryApi.getFactories().then((res) => res.data),
  });

  const recipients = React.useMemo(() => {
    const seen = new Map();
    (factories || []).forEach((factory) => {
      if (factory.manager?.id && !seen.has(factory.manager.id)) {
        seen.set(factory.manager.id, { id: factory.manager.id, label: `${factory.manager.name} (${factory.name})` });
      }
    });
    return Array.from(seen.values());
  }, [factories]);

  const sendMutation = useMutation({
    mutationFn: () => messageApi.sendBatchMessage(selectedManagerIds, subject, body),
    onSuccess: (res) => {
      const { sentCount, excludedCount } = res.data;
      showNotification(
        excludedCount > 0
          ? `پیام برای ${sentCount} گیرنده ارسال شد. ${excludedCount} گیرنده نامعتبر نادیده گرفته شد.`
          : `پیام با موفقیت برای ${sentCount} گیرنده ارسال شد.`,
        'success',
      );
      setSelectedManagerIds([]);
      setSubject('');
      setBody('');
    },
    onError: (err) => showNotification(getErrorMessage(err, 'ارسال پیام ناموفق بود.'), 'error'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedManagerIds.length || !subject.trim() || !body.trim()) {
      showNotification('لطفا گیرندگان، موضوع و متن پیام را مشخص کنید.', 'error');
      return;
    }
    sendMutation.mutate();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        ارسال پیام گروهی
      </Typography>
      <Paper sx={{ p: 3 }}>
        {isError && <Alert severity="error" sx={{ mb: 2 }}>دریافت لیست گیرندگان ناموفق بود.</Alert>}
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>انتخاب گیرندگان</InputLabel>
                <Select
                  multiple
                  value={selectedManagerIds}
                  onChange={(e) => setSelectedManagerIds(/** @type {string[]} */ (e.target.value))}
                  input={<OutlinedInput label="انتخاب گیرندگان" />}
                  renderValue={(selected) => recipients.filter((r) => selected.includes(r.id)).map((r) => r.label).join('، ')}
                  disabled={isLoading}
                >
                  {recipients.map((recipient) => (
                    <MenuItem key={recipient.id} value={recipient.id}>
                      <Checkbox checked={selectedManagerIds.indexOf(recipient.id) > -1} />
                      <ListItemText primary={recipient.label} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth required label="موضوع پیام" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth required label="متن پیام" multiline rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
            </Grid>
            <Grid item xs={12} sx={{ textAlign: 'right' }}>
              <Button type="submit" variant="contained" disabled={sendMutation.isPending}>
                {sendMutation.isPending ? <CircularProgress size={22} /> : 'ارسال پیام'}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Box>
  );
};

export default SendMessagePage;
