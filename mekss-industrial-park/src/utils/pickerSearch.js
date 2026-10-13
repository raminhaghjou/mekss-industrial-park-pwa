import { normalizeText } from './semanticSearch';

const matchRank = (option, query) => {
  const label = normalizeText(option.label);
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  if (label.split(/\s+/).some((word) => word.startsWith(query))) return 2;
  if (label.includes(query)) return 3;
  const keywords = (option.keywords || []).map((keyword) => normalizeText(keyword));
  if (keywords.some((keyword) => keyword.startsWith(query))) return 4;
  if (keywords.some((keyword) => keyword.includes(query))) return 5;
  return -1;
};

/**
 * Ranked substring search for picker options (exact → prefix → word prefix → contains → keywords).
 * @param {{ label: string, keywords?: string[] }[]} options
 * @param {string} rawQuery
 */
export const filterPickerOptions = (options, rawQuery) => {
  const query = normalizeText(rawQuery);
  if (!query) return options;
  return options
    .map((option, index) => ({ option, index, rank: matchRank(option, query) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.option);
};
