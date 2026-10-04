export const BANNER_IMAGE_SPECS = {
  desktop: { width: 1920, height: 480, label: 'تصویر دسکتاپ', hint: '۱۹۲۰×۴۸۰ پیکسل (نسبت ۴ به ۱)' },
  mobile: { width: 1080, height: 540, label: 'تصویر موبایل', hint: '۱۰۸۰×۵۴۰ پیکسل (نسبت ۲ به ۱)' },
};

const RATIO_TOLERANCE = 0.05;

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
