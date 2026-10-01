/**
 * Plate categories. Colours follow the physical plates: white private, yellow public/taxi,
 * red government, blue police, green military, and so on.
 */
export const IRAN_PLATE_TYPES = {
  PRIVATE: { label: 'شخصی', bg: '#ffffff', fg: '#0f172a' },
  TAXI: { label: 'تاکسی', bg: '#facc15', fg: '#0f172a' },
  PUBLIC: { label: 'عمومی / باری', bg: '#facc15', fg: '#0f172a' },
  GOVERNMENT: { label: 'دولتی', bg: '#dc2626', fg: '#ffffff' },
  POLICE: { label: 'انتظامی', bg: '#1d4ed8', fg: '#ffffff' },
  MILITARY: { label: 'نظامی', bg: '#166534', fg: '#ffffff' },
  DISABLED: { label: 'جانبازان / معلولین', bg: '#ffffff', fg: '#0f172a' },
  AGRICULTURAL: { label: 'کشاورزی', bg: '#ffffff', fg: '#0f172a' },
  FREE_ZONE: { label: 'منطقه آزاد', bg: '#ffffff', fg: '#0f172a' },
  OTHER: { label: 'سایر', bg: '#ffffff', fg: '#0f172a' },
};

const LETTER_TYPES = {
  ب: 'PRIVATE', ج: 'PRIVATE', د: 'PRIVATE', س: 'PRIVATE', ص: 'PRIVATE', ط: 'PRIVATE', ق: 'PRIVATE',
  ل: 'PRIVATE', م: 'PRIVATE', ن: 'PRIVATE', و: 'PRIVATE', ه: 'PRIVATE', ی: 'PRIVATE',
  ت: 'TAXI',
  ع: 'PUBLIC',
  ا: 'GOVERNMENT',
  پ: 'POLICE',
  ث: 'MILITARY', ش: 'MILITARY', ز: 'MILITARY', ف: 'MILITARY',
  ژ: 'DISABLED',
  ک: 'AGRICULTURAL',
  ح: 'OTHER', گ: 'OTHER',
};

/** Every letter issued on Iranian plates (same set as mekss-backend plate-grammar.ts). */
export const IRAN_PLATE_LETTERS = Object.keys(LETTER_TYPES).map((value) => ({
  value,
  label: value === 'ا' ? 'الف' : value,
  type: LETTER_TYPES[value],
}));

/** Free-trade-zone plates, canonical `FZ-<ZONE>-12345`. */
export const IRAN_FREE_ZONES = [
  { code: 'KISH', label: 'کیش' },
  { code: 'QESHM', label: 'قشم' },
  { code: 'ARVAND', label: 'اروند' },
  { code: 'ANZALI', label: 'انزلی' },
  { code: 'CHABAHAR', label: 'چابهار' },
  { code: 'ARAS', label: 'ارس' },
  { code: 'MAKU', label: 'ماکو' },
];

const LETTER_ALIASES = { آ: 'ا', أ: 'ا', إ: 'ا', ٱ: 'ا', ي: 'ی', ى: 'ی', ئ: 'ی', ك: 'ک', ۀ: 'ه', ة: 'ه' };
const UNALLOCATED_REGIONS = new Set(['39', '70', '80', '90']);
const PLATE_LETTER_CLASS = Object.keys(LETTER_TYPES).join('');
const STANDARD_RE = new RegExp(`^(\\d{2})([${PLATE_LETTER_CLASS}])(\\d{3})(\\d{2})$`, 'u');
const FREE_ZONE_RE = /^FZ-([A-Z]+)-(\d{5})$/;

export function plateTypeForLetter(letter = '') {
  return LETTER_TYPES[letter] || null;
}

export function isKnownIranPlateRegion(code = '') {
  return /^[1-9]\d$/.test(String(code)) && !UNALLOCATED_REGIONS.has(String(code));
}

/**
 * Canonicalise any user/OCR plate string. Mirrors `normalizePlate` in the backend and
 * mekss-anpr so all three agree on `shared/anpr/plate-grammar.vectors.json`.
 * @returns {{ plate: string, valid: boolean, plateType: string|null, parts: object|null }}
 */
