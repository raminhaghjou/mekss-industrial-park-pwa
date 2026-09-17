/** Valid Persian letters used on standard Iranian vehicle plates. */
export const IRAN_PLATE_LETTERS = [
  { value: 'ب', label: 'ب' },
  { value: 'ج', label: 'ج' },
  { value: 'د', label: 'د' },
  { value: 'س', label: 'س' },
  { value: 'ص', label: 'ص' },
  { value: 'ط', label: 'ط' },
  { value: 'ق', label: 'ق' },
  { value: 'ل', label: 'ل' },
  { value: 'م', label: 'م' },
  { value: 'ن', label: 'ن' },
  { value: 'و', label: 'و' },
  { value: 'ه', label: 'ه' },
  { value: 'ی', label: 'ی' },
  { value: 'ت', label: 'ت' },
  { value: 'ا', label: 'الف' },
];

/** Common Iran plate region codes (کد شهر / استان روی پلاک). */
export const IRAN_PLATE_REGIONS = [
  { code: '10', label: '۱۰ — تهران' },
  { code: '11', label: '۱۱ — تهران' },
  { code: '12', label: '۱۲ — خراسان رضوی' },
  { code: '13', label: '۱۳ — اصفهان' },
  { code: '14', label: '۱۴ — آذربایجان شرقی' },
  { code: '15', label: '۱۵ — البرز / کرج' },
  { code: '16', label: '۱۶ — خوزستان' },
  { code: '17', label: '۱۷ — فارس' },
  { code: '18', label: '۱۸ — آذربایجان غربی' },
  { code: '19', label: '۱۹ — کرمان' },
  { code: '20', label: '۲۰ — مازندران' },
  { code: '21', label: '۲۱ — تهران' },
  { code: '22', label: '۲۲ — تهران' },
  { code: '23', label: '۲۳ — تهران' },
  { code: '24', label: '۲۴ — گیلان' },
  { code: '25', label: '۲۵ — مرکزی' },
  { code: '26', label: '۲۶ — همدان' },
  { code: '27', label: '۲۷ — کرمانشاه' },
  { code: '28', label: '۲۸ — گلستان' },
  { code: '29', label: '۲۹ — هرمزگان' },
  { code: '30', label: '۳۰ — خوزستان' },
  { code: '31', label: '۳۱ — لرستان' },
  { code: '32', label: '۳۲ — کردستان' },
  { code: '33', label: '۳۳ — سیستان و بلوچستان' },
  { code: '34', label: '۳۴ — زنجان' },
  { code: '35', label: '۳۵ — یزد' },
  { code: '36', label: '۳۶ — اردبیل' },
  { code: '37', label: '۳۷ — قم' },
  { code: '38', label: '۳۸ — قزوین' },
  { code: '40', label: '۴۰ — بوشهر' },
  { code: '41', label: '۴۱ — سمنان' },
  { code: '42', label: '۴۲ — ایلام' },
  { code: '43', label: '۴۳ — چهارمحال و بختیاری' },
  { code: '44', label: '۴۴ — کهگیلویه و بویراحمد' },
  { code: '45', label: '۴۵ — خراسان شمالی' },
  { code: '46', label: '۴۶ — خراسان جنوبی' },
  { code: '51', label: '۵۱ — فارس' },
  { code: '52', label: '۵۲ — خراسان رضوی' },
  { code: '53', label: '۵۳ — آذربایجان شرقی' },
  { code: '54', label: '۵۴ — آذربایجان غربی' },
  { code: '55', label: '۵۵ — اصفهان' },
  { code: '56', label: '۵۶ — کرمان' },
  { code: '57', label: '۵۷ — مازندران' },
  { code: '61', label: '۶۱ — خوزستان' },
  { code: '62', label: '۶۲ — گیلان' },
  { code: '63', label: '۶۳ — فارس' },
  { code: '66', label: '۶۶ — تهران' },
  { code: '67', label: '۶۷ — البرز' },
  { code: '68', label: '۶۸ — تهران' },
  { code: '71', label: '۷۱ — فارس' },
  { code: '72', label: '۷۲ — خراسان رضوی' },
  { code: '74', label: '۷۴ — اصفهان' },
  { code: '75', label: '۷۵ — مازندران' },
  { code: '77', label: '۷۷ — فارس' },
  { code: '78', label: '۷۸ — تهران' },
  { code: '81', label: '۸۱ — کرمان' },
  { code: '82', label: '۸۲ — خوزستان' },
  { code: '84', label: '۸۴ — همدان' },
  { code: '86', label: '۸۶ — یزد' },
  { code: '87', label: '۸۷ — مرکزی' },
  { code: '88', label: '۸۸ — بوشهر' },
  { code: '91', label: '۹۱ — هرمزگان' },
  { code: '93', label: '۹۳ — سیستان و بلوچستان' },
  { code: '95', label: '۹۵ — کهگیلویه و بویراحمد' },
  { code: '96', label: '۹۶ — زنجان' },
  { code: '97', label: '۹۷ — قزوین' },
  { code: '98', label: '۹۸ — ایلام' },
  { code: '99', label: '۹۹ — تهران' },
];

export const TWO_DIGIT_OPTIONS = Array.from({ length: 99 }, (_, i) => String(i + 1).padStart(2, '0'));
export const DIGIT_OPTIONS = Array.from({ length: 10 }, (_, i) => String(i));

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
  return Boolean(formatIranLicensePlate(parseIranLicensePlate(value)));
}
