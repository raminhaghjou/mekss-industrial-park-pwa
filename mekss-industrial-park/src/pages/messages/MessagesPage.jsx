import React from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, Divider } from '@mui/material';

const mockMessages = [
  { id: 1, sender: 'مدیریت شهرک', subject: 'اطلاعیه قطعی برق', date: '۱۴۰۲/۰۴/۰۱' },
  { id: 2, sender: 'واحد مالی', subject: 'یادآوری پرداخت شارژ', date: '۱۴۰۲/۰۳/۲۸' },
  { id: 3, sender: 'نگهبانی', subject: 'هماهنگی جهت خروج بار', date: '۱۴۰۲/۰۳/۲۵' },
];

const MessagesPage = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        صندوق پیام‌ها
      </Typography>
      <Paper>
        <List>
          {mockMessages.map((message, index) => (
            <React.Fragment key={message.id}>
              <ListItem button>
                <ListItemText
                  primary={message.subject}
                  secondary={`از طرف: ${message.sender} - تاریخ: ${message.date}`}
                />
              </ListItem>
              {index < mockMessages.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

export default MessagesPage;
