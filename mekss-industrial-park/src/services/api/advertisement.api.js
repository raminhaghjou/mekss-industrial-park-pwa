import apiClient from './base.api';

export const advertisementApi = {
  getPublicAdvertisements: () => apiClient.get('/advertisements'),
  createAdvertisement: (data) => apiClient.post('/advertisements', data),
  getManagedPending: () => apiClient.get('/advertisements/managed/pending'),
  getManagedHistory: () => apiClient.get('/advertisements/managed/history'),
  approveAdvertisement: (id) => apiClient.post(`/advertisements/${id}/approve`, { approved: true }),
  rejectAdvertisement: (id, rejectionReason) => apiClient.post(`/advertisements/${id}/approve`, { approved: false, rejectionReason }),
};
