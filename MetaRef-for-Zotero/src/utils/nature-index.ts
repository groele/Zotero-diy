import { extractISSNs, normalizeTitleKey } from "./esi";

export interface NatureIndexEntry {
  title: string;
  type: "journal" | "conference";
  aliases?: string[];
  issn?: string[];
}

export interface NatureIndexLookupMaps {
  issnSet: Set<string>;
  titleSet: Set<string>;
  ambiguousTitles: Set<string>;
}

export interface MatchNatureIndexOptions {
  publicationTitle?: string;
  journalAbbreviation?: string;
  issn?: string;
  maps: NatureIndexLookupMaps;
}

export function buildNatureIndexLookupMaps(entries: NatureIndexEntry[]): NatureIndexLookupMaps {
  const issnSet = new Set<string>();
  const titleCounts = new Map<string, number>();
  const journalTitles = new Map<string, Set<string>>();

  for (const entry of entries) {
    if (entry.type !== "journal")
      continue;

    const identity = JSON.stringify([normalizeTitleKey(entry.title), [...new Set((entry.issn ?? []).flatMap(extractISSNs))].sort()]);

    for (const issn of entry.issn ?? []) {
      for (const code of extractISSNs(issn))
        issnSet.add(code);
    }

    const entryTitles = journalTitles.get(identity) ?? new Set<string>();
    for (const title of [entry.title, ...(entry.aliases ?? [])].map(normalizeTitleKey).filter(Boolean))
      entryTitles.add(title);
    journalTitles.set(identity, entryTitles);
  }
  for (const entryTitles of journalTitles.values()) {
    for (const key of entryTitles) {
      titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
    }
  }

  const ambiguousTitles = new Set([...titleCounts].filter(([, count]) => count > 1).map(([key]) => key));
  return {
    issnSet,
    titleSet: new Set([...titleCounts.keys()].filter(key => !ambiguousTitles.has(key))),
    ambiguousTitles,
  };
}

export function isNatureIndexJournal(options: MatchNatureIndexOptions): boolean {
  const { publicationTitle, journalAbbreviation, issn, maps } = options;
  for (const code of extractISSNs(issn ?? "")) {
    if (maps.issnSet.has(code))
      return true;
  }

  for (const value of [publicationTitle, journalAbbreviation]) {
    const key = normalizeTitleKey(value ?? "");
    if (key && maps.titleSet.has(key))
      return true;
  }

  return false;
}
