import apiClient from './base.api';

export const messageApi = {
  sendBatchMessage: (recipientIds, subject, body) =>
    apiClient.post('/messages/batch', { recipientIds, subject, body }),
  broadcastToFactoryManagers: (subject, body) =>
    apiClient.post('/messages/broadcast/factory-managers', { subject, body }),
  sendMessage: (data) => apiClient.post('/messages', data),
  getRecipients: () => apiClient.get('/messages/recipients'),
  getInbox: () => apiClient.get('/messages/inbox'),
  getMessages: () => apiClient.get('/messages/inbox'),
  getSent: () => apiClient.get('/messages/sent'),
  getUnreadCount: () => apiClient.get('/messages/unread-count'),
  markRead: (id) => apiClient.post(`/messages/${id}/read`),
  getNotifications: () => apiClient.get('/notifications'),
  markNotificationRead: (id) => apiClient.post(`/notifications/${id}/read`),
  markAllNotificationsRead: () => apiClient.post('/notifications/read-all'),
};
