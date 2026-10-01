import apiClient from './base.api';

export const anprApi = {
  /** HTTP fallback for a single frame (raw JPEG body). */
  recognize: (image, { sessionId, mode, signal } = {}) =>
    apiClient.post('/anpr/recognize', image, {
      params: { ...(sessionId ? { sessionId } : {}), ...(mode ? { mode } : {}) },
      headers: { 'Content-Type': 'image/jpeg' },
      timeout: 4000,
      signal,
      transformRequest: [(data) => data],
    }),
  resetSession: (sessionId) => apiClient.post(`/anpr/sessions/${encodeURIComponent(sessionId)}/reset`),
  /** Match + audit a plate read on the device or typed by the guard. */
  match: (payload) => apiClient.post('/anpr/match', payload, { timeout: 6000 }),
  confirmRead: (id, payload) => apiClient.post(`/anpr/reads/${encodeURIComponent(id)}/confirm`, payload),
  status: () => apiClient.get('/anpr/status', { timeout: 3000 }),
};