export function normalizeIranPlate(raw) {
  const invalid = { plate: '', valid: false, plateType: null, parts: null };
  if (typeof raw !== 'string' || !raw.trim()) return invalid;
  let text = toAsciiDigits(raw).trim();

  const fz = FREE_ZONE_RE.exec(text.toUpperCase());
  if (fz && IRAN_FREE_ZONES.some((z) => z.code === fz[1])) {
    return { plate: text.toUpperCase(), valid: true, plateType: 'FREE_ZONE', parts: { zone: fz[1], number: fz[2] } };
  }
  for (const zone of IRAN_FREE_ZONES) {
    if (text.includes(zone.label)) {
      const digits = text.replace(zone.label, '').replace(/\D/g, '');
      if (digits.length !== 5) return invalid;
      return { plate: `FZ-${zone.code}-${digits}`, valid: true, plateType: 'FREE_ZONE', parts: { zone: zone.code, number: digits } };
    }
  }

  text = text.replace(/ایران/g, '').replace(/iran/gi, '').replace(/الف/g, 'ا');
  text = [...text].map((ch) => LETTER_ALIASES[ch] || ch).join('');
  text = text.replace(/[\s\-_|./\\,:;]+/g, '');
  const match = STANDARD_RE.exec(text);
  if (!match) return invalid;
  const [, series, letter, middle, region] = match;
  return { plate: `${series}${letter}${middle}${region}`, valid: true, plateType: LETTER_TYPES[letter], parts: { series, letter, middle, region } };
}

export function parseIranFreeZonePlate(value = '') {
  const n = normalizeIranPlate(value);
  return n.valid && n.plateType === 'FREE_ZONE' ? n.parts : null;
}

export function formatIranFreeZonePlate({ zone = '', number = '' } = {}) {
  if (!IRAN_FREE_ZONES.some((z) => z.code === zone) || !/^\d{5}$/.test(number)) return '';
  return `FZ-${zone}-${number}`;
}

export function iranPlateTypeOf(value = '') {
  return normalizeIranPlate(value).plateType;
}

/**
 * Official Iran plate region codes (دو رقم سمت راست / ایران) at province level.
 * Source: Wikipedia "Vehicle registration plates of Iran" (راهنمایی و رانندگی table).
 * Unallocated codes (not in this list): 39, 70, 80, 90.
 * Fars = 63, 73, 83, 93 — not 17 (West Azerbaijan).
 * Any 2-digit code can still be entered via the custom option in the UI.
 */
