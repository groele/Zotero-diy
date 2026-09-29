export interface ESIJournalEntry {
  title: string;
  title20?: string;
  title29?: string;
  issn?: string;
  eissn?: string;
  category: string;
}

export interface ESILookupMaps {
  issnMap: Map<string, string[]>;
  titleMap: Map<string, string[]>;
}

export interface MatchESIOptions {
  publicationTitle?: string;
  journalAbbreviation?: string;
  issn?: string;
  maps: ESILookupMaps;
}

export const ESI_CATEGORIES: Record<string, { zh: string; en: string }> = {
  "PHYSICS": { zh: "物理学", en: "Physics" },
  "CHEMISTRY": { zh: "化学", en: "Chemistry" },
  "MATERIALS SCIENCE": { zh: "材料科学", en: "Materials Science" },
  "ENGINEERING": { zh: "工程学", en: "Engineering" },
  "COMPUTER SCIENCE": { zh: "计算机科学", en: "Computer Science" },
  "MATHEMATICS": { zh: "数学", en: "Mathematics" },
  "GEOSCIENCES": { zh: "地球科学", en: "Geosciences" },
  "ENVIRONMENT/ECOLOGY": { zh: "环境与生态学", en: "Environment/Ecology" },
  "PLANT & ANIMAL SCIENCE": { zh: "植物与动物科学", en: "Plant & Animal Science" },
  "AGRICULTURAL SCIENCES": { zh: "农业科学", en: "Agricultural Sciences" },
  "BIOLOGY & BIOCHEMISTRY": { zh: "生物与生化", en: "Biology & Biochemistry" },
  "MOLECULAR BIOLOGY & GENETICS": { zh: "分子生物学与遗传学", en: "Molecular Biology & Genetics" },
  "MICROBIOLOGY": { zh: "微生物学", en: "Microbiology" },
  "IMMUNOLOGY": { zh: "免疫学", en: "Immunology" },
  "NEUROSCIENCE & BEHAVIOR": { zh: "神经系统科学与行为学", en: "Neuroscience & Behavior" },
  "CLINICAL MEDICINE": { zh: "临床医学", en: "Clinical Medicine" },
  "PHARMACOLOGY & TOXICOLOGY": { zh: "药理学与毒理学", en: "Pharmacology & Toxicology" },
  "PSYCHIATRY/PSYCHOLOGY": { zh: "精神病学与心理学", en: "Psychiatry/Psychology" },
  "SPACE SCIENCE": { zh: "空间科学", en: "Space Science" },
  "ECONOMICS & BUSINESS": { zh: "经济与商学", en: "Economics & Business" },
  "SOCIAL SCIENCES, GENERAL": { zh: "社会科学总论", en: "Social Sciences, General" },
  "MULTIDISCIPLINARY": { zh: "综合交叉学科", en: "Multidisciplinary" },
};

/**
 * Normalizes an ISSN string to 8 alphanumeric characters uppercase (e.g. "1063-7710" -> "10637710")
 */
export function normalizeISSN(issn: string): string {
  if (!issn)
    return "";
  return issn.replace(/[^0-9x]/gi, "").toUpperCase();
}

/**
 * Extracts all valid normalized 8-digit ISSNs from a string field
 */
export function extractISSNs(issnField: string): string[] {
  if (!issnField)
    return [];

  const matches = issnField.match(/\b\d{4}-?\d{3}[\dX]\b/gi);
  if (matches && matches.length > 0) {
    const list = matches.map(normalizeISSN).filter(s => s.length === 8);
    if (list.length > 0) {
      return [...new Set(list)];
    }
  }

  const single = normalizeISSN(issnField);
  if (single.length === 8) {
    return [single];
  }

  return [];
}

/**
 * Normalizes a journal title or abbreviation for fuzzy lookup key matching
 */
export function normalizeTitleKey(title: string): string {
  if (!title)
    return "";
  return title
    .toLowerCase()
    .trim()
    .replace(/[.+]/g, "")
    .replace(/\b(the|and)\b/g, "")
    .replace(/[&\-:, ()]/g, "")
    .replace(/\s+/g, "");
}

function getPropValue(item: any, possibleKeys: string[]): string {
  if (!item || typeof item !== "object")
    return "";
  for (const key of possibleKeys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== "") {
      return String(item[key]).trim();
    }
  }
  return "";
}

/**
 * Builds ISSN and Title lookup maps from an array of ESI journal entries
 */
