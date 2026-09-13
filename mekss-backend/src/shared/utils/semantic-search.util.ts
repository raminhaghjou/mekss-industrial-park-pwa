const ARABIC_YEH = /\u064A/g;
const ARABIC_KEH = /\u0643/g;
const DIACRITICS = /[\u064B-\u065F\u0670]/g;
const ZWNJ = /\u200C/g;

const DIGIT_MAP: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

const SYNONYM_GROUPS = [
  ['فروشگاه', 'شاپ', 'store', 'shop', 'بازار', 'مارکت', 'market'],
  ['واحد', 'کارخانه', 'کارگاه', 'factory', 'صنعتی', 'شرکت'],
  ['شهرک', 'پارک', 'park', 'ناحیه', 'منطقه'],
  ['مجوز', 'برگه', 'گیت', 'تردد', 'عبور', 'پلاک', 'راننده', 'gate', 'pass'],
  ['قبض', 'صورتحساب', 'فاکتور', 'پرداخت', 'invoice'],
  ['درخواست', 'سرویس', 'خدمات', 'request', 'sms', 'پیامک'],
  ['اطلاعیه', 'اعلان', 'آگهی', 'اگهی', 'خبر', 'announcement', 'advertisement'],
  ['اضطراری', 'اورژانس', 'هشدار', 'emergency'],
  ['نگهبان', 'حراست', 'گارد', 'امنیت', 'guard', 'security'],
  ['مدیر', 'مدیریت', 'مالک', 'owner', 'مدیرعامل', 'ceo'],
];

export function normalizeSearchText(value: string): string {
  return String(value || '')
    .replace(ARABIC_YEH, 'ی')
    .replace(ARABIC_KEH, 'ک')
    .replace(DIACRITICS, '')
    .replace(ZWNJ, ' ')
    .replace(/[۰-۹٠-٩]/g, (d) => DIGIT_MAP[d] || d)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

const synonymIndex = (() => {
  const map = new Map<string, string[]>();
  for (const group of SYNONYM_GROUPS) {
    const normalized = group.map((term) => normalizeSearchText(term)).filter(Boolean);
    for (const term of normalized) map.set(term, normalized);
  }
  return map;
})();

function expandToken(token: string): string[] {
  const normalized = normalizeSearchText(token);
  if (!normalized) return [];
  const group = synonymIndex.get(normalized);
  if (group?.length) return [...new Set(group)];
  return [normalized];
}

/** Split + expand a user query into unique search terms (max 12). */
export function expandSearchTerms(query?: string | null): string[] {
  const normalized = normalizeSearchText(query || '');
  if (!normalized) return [];
  const tokens = normalized.split(/[\s,،./\\|_+-]+/).filter(Boolean);
  const terms = new Set<string>();
  for (const token of tokens) {
    for (const variant of expandToken(token)) {
      if (variant.length >= 1) terms.add(variant);
    }
  }
  return [...terms].slice(0, 12);
}

/**
 * Build Prisma OR clauses: each term may match any of the given string fields.
 * Multi-token conceptual queries use OR across expanded synonyms/terms so
 * "فروشگاه" also hits "شاپ" / "shop" rows.
 */
export function buildSemanticContainsOr<T extends Record<string, unknown>>(
  fields: string[],
  query?: string | null,
): T | undefined {
  const terms = expandSearchTerms(query);
  if (!terms.length || !fields.length) return undefined;
  const or = terms.flatMap((term) =>
    fields.map((field) => ({
      [field]: field === 'phoneNumber' || field === 'nationalId' || field === 'licenseNumber'
        ? { contains: term }
        : { contains: term, mode: 'insensitive' as const },
    })),
  );
  return { OR: or } as unknown as T;
}
