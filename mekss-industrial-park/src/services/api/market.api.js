import apiClient from './base.api';

export const marketApi = {
  getRates: () => apiClient.get('/market-rates'),
  getHistory: (days = 14) => apiClient.get('/market-rates/history', { params: { days } }),
  refreshRates: () => apiClient.post('/market-rates/refresh'),
  updateRate: (key, data) => apiClient.put(`/market-rates/${key}`, data),
};
