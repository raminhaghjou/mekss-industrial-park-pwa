import apiClient from './base.api';

export const parkStaffApi = {
  list: (params) => apiClient.get('/park-staff', { params }),
  create: (data) => apiClient.post('/park-staff', data),
  update: (id, data) => apiClient.patch(`/park-staff/${id}`, data),
  remove: (id) => apiClient.delete(`/park-staff/${id}`),
};
