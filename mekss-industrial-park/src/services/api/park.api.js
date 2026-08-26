import apiClient from './base.api';

export const parkApi = {
  getParks: (params) => apiClient.get('/industrial-parks', { params }),
  getPark: (id) => apiClient.get(`/industrial-parks/${id}`),
  createPark: (data) => apiClient.post('/industrial-parks', data),
  updatePark: (id, data) => apiClient.put(`/industrial-parks/${id}`, data),
  deletePark: (id) => apiClient.delete(`/industrial-parks/${id}`),
};
