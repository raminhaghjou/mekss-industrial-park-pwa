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
  'banner',
];

const MIME_EXTENSIONS = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'text/html': 'html',
  'application/zip': 'zip',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

/** Reads `filename*=UTF-8''…` (preferred) or `filename="…"` from a Content-Disposition header. */
export const filenameFromDisposition = (header) => {
  if (!header || typeof header !== 'string') return '';
  const extended = header.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // fall through to the plain filename
    }
  }
  const plain = header.match(/filename\s*=\s*"([^"]*)"|filename\s*=\s*([^;]+)/);
  return (plain?.[1] ?? plain?.[2] ?? '').trim();
};

export const extensionForMime = (mime) => MIME_EXTENSIONS[String(mime || '').split(';')[0].trim().toLowerCase()] || '';

/** Adds the MIME-derived extension when the name has none, and strips characters invalid in file names. */
export const ensureFileExtension = (name, mime) => {
  const controlsAsSlash = Array.from(String(name || ''), (char) => (char.charCodeAt(0) < 32 ? '/' : char)).join('');
  const clean = controlsAsSlash.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'download';
  if (/\.[A-Za-z0-9]{1,8}$/.test(clean)) return clean;
  const extension = extensionForMime(mime);
  return extension ? `${clean}.${extension}` : clean;
};

/** Triggers a browser download; the object URL is revoked later so slow browsers can still read it. */
export const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/** Saves an axios `responseType: 'blob'` response with the server-provided name and a typed Blob. */
export const saveResponseBlob = (response, fallbackName) => {
  const headers = response?.headers || {};
  const contentType = headers['content-type'] || response?.data?.type || 'application/octet-stream';
  const serverName = filenameFromDisposition(headers['content-disposition']);
  const name = ensureFileExtension(serverName || fallbackName || 'download', contentType);
  const data = response?.data;
  const blob = data instanceof Blob && data.type ? data : new Blob([data], { type: String(contentType).split(';')[0] });
  saveBlob(blob, name);
  return name;
};

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

  /** Saves a stored file under its original name (from Content-Disposition) with a proper extension. */
  download: async (id, filename) => {
    const response = await apiClient.get(`/files/${id}/content`, {
      params: { download: 1 },
      responseType: 'blob',
      timeout: 120000,
    });
    saveResponseBlob(response, filename);
  },

  remove: (id) => apiClient.delete(`/files/${id}`),
};

export default filesApi;
