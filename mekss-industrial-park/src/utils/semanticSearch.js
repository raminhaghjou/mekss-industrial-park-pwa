/**
 * Persian-aware conceptual (semantic) search for MEKSS lists.
 * Normalizes Arabic/Persian variants, expands domain synonyms, and matches
 * every query token against searchable text (AND across tokens).
 */

const ARABIC_YEH = /\u064A/g;
const ARABIC_KEH = /\u0643/g;
const ARABIC_HEH = /\u0629/g;
const DIACRITICS = /[\u064B-\u065F\u0670]/g;
const ZWNJ = /\u200C/g;
const EXTRA_SPACE = /\s+/g;

const DIGIT_MAP = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

/** Domain synonym groups — any term expands to the whole group. */
const SYNONYM_GROUPS = [
  ['فروشگاه', 'شاپ', 'store', 'shop', 'بازار', 'مارکت', 'market', 'آنلاین', 'اینترنتی'],
  ['واحد', 'کارخانه', 'کارگاه', 'factory', 'صنعتی', 'شرکت', 'کارخانجات'],
  ['شهرک', 'پارک', 'park', 'ناحیه', 'منطقه'],
  ['مجوز', 'برگه', 'برگ خروج', 'گیت', 'تردد', 'عبور', 'پلاک', 'راننده', 'gate', 'pass'],
  ['قبض', 'صورتحساب', 'فاکتور', 'پرداخت', 'invoice', 'بدهی'],
  ['درخواست', 'سرویس', 'خدمات', 'request', 'sms', 'پیامک', 'کد'],
  ['اطلاعیه', 'اعلان', 'اگهی', 'آگهی', 'خبر', 'announcement', 'advertisement'],
  ['اضطراری', 'اورژانس', 'هشدار', 'emergency', 'آلارم'],
  ['نگهبان', 'حراست', 'گارد', 'امنیت', 'guard', 'security'],
  ['مدیر', 'مدیریت', 'مالک', 'owner', 'مدیرعامل', 'ceo'],
  ['تهران', 'tehran'],
  ['اصفهان', 'isfahan', 'esfahan'],
  ['شیراز', 'shiraz'],
  ['مشهد', 'mashhad'],
  ['تبریز', 'tabriz'],
  ['کرج', 'karaj'],
  ['اهواز', 'ahvaz'],
  ['قم', 'qom'],
  ['کرمان', 'kerman'],
  ['یزد', 'yazd'],
];

const synonymIndex = (() => {
  const map = new Map();
  for (const group of SYNONYM_GROUPS) {
    const normalized = group.map((term) => normalizeText(term)).filter(Boolean);
    for (const term of normalized) {
      map.set(term, normalized);
    }
  }
  return map;
})();

export function normalizeText(value) {
  if (value == null) return '';
  return String(value)
    .replace(ARABIC_YEH, 'ی')
    .replace(ARABIC_KEH, 'ک')
    .replace(ARABIC_HEH, 'ه')
    .replace(DIACRITICS, '')
    .replace(ZWNJ, ' ')
    .replace(/[۰-۹٠-٩]/g, (d) => DIGIT_MAP[d] || d)
    .toLowerCase()
    .trim()
    .replace(EXTRA_SPACE, ' ');
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[\s,،./\\|_+-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function expandToken(token) {
  const normalized = normalizeText(token);
  if (!normalized) return [];
  const group = synonymIndex.get(normalized);
  if (group?.length) return [...new Set(group)];
  // Partial synonym hit: token is prefix/substring of a known term
  const partial = [];
  for (const [key, values] of synonymIndex.entries()) {
    if (key.includes(normalized) || normalized.includes(key)) {
      partial.push(...values);
    }
  }
  if (partial.length) return [...new Set([normalized, ...partial])];
  return [normalized];
}

function fieldsToHaystack(fields) {
  if (typeof fields === 'function') return '';
  if (Array.isArray(fields)) {
    return normalizeText(fields.filter((v) => v != null && v !== '').join(' '));
  }
  if (fields && typeof fields === 'object') {
    return normalizeText(Object.values(fields).filter((v) => v != null && v !== '').join(' '));
  }
  return normalizeText(fields);
}

/**
 * Score how well `haystack` matches `query`.
 * Returns 0 if no match; higher is better.
 */
export function scoreSemanticMatch(query, haystack) {
  const q = normalizeText(query);
  const hay = normalizeText(haystack);
  if (!q) return 1;
  if (!hay) return 0;

  const tokens = tokenize(q);
  if (!tokens.length) return 1;

  let score = 0;
  for (const token of tokens) {
    const variants = expandToken(token);
    const hit = variants.find((variant) => hay.includes(variant));
    if (!hit) return 0;

    // Prefer exact / longer matches
    if (hay === hit || hay.split(' ').includes(hit)) score += 8;
    else if (hay.includes(hit)) score += Math.min(6, hit.length);
    else score += 2;
  }

  // Bonus if the full normalized query appears as a phrase
  if (hay.includes(q)) score += 10;
  return score;
}

/**
 * Filter + rank items with conceptual search.
 *
 * @param {Array} items
 * @param {string} query
 * @param {(item: any) => string|Array|object} getFields - returns searchable fields
 */
export function semanticFilter(items, query, getFields) {
  const list = Array.isArray(items) ? items : [];
  const q = normalizeText(query);
  if (!q) return list;

  return list
    .map((item) => {
      const fields = typeof getFields === 'function' ? getFields(item) : getFields;
      const haystack = fieldsToHaystack(fields);
      const score = scoreSemanticMatch(q, haystack);
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

/**
 * Expand a user query into a server-friendly search string
 * (original query + synonym hints), useful for API `search` params.
 */
export function expandSearchQuery(query) {
  const tokens = tokenize(query);
  if (!tokens.length) return '';
  const expanded = new Set();
  for (const token of tokens) {
    expanded.add(token);
    for (const variant of expandToken(token)) {
      if (variant.length >= 2) expanded.add(variant);
    }
  }
  return [...expanded].join(' ');
}

export function matchesSemantic(query, ...fields) {
  return scoreSemanticMatch(query, fieldsToHaystack(fields)) > 0;
}
