import apiClient from './base.api';

export const smsApi = {
  getHealth: () => apiClient.get('/sms/health'),
};
