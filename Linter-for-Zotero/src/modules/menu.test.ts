import { describe, expect, it } from "vitest";
import { MENU_SECTIONS, shouldShowSeparator } from "./menu";
import { Rules } from "./rules";

describe("menu module", () => {
  describe("shouldShowSeparator", () => {
    it("returns true when current section and subsequent section both have visible items", () => {
      const current = ["a", "b"];
      const following = [["c", "d"], ["e"]];
      const isVisible = (k: string) => k === "a" || k === "e";

      expect(shouldShowSeparator(current, following, isVisible)).toBe(true);
    });

    it("returns false when current section has no visible items", () => {
      const current = ["a", "b"];
      const following = [["c", "d"], ["e"]];
      const isVisible = (k: string) => k === "c";

      expect(shouldShowSeparator(current, following, isVisible)).toBe(false);
    });

    it("returns false when following sections have no visible items", () => {
      const current = ["a", "b"];
      const following = [["c", "d"], ["e"]];
      const isVisible = (k: string) => k === "a";

      expect(shouldShowSeparator(current, following, isVisible)).toBe(false);
    });

    it("returns false when everything is hidden", () => {
      const current = ["a"];
      const following = [["b"]];
      const isVisible = () => false;

      expect(shouldShowSeparator(current, following, isVisible)).toBe(false);
    });
  });

  describe("menu sections configuration", () => {
    it("keeps registered rule IDs unique and every tool out of standard rules", () => {
      const all = Rules.getAll();
      expect(new Set(all.map(rule => rule.id)).size).toBe(all.length);
      for (const rule of all)
        expect(rule.category === "tool").toBe(rule.id.startsWith("tool-"));
      expect(Rules.getStandard().every(rule => !rule.id.startsWith("tool-"))).toBe(true);
    });

    it("covers all 21 menu items across all sections", () => {
      const allItemIDs = [
        ...MENU_SECTIONS.section0,
        ...MENU_SECTIONS.section1,
        ...MENU_SECTIONS.section2,
        ...MENU_SECTIONS.section3,
        ...MENU_SECTIONS.section4,
        ...MENU_SECTIONS.toolSec0,
        ...MENU_SECTIONS.toolSec1,
        ...MENU_SECTIONS.toolSec2,
      ];

      expect(allItemIDs).toHaveLength(21);
      const uniqueIDs = new Set(allItemIDs);
      expect(uniqueIDs.size).toBe(21);
    });

    it("references valid registered rules for all rule-based menu items", () => {
      const ruleBasedItems = [
        ...MENU_SECTIONS.section1,
        ...MENU_SECTIONS.section2,
        ...MENU_SECTIONS.section3,
        ...MENU_SECTIONS.section4,
        ...MENU_SECTIONS.toolSec0,
        ...MENU_SECTIONS.toolSec1,
        ...MENU_SECTIONS.toolSec2,
      ];

      const allRegisteredIDs = new Set(Rules.getAll().map(r => r.id));

      for (const id of ruleBasedItems) {
        expect(allRegisteredIDs.has(id as any)).toBe(true);
      }
    });
  });
});
