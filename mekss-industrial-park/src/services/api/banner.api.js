import apiClient from './base.api';

export const bannerApi = {
  getActive: () => apiClient.get('/banners/active'),
  getManaged: () => apiClient.get('/banners/managed'),
  create: (data) => apiClient.post('/banners/managed', data),
  update: (id, data) => apiClient.put(`/banners/managed/${id}`, data),
  remove: (id) => apiClient.delete(`/banners/managed/${id}`),
  recordClick: (id) => apiClient.post(`/banners/${id}/click`),
};

/** Same rule as the backend DTO: https:// URLs or internal paths starting with a single `/`. */
const BANNER_LINK = /^(https:\/\/[^\s<>"'\\]+|\/(?![/\\])[^\s<>"'\\]*)$/;

export const isAllowedBannerLink = (value) => {
  const link = String(value || '').trim();
  return !link || BANNER_LINK.test(link);
};

export const isExternalBannerLink = (value) => /^https:\/\//.test(String(value || '').trim());

export default bannerApi;
