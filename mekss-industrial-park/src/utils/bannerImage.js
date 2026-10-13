export const BANNER_IMAGE_SPECS = {
  desktop: { width: 1920, height: 480, label: 'تصویر دسکتاپ', hint: '۱۹۲۰×۴۸۰ پیکسل (نسبت ۴ به ۱)' },
  mobile: { width: 1080, height: 540, label: 'تصویر موبایل', hint: '۱۰۸۰×۵۴۰ پیکسل (نسبت ۲ به ۱)' },
};

const RATIO_TOLERANCE = 0.05;

/** Files at or below this size are uploaded untouched. */
export const BANNER_OPTIMIZE_THRESHOLD = 1.5 * 1024 * 1024;

const loadBitmap = async (file) => {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      return null;
    }
  }
};

const canvasToBlob = (canvas, type, quality) => new Promise((resolve) => {
  if (typeof canvas.convertToBlob === 'function') {
    canvas.convertToBlob({ type, quality }).then(resolve, () => resolve(null));
    return;
  }
  canvas.toBlob((blob) => resolve(blob), type, quality);
});

/**
 * Downscales a large banner image to at most twice the target width and re-encodes it (WebP, else JPEG)
 * so uploads stay small. Returns the original file when it is already small or the browser cannot
 * re-encode it; never returns a bigger file.
 * @param {File} file
 * @param {'desktop' | 'mobile'} kind
 * @returns {Promise<File>}
 */
export const optimizeBannerImage = async (file, kind) => {
  const spec = BANNER_IMAGE_SPECS[kind];
  if (!spec || !file || file.size <= BANNER_OPTIMIZE_THRESHOLD || file.type === 'image/gif') return file;
  const bitmap = await loadBitmap(file);
  if (!bitmap) return file;
  try {
    const scale = Math.min(1, spec.width / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    for (const [type, quality] of [['image/webp', 0.9], ['image/jpeg', 0.88], ['image/jpeg', 0.75]]) {
      const blob = await canvasToBlob(canvas, type, quality);
      if (!blob || blob.type !== type || blob.size >= file.size) continue;
      if (blob.size > BANNER_OPTIMIZE_THRESHOLD && quality > 0.75) continue;
      const extension = type === 'image/webp' ? 'webp' : 'jpg';
      const name = `${String(file.name || 'banner').replace(/\.[^.]+$/, '')}.${extension}`;
      return new File([blob], name, { type });
    }
    return file;
  } finally {
    bitmap.close?.();
  }
};

/** Returns a Persian warning when a picked image does not match the expected banner size, or '' when it does. */
export const bannerImageWarning = (kind, width, height) => {
  const spec = BANNER_IMAGE_SPECS[kind];
  if (!spec || !width || !height) return '';
  const expected = spec.width / spec.height;
  const actual = width / height;
  if (Math.abs(actual - expected) / expected > RATIO_TOLERANCE) {
    return `نسبت تصویر (${width}×${height}) با ${spec.hint} هم‌خوان نیست؛ بخشی از تصویر در نمایش بریده می‌شود.`;
  }
  if (width < spec.width * 0.75) {
    return `وضوح تصویر (${width}×${height}) کمتر از ${spec.hint} است و ممکن است تار دیده شود.`;
  }
  return '';
};
