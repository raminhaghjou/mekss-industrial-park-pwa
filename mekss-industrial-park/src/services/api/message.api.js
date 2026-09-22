import apiClient from './base.api';

export const messageApi = {
  sendBatchMessage: (recipientIds, subject, body) =>
    apiClient.post('/messages/batch', { recipientIds, subject, body }),
  broadcastMessage: (payload) => apiClient.post('/messages/broadcast', payload),
  /** @deprecated Prefer broadcastMessage({ audience: 'PARK_ALL' }) */
  broadcastToFactoryManagers: (subject, body) =>
    apiClient.post('/messages/broadcast/factory-managers', { subject, body }),
  sendMessage: (data) => apiClient.post('/messages', data),
  getRecipients: () => apiClient.get('/messages/recipients'),
  getInbox: (params) => apiClient.get('/messages/inbox', { params }),
  getMessages: (params) => apiClient.get('/messages/inbox', { params }),
  getSent: (params) => apiClient.get('/messages/sent', { params }),
  getUnreadCount: () => apiClient.get('/messages/unread-count'),
  markRead: (id) => apiClient.post(`/messages/${id}/read`),
  getNotifications: () => apiClient.get('/notifications'),
  markNotificationRead: (id) => apiClient.post(`/notifications/${id}/read`),
  markAllNotificationsRead: () => apiClient.post('/notifications/read-all'),
};
