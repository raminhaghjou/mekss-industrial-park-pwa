const ONES = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const TEENS = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const TENS = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const HUNDREDS = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'هزار میلیارد'];

const threeDigits = (value) => {
  const parts = [];
  const hundred = Math.floor(value / 100);
  const rest = value % 100;
  if (hundred) parts.push(HUNDREDS[hundred]);
  if (rest >= 10 && rest < 20) parts.push(TEENS[rest - 10]);
  else {
    const ten = Math.floor(rest / 10);
    const one = rest % 10;
    if (ten) parts.push(TENS[ten]);
    if (one) parts.push(ONES[one]);
  }
  return parts.join(' و ');
};

/** Spells a non-negative integer in Persian words, e.g. 1500000 → «یک میلیون و پانصد هزار». */
export const numberToPersianWords = (input) => {
  const value = Math.floor(Number(input));
  if (!Number.isFinite(value) || value < 0) return '';
  if (value === 0) return 'صفر';
  const groups = [];
  let remaining = value;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  if (groups.length > SCALES.length) return '';
  return groups
    .map((group, index) => (group ? `${threeDigits(group)}${SCALES[index] ? ` ${SCALES[index]}` : ''}` : ''))
    .filter(Boolean)
    .reverse()
    .join(' و ');
};
