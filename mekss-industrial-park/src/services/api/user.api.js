import apiClient from './base.api';

export const userApi = {
  getUsers: (params) => apiClient.get('/users', { params }),
  getUser: (id) => apiClient.get(`/users/${id}`),
  getPendingRegistrations: () => apiClient.get('/users/pending-registrations'),
  approveRegistration: (id) => apiClient.post(`/users/${id}/approve-registration`),
  rejectRegistration: (id, reason) => apiClient.post(`/users/${id}/reject-registration`, { reason }),
  createUser: (data) => apiClient.post('/users', data),
  updateUser: (id, data) => apiClient.patch(`/users/${id}`, data),
  deleteUser: (id) => apiClient.delete(`/users/${id}`),
  activateUser: (id) => apiClient.post(`/users/${id}/activate`),
  deactivateUser: (id) => apiClient.post(`/users/${id}/deactivate`),
  resetPassword: (id, newPassword) => apiClient.post(`/users/${id}/reset-password`, { newPassword }),
};
