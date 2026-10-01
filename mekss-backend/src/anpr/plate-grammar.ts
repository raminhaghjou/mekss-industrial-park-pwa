/**
 * Iranian plate grammar shared by the ANPR engines, the matcher and gate-pass DTOs.
 *
 * Canonical forms (identical in mekss-anpr/app/pipeline/grammar.py and the PWA):
 *  - standard: `DDLDDDDD` e.g. `12ب34567`
 *  - free zone: `FZ-<ZONE>-DDDDD` e.g. `FZ-KISH-12345`
 */

export type PlateTypeName =
  | 'PRIVATE'
  | 'PUBLIC'
  | 'TAXI'
  | 'GOVERNMENT'
  | 'POLICE'
  | 'MILITARY'
  | 'DISABLED'
  | 'AGRICULTURAL'
  | 'FREE_ZONE'
  | 'OTHER';

export const PLATE_LETTER_TYPES: Readonly<Record<string, PlateTypeName>> = {
  ب: 'PRIVATE', ج: 'PRIVATE', د: 'PRIVATE', س: 'PRIVATE', ص: 'PRIVATE',
  ط: 'PRIVATE', ق: 'PRIVATE', ل: 'PRIVATE', م: 'PRIVATE', ن: 'PRIVATE',
  و: 'PRIVATE', ه: 'PRIVATE', ی: 'PRIVATE',
  ت: 'TAXI',
  ع: 'PUBLIC',
  ا: 'GOVERNMENT',
  پ: 'POLICE',
  ث: 'MILITARY', ش: 'MILITARY', ز: 'MILITARY', ف: 'MILITARY',
  ژ: 'DISABLED',
  ک: 'AGRICULTURAL',
  ح: 'OTHER', گ: 'OTHER',
};

export const PLATE_LETTERS = Object.keys(PLATE_LETTER_TYPES).join('');

const LETTER_ALIASES: Readonly<Record<string, string>> = {
  آ: 'ا', أ: 'ا', إ: 'ا', ٱ: 'ا',
  ي: 'ی', ى: 'ی', ئ: 'ی',
  ك: 'ک',
  ۀ: 'ه', ة: 'ه',
};

export const FREE_ZONES: Readonly<Record<string, string>> = {
  KISH: 'کیش',
  QESHM: 'قشم',
  ARVAND: 'اروند',
  ANZALI: 'انزلی',
  CHABAHAR: 'چابهار',
  ARAS: 'ارس',
  MAKU: 'ماکو',
};

const UNALLOCATED_REGIONS = new Set(['39', '70', '80', '90']);
const STANDARD_RE = new RegExp(`^(\\d{2})([${PLATE_LETTERS}])(\\d{3})(\\d{2})$`, 'u');
const FREE_ZONE_RE = /^FZ-([A-Z]+)-(\d{5})$/;

/** Accepted by gate-pass DTOs: standard, legacy Latin-letter rows, and free-zone plates. */
export const IRAN_LICENSE_PLATE_PATTERN = new RegExp(
  `^(?:\\d{2}[آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیA-Za-z]{1,3}\\d{5}|FZ-(?:${Object.keys(FREE_ZONES).join('|')})-\\d{5})$`,
  'u',
);

export const STANDARD_LAYOUT = ['digit', 'digit', 'letter', 'digit', 'digit', 'digit', 'digit', 'digit'] as const;

export type PlateParts =
  | { series: string; letter: string; middle: string; region: string }
  | { zone: string; number: string };

export interface NormalizedPlate {
  plate: string;
  valid: boolean;
  plateType: PlateTypeName | null;
  parts: PlateParts | null;
}

const INVALID: NormalizedPlate = Object.freeze({ plate: '', valid: false, plateType: null, parts: null });

export function toAsciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function plateTypeForLetter(letter: string): PlateTypeName | null {
  return PLATE_LETTER_TYPES[letter] ?? null;
}

export function isKnownRegion(code: string): boolean {
  return /^[1-9]\d$/.test(code) && !UNALLOCATED_REGIONS.has(code);
}

