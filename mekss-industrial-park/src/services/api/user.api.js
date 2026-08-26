import apiClient from './base.api';

export const userApi = {
  getUsers: (params) => apiClient.get('/users', { params }),
  getUser: (id) => apiClient.get(`/users/${id}`),
  createUser: (data) => apiClient.post('/users', data),
  updateUser: (id, data) => apiClient.patch(`/users/${id}`, data),
  deleteUser: (id) => apiClient.delete(`/users/${id}`),
  activateUser: (id) => apiClient.post(`/users/${id}/activate`),
  deactivateUser: (id) => apiClient.post(`/users/${id}/deactivate`),
  resetPassword: (id, newPassword) => apiClient.post(`/users/${id}/reset-password`, { newPassword }),
};
