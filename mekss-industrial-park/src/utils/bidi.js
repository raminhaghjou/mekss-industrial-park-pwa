/**
 * Bidi-isolation helpers for rendering left-to-right tokens (phone numbers,
 * license plates, emails, URLs, codes) correctly inside RTL Persian text
 * without changing the underlying stored/payload value. Presentation-only.
 */

/** Values that read correctly only in LTR direction, regardless of the surrounding RTL context. */
export const LTR_FIELD_KINDS = ['phone', 'email', 'url', 'plate', 'code', 'id'];

/**
 * Returns MUI-compatible props that isolate an LTR token inside RTL flow
 * using the Unicode bidi isolate characters, so digits/punctuation in phone
 * numbers, plates, and codes do not visually reorder.
 * @param {string | null | undefined} value
 * @returns {{ dir: 'ltr', children: string }}
 */
export const isolateLtr = (value) => ({
  dir: 'ltr',
  children: value ? `\u2066${value}\u2069` : '—',
});
