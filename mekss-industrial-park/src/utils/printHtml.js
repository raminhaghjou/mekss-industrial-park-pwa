import vazirArabic400 from '@fontsource/vazirmatn/files/vazirmatn-arabic-400-normal.woff2?url';
import vazirLatin400 from '@fontsource/vazirmatn/files/vazirmatn-latin-400-normal.woff2?url';
import vazirArabic700 from '@fontsource/vazirmatn/files/vazirmatn-arabic-700-normal.woff2?url';
import vazirLatin700 from '@fontsource/vazirmatn/files/vazirmatn-latin-700-normal.woff2?url';

/**
 * Printing through a hidden iframe instead of `window.open(..., 'noopener')`:
 * a noopener popup always returns null (nothing was ever printed) and popups are
 * blocked in installed PWAs. The font is the bundled Vazirmatn (no CDN), so
 * printing also works offline.
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ARABIC_RANGE = 'U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200E,U+2010-2011,U+FB50-FDFF,U+FE70-FEFC';
const LATIN_RANGE = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212';

const absoluteUrl = (url) => {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
};

export function printFontFaceCss() {
  const face = (url, weight, range) => `@font-face{font-family:'Vazirmatn';font-style:normal;font-weight:${weight};font-display:block;src:url('${absoluteUrl(url)}') format('woff2');unicode-range:${range};}`;
  return [
    face(vazirArabic400, 400, ARABIC_RANGE),
    face(vazirLatin400, 400, LATIN_RANGE),
    face(vazirArabic700, 700, ARABIC_RANGE),
    face(vazirLatin700, 700, LATIN_RANGE),
  ].join('\n');
}

const BASE_CSS = `
  :root { --brand: #21aa58; --ink: #0f172a; --muted: #64748b; --line: #e2e8f0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { font-family: 'Vazirmatn', Tahoma, sans-serif; color: var(--ink); line-height: 1.8; padding: 24px; font-size: 13px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 18px 0 8px; color: var(--brand); }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border: 1px solid var(--line); padding: 6px 8px; text-align: right; vertical-align: top; }
  th { background: #f0fdf4; color: #166534; font-weight: 700; }
  .muted { color: var(--muted); }
  .ltr { direction: ltr; unicode-bidi: embed; display: inline-block; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 3px solid var(--brand); padding-bottom: 10px; margin-bottom: 14px; }
  .brand { font-size: 12px; font-weight: 700; color: var(--brand); }
  .row { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--line); padding: 5px 0; }
  .total { font-size: 15px; font-weight: 700; }
  .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid var(--line); font-size: 11px; color: var(--muted); }
  @media print { body { padding: 8mm; } }
`;

/** Full RTL HTML document for printing. `bodyHtml` must already be escaped. */
export function buildPrintDocument({ title, bodyHtml, css = '' }) {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${printFontFaceCss()}\n${BASE_CSS}\n${css}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function downloadHtmlFallback(html, title) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${String(title || 'mekss-print').replace(/[\\/:*?"<>|]+/g, '-')}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const waitForFonts = (doc, timeoutMs) => new Promise((resolve) => {
  const timer = setTimeout(resolve, timeoutMs);
  const ready = doc?.fonts?.ready;
  if (!ready || typeof ready.then !== 'function') {
    clearTimeout(timer);
    resolve();
    return;
  }
  ready.then(() => {
    clearTimeout(timer);
    resolve();
  }, () => {
    clearTimeout(timer);
    resolve();
  });
});

/**
 * Opens the browser print dialog for the given document (users pick "Save as PDF"
 * to get a file). Resolves true once the dialog was opened, false on fallback.
 */
export function printHtml({ title, bodyHtml, css = '' }) {
  const html = buildPrintDocument({ title, bodyHtml, css });
  // On mobile, print() returns before the dialog has rendered the page (and afterprint can fire
  // early), so a used frame is only removed when the next print starts — never on a timer.
  document.querySelectorAll('iframe[data-mekss-print]').forEach((frame) => frame.remove());
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('data-mekss-print', '');
    iframe.title = title || 'print';
    Object.assign(iframe.style, {
      position: 'fixed', left: '0', bottom: '0', width: '0', height: '0', border: '0', opacity: '0', pointerEvents: 'none',
    });
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    iframe.onload = async () => {
      const win = iframe.contentWindow;
      if (!win) {
        downloadHtmlFallback(html, title);
        iframe.remove();
        finish(false);
        return;
      }
      await waitForFonts(iframe.contentDocument, 2500);
      try {
        win.focus();
        win.print();
        finish(true);
      } catch {
        downloadHtmlFallback(html, title);
        iframe.remove();
        finish(false);
      }
    };
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });
}

const FA_NUMBER = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
export const formatFaMoney = (value) => FA_NUMBER.format(Math.round(Number(value) || 0));
export const formatFaDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fa-IR-u-ca-persian');
};
export const formatFaDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fa-IR-u-ca-persian', { dateStyle: 'short', timeStyle: 'short' });
};
