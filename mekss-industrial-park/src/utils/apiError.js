/**
 * Extracts a user-facing Persian error message from an Axios-style error
 * response, falling back to a supplied default when the server did not
 * return a classified message (e.g. network failure, timeout, offline).
 * Accepts `any` deliberately: callers receive React Query's generic `Error`
 * type for query/mutation failures, but the underlying rejection is always
 * the Axios error thrown by the shared `apiClient` interceptors.
 * @param {any} error
 * @param {string} fallback
 * @returns {string}
 */
export const getErrorMessage = (error, fallback) => error?.response?.data?.message || fallback;
