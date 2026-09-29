import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildESILookupMaps,
  extractISSNs,
  formatESICategories,
  matchESICategories,
  normalizeISSN,
  normalizeTitleKey,
} from "../../utils/esi";

describe("eSI utility functions", () => {
  it("preserves punctuation inside category names and splits multiple disciplines", () => {
    const maps = buildESILookupMaps([{ title: "Test journal", category: "ENVIRONMENT/ECOLOGY; SOCIAL SCIENCES, GENERAL / PHYSICS" }]);
    const categories = maps.titleMap.get(normalizeTitleKey("Test journal"));
    expect(categories).toEqual(["ENVIRONMENT/ECOLOGY", "SOCIAL SCIENCES, GENERAL", "PHYSICS"]);
    expect(formatESICategories(categories!)).toBe(["环境与生态学", "社会科学总论", "物理学"].map(name => `${name}${"ESI"}`).join(" / "));
  });
  describe("normalizeISSN", () => {
    it("strips hyphens and uppercases", () => {
      expect(normalizeISSN("1063-7710")).toBe("10637710");
      expect(normalizeISSN("1898-794x")).toBe("1898794X");
      expect(normalizeISSN("****-****")).toBe("");
      expect(normalizeISSN("")).toBe("");
    });
  });

  describe("extractISSNs", () => {
    it("extracts single and multiple ISSNs", () => {
      expect(extractISSNs("1063-7710")).toEqual(["10637710"]);
      expect(extractISSNs("1063-7710, 1562-6865")).toEqual(["10637710", "15626865"]);
      expect(extractISSNs("Print: 1063-7710; Online: 1562-6865")).toEqual(["10637710", "15626865"]);
      expect(extractISSNs("1898-794X")).toEqual(["1898794X"]);
      expect(extractISSNs("10637710")).toEqual(["10637710"]);
      expect(extractISSNs("")).toEqual([]);
      expect(extractISSNs("invalid-text")).toEqual([]);
    });
  });

  describe("normalizeTitleKey", () => {
    it("normalizes full titles and abbreviations for fuzzy matching", () => {
      expect(normalizeTitleKey("Physical Review Letters")).toBe("physicalreviewletters");
      expect(normalizeTitleKey("Phys. Rev. Lett.")).toBe("physrevlett");
      expect(normalizeTitleKey("PHYS REV LETT")).toBe("physrevlett");
      expect(normalizeTitleKey("ACOUST PHYS+")).toBe("acoustphys");
      expect(normalizeTitleKey("Acoust. Phys.")).toBe("acoustphys");
      expect(normalizeTitleKey("The Journal of Chemical Physics")).toBe("journalofchemicalphysics");
    });
  });

  describe("formatESICategories", () => {
    it("formats with default template {subject}ESI", () => {
      expect(formatESICategories(["PHYSICS"])).toBe("物理学" + "ESI");
      expect(formatESICategories(["PHYSICS"], "{subject}ESI")).toBe("物理学" + "ESI");
    });

    it("formats with custom template {subject} ESI", () => {
      expect(formatESICategories(["PHYSICS"], "{subject} ESI")).toBe("物理学 ESI");
    });

    it("formats with English variables", () => {
      expect(formatESICategories(["PHYSICS"], "{category}")).toBe("PHYSICS");
      expect(formatESICategories(["PHYSICS"], "{en} ESI")).toBe("Physics ESI");
    });

    it("handles multiple categories", () => {
      expect(formatESICategories(["PHYSICS", "CHEMISTRY"], "{subject}ESI")).toBe("物理学" + "ESI / 化学" + "ESI");
    });

    it("handles unknown categories gracefully", () => {
      expect(formatESICategories(["QUANTUM OPTICS"], "{subject}ESI")).toBe("QUANTUM OPTICSESI");
    });

    it("returns empty string for empty input", () => {
      expect(formatESICategories([])).toBe("");
    });
  });

  describe("matchESICategories with mock data", () => {
    const mockEntries = [
      {
        title: "PHYSICAL REVIEW LETTERS",
        title20: "PHYS REV LETT",
        title29: "PHYS REV LETT",
        issn: "0031-9007",
        eissn: "1079-7114",
        category: "PHYSICS",
      },
      {
        title: "ACTA ACUSTICA",
        title20: "ACTA ACUST",
        title29: "ACTA ACUST",
        issn: "",
        eissn: "2681-4617",
        category: "PHYSICS",
      },
    ];

    const maps = buildESILookupMaps(mockEntries);

    it("matches by print ISSN", () => {
      const match = matchESICategories({ issn: "0031-9007", maps });
      expect(match).toEqual(["PHYSICS"]);
    });

    it("matches by electronic eISSN", () => {
      const match = matchESICategories({ issn: "2681-4617", maps });
      expect(match).toEqual(["PHYSICS"]);
    });

    it("matches by publication title", () => {
      const match = matchESICategories({ publicationTitle: "Physical Review Letters", maps });
      expect(match).toEqual(["PHYSICS"]);
    });

    it("matches by publication title with subtitle prefix fallback", () => {
      const match = matchESICategories({ publicationTitle: "Physical Review Letters: Section A", maps });
      expect(match).toEqual(["PHYSICS"]);
    });

    it("matches by abbreviated title in journalAbbreviation", () => {
      const match = matchESICategories({ journalAbbreviation: "Phys. Rev. Lett.", maps });
      expect(match).toEqual(["PHYSICS"]);
    });

    it("handles multi-discipline entries in raw category", () => {
      const multiEntries = [
        {
          title: "NATURE MATERIALS",
          category: "MATERIALS SCIENCE; PHYSICS",
        },
      ];
      const multiMaps = buildESILookupMaps(multiEntries);
      const match = matchESICategories({ publicationTitle: "Nature Materials", maps: multiMaps });
      expect(match).toEqual(["MATERIALS SCIENCE", "PHYSICS"]);
    });

    it("returns undefined for unknown journal", () => {
      const match = matchESICategories({ publicationTitle: "Journal of Unknown Field", maps });
      expect(match).toBeUndefined();
    });
  });

  describe("built-in ESI dataset validation", () => {
    it("loads real dataset and matches physics journals correctly", () => {
      const datasetPath = path.resolve(__dirname, "../../../data/esi/esi-journals.json");
      expect(fs.existsSync(datasetPath)).toBe(true);

      const data = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(311);

      const maps = buildESILookupMaps(data);

      // Test Acoustical Physics
      expect(matchESICategories({ publicationTitle: "Acoustical Physics", maps })).toEqual(["PHYSICS"]);
      expect(matchESICategories({ journalAbbreviation: "Acoust. Phys.", maps })).toEqual(["PHYSICS"]);
      expect(matchESICategories({ issn: "1063-7710", maps })).toEqual(["PHYSICS"]);
      expect(matchESICategories({ issn: "1562-6865", maps })).toEqual(["PHYSICS"]);

      // Test Physical Review Letters
      expect(matchESICategories({ publicationTitle: "Physical Review Letters", maps })).toEqual(["PHYSICS"]);
      expect(matchESICategories({ journalAbbreviation: "Phys. Rev. Lett.", maps })).toEqual(["PHYSICS"]);
      expect(matchESICategories({ issn: "0031-9007", maps })).toEqual(["PHYSICS"]);

      // Test Advanced Quantum Technologies
      expect(matchESICategories({ publicationTitle: "Advanced Quantum Technologies", maps })).toEqual(["PHYSICS"]);
      expect(matchESICategories({ issn: "2511-9044", maps })).toEqual(["PHYSICS"]);

      // Test Universe
      expect(matchESICategories({ publicationTitle: "Universe", maps })).toEqual(["PHYSICS"]);
      expect(matchESICategories({ issn: "2218-1997", maps })).toEqual(["PHYSICS"]);

      // Format tests
      const matched = matchESICategories({ publicationTitle: "Physical Review Letters", maps });
      expect(formatESICategories(matched!, "{subject}ESI")).toBe("物理学" + "ESI");
      expect(formatESICategories(matched!, "{subject} ESI")).toBe("物理学 ESI");
      expect(formatESICategories(matched!, "{en} ESI")).toBe("Physics ESI");
    });
  });
});
