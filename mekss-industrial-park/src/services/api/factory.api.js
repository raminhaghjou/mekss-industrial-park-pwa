import apiClient from './base.api';

export const factoryApi = {
  // Legacy array route used by existing selector consumers.
  getFactories: (params) => apiClient.get('/factories', { params }),
  getManagedFactories: (params) => apiClient.get('/factories/managed', { params }),
  getManagedFactory: (id) => apiClient.get(`/factories/managed/${id}`),
  getManagementScope: () => apiClient.get('/factories/management-scope'),
  createFactory: (data) => apiClient.post('/factories', data),
  updateFactory: (id, data) => apiClient.put(`/factories/${id}`, data),
  approveFactory: (id) => apiClient.post(`/factories/${id}/approve`),
  rejectFactory: (id, reason) => apiClient.post(`/factories/${id}/reject`, { reason }),
};
