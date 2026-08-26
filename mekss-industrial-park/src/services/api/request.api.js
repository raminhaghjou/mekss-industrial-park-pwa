import apiClient from './base.api';

export const requestApi = {
  getRequests: (params) => apiClient.get('/requests', { params }),
  createRequest: (data) => apiClient.post('/requests', data),
  approveRequest: (id) => apiClient.post(`/requests/${id}/approve`),
  rejectRequest: (id, data) => apiClient.post(`/requests/${id}/reject`, data),
};
