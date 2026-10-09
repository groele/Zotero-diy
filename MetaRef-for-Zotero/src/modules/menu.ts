import type { RuleForRegularScopeField } from "./rules/rule-base";
import { getJournalInsights } from "../utils/journal-insights";
import { presentJournalInsights } from "../utils/journal-insights-presentation";
import { getLocaleID, getString } from "../utils/locale";
import { logger } from "../utils/logger";
import { getPref } from "../utils/prefs";
import { refreshJournalInsights } from "./journal-pane";
import { createReporter } from "./reporter";
import { Rules } from "./rules";

type FieldMenu = _ZoteroTypes.MenuManager.MenuData<_ZoteroTypes.MenuManager.ItemPaneMenuContext>;
type ItemMenu = _ZoteroTypes.MenuManager.MenuData<_ZoteroTypes.MenuManager.LibraryMenuContext>;
type LibraryContext = _ZoteroTypes.MenuManager.LibraryMenuContext & { collectionTreeRows?: Zotero.CollectionTreeRow[] };

async function menuItems(context: LibraryContext): Promise<Zotero.Item[]> {
  if (context.items)
    return context.items;
  const rows = context.collectionTreeRows ?? [];
  const items = await Promise.all(rows.map(row => row.getItems()));
  return items.flat().filter((item): item is Zotero.Item => Boolean(item && typeof (item as Zotero.Item).isRegularItem === "function"));
}

function hasMenuItems(context: LibraryContext): boolean {
  if (context.items)
    return context.items.some(item => item.isRegularItem() && !item.deleted && item.isEditable());
  return Boolean(context.collectionTreeRows?.length);
}

const icon = typeof rootURI !== "undefined" ? `${rootURI}/content/icons/metaref-96.png` : "";
const registeredMenus: string[] = [];
const handledCommands = new WeakSet<Event>();

function acceptCommand(event: Event) {
  // Native menu listeners are removed at idle; rapid reopenings can deliver one event twice.
  if (handledCommands.has(event))
    return false;
  handledCommands.add(event);
  return true;
}

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
        if (!acceptCommand(_event))
          return;
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
  primary: ["standard", "tool-update-metadata"],
  title: ["correct-title-sentence-case", "correct-title-chemical-formula", "tool-title-guillemet"],
  creators: ["correct-creators-case", "correct-creators-pinyin", "tool-creators-ext"],
  publication: ["require-language", "tool-set-language", "correct-publication-title-alias", "correct-publication-title-case", "require-journal-abbr", "correct-conference-abbr", "require-university-place"],
  indexing: ["tool-query-esi", "tool-query-nature-index"],
  maintenance: ["correct-date-format", "no-doi-prefix", "tool-get-short-doi", "tool-csl-helper", "tool-clean-extra"],
} satisfies Record<string, string[]>;

export const MENU_GROUPS = Object.entries(MENU_SECTIONS).filter(([key]) => key !== "primary") as [Exclude<keyof typeof MENU_SECTIONS, "primary">, string[]][];

function registerItemMenus() {
  const isMenuVisible = (key: string): boolean => getPref(`menu.${key}` as any, true) ?? true;
  const makeItem = (key: string): ItemMenu => {
    const indexing = MENU_SECTIONS.indexing.includes(key);
    const rule = key === "standard" ? undefined : Rules.getByID(key as ID);
    const custom = rule?.getItemMenu?.();
    const l10nID = key === "standard" ? getLocaleID("menuitem-stdFormatFlow") : getLocaleID(custom?.l10nID || `rule-${key as ID}-menu-item` as Parameters<typeof getLocaleID>[0]);
    return {
      menuType: "menuitem",
      l10nID,
      onShowing(_event, context) {
        context.setVisible(isMenuVisible(key));
        const eligible = context.items?.filter(item => item.isRegularItem() && !item.deleted && (indexing || item.isEditable())
          && (!(rule?.scope === "item" || rule?.scope === "field") || !rule.targetItemTypes || rule.targetItemTypes.includes(item.itemType)));
        context.setEnabled((context.items ? !!eligible?.length : hasMenuItems(context))
          && !(custom?.mutiltipleItems === false && (context.items?.length ?? 0) > 1));
      },
      onShown(_event, context) { checkL10nString(context.menuElem, key, l10nID); },
      async onCommand(_event, context) {
        if (!acceptCommand(_event))
          return;
        const items = await menuItems(context);
        if (indexing) {
          await refreshJournalInsights();
          const infos = await Promise.all(items.filter(item => item.isRegularItem() && !item.deleted && item.itemType === "journalArticle").map(async (item) => {
            const result = await getJournalInsights(item);
            const row = presentJournalInsights(result, Zotero.locale)[key === "tool-query-esi" ? 0 : 1];
            return { itemID: item.id, title: item.getField("title") as string, ruleID: key, level: row.warning ? "warning" as const : "info" as const, label: row.label, message: [row.value, row.basis, row.source, row.warning, getString("journal-insights-boundary")].filter(Boolean).join("\n") };
          }));
          if (infos.length)
            void createReporter(infos).catch(error => logger.error("Journal report failed:", error));
          return;
        }
        const rules = key === "tool-update-metadata"
          ? ["tool-update-metadata", "standard"] as const
          : key === "correct-date-format"
            ? ["correct-date-format", "correct-filing-date-format", "correct-issue-date-format", "correct-priority-date-format"] as const
            : [key as ID | "standard"];
        await addon.hooks.onLintInBatch([...rules], items);
      },
    };
  };
  const sections = Object.values(MENU_SECTIONS);
  const menus: ItemMenu[] = [{
    menuType: "submenu",
    l10nID: getLocaleID("menuitem-label"),
    icon,
    onShowing(_event, context) {
      context.setVisible(Object.values(MENU_SECTIONS).flat().some(isMenuVisible));
      context.setEnabled(context.items ? context.items.some(item => item.isRegularItem() && !item.deleted) : hasMenuItems(context));
    },
    menus: sections.flatMap((keys, index): ItemMenu[] => [
      ...keys.map(makeItem),
      ...(index < sections.length - 1
        ? [{ menuType: "separator", onShowing(_event, context) {
            context.setVisible(shouldShowSeparator(keys, sections.slice(index + 1), isMenuVisible));
          } } as ItemMenu]
        : []),
    ]),
  }];
  for (const target of ["main/library/item", "main/library/collection"] as const) {
    addMenu({ pluginID: addon.data.config.addonID, menuID: target.endsWith("item") ? "item-menu" : "collection-menu", target, menus });
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
