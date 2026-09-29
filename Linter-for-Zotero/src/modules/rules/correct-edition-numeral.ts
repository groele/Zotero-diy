import { defineRule } from "./rule-base";

/** Map of English ordinal words to numbers */
const ORDINAL_WORD_MAP: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
};

/** Map of Roman numerals to numbers */
const ROMAN_MAP: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  xi: 11,
  xii: 12,
  xiii: 13,
  xiv: 14,
  xv: 15,
  xvi: 16,
  xvii: 17,
  xviii: 18,
  xix: 19,
  xx: 20,
};

/** Map of incomplete edition/volume names */
const NAME_MAP: Record<string, string> = {
  修订: "修订版",
  影印: "影印本",
  Revised: "Revised Edition",
  Facsimile: "Facsimile Edition",
};

/** Map of Chinese digits to numeric values */
const CHINESE_DIGIT_MAP: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

/** Parse Chinese numerals up to 999 into number */
export function parseChineseNumber(str: string): number | null {
  if (!str)
    return null;
  if (/^\d+$/.test(str))
    return Number(str);

  let total = 0;
  let current = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "百") {
      total += (current || 1) * 100;
      current = 0;
    }
    else if (char === "十") {
      total += (current || 1) * 10;
      current = 0;
    }
    else if (char in CHINESE_DIGIT_MAP) {
      current = CHINESE_DIGIT_MAP[char];
    }
    else {
      return null;
    }
  }
  total += current;
  return total > 0 ? total : null;
}

/** Convert English ordinal words to numbers */
function normalizeOrdinalWord(value: string): string {
  return value.replace(/\b([a-z]+)\b/gi, (match) => {
    const num = ORDINAL_WORD_MAP[match.toLowerCase()];
    return num !== undefined ? String(num) : match;
  });
}

/** Convert numeric ordinal suffixes (1st, 2nd, 3rd, 4th) to numbers */
function normalizeOrdinal(value: string): string {
  return value.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, num) => num);
}

/** Convert Roman numerals to numbers */
function normalizeRoman(value: string): string {
  return value.replace(/\b([ivxlcdm]+)\b/gi, (match) => {
    const num = ROMAN_MAP[match.toLowerCase()];
    return num !== undefined ? String(num) : match;
  });
}

/** Normalize incomplete Chinese or English names */
function normalizeName(value: string): string {
  const trimmed = value.trim();

  // Exact match for Chinese names
  if (NAME_MAP[trimmed]) {
    return NAME_MAP[trimmed];
  }

  // Case-insensitive exact match for English names
  for (const key of Object.keys(NAME_MAP)) {
    if (/^[A-Z]+$/i.test(key)) {
      if (trimmed.toLowerCase() === key.toLowerCase()) {
        return NAME_MAP[key];
      }
    }
  }

  return trimmed;
}

/** Normalize Chinese ordinals and standalone Chinese numbers */
function normalizeChineseOrdinal(value: string): string {
  let result = value;

  // Convert "第 X 版" / "第 X 册" / "第 X 卷" to numbers
  result = result.replace(/第([一二三四五六七八九十百\d]+)[版册卷]?/g, (original, match) => {
    const num = parseChineseNumber(match);
    return num !== null ? String(num) : original;
  });

  // Convert standalone Chinese ordinal patterns like "X 版" / "X 册"
  result = result.replace(/^([一二三四五六七八九十百\d]+)[版册卷]$/g, (original, match) => {
    const num = parseChineseNumber(match);
    return num !== null ? String(num) : original;
  });

  // If the entire string is a standalone Chinese number, convert it
  const pureNum = parseChineseNumber(result.trim());
  if (pureNum !== null) {
    return String(pureNum);
  }

  return result;
}
/** Normalize a field value (edition or volume) */
export function normalizeField(value: string): string {
  let result = value.trim();

  result = normalizeOrdinalWord(result);
  result = normalizeOrdinal(result);
  result = normalizeRoman(result);
  result = normalizeChineseOrdinal(result);

  // Remove trailing "ed." or "edition" for edition field
  result = result.replace(/\s+(ed\.?|edition)$/i, "");

  result = normalizeName(result);

  return result.trim();
}

/** Create a rule for edition or volume normalization */
function createRule(field: "edition" | "volume") {
  const id = `correct-${field}-numeral`;

  return defineRule({
    id,
    scope: "field",
    targetItemTypes: ["book"],
    targetItemField: field,

    async apply({ item, debug }) {
      const value = item.getField(field);
      if (!value)
        return;

      const normalized = normalizeField(value);
      if (normalized !== value) {
        debug(`Normalized ${field}: "${value}" → "${normalized}"`);
        item.setField(field, normalized);
      }
    },
  });
}

export const CorrectEditionNumeral = createRule("edition");
export const CorrectVolumeNumeral = createRule("volume");
