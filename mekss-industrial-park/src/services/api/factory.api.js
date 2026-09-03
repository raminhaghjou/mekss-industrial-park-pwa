import apiClient from './base.api';

export const factoryApi = {
  getFactories: (params) => apiClient.get('/factories', { params }),
  getManagedFactories: (params) => apiClient.get('/factories/managed', { params }),
  getManagedFactory: (id) => apiClient.get(`/factories/managed/${id}`),
  getManagementScope: () => apiClient.get('/factories/management-scope'),
  createFactory: (data) => apiClient.post('/factories', data),
  registerFactory: (data) => apiClient.post('/factories/register', data),
  updateFactory: (id, data) => apiClient.put(`/factories/${id}`, data),
  approveFactory: (id) => apiClient.post(`/factories/${id}/approve`),
  rejectFactory: (id, reason) => apiClient.post(`/factories/${id}/reject`, { reason }),
  getStaff: (id) => apiClient.get(`/factories/${id}/staff`),
  createStaff: (id, data) => apiClient.post(`/factories/${id}/staff`, data),
  updateStaff: (id, userId, data) => apiClient.patch(`/factories/${id}/staff/${userId}`, data),
  getWallet: (id) => apiClient.get(`/factories/${id}/wallet`),
  topUpWallet: (id, amount) => apiClient.post(`/factories/${id}/wallet/top-up`, { amount }),
};
