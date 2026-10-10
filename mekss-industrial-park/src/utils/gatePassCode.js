import { normalizeText } from './semanticSearch';
import { gatePassNumber } from './gatePassPrint';

const MEKSS_TOKEN = /MEKSS-[A-Za-z0-9]+/i;
const SAFE = /[^A-Za-z0-9_-]/g;

/**
 * Turn whatever a QR scanner or a guard typed into the token the by-qr endpoint accepts:
 * the raw `MEKSS-…` code, a URL / JSON payload containing it, or a (partial) gate-pass number.
 */
export function extractGatePassCode(value) {
  const text = normalizeText(value).replace(/\s+/g, '');
  if (!text) return '';
  const token = String(value).match(MEKSS_TOKEN) || text.match(MEKSS_TOKEN);
  if (token) return token[0].replace(/^mekss-/i, 'MEKSS-');
  if (text.startsWith('{')) {
    try {
      const data = JSON.parse(String(value));
      const inner = data?.qrCode || data?.code || data?.id;
      if (inner) return extractGatePassCode(inner);
    } catch {
      /* not JSON */
    }
  }
  if (/^https?:/i.test(text)) {
    try {
      const url = new URL(String(value).trim());
      const param = url.searchParams.get('code') || url.searchParams.get('qr') || url.searchParams.get('id');
      const last = url.pathname.split('/').filter(Boolean).pop();
      return extractGatePassCode(param || last || '');
    } catch {
      /* not a URL */
    }
  }
  return String(value).trim().replace(/[۰-۹٠-٩]/g, (d) => normalizeText(d)).replace(SAFE, '');
}

/** True when `query` is the start of (or the whole) printed gate-pass number. */
export function matchesGatePassNumber(pass, query) {
  const q = extractGatePassCode(query).toUpperCase();
  if (q.length < 3) return false;
  const number = gatePassNumber(pass);
  return number !== '—' && number.startsWith(q);
}
