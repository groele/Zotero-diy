import type { Arrayable } from "./utils/types";
import { checkCompat } from "./modules/compat";
import { registerExtraColumns, unregisterExtraColumns } from "./modules/item-tree";
import { registerMenu, unregisterMenu } from "./modules/menu";
import { registerNotifier, unregisterNotifier } from "./modules/notifier";
import { registerPrefs, registerPrefsScripts } from "./modules/preference";
import { RichTextToolBar, setHtmlTag } from "./modules/rich-text";
import { Rules } from "./modules/rules";
import { registerShortcuts } from "./modules/shortcuts";
import { closeAllDialogs } from "./utils/dialog";
import { toArray } from "./utils/general";
import { initLocale, registerMainWindowLocale, unloadLocale, unregisterMainWindowLocale } from "./utils/locale";
import { logger } from "./utils/logger";
import { getPref } from "./utils/prefs";

const shortcutCleanups = new Map<Window, () => void>();
const toolbars = new Map<Window, RichTextToolBar>();

async function onStartup() {
  await Promise.all([Zotero.initializationPromise, Zotero.unlockPromise, Zotero.uiReadyPromise]);
  initLocale();
  await checkCompat();
  registerPrefs();
  registerNotifier();
  registerMenu();
  registerExtraColumns();
  await Promise.all(Zotero.getMainWindows().map(onMainWindowLoad));
}

async function onMainWindowLoad(win: Window): Promise<void> {
  registerMainWindowLocale(win);
  shortcutCleanups.get(win)?.();
  shortcutCleanups.set(win, registerShortcuts(win));
  toolbars.get(win)?.clean();
  const toolbar = new RichTextToolBar(win);
  toolbar.init();
  toolbars.set(win, toolbar);
}

async function onMainWindowUnload(win: Window): Promise<void> {
  shortcutCleanups.get(win)?.();
  shortcutCleanups.delete(win);
  toolbars.get(win)?.clean();
  toolbars.delete(win);
  unregisterMainWindowLocale(win);
}

async function onShutdown() {
  addon.data.alive = false;
  unregisterNotifier();
  closeAllDialogs();
  await addon.runner.stop();
  closeAllDialogs();
  unregisterMenu();
  unregisterExtraColumns();
  ztoolkit.unregisterAll();
  await Promise.all(Zotero.getMainWindows().map(onMainWindowUnload));
  unloadLocale();
  // Remove addon object
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: unknown },
) {
  logger.debug("notify", event, type, ids, extraData);

  // Skip if disabled add on lint
  if (!getPref("lint.onAdded"))
    return;

  // We only process the add item event
  if (event !== "add" || type !== "item")
    return;

  // Skip synced item
  if (extraData.skipAutoSync)
    return;

  // Wait a short time to allow other plugins' changes to be saved
  // Use hidden pref `lint.delayOnAdded` but enforce a minimum of 500ms
  const configuredDelay = getPref("lint.delayOnAdded");
  const delay = Number.isFinite(configuredDelay) ? Math.max(500, configuredDelay) : 500;
  await Zotero.Promise.delay(delay);
  if (!addon.data.alive || !getPref("lint.onAdded"))
    return;

  const items = Zotero.Items.get(ids as number[]).filter(
    (item): item is Zotero.Item => {
      // skip deleted or non-existent items
      if (!item || !item.isRegularItem())
        return false;

      // skip non-editable item
      if (typeof item.isEditable === "function" && !item.isEditable())
        return false;

      // skip trash item
      if (item.deleted)
        return false;

      // skip feed item
      if (item.isFeedItem)
        return false;

      // skip new empty item
      if (!item.getField("title"))
        return false;

      // skip group item
      // @ts-expect-error libraryID is got from item, so get() will never return false
      if (Zotero.Libraries.get(item.libraryID)?.libraryType === "group" && !getPref("lint.onGroup"))
        return false;

      return true;
    },
  );

  if (items.length !== 0) {
    await addon.hooks.onLintInBatch("standard", items);
  }

  logger.debug("notify end for", event, type, ids, extraData);
}

async function onPrefsEvent(type: string, data: { [key: string]: never }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
  }
}

function onShortcuts(type: string, win?: Window) {
  switch (type) {
    case "subscript":
      setHtmlTag("sub", undefined, undefined, win);
      break;
    case "supscript":
      setHtmlTag("sup", undefined, undefined, win);
      break;
    case "bold":
      setHtmlTag("b", undefined, undefined, win);
      break;
    case "italic":
      setHtmlTag("i", undefined, undefined, win);
      break;
    case "nocase":
      setHtmlTag("span", "class", "nocase", win);
      break;
    case "small-caps":
      setHtmlTag("span", "style", "font-variant:small-caps;", win);
      break;
    case "confliction":
      break;
    default:
      break;
  }
}

/**
 * 分发批量执行某函数的任务
 * @param ruleIDs 批量处理任务的类别，决定调用的函数
 * @param items 需要批量处理的 Zotero.Item[]，或通过触发批量任务的位置决定 Zotero Item 的获取方式。 "item" | "collection" | XUL.MenuPopup | "menuFile" | "menuEdit" | "menuView" | "menuGo" | "menuTools" | "menuHelp"
 */
async function onLintInBatch(
  ruleIDs: Arrayable<ID | "standard">,
  items: Zotero.Item[] | "item" | "collection" | string,
) {
  if (typeof items === "string") {
    switch (items) {
      case "item":
        items = Zotero.getActiveZoteroPane()?.getSelectedItems() ?? [];
        break;
      case "collection":
        items = Zotero.getActiveZoteroPane()?.getSelectedCollection()?.getChildItems() ?? [];
        break;
      default:
        items = Zotero.getActiveZoteroPane()?.getSelectedItems() ?? [];
        break;
    }
  }

  items = items.filter(
    (item): item is Zotero.Item =>
      Boolean(item)
      && item.isRegularItem()
      && !item.deleted
      && (typeof item.isEditable !== "function" || item.isEditable()),
  );
  items = [...new Map(items.map(item => [item.id || item, item])).values()];

  const requestedRules = toArray(ruleIDs).map(id =>
    id === "standard"
      ? Rules.getEnabledStandard()
      : Rules.getByID(id)!,
  ).flat();
  const rules = [...new Map(requestedRules.filter(Boolean).map(rule => [rule.id, rule])).values()];

  if (rules.length === 0 || items.length === 0)
    return;

  const tasks = { items, rules };
  await addon.runner.add(tasks);
}

/**
 * @deprecated use onLintInBatch instead.
 */
const onUpdateInBatch = onLintInBatch;

export default {
  onStartup,
  onMainWindowLoad,
  onMainWindowUnload,
  onShutdown,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onLintInBatch,
  onUpdateInBatch,
};