export function buildESILookupMaps(entries: any[]): ESILookupMaps {
  const issnMap = new Map<string, string[]>();
  const titleMap = new Map<string, string[]>();

  const appendToMap = (map: Map<string, string[]>, key: string, category: string) => {
    if (!key || !category)
      return;
    const existing = map.get(key);
    if (existing) {
      if (!existing.includes(category)) {
        existing.push(category);
      }
    }
    else {
      map.set(key, [category]);
    }
  };

  for (const entry of entries) {
    const rawCategory = getPropValue(entry, ["category", "Category", "CATEGORY", "subject", "Subject", "discipline", "Discipline"]);
    if (!rawCategory)
      continue;

    const names = Object.keys(ESI_CATEGORIES).sort((a, b) => b.length - a.length);
    let protectedCategory = rawCategory.toUpperCase();
    names.forEach((name, index) => {
      protectedCategory = protectedCategory.replaceAll(name, `\u0000${index}\u0000`);
    });
    const categories = protectedCategory.split(/[;,/]/).map(category => category.replace(/\0(\d+)\0/g, (_, index) => names[Number(index)]).trim()).filter(Boolean);
    if (categories.length === 0)
      continue;

    const title = getPropValue(entry, ["title", "Title", "TITLE", "Journal Title", "journal_title"]);
    const title20 = getPropValue(entry, ["title20", "Title20", "TITLE20", "Title 20"]);
    const title29 = getPropValue(entry, ["title29", "Title29", "TITLE29", "Title 29"]);
    const issn = getPropValue(entry, ["issn", "ISSN", "Issn", "Print ISSN"]);
    const eissn = getPropValue(entry, ["eissn", "eISSN", "EISSN", "Online ISSN"]);

    const rawIssns = [issn, eissn].filter(s => s && s !== "****-****");
    const extractedIssns = rawIssns.flatMap(extractISSNs);

    for (const category of categories) {
      for (const code of extractedIssns) {
        appendToMap(issnMap, code, category);
      }

      for (const t of [title, title20, title29]) {
        if (t) {
          const normKey = normalizeTitleKey(t);
          if (normKey)
            appendToMap(titleMap, normKey, category);
        }
      }
    }
  }

  return { issnMap, titleMap };
}

/**
 * Checks whether an existing value appears to be an ESI discipline tag
 */
export function isEsiValue(value: string): boolean {
  if (!value)
    return false;
  return /ESI/i.test(value) || Object.values(ESI_CATEGORIES).some(cat => value.includes(cat.zh) || value.includes(cat.en));
}

/**
 * Formats a list of ESI categories using a template string
 * Template variables:
 * - {subject}: Chinese subject name (e.g. "物理学")
 * - {category}: English uppercase category (e.g. "PHYSICS")
 * - {en}: English title-cased name (e.g. "Physics")
 */
export function formatESICategories(categories: string[], formatTemplate: string = "{subject}ESI"): string {
  if (!categories || categories.length === 0)
    return "";

  const uniqueCats = [...new Set(categories)];
  const template = formatTemplate || "{subject}ESI";
  const formattedList = uniqueCats.map((cat) => {
    const upperCat = cat.toUpperCase();
    const info = ESI_CATEGORIES[upperCat];
    const zh = info ? info.zh : cat;
    const en = info ? info.en : cat;

    return template
      .replace(/\{subject\}/g, zh)
      .replace(/\{category\}/g, upperCat)
      .replace(/\{en\}/g, en);
  });

  return formattedList.join(" / ");
}

/**
 * Matches an item against ESI maps by ISSN, publicationTitle, and journalAbbreviation
 */
export function matchESICategories(options: MatchESIOptions): string[] | undefined {
  const { publicationTitle, journalAbbreviation, issn, maps } = options;

  // 1. Prioritize ISSN matching
  if (issn) {
    const issns = extractISSNs(issn);
    for (const code of issns) {
      const match = maps.issnMap.get(code);
      if (match && match.length > 0)
        return match;
    }
  }

  // 2. Match by publication title
  if (publicationTitle) {
    const key = normalizeTitleKey(publicationTitle);
    const match = maps.titleMap.get(key);
    if (match && match.length > 0)
      return match;

    // Subtitle prefix fallback (e.g. "Physical Review B: Condensed Matter" -> "Physical Review B")
    if (publicationTitle.includes(":") || publicationTitle.includes(" - ")) {
      const mainTitle = publicationTitle.split(/:| - /)[0].trim();
      const mainKey = normalizeTitleKey(mainTitle);
      const subMatch = maps.titleMap.get(mainKey);
      if (subMatch && subMatch.length > 0)
        return subMatch;
    }
  }

  // 3. Match by journal abbreviation
  if (journalAbbreviation) {
    const key = normalizeTitleKey(journalAbbreviation);
    const match = maps.titleMap.get(key);
    if (match && match.length > 0)
      return match;
  }

  return undefined;
}
