import { getPref } from "../utils/prefs";
import { matchesShortcut, SHORTCUT_DEFAULTS } from "../utils/shortcuts";
import { getTitleEditor } from "./rich-text";

export function registerShortcuts(win: Window): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.repeat || event.isComposing)
      return;
    const target = event.composedPath()[0] as HTMLElement | undefined;
    // Recording shortcuts must never dispatch library commands.
    if (target?.closest?.("#metaref, .metaref-shortcut-input"))
      return;

    const matching = Object.entries(SHORTCUT_DEFAULTS).filter(([action, fallback]) =>
      matchesShortcut(event, getPref(`shortcut.${action}` as any, fallback) as string, Zotero.isMac),
    );
    if (matching.length !== 1)
      return;
    const [action] = matching[0];

    const editor = getTitleEditor(win);
    if (action === "lint" || action === "chemicalFormula") {
      if (!target?.closest?.("#zotero-items-tree"))
        return;
      if (target?.closest?.("input, textarea, [contenteditable='true'], editable-text"))
        return;
      const items = (win as unknown as ReturnType<typeof Zotero.getMainWindow>).ZoteroPane?.getSelectedItems() ?? [];
      if (!items.some(item => item.isRegularItem() && !item.deleted && item.isEditable()))
        return;
      event.preventDefault();
      event.stopPropagation();
      void addon.hooks.onLintInBatch(action === "lint" ? "standard" : "correct-title-chemical-formula", items);
    }
    else if (getPref("richtext.hotkey") && editor && editor.selectionStart !== editor.selectionEnd) {
      event.preventDefault();
      event.stopPropagation();
      addon.hooks.onShortcuts(action, win);
    }
  };

  win.addEventListener("keydown", onKeyDown, true);
  return () => win.removeEventListener("keydown", onKeyDown, true);
}
