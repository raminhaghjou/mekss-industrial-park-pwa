const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

/** Older ads may store absolute URLs; new ones store media asset ids. */
const isDirectUrl = (value) => /^(https?:|data:|blob:|\/)/.test(value);

/**
 * Image source for an approved ad, readable without a session (the public ads wall).
 * @param {unknown} value media asset id or legacy URL
 */
export const publicAdvertisementImageUrl = (value) => {
  if (!value) return null;
  const text = String(value);
  if (isDirectUrl(text)) return text;
  return `${API_BASE_URL}/files/public/advertisement-images/${encodeURIComponent(text)}`;
};

/**
 * Normalizes stored image references (ids or uploaded file DTOs) to the id list the API expects.
 * @param {Array<string | {id?: string}>} images
 */
export const advertisementImageIds = (images) => (images || [])
  .map((image) => (typeof image === 'string' ? image : image?.id))
  .filter(Boolean);
