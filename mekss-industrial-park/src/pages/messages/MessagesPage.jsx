import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Paper, List, ListItem, ListItemButton, ListItemText, Divider, CircularProgress, Alert, Chip } from '@mui/material';
import { messageApi } from '../../services/api/message.api';
import { getErrorMessage } from '../../utils/apiError';

const MessagesPage = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['messages', 'inbox'],
    queryFn: () => messageApi.getInbox().then((res) => res.data),
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => messageApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] }),
  });

  const messages = data || [];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        صندوق پیام‌ها
      </Typography>
      {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
      {isError && <Alert severity="error">{getErrorMessage(error, 'دریافت پیام‌ها ناموفق بود.')}</Alert>}
      {!isLoading && !isError && (
        <Paper>
          <List>
            {messages.length === 0 && <ListItem><ListItemText primary="صندوق پیام شما خالی است." /></ListItem>}
            {messages.map((message, index) => (
              <React.Fragment key={message.id}>
                <ListItem disablePadding secondaryAction={message.status === 'UNREAD' && <Chip label="جدید" color="primary" size="small" />}>
                  <ListItemButton onClick={() => message.status === 'UNREAD' && markReadMutation.mutate(message.id)}>
                    <ListItemText
                      primary={message.subject}
                      secondary={`از طرف: ${message.sender?.name || 'سامانه'} — تاریخ: ${new Date(message.createdAt).toLocaleDateString('fa-IR')}`}
                    />
                  </ListItemButton>
                </ListItem>
                {index < messages.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default MessagesPage;
