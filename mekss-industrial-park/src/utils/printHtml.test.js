import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPrintDocument, escapeHtml, printHtml } from './printHtml';

describe('printHtml', () => {
  afterEach(() => {
    document.querySelectorAll('iframe').forEach((frame) => frame.remove());
    vi.restoreAllMocks();
  });

  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
    expect(escapeHtml(null)).toBe('');
  });

  it('builds an RTL document with the bundled Vazirmatn font and no CDN', () => {
    const html = buildPrintDocument({ title: 'قبض <1>', bodyHtml: '<p>متن</p>', css: '.x{color:red}' });
    expect(html).toContain('<html lang="fa" dir="rtl">');
    expect(html).toContain('<title>قبض &lt;1&gt;</title>');
    expect(html).toContain("font-family:'Vazirmatn'");
    expect(html).toContain('.x{color:red}');
    expect(html).toContain('<p>متن</p>');
    expect(html).not.toMatch(/googleapis|jsdelivr|unpkg/);
  });

  it('prints through a hidden iframe instead of a popup window', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const pending = printHtml({ title: 'گزارش', bodyHtml: '<p>x</p>' });

    const iframe = document.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe.getAttribute('aria-hidden')).toBe('true');
    expect(iframe.srcdoc).toContain('<p>x</p>');

    const print = vi.fn();
    iframe.contentWindow.focus = vi.fn();
    iframe.contentWindow.print = print;
    await iframe.onload(new Event('load'));

    await expect(pending).resolves.toBe(true);
    expect(print).toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('keeps the printed frame until the next print and then replaces it', () => {
    printHtml({ title: 'اول', bodyHtml: '<p>1</p>' });
    printHtml({ title: 'دوم', bodyHtml: '<p>2</p>' });
    const frames = /** @type {NodeListOf<HTMLIFrameElement>} */ (document.querySelectorAll('iframe[data-mekss-print]'));
    expect(frames).toHaveLength(1);
    expect(frames[0].srcdoc).toContain('<p>2</p>');
  });

  it('falls back to downloading the HTML when the print dialog cannot open', async () => {
    const createObjectURL = vi.fn(() => 'blob:print');
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const pending = printHtml({ title: 'گزارش/ماهانه', bodyHtml: '<p>x</p>' });

    const iframe = document.querySelector('iframe');
    iframe.contentWindow.focus = vi.fn();
    iframe.contentWindow.print = () => { throw new Error('blocked'); };
    await iframe.onload(new Event('load'));

    await expect(pending).resolves.toBe(false);
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });
});
