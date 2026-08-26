import apiClient from './base.api';

export const emergencyApi = {
  getEmergencies: () => apiClient.get('/emergency'),
  createEmergency: (data) => apiClient.post('/emergency', data),
  acknowledgeEmergency: (id) => apiClient.post(`/emergency/${id}/acknowledge`),
  resolveEmergency: (id) => apiClient.post(`/emergency/${id}/resolve`),
};
