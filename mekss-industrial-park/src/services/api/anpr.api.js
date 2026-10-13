import apiClient from './base.api';

/** Still photos run multi-scale + tiled detection on the server, so they get a longer deadline. */
export const ANPR_TIMEOUTS = { frame: 4000, photo: 15000 };

export const anprApi = {
  /** HTTP fallback for a single frame, or a still photo with `mode: 'photo'` (raw JPEG body). */
  recognize: (image, { sessionId, mode, signal } = {}) =>
    apiClient.post('/anpr/recognize', image, {
      params: { ...(sessionId ? { sessionId } : {}), ...(mode ? { mode } : {}) },
      headers: { 'Content-Type': 'image/jpeg' },
      timeout: mode === 'photo' ? ANPR_TIMEOUTS.photo : ANPR_TIMEOUTS.frame,
      signal,
      transformRequest: [(data) => data],
    }),
  resetSession: (sessionId) => apiClient.post(`/anpr/sessions/${encodeURIComponent(sessionId)}/reset`),
  /** Match + audit a plate read on the device or typed by the guard. */
  match: (payload) => apiClient.post('/anpr/match', payload, { timeout: 6000 }),
  confirmRead: (id, payload) => apiClient.post(`/anpr/reads/${encodeURIComponent(id)}/confirm`, payload),
  status: () => apiClient.get('/anpr/status', { timeout: 3000 }),
  /** True when at least one server engine can read plates (older servers without `available` count as up). */
  serverAvailable: async () => {
    const { data } = await apiClient.get('/anpr/status', { timeout: 3000 });
    return data?.available !== false;
  },
};