export const IRAN_PLATE_REGIONS = [
  { code: '10', province: 'تهران', label: '۱۰ — تهران' },
  { code: '11', province: 'تهران', label: '۱۱ — تهران' },
  { code: '12', province: 'خراسان رضوی', label: '۱۲ — خراسان رضوی' },
  { code: '13', province: 'اصفهان', label: '۱۳ — اصفهان' },
  { code: '14', province: 'خوزستان', label: '۱۴ — خوزستان' },
  { code: '15', province: 'آذربایجان شرقی', label: '۱۵ — آذربایجان شرقی' },
  { code: '16', province: 'قم', label: '۱۶ — قم' },
  { code: '17', province: 'آذربایجان غربی', label: '۱۷ — آذربایجان غربی' },
  { code: '18', province: 'همدان', label: '۱۸ — همدان' },
  { code: '19', province: 'کرمانشاه', label: '۱۹ — کرمانشاه' },
  { code: '20', province: 'تهران', label: '۲۰ — تهران' },
  { code: '21', province: 'البرز / تهران', label: '۲۱ — البرز / تهران' },
  { code: '22', province: 'تهران', label: '۲۲ — تهران' },
  { code: '23', province: 'اصفهان', label: '۲۳ — اصفهان' },
  { code: '24', province: 'خوزستان', label: '۲۴ — خوزستان' },
  { code: '25', province: 'آذربایجان شرقی', label: '۲۵ — آذربایجان شرقی' },
  { code: '26', province: 'خراسان شمالی', label: '۲۶ — خراسان شمالی' },
  { code: '27', province: 'آذربایجان غربی', label: '۲۷ — آذربایجان غربی' },
  { code: '28', province: 'همدان', label: '۲۸ — همدان' },
  { code: '29', province: 'کرمانشاه', label: '۲۹ — کرمانشاه' },
  { code: '30', province: 'البرز / تهران', label: '۳۰ — البرز / تهران' },
  { code: '31', province: 'لرستان', label: '۳۱ — لرستان' },
  { code: '32', province: 'خراسان رضوی / شمالی / جنوبی', label: '۳۲ — خراسان (رضوی/شمالی/جنوبی)' },
  { code: '33', province: 'تهران', label: '۳۳ — تهران' },
  { code: '34', province: 'خوزستان', label: '۳۴ — خوزستان' },
  { code: '35', province: 'آذربایجان شرقی', label: '۳۵ — آذربایجان شرقی' },
  { code: '36', province: 'خراسان رضوی', label: '۳۶ — خراسان رضوی' },
  { code: '37', province: 'آذربایجان غربی', label: '۳۷ — آذربایجان غربی' },
  { code: '38', province: 'البرز / تهران', label: '۳۸ — البرز / تهران' },
  { code: '40', province: 'تهران', label: '۴۰ — تهران' },
  { code: '41', province: 'لرستان', label: '۴۱ — لرستان' },
  { code: '42', province: 'خراسان رضوی / شمالی / جنوبی', label: '۴۲ — خراسان (رضوی/شمالی/جنوبی)' },
  { code: '43', province: 'اصفهان', label: '۴۳ — اصفهان' },
  { code: '44', province: 'تهران', label: '۴۴ — تهران' },
  { code: '45', province: 'کرمان', label: '۴۵ — کرمان' },
  { code: '46', province: 'گیلان', label: '۴۶ — گیلان' },
  { code: '47', province: 'مرکزی', label: '۴۷ — مرکزی' },
  { code: '48', province: 'بوشهر', label: '۴۸ — بوشهر' },
  { code: '49', province: 'کهگیلویه و بویراحمد', label: '۴۹ — کهگیلویه و بویراحمد' },
  { code: '50', province: 'تهران', label: '۵۰ — تهران' },
  { code: '51', province: 'کردستان', label: '۵۱ — کردستان' },
  { code: '52', province: 'خراسان جنوبی', label: '۵۲ — خراسان جنوبی' },
  { code: '53', province: 'اصفهان', label: '۵۳ — اصفهان' },
  { code: '54', province: 'یزد', label: '۵۴ — یزد' },
  { code: '55', province: 'تهران', label: '۵۵ — تهران' },
  { code: '56', province: 'گیلان', label: '۵۶ — گیلان' },
  { code: '57', province: 'مرکزی', label: '۵۷ — مرکزی' },
  { code: '58', province: 'بوشهر', label: '۵۸ — بوشهر' },
  { code: '59', province: 'گلستان', label: '۵۹ — گلستان' },
  { code: '60', province: 'تهران', label: '۶۰ — تهران' },
  { code: '61', province: 'کردستان', label: '۶۱ — کردستان' },
  { code: '62', province: 'مازندران', label: '۶۲ — مازندران' },
  { code: '63', province: 'فارس', label: '۶۳ — فارس (شیراز و اطراف)' },
  { code: '64', province: 'یزد', label: '۶۴ — یزد' },
  { code: '65', province: 'کرمان', label: '۶۵ — کرمان' },
  { code: '66', province: 'تهران', label: '۶۶ — تهران' },
  { code: '67', province: 'اصفهان', label: '۶۷ — اصفهان' },
  { code: '68', province: 'البرز / تهران', label: '۶۸ — البرز / تهران' },
  { code: '69', province: 'گلستان', label: '۶۹ — گلستان' },
  { code: '71', province: 'چهارمحال و بختیاری', label: '۷۱ — چهارمحال و بختیاری' },
  { code: '72', province: 'مازندران', label: '۷۲ — مازندران' },
  { code: '73', province: 'فارس', label: '۷۳ — فارس' },
  { code: '74', province: 'خراسان رضوی', label: '۷۴ — خراسان رضوی' },
  { code: '75', province: 'کرمان', label: '۷۵ — کرمان' },
  { code: '76', province: 'گیلان', label: '۷۶ — گیلان' },
  { code: '77', province: 'تهران', label: '۷۷ — تهران' },
  { code: '78', province: 'البرز / تهران', label: '۷۸ — البرز / تهران' },
  { code: '79', province: 'قزوین', label: '۷۹ — قزوین' },
  { code: '81', province: 'چهارمحال و بختیاری', label: '۸۱ — چهارمحال و بختیاری' },
  { code: '82', province: 'مازندران', label: '۸۲ — مازندران' },
  { code: '83', province: 'فارس', label: '۸۳ — فارس' },
  { code: '84', province: 'هرمزگان', label: '۸۴ — هرمزگان' },
  { code: '85', province: 'سیستان و بلوچستان', label: '۸۵ — سیستان و بلوچستان' },
  { code: '86', province: 'سمنان', label: '۸۶ — سمنان' },
  { code: '87', province: 'زنجان', label: '۸۷ — زنجان' },
  { code: '88', province: 'تهران', label: '۸۸ — تهران' },
  { code: '89', province: 'قزوین', label: '۸۹ — قزوین' },
  { code: '91', province: 'اردبیل', label: '۹۱ — اردبیل' },
  { code: '92', province: 'مازندران', label: '۹۲ — مازندران' },
  { code: '93', province: 'فارس', label: '۹۳ — فارس' },
  { code: '94', province: 'هرمزگان', label: '۹۴ — هرمزگان' },
  { code: '95', province: 'سیستان و بلوچستان', label: '۹۵ — سیستان و بلوچستان' },
  { code: '96', province: 'سمنان', label: '۹۶ — سمنان' },
  { code: '97', province: 'زنجان', label: '۹۷ — زنجان' },
  { code: '98', province: 'ایلام', label: '۹۸ — ایلام' },
  { code: '99', province: 'تهران', label: '۹۹ — تهران' },
];

