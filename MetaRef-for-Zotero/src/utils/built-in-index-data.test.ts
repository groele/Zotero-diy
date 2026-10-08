import type { NatureIndexEntry } from "./nature-index";
import { describe, expect, it } from "vitest";
import esiJournals from "../../data/esi/esi-journals.json";
import natureIndex from "../../data/nature-index/nature-index-journals.json";
import { ESI_CATEGORIES, normalizeTitleKey } from "./esi";
import { parseESIDataset, parseNatureDataset } from "./journal-datasets";
import { buildNatureIndexLookupMaps } from "./nature-index";

describe("bundled research-index datasets", () => {
  it("validates every built-in record with the same schema used for custom imports", () => {
    expect(parseESIDataset(esiJournals)).toHaveLength(12245);
    expect(parseNatureDataset(natureIndex)).toHaveLength(178);
  });
  it("covers every official ESI field with ISSN-backed master-list journals", () => {
    const categories = new Set<string>();
    for (const entry of esiJournals) {
      for (const category of entry.category.split(";"))
        categories.add(category.trim());
      expect(entry.title).not.toBe("");
    }

    expect(esiJournals.length).toBeGreaterThan(12_000);
    expect([...categories].sort()).toEqual(Object.keys(ESI_CATEGORIES).sort());
    expect(esiJournals.every(entry => entry.issn || entry.eissn)).toBe(true);
  });

  it("keeps the official Nature Index venue total and excludes its conference from journal matching", () => {
    expect(natureIndex.publicationCount).toBe(178);
    expect(natureIndex.journalCount).toBe(177);
    expect(natureIndex.conferenceCount).toBe(1);
    expect(natureIndex.venues).toHaveLength(178);

    const maps = buildNatureIndexLookupMaps(natureIndex.venues as NatureIndexEntry[]);
    const conference = natureIndex.venues.find(venue => venue.type === "conference")!;
    expect(maps.titleSet.has(normalizeTitleKey(conference.title))).toBe(false);
    expect(maps.titleSet.size).toBeGreaterThan(150);
  });
});
