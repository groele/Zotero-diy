import type { NatureIndexEntry } from "./nature-index";
import { describe, expect, it } from "vitest";
import { buildNatureIndexLookupMaps, isNatureIndexJournal } from "./nature-index";

const entries: NatureIndexEntry[] = [
  { title: "Nature Communications", type: "journal", aliases: ["Nat. Commun."], issn: ["2041-1723"] },
  { title: "American Economic Review", type: "journal", aliases: ["Am. Econ. Rev."] },
  { title: "Confusing Journal", type: "journal", aliases: ["Shared abbreviation"] },
  { title: "Second Confusing Journal", type: "journal", aliases: ["Shared abbreviation"] },
  { title: "IEEE/RSJ International Conference on Intelligent Robots and Systems (IROS)", type: "conference" },
];
const maps = buildNatureIndexLookupMaps(entries);

describe("nature Index recognition", () => {
  it("ignores exact duplicate records without making their titles ambiguous", () => {
    const duplicateMaps = buildNatureIndexLookupMaps([entries[0], entries[0], { ...entries[0], aliases: ["Nature Commun"] }]);
    expect(isNatureIndexJournal({ publicationTitle: "Nature Communications", maps: duplicateMaps })).toBe(true);
    expect(duplicateMaps.ambiguousTitles.size).toBe(0);
    expect(isNatureIndexJournal({ journalAbbreviation: "Nature Commun", maps: duplicateMaps })).toBe(true);
  });
  it("matches canonical titles, curated aliases, and print or electronic ISSNs", () => {
    expect(isNatureIndexJournal({ publicationTitle: "Nature Communications", maps })).toBe(true);
    expect(isNatureIndexJournal({ journalAbbreviation: "Nat Commun", maps })).toBe(true);
    expect(isNatureIndexJournal({ issn: "2041-1723", maps })).toBe(true);
    expect(isNatureIndexJournal({ publicationTitle: "American Economic Review", maps })).toBe(true);
  });

  it("does not match ambiguous abbreviations or the conference as a journal", () => {
    expect(isNatureIndexJournal({ journalAbbreviation: "Shared abbreviation", maps })).toBe(false);
    expect(isNatureIndexJournal({ publicationTitle: "IEEE/RSJ International Conference on Intelligent Robots and Systems (IROS)", maps })).toBe(false);
  });

  it("does not promote partial title or unrelated ISSN matches", () => {
    expect(isNatureIndexJournal({ publicationTitle: "Nature Communications: Methods", maps })).toBe(false);
    expect(isNatureIndexJournal({ publicationTitle: "Nature Communications", issn: "0000-0000", maps: { ...maps, issnSet: new Set() } })).toBe(true);
    expect(isNatureIndexJournal({ publicationTitle: "An unrelated title", issn: "0000-0000", maps })).toBe(false);
  });
});