export function normalizePlate(raw: unknown): NormalizedPlate {
  if (typeof raw !== 'string' || !raw.trim()) return INVALID;
  let text = toAsciiDigits(raw).trim();

  const fz = FREE_ZONE_RE.exec(text.toUpperCase());
  if (fz && FREE_ZONES[fz[1]]) {
    return { plate: text.toUpperCase(), valid: true, plateType: 'FREE_ZONE', parts: { zone: fz[1], number: fz[2] } };
  }

  for (const [code, name] of Object.entries(FREE_ZONES)) {
    if (text.includes(name)) {
      const digits = text.replace(name, '').replace(/\D/g, '');
      if (digits.length !== 5) return INVALID;
      return { plate: `FZ-${code}-${digits}`, valid: true, plateType: 'FREE_ZONE', parts: { zone: code, number: digits } };
    }
  }

  text = text.replace(/ایران/g, '').replace(/iran/gi, '').replace(/الف/g, 'ا');
  text = [...text].map((ch) => LETTER_ALIASES[ch] ?? ch).join('');
  text = text.replace(/[\s\-_|./\\,:;]+/g, '');

  const match = STANDARD_RE.exec(text);
  if (!match) return INVALID;
  const [, series, letter, middle, region] = match;
  return {
    plate: `${series}${letter}${middle}${region}`,
    valid: true,
    plateType: plateTypeForLetter(letter),
    parts: { series, letter, middle, region },
  };
}

/** Normalise when possible, otherwise keep a whitespace-stripped legacy value for validation. */
export function canonicalPlateOrRaw(value: string): string {
  const normalized = normalizePlate(value);
  if (normalized.valid) return normalized.plate;
  const text = toAsciiDigits(value.trim());
  if (/^FZ-/i.test(text)) return text.toUpperCase().replace(/\s+/g, '');
  return text.replace(/ایران/g, '').replace(/IRAN/gi, '').replace(/[\s\-_|]/g, '');
}

/** Soft prior on a character at a grammar position; mirrors grammar.py. */
export function positionPrior(position: number, char: string): number {
  return (position === 0 || position === 3 || position === 6) && char === '0' ? 0.05 : 1;
}

export function regionPrior(region: string): number {
  return isKnownRegion(region) ? 1 : 0.2;
}

/**
 * Glyph pairs that OCR models (and tired eyes) confuse on Iranian plates. Substituting
 * one for the other costs less than an arbitrary substitution in `plateDistance`.
 */
const CONFUSABLE_GROUPS: string[][] = [
  ['ب', 'پ', 'ت', 'ث'],
  ['ج', 'ح'],
  ['س', 'ش'],
  ['ص', 'ط'],
  ['د', 'ذ'],
  ['ز', 'ژ'],
  ['ق', 'ف'],
  ['ک', 'گ'],
  ['ه', '5'],
  ['ا', '1'],
  ['4', '6'],
  ['2', '3'],
  ['7', '8'],
  ['6', '9'],
  ['0', '5'],
];
const CONFUSION_COST = 0.4;
const confusable = new Map<string, Set<string>>();
for (const group of CONFUSABLE_GROUPS) {
  for (const a of group) {
    const set = confusable.get(a) ?? new Set<string>();
    group.forEach((b) => b !== a && set.add(b));
    confusable.set(a, set);
  }
}

export function substitutionCost(a: string, b: string): number {
  if (a === b) return 0;
  return confusable.get(a)?.has(b) ? CONFUSION_COST : 1;
}

/** Confusion-weighted Levenshtein distance between two canonical plates. */
export function plateDistance(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= y.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + substitutionCost(x[i - 1], y[j - 1]));
    }
    prev = cur;
  }
  return prev[y.length];
}

export function displayPlate(plate: string): string {
  const n = normalizePlate(plate);
  if (!n.valid || !n.parts) return plate;
  if ('zone' in n.parts) return `${FREE_ZONES[n.parts.zone]} ${n.parts.number}`;
  const letter = n.parts.letter === 'ا' ? 'الف' : n.parts.letter;
  return `${n.parts.series} ${letter} ${n.parts.middle}-${n.parts.region}`;
}
