import apiClient from './base.api';

export const smsApi = {
  getHealth: () => apiClient.get('/sms/health'),
  getSettings: () => apiClient.get('/sms/settings'),
  updateSettings: (payload) => apiClient.put('/sms/settings', payload),
  sendTest: (phoneNumber, kind) => apiClient.post('/sms/test', { phoneNumber, kind }),
  getCredit: () => apiClient.get('/sms/credit'),
};
