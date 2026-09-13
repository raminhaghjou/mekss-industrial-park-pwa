import apiClient from './base.api';

export const MEDIA_DOMAINS = [
  'avatar',
  'logo',
  'document',
  'invoice',
  'gate-pass',
  'advertisement',
  'request',
  'message',
  'announcement',
];

export const filesApi = {
  upload: (file, { domain, parkId, factoryId } = {}) => {
    if (!file) return Promise.reject(new Error('فایل انتخاب نشده است'));
    if (!domain) return Promise.reject(new Error('domain الزامی است'));

    const form = new FormData();
    form.append('file', file);
    form.append('domain', domain);
    if (parkId) form.append('parkId', parkId);
    if (factoryId) form.append('factoryId', factoryId);

    return apiClient.post('/files/upload', form, {
      // Let the browser set multipart boundary — do not force Content-Type.
      headers: { 'Content-Type': undefined },
      timeout: 120000,
      transformRequest: [(data, headers) => {
        if (data instanceof FormData && headers) {
          delete headers['Content-Type'];
        }
        return data;
      }],
    });
  },

  getMetadata: (id) => apiClient.get(`/files/${id}`),

  /** Authenticated binary download (Blob) for inline preview / img. */
  getContentBlob: async (id) => {
    const response = await apiClient.get(`/files/${id}/content`, {
      responseType: 'blob',
      timeout: 120000,
    });
    return response.data;
  },

  download: async (id, filename) => {
    const response = await apiClient.get(`/files/${id}/content`, {
      params: { download: 1 },
      responseType: 'blob',
      timeout: 120000,
    });
    const blob = response.data;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || 'download';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

  remove: (id) => apiClient.delete(`/files/${id}`),
};

export default filesApi;
