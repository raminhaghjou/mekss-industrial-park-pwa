import apiClient from './base.api';

export const messageApi = {
  sendBatchMessage: (recipientIds, subject, body) => apiClient.post('/messages/batch', { recipientIds, subject, body }),
  getInbox: () => apiClient.get('/messages/inbox'),
  markRead: (id) => apiClient.post(`/messages/${id}/read`),
};