export const TWO_DIGIT_OPTIONS = Array.from({ length: 99 }, (_, i) => String(i + 1).padStart(2, '0'));
export const DIGIT_OPTIONS = Array.from({ length: 10 }, (_, i) => String(i));

const CUSTOM_REGION = '__custom__';

export function findIranPlateRegion(code = '') {
  return IRAN_PLATE_REGIONS.find((item) => item.code === String(code)) || null;
}

export function iranPlateRegionLabel(code = '') {
  const known = findIranPlateRegion(code);
  if (known) return known.label;
  if (/^\d{2}$/.test(String(code))) return `${toPersianDigits(code)} — سایر / دستی`;
  return '';
}

export function toPersianDigits(value = '') {
  return String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

const toAsciiDigits = (value = '') =>
  String(value)
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

/**
 * Parse stored plate strings like `12ب34567` into parts.
 * @param {string} value
 * @returns {{ series: string, letter: string, middle: string, region: string }}
 */
export function parseIranLicensePlate(value = '') {
  const normalized = toAsciiDigits(value)
    .replace(/ایران/gi, '')
    .replace(/IRAN/gi, '')
    .replace(/[\s\-_|]/g, '');
  const match = normalized.match(/^(\d{2})([آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]+)(\d{3})(\d{2})$/u);
  if (!match) {
    return { series: '', letter: '', middle: '', region: '' };
  }
  let letter = match[2];
  if (letter === 'آ' || letter === 'الف') letter = 'ا';
  return {
    series: match[1],
    letter,
    middle: match[3],
    region: match[4],
  };
}

/**
 * @param {{ series: string, letter: string, middle: string, region: string }} parts
 * @returns {string}
 */
export function formatIranLicensePlate(parts) {
  const series = String(parts.series || '');
  const letter = String(parts.letter || '');
  const middle = String(parts.middle || '');
  const region = String(parts.region || '');
  if (!/^\d{2}$/.test(series) || !letter || !/^\d{3}$/.test(middle) || !/^\d{2}$/.test(region)) {
    return '';
  }
  return `${series}${letter}${middle}${region}`;
}

export function isCompleteIranLicensePlate(value) {
  return Boolean(formatIranLicensePlate(parseIranLicensePlate(value))) || Boolean(parseIranFreeZonePlate(value));
}

/**
 * Human-readable Iranian plate for UI (lists, confirm dialogs, toasts).
 * Example: `13ب87863` → `13 ب 878-63`
 * @param {string} value
 * @param {{ persianDigits?: boolean }} [options]
 * @returns {string}
 */
export function displayIranLicensePlate(value = '', options = {}) {
  const fz = parseIranFreeZonePlate(value);
  if (fz) {
    const text = `${IRAN_FREE_ZONES.find((z) => z.code === fz.zone)?.label || fz.zone} ${fz.number}`;
    return options.persianDigits ? toPersianDigits(text) : text;
  }
  const parts = parseIranLicensePlate(value);
  if (!parts.series || !parts.letter || !parts.middle || !parts.region) {
    return String(value || '').trim() || '—';
  }
  const letterMeta = IRAN_PLATE_LETTERS.find((item) => item.value === parts.letter);
  const letterLabel = letterMeta?.label || parts.letter;
  const text = `${parts.series} ${letterLabel} ${parts.middle}-${parts.region}`;
  return options.persianDigits ? toPersianDigits(text) : text;
}

export { CUSTOM_REGION };
