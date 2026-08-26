import apiClient from './base.api';

export const announcementApi = {
  getAnnouncements: () => apiClient.get('/announcements'),
  getManagedAnnouncements: () => apiClient.get('/announcements/managed'),
  createAnnouncement: (data) => apiClient.post('/announcements', data),
  updateAnnouncement: (id, data) => apiClient.put(`/announcements/${id}`, data),
  deleteAnnouncement: (id) => apiClient.delete(`/announcements/${id}`),
};
