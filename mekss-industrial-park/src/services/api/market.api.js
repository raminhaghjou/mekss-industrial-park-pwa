import apiClient from './base.api';

export const marketApi = {
  getRates: () => apiClient.get('/market-rates'),
  updateRate: (key, data) => apiClient.put(`/market-rates/${key}`, data),
};
