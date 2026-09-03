import apiClient from './base.api';

export const publicApi = {
  getParks: () => apiClient.get('/public/parks'),
  getFactories: () => apiClient.get('/public/factories'),
  getFactory: (id) => apiClient.get(`/public/factories/${id}`),
  getShops: () => apiClient.get('/public/shops'),
  submitSmsRequest: (data) => apiClient.post('/public/sms-requests', data),
};
