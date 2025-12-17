import apiClient from './base.api';

export const requestApi = {
  // Request management
  getRequests: (params) => apiClient.get('/requests', { params }),
  getRequest: (id) => apiClient.get(`/requests/${id}`),
  createRequest: (data) => apiClient.post('/requests', data),
  updateRequest: (id, data) => apiClient.put(`/requests/${id}`, data),
  deleteRequest: (id) => apiClient.delete(`/requests/${id}`),
  
  // Request actions
  approveRequest: (id, data) => apiClient.post(`/requests/${id}/approve`, data),
  rejectRequest: (id, data) => apiClient.post(`/requests/${id}/reject`, data),
  
  // Request statistics
  getRequestStats: (params) => apiClient.get('/requests/stats', { params }),
  getRequestAnalytics: (params) => apiClient.get('/requests/analytics', { params }),
};