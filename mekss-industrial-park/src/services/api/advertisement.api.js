import apiClient from './base.api';

export const advertisementApi = {
  getPublicAdvertisements: (params) => apiClient.get('/advertisements', { params }),
  getCategories: () => apiClient.get('/advertisement-categories'),
  getManagedCategories: () => apiClient.get('/advertisement-categories/managed'),
  createCategory: (data) => apiClient.post('/advertisement-categories', data),
  updateCategory: (id, data) => apiClient.put(`/advertisement-categories/${id}`, data),
  deleteCategory: (id) => apiClient.delete(`/advertisement-categories/${id}`),
  getFavorites: () => apiClient.get('/advertisements/favorites'),
  addFavorite: (id) => apiClient.post(`/advertisements/${id}/favorite`),
  removeFavorite: (id) => apiClient.delete(`/advertisements/${id}/favorite`),
  requestFeatured: (id) => apiClient.post(`/advertisements/mine/${id}/featured-request`),
  getFeaturedSettings: () => apiClient.get('/settings/advertisement-featured'),
  updateFeaturedSettings: (monthlyCap) => apiClient.patch('/settings/advertisement-featured', { monthlyCap }),
  getMyAdvertisements: () => apiClient.get('/advertisements/mine'),
  getMyAdvertisement: (id) => apiClient.get(`/advertisements/mine/${id}`),
  getCreationScope: () => apiClient.get('/advertisements/creation-scope'),
  createAdvertisement: (data) => apiClient.post('/advertisements', data),
  updateMyAdvertisement: (id, data) => apiClient.put(`/advertisements/mine/${id}`, data),
  deleteMyAdvertisement: (id) => apiClient.delete(`/advertisements/mine/${id}`),
  // Legacy array routes remain available for existing clients.
  getManagedPending: () => apiClient.get('/advertisements/managed/pending'),
  getManagedHistory: () => apiClient.get('/advertisements/managed/history'),
  getManagedAdvertisements: (params) => apiClient.get('/advertisements/managed', { params }),
  getManagedAdvertisement: (id) => apiClient.get(`/advertisements/managed/${id}`),
  approveAdvertisement: (id, promoteFeatured = false) => apiClient.post(`/advertisements/${id}/approve`, { approved: true, promoteFeatured }),
  rejectAdvertisement: (id, rejectionReason) => apiClient.post(`/advertisements/${id}/approve`, { approved: false, rejectionReason }),
};
