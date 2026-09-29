import type { RuleForRegularScopeField } from "./rules/rule-base";
import { getLocaleID } from "../utils/locale";
import { logger } from "../utils/logger";
import { getPref } from "../utils/prefs";
import { Rules } from "./rules";

type FieldMenu = _ZoteroTypes.MenuManager.MenuData<_ZoteroTypes.MenuManager.ItemPaneMenuContext>;
type ItemMenu = _ZoteroTypes.MenuManager.MenuData<_ZoteroTypes.MenuManager.LibraryMenuContext>;
type LibraryContext = _ZoteroTypes.MenuManager.LibraryMenuContext & { collectionTreeRows?: Zotero.CollectionTreeRow[] };

async function menuItems(context: LibraryContext): Promise<Zotero.Item[]> {
  if (context.items)
    return context.items;
  const rows: Zotero.CollectionTreeRow[] = context.collectionTreeRows ?? (context.collectionTreeRow ? [context.collectionTreeRow as unknown as Zotero.CollectionTreeRow] : []);
  const items = await Promise.all(rows.map(row => row.getItems()));
  return items.flat().filter((item): item is Zotero.Item => Boolean(item && typeof (item as Zotero.Item).isRegularItem === "function"));
}

function hasMenuItems(context: LibraryContext): boolean {
  return Boolean(context.items?.some(item => item.isRegularItem() && !item.deleted && item.isEditable())
    || context.collectionTreeRows?.length || context.collectionTreeRow);
}

const icon = typeof rootURI !== "undefined" ? `${rootURI}/content/icons/favicon.png` : "";
const registeredMenus: string[] = [];

function addMenu<T extends _ZoteroTypes.MenuManager.ValidTarget>(options: _ZoteroTypes.MenuManager.MenuOptions<T>) {
  const id = Zotero.MenuManager.registerMenu(options);
  if (id)
    registeredMenus.push(id);
}

export function unregisterMenu() {
  registeredMenus.splice(0).forEach(id => Zotero.MenuManager.unregisterMenu(id));
}

export function registerMenu() {
  if (registeredMenus.length)
    return;
  registerItemMenus();
  registerFieldMenus();
}

function registerFieldMenus() {
  const isMenuVisible = (key: string): boolean => getPref(`menu.${key}` as any, true) ?? true;

  const menus: FieldMenu[] = Rules
    .getAll()
    .filter((r): r is RuleForRegularScopeField => r.scope === "field" && Boolean(r.fieldMenu))
    .map(rule => ({
      menuType: "menuitem",
      l10nID: getLocaleID(rule.fieldMenu?.l10nID),
      icon: rule.fieldMenu?.icon,
      enableForTabTypes: rule.targetItemTypes,
      onShowing: (_event, context) => {
        const isPrefEnabled = isMenuVisible(rule.id);
        const visiable: boolean = isPrefEnabled && (rule.targetItemField === context.fieldName);
        context.setVisible(visiable);
        if (!visiable)
          return;

        // set enabled state: setDisabled returns true when item should be disabled
        const disabled: boolean = !context.editable || !context.items.some(item => item.isRegularItem() && !item.deleted && item.isEditable()) || !!rule.fieldMenu?.setDisabled?.(context);
        context.setEnabled(!disabled);
      },
      onShown(event, context) {
        checkL10nString(context.menuElem, rule.id, rule.fieldMenu?.l10nID);
      },
      onCommand: (_event, context) => {
        if (rule.fieldMenu?.onCommand) {
          rule.fieldMenu.onCommand(context);
          return;
        }
        addon.hooks.onLintInBatch(rule.id, context.items);
      },
    }));

  addMenu({
    pluginID: addon.data.config.addonID,
    menuID: "field-menu",
    target: "itemPane/info/row",
    menus,
  });
}

export function shouldShowSeparator(
  currentSection: string[],
  followingSections: string[][],
  isKeyVisible: (key: string) => boolean,
): boolean {
  const currentVisible = currentSection.some(isKeyVisible);
  const followingVisible = followingSections.some(sec => sec.some(isKeyVisible));
  return currentVisible && followingVisible;
}

export const MENU_SECTIONS = {
  section0: ["standard"],
  section1: [
    "correct-title-sentence-case",
    "correct-title-chemical-formula",
    "correct-creators-case",
    "correct-creators-pinyin",
  ],
  section2: [
    "require-language",
    "tool-set-language",
  ],
  section3: [
    "correct-publication-title-alias",
    "correct-publication-title-case",
    "require-journal-abbr",
    "require-series-esi",
    "correct-conference-abbr",
    "require-university-place",
  ],
  section4: ["tool-update-metadata"],
  toolSec0: ["tool-title-guillemet"],
  toolSec1: [
    "no-doi-prefix",
    "tool-get-short-doi",
    "correct-date-format",
    "tool-clean-extra",
  ],
  toolSec2: [
    "tool-csl-helper",
    "tool-creators-ext",
  ],
};

