import { describe, expect, it, vi } from "vitest";
import { MENU_SECTIONS, registerMenu, shouldShowSeparator, unregisterMenu } from "./menu";
import { Rules } from "./rules";

describe("menu module", () => {
  const registered = () => {
    const options: any[] = [];
    vi.stubGlobal("addon", { data: { config: { addonRef: "metaref", addonID: "test", prefsPrefix: "test" } } });
    vi.stubGlobal("Zotero", { MenuManager: { registerMenu: (option: any) => {
      options.push(option);
      return String(options.length);
    }, unregisterMenu: vi.fn() } });
    registerMenu();
    return options.find(option => option.target === "main/library/item").menus[0];
  };
  it("registers every command directly with no nested submenus", () => {
    try {
      const root = registered();
      expect(root.menus.filter((menu: any) => menu.menuType === "submenu")).toHaveLength(0);
      expect(root.menus.filter((menu: any) => menu.menuType === "menuitem")).toHaveLength(22);
    }
    finally {
      unregisterMenu();
      vi.unstubAllGlobals();
    }
  });
  it("enables read-only index actions but does not treat empty item selection as a collection", () => {
    try {
      const root = registered();
      const enabled = vi.fn();
      const context = { items: [{ isRegularItem: () => true, deleted: false, isEditable: () => false, itemType: "journalArticle" }], setVisible: vi.fn(), setEnabled: enabled };
      root.menus.find((menu: any) => menu.l10nID === "metaref-rule-tool-query-esi-menu-item").onShowing(null, context);
      expect(enabled).toHaveBeenLastCalledWith(true);
      root.menus.find((menu: any) => menu.l10nID === "metaref-menuitem-stdFormatFlow").onShowing(null, context);
      expect(enabled).toHaveBeenLastCalledWith(false);
      root.onShowing(null, { ...context, items: [], get collectionTreeRow() {
        throw new Error("must not read deprecated getter");
      } });
      expect(enabled).toHaveBeenLastCalledWith(false);
    }
    finally {
      unregisterMenu();
      vi.unstubAllGlobals();
    }
  });
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

    it("covers all 22 menu items across all sections", () => {
      const allItemIDs = Object.values(MENU_SECTIONS).flat();

      expect(allItemIDs).toHaveLength(22);
      const uniqueIDs = new Set(allItemIDs);
      expect(uniqueIDs.size).toBe(22);
    });

    it("references valid registered rules for all rule-based menu items", () => {
      const ruleBasedItems = Object.values(MENU_SECTIONS).flat().filter(id => id !== "standard");

      const allRegisteredIDs = new Set(Rules.getAll().map(r => r.id));

      for (const id of ruleBasedItems) {
        expect(allRegisteredIDs.has(id as any)).toBe(true);
      }
    });
  });
});
