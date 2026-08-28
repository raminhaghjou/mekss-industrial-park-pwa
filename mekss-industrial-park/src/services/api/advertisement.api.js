import apiClient from './base.api';

export const advertisementApi = {
  getPublicAdvertisements: () => apiClient.get('/advertisements'),
  getCreationScope: () => apiClient.get('/advertisements/creation-scope'),
  createAdvertisement: (data) => apiClient.post('/advertisements', data),
  // Legacy array routes remain available for existing clients.
  getManagedPending: () => apiClient.get('/advertisements/managed/pending'),
  getManagedHistory: () => apiClient.get('/advertisements/managed/history'),
  getManagedAdvertisements: (params) => apiClient.get('/advertisements/managed', { params }),
  getManagedAdvertisement: (id) => apiClient.get(`/advertisements/managed/${id}`),
  approveAdvertisement: (id) => apiClient.post(`/advertisements/${id}/approve`, { approved: true }),
  rejectAdvertisement: (id, rejectionReason) => apiClient.post(`/advertisements/${id}/approve`, { approved: false, rejectionReason }),
};
