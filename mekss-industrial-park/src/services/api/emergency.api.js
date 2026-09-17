import apiClient from './base.api';

export const emergencyApi = {
  getEmergencies: () => apiClient.get('/emergency'),
  getActiveEmergencies: () => apiClient.get('/emergency/active'),
  createEmergency: (data) => apiClient.post('/emergency', data),
  acknowledgeEmergency: (id) => apiClient.post(`/emergency/${id}/acknowledge`),
  resolveEmergency: (id) => apiClient.post(`/emergency/${id}/resolve`),
};
