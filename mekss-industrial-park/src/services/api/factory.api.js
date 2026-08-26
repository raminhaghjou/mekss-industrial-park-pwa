import apiClient from './base.api';

export const factoryApi = {
  getFactories: (params) => apiClient.get('/factories', { params }),
  createFactory: (data) => apiClient.post('/factories', data),
  updateFactory: (id, data) => apiClient.put(`/factories/${id}`, data),
};
