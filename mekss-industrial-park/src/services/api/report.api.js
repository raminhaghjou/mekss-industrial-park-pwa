import apiClient from './base.api';

export const reportApi = {
  getReport: (type, from, to) => apiClient.get('/reports', { params: { type, from, to } }),
};
