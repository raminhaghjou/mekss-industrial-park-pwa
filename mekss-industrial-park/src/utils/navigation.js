/** Accepts only same-app paths (`/x`, not `//host`), excluding the given prefixes; otherwise returns the fallback. */
export const safeInternalPath = (value, fallback = '/dashboard', excludedPrefixes = []) => {
  const path = typeof value === 'string' ? value : '';
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return fallback;
  if (excludedPrefixes.some((prefix) => path.startsWith(prefix))) return fallback;
  return path;
};

/**
 * Where the global back button goes: browser history when this tab has in-app entries behind the current one
 * (React Router keeps that index in `history.state.idx`; replace-redirects keep it at 0), otherwise the fallback.
 */
export const backTarget = (historyIndex, fallback = '/dashboard') => (
  Number.isInteger(historyIndex) && historyIndex > 0 ? -1 : fallback
);
