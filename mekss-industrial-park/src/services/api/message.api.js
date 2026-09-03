import apiClient from './base.api';

export const messageApi = {
  sendBatchMessage: (recipientIds, subject, body) =>
    apiClient.post('/messages/batch', { recipientIds, subject, body }),
  sendMessage: (data) => apiClient.post('/messages', data),
  getInbox: () => apiClient.get('/messages/inbox'),
  getMessages: () => apiClient.get('/messages/inbox'),
  getSent: () => apiClient.get('/messages/sent'),
  getUnreadCount: () => apiClient.get('/messages/unread-count'),
  markRead: (id) => apiClient.post(`/messages/${id}/read`),
};
