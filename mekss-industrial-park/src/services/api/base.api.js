import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise = null;

const clearSession = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

const refreshSession = () => {
  if (refreshPromise) return refreshPromise;
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return Promise.reject(new Error('Refresh token is unavailable'));

  refreshPromise = axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
    .then(({ data }) => {
      const { accessToken, refreshToken: rotatedRefreshToken } = data;
      if (typeof accessToken !== 'string' || typeof rotatedRefreshToken !== 'string') {
        throw new Error('Invalid token refresh response');
      }
      // localStorage writes are synchronous; no other interceptor task can observe
      // the pair between these writes before this promise resolves.
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', rotatedRefreshToken);
      return accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
};

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const method = (config.method || 'get').toLowerCase();
    // Block mutations while offline instead of letting them appear to
    // "succeed" locally or queue for silent background replay; the caller's
    // error handler surfaces this as an explicit non-mutating failure.
    if (method !== 'get' && typeof navigator !== 'undefined' && navigator.onLine === false) {
      return Promise.reject(new axios.Cancel('Offline: mutation blocked until reconnect'));
    }
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const accessToken = await refreshSession();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // A single shared refresh failure invalidates the session. Concurrent
        // requests never clear a token pair written by another refresh attempt.
        clearSession();
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;