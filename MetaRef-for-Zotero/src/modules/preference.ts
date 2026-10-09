import { homepage } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { normalizeShortcut, recordShortcut, SHORTCUT_DEFAULTS, shortcutPreview } from "../utils/shortcuts";
import { setupCustomDataFiles } from "./custom-data-settings";
import { setupJournalDatabases } from "./journal-database-settings";
import { MENU_GROUPS, MENU_SECTIONS } from "./menu";
import { Rules } from "./rules";
import { setupSettingsPanel } from "./settings-panel";

const initializedPanes = new WeakSet<Element>();

export function registerPrefs() {
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: `${rootURI}content/preferences.xhtml`,
    label: getString("prefs-title"),
    image: `${rootURI}/content/icons/metaref-96.png`,
    stylesheets: [`${rootURI}/content/preferences.css`],
    helpURL: homepage,
  });
}

export function registerPrefsScripts(_window: Window) {
  // This function is called when the prefs window is opened
  // See addon/content/preferences.xul onpaneload
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
    };
  }
  else {
    addon.data.prefs.window = _window;
  }

  const pane = _window.document.getElementById(addon.data.config.addonRef);
  if (!pane || initializedPanes.has(pane))
    return;
  initializedPanes.add(pane);
  setupMenuSettings(pane);
  setupCustomDataReset(pane);
  setupCustomDataFiles(pane);
  setupJournalDatabases(pane);
  setupDependencies(pane);
  setupShortcutInputs();
  setupSettingsPanel(pane);
}

function setupMenuSettings(pane: Element) {
  const container = pane.querySelector("#metaref-menu-settings");
  if (!container)
    return;
  const doc = pane.ownerDocument!;
  for (const [key, keys] of [["primary", MENU_SECTIONS.primary], ...MENU_GROUPS]) {
    const group = doc.createXULElement("groupbox");
    const label = doc.createXULElement("label");
    doc.l10n!.setAttributes(label, `metaref-menu-group-${key}`);
    group.appendChild(label);
    for (const id of keys) {
      const control = doc.createXULElement("checkbox") as XULElement & { checked: boolean };
      const rule = id === "standard" ? undefined : Rules.getByID(id as ID);
      const l10nID = id === "standard" ? "menuitem-stdFormatFlow" : rule?.getItemMenu?.()?.l10nID || `rule-${id}-menu-item`;
      doc.l10n!.setAttributes(control, `metaref-${l10nID}`);
      control.setAttribute("native", "true");
      control.setAttribute("preference", `${addon.data.config.prefsPrefix}.menu.${id}`);
      control.checked = getPref(`menu.${id}` as any, true) as boolean;
      control.addEventListener("command", () => setPref(`menu.${id}` as any, control.checked));
      group.appendChild(control);
    }
    container.appendChild(group);
  }
}

function setupCustomDataReset(pane: Element) {
  for (const input of pane.querySelectorAll<HTMLInputElement>("input[readonly][preference]")) {
    const button = input.ownerDocument.createXULElement("button");
    input.ownerDocument.l10n!.setAttributes(button, "metaref-settings-custom-data-reset");
    button.setAttribute("native", "true");
    button.dataset.resetPath = "true";
    if (!input.closest("[data-journal-database]")) {
      button.addEventListener("command", () => {
        if (input.parentElement!.hasAttribute("data-busy"))
          return;
        const status = input.parentElement!.querySelector(".metaref-custom-data-status");
        if (status)
          status.textContent = "";
        const key = input.getAttribute("preference")!.replace(`${addon.data.config.prefsPrefix}.`, "");
        setPref(key as any, "");
        input.value = "";
      });
    }
    input.parentElement!.appendChild(button);
  }
}

function setupDependencies(pane: Element) {
  const prefix = `${addon.data.config.prefsPrefix}.`;
  const controls = [...pane.querySelectorAll<HTMLInputElement>("[preference]")];
  const key = (control: Element) => control.getAttribute("preference")!.replace(prefix, "");
  const parents = controls.filter(control => control.localName === "checkbox")
    .map(control => ({ control, prefix: `${key(control)}.` }));
  const dependencies = controls.map(control => ({
    control,
    parents: parents.filter(parent => parent.control !== control && key(control).startsWith(parent.prefix)),
  }));
  const auto = controls.find(control => key(control) === "lint.onAdded");
  const group = controls.find(control => key(control) === "lint.onGroup");
  const update = () => {
    for (const { control, parents } of dependencies) {
      control.disabled = parents.some(parent => !parent.control.checked);
    }
    if (auto && group)
      group.disabled = !auto.checked;
    for (const button of pane.querySelectorAll<HTMLButtonElement>("hbox button")) {
      if (button.closest("[data-busy='true']")) {
        button.disabled = true;
        continue;
      }
      const input = button.parentElement?.querySelector("input[preference]") as HTMLInputElement | null;
      if (input)
        button.disabled = input.disabled || (button.dataset.resetPath === "true" && !input.value);
    }
  };
  pane.addEventListener("command", update);
  pane.addEventListener("syncfrompreference", () => setTimeout(update, 0), true);
  update();
}

// ---------- Shortcut input recording & preview ----------

function setupShortcutInputs() {
  const win = addon.data.prefs?.window;
  if (!win)
    return;
  const doc = win.document;
  const status = doc.querySelector<HTMLElement>(".metaref-shortcut-status");
  if (status) {
    status.id = "metaref-shortcut-status";
    status.setAttribute("role", "status");
  }
  const inputs = [...doc.querySelectorAll<HTMLInputElement>(".metaref-shortcut-input")];
  const prefKey = (input: HTMLInputElement) => input.getAttribute("preference")!
    .replace(`${addon.data.config.prefsPrefix}.`, "");

  const updatePreview = (input: HTMLInputElement) => {
    const preview = input.parentElement?.querySelector<HTMLElement>(".metaref-shortcut-preview");
    if (preview) {
      preview.textContent = shortcutPreview(input.value, Zotero.isMac);
      preview.title = preview.textContent;
    }
  };
  const showStatus = (id: string, args?: Record<string, unknown>) => {
    if (status)
      doc.l10n!.setAttributes(status, `metaref-${id}`, args);
  };
  const save = (input: HTMLInputElement, raw: string): boolean => {
    const normalized = normalizeShortcut(raw, Zotero.isMac);
    const conflict = normalized && inputs.find(other => other !== input
      && normalizeShortcut(other.value, Zotero.isMac) === normalized);
    if (normalized === null || conflict) {
      input.setAttribute("aria-invalid", "true");
      if (conflict) {
        const label = conflict.parentElement?.querySelector("label")?.textContent ?? "";
        showStatus("shortcut-conflict", { action: label });
      }
      else {
        showStatus("shortcut-invalid");
      }
      return false;
    }
    input.removeAttribute("aria-invalid");
    input.value = raw.trim();
    setPref(prefKey(input) as any, input.value);
    updatePreview(input);
    showStatus(input.value ? "shortcut-saved" : "shortcut-disabled");
    return true;
  };

  for (const input of inputs) {
    const row = input.parentElement!;
    const pref = prefKey(input);
    const action = pref.slice("shortcut.".length) as keyof typeof SHORTCUT_DEFAULTS;
    input.id = `metaref-shortcut-${action}`;
    const label = row.querySelector("label")!;
    label.id = `${input.id}-label`;
    label.setAttribute("control", input.id);
    input.setAttribute("aria-labelledby", label.id);
    input.setAttribute("aria-describedby", "metaref-shortcut-status");
    doc.l10n!.setAttributes(input, "metaref-shortcut-input-hint");
    const actions = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    actions.className = "metaref-shortcut-actions";
    actions.setAttribute("role", "group");
    actions.setAttribute("aria-labelledby", label.id);
    row.appendChild(actions);
    const makeButton = (l10nID: string, onCommand: () => void) => {
      const button = doc.createXULElement("button");
      doc.l10n!.setAttributes(button, `metaref-${l10nID}`);
      button.setAttribute("native", "true");
      button.classList.add("metaref-shortcut-action");
      button.addEventListener("command", onCommand);
      actions.appendChild(button);
    };
    makeButton("shortcut-clear", () => save(input, ""));
    makeButton("shortcut-reset", () => save(input, SHORTCUT_DEFAULTS[action]));
    input.value = getPref(pref as any, SHORTCUT_DEFAULTS[action]) as string;
    updatePreview(input);
    input.addEventListener("syncfrompreference", () => setTimeout(updatePreview, 0, input));

    input.addEventListener("input", (event: Event) => {
      // Reject invalid pasted bindings before Zotero's preference binding saves them.
      event.stopImmediatePropagation();
      const raw = input.value;
      if (!save(input, raw)) {
        input.value = getPref(pref as any, SHORTCUT_DEFAULTS[action]) as string;
        updatePreview(input);
      }
    }, true);
    input.addEventListener("blur", () => input.removeAttribute("aria-invalid"));
    input.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Tab")
        return;
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        input.blur();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "v")
        return;
      event.preventDefault();
      if ((event.key === "Backspace" || event.key === "Delete") && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        save(input, "");
        return;
      }
      const raw = recordShortcut(event, Zotero.isMac);
      if (raw && save(input, raw))
        input.blur();
    });
  }
}
