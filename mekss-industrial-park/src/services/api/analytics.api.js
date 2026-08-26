import apiClient from './base.api';

export const analyticsApi = {
  getDashboardData: () => apiClient.get('/analytics/dashboard'),
};