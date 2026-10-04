import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('./base.api', () => ({
  default: { get: mocks.get, post: mocks.post, delete: mocks.delete },
}));

const {
  ensureFileExtension,
  extensionForMime,
  filenameFromDisposition,
  filesApi,
  saveResponseBlob,
} = await import('./files.api');

describe('file download helpers', () => {
  let anchors;
  let createObjectURL;
  let revokeObjectURL;

  beforeEach(() => {
    vi.useFakeTimers();
    anchors = [];
    createObjectURL = vi.fn(() => 'blob:mock');
    revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
      anchors.push({ href: this.href, download: this.download });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mocks.get.mockReset();
  });

  it('reads RFC 5987 and plain Content-Disposition file names', () => {
    expect(filenameFromDisposition(`attachment; filename*=UTF-8''${encodeURIComponent('قبض مهر.pdf')}`)).toBe('قبض مهر.pdf');
    expect(filenameFromDisposition('attachment; filename="report.xlsx"')).toBe('report.xlsx');
    expect(filenameFromDisposition('inline; filename=plain.txt')).toBe('plain.txt');
    expect(filenameFromDisposition('')).toBe('');
    expect(filenameFromDisposition(undefined)).toBe('');
  });

  it('adds a MIME-derived extension only when the name has none and strips unsafe characters', () => {
    expect(extensionForMime('application/pdf; charset=binary')).toBe('pdf');
    expect(ensureFileExtension('پیوست-1', 'application/pdf')).toBe('پیوست-1.pdf');
    expect(ensureFileExtension('scan.png', 'application/pdf')).toBe('scan.png');
    expect(ensureFileExtension('a/b:c', 'image/jpeg')).toBe('a-b-c.jpg');
    expect(ensureFileExtension('', 'application/octet-stream')).toBe('download');
  });

  it('saves a blob response under the server name and revokes the URL later, not immediately', () => {
    const response = {
      data: new Blob(['%PDF'], { type: 'application/pdf' }),
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent('invoice-12.pdf')}`,
      },
    };

    expect(saveResponseBlob(response, 'fallback')).toBe('invoice-12.pdf');
    expect(anchors).toEqual([{ href: 'blob:mock', download: 'invoice-12.pdf' }]);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('falls back to the given name plus an extension when the server sends no file name', () => {
    const response = { data: new Blob(['x'], { type: '' }), headers: { 'content-type': 'image/png' } };
    expect(saveResponseBlob(response, 'پیوست-2')).toBe('پیوست-2.png');
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe('image/png');
  });

  it('downloads stored files as attachments through the authenticated content route', async () => {
    mocks.get.mockResolvedValue({
      data: new Blob(['x'], { type: 'application/pdf' }),
      headers: { 'content-type': 'application/pdf', 'content-disposition': "attachment; filename*=UTF-8''doc.pdf" },
    });

    await filesApi.download('file-1', 'پیوست-1');

    expect(mocks.get).toHaveBeenCalledWith('/files/file-1/content', expect.objectContaining({
      params: { download: 1 },
      responseType: 'blob',
    }));
    expect(anchors[0].download).toBe('doc.pdf');
  });
});