function registerItemMenus() {
  const isMenuVisible = (key: string): boolean => getPref(`menu.${key}` as any, true) ?? true;

  const { section0, section1, section2, section3, section4, toolSec0, toolSec1, toolSec2 } = MENU_SECTIONS;
  const section5 = [...toolSec0, ...toolSec1, ...toolSec2];

  const hasAnyVisible = (keys: string[]) => keys.some(isMenuVisible);

  function makeSmartSeparator(currentSection: string[], followingSections: string[][]): ItemMenu {
    return {
      menuType: "separator",
      onShowing(_event, context) {
        context.setVisible(shouldShowSeparator(currentSection, followingSections, isMenuVisible));
      },
    };
  }

  function makeItemMenu(ruleID: ID): ItemMenu {
    const rule = Rules.getByID(ruleID)!;
    const menu = rule?.getItemMenu?.();
    // @ts-expect-error some rules are not defined in the item menu
    const l10nID = getLocaleID(menu?.l10nID || `rule-${ruleID}-menu-item`);

    return {
      menuType: "menuitem",
      l10nID,
      onShowing(event, context) {
        const visible = isMenuVisible(ruleID);
        context.setVisible(visible);
        if (!visible)
          return;

        const enabled: boolean = hasMenuItems(context) && !(menu?.mutiltipleItems === false && (context.items?.length ?? 0) > 1);
        context.setEnabled(enabled);
      },
      onShown(event, context) {
        checkL10nString(context.menuElem, ruleID, l10nID);
      },
      async onCommand(event, context) {
        await addon.hooks.onLintInBatch(ruleID, await menuItems(context));
      },
    };
  }

  const menus: ItemMenu[] = [
    {
      menuType: "submenu",
      l10nID: getLocaleID("menuitem-label"),
      icon,
      onShowing(_event, context) {
        const allSections = [section0, section1, section2, section3, section4, section5];
        const anyVisible = allSections.some(hasAnyVisible);
        context.setVisible(anyVisible);
      },
      menus: [
        {
          menuType: "menuitem",
          l10nID: getLocaleID("menuitem-stdFormatFlow"),
          onShowing(_event, context) {
            context.setVisible(isMenuVisible("standard"));
            context.setEnabled(hasMenuItems(context));
          },
          async onCommand(event, context) {
            await addon.hooks.onLintInBatch("standard", await menuItems(context));
          },
        },
        makeSmartSeparator(section0, [section1, section2, section3, section4, section5]),
        makeItemMenu("correct-title-sentence-case"),
        makeItemMenu("correct-title-chemical-formula"),
        makeItemMenu("correct-creators-case"),
        makeItemMenu("correct-creators-pinyin"),
        makeSmartSeparator(section1, [section2, section3, section4, section5]),
        makeItemMenu("require-language"),
        makeItemMenu("tool-set-language"),
        makeSmartSeparator(section2, [section3, section4, section5]),
        makeItemMenu("correct-publication-title-alias"),
        makeItemMenu("correct-publication-title-case"),
        makeItemMenu("require-journal-abbr"),
        makeItemMenu("require-series-esi"),
        makeItemMenu("correct-conference-abbr"),
        makeItemMenu("require-university-place"),
        makeSmartSeparator(section3, [section4, section5]),
        {
          menuType: "menuitem",
          l10nID: getLocaleID("rule-tool-update-metadata-menu-item"),
          onShowing(_event, context) {
            context.setVisible(isMenuVisible("tool-update-metadata"));
            context.setEnabled(hasMenuItems(context));
          },
          async onCommand(event, context) {
            await addon.hooks.onLintInBatch(["tool-update-metadata", "standard"], await menuItems(context));
          },
        },
        makeSmartSeparator(section4, [section5]),
        {
          menuType: "submenu",
          l10nID: getLocaleID("menuTools-label"),
          icon,
          onShowing(_event, context) {
            context.setVisible(hasAnyVisible(section5));
          },
          menus: [
            makeItemMenu("tool-title-guillemet"),
            makeSmartSeparator(toolSec0, [toolSec1, toolSec2]),
            makeItemMenu("no-doi-prefix"),
            makeItemMenu("tool-get-short-doi"),
            {
              menuType: "menuitem",
              l10nID: getLocaleID("rule-correct-date-format-menu-item"),
              onShowing(_event, context) {
                context.setVisible(isMenuVisible("correct-date-format"));
                context.setEnabled(hasMenuItems(context));
              },
              async onCommand(event, context) {
                await addon.hooks.onLintInBatch([
                  "correct-date-format",
                  "correct-filing-date-format",
                  "correct-issue-date-format",
                  "correct-priority-date-format",
                ], await menuItems(context));
              },
            },
            makeItemMenu("tool-clean-extra"),
            makeSmartSeparator(toolSec1, [toolSec2]),
            makeItemMenu("tool-csl-helper"),
            makeItemMenu("tool-creators-ext"),
          ],
        },
      ],
    },
  ];

  addMenu({
    pluginID: addon.data.config.addonID,
    menuID: "item-menu",
    target: "main/library/item",
    menus,
  });

  addMenu({
    pluginID: addon.data.config.addonID,
    menuID: "collection-menu",
    target: "main/library/collection",
    menus,
  });

  if (__env__ === "development") {
    addMenu({
      pluginID: addon.data.config.addonID,
      menuID: "item-menu-test",
      target: "main/library/item",
      menus: [{
        menuType: "menuitem",
        l10nID: getLocaleID("menuitem-label"),
        async onCommand(event, context) {
          await addon.hooks.onLintInBatch("standard", await menuItems(context));
        },
      }],
    });
  }
}

function checkL10nString(menuElem: XULElement, ruleID: string, l10nID?: string) {
  // Since fluent.js is async, when menu first shown, the l10n string is not ready,
  // so we need to wait for i18n string to be ready
  setTimeout(() => {
    if (!menuElem.getAttribute("label") && !menuElem.textContent) {
      logger.warn(`Miss l10n string: ${l10nID}`);
      menuElem.setAttribute("label", `Miss l10n string (${ruleID})`);
    }
  }, 500);
}
