import { homepage } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { normalizeShortcut, recordShortcut, SHORTCUT_DEFAULTS, shortcutPreview } from "../utils/shortcuts";
import { setupJournalDatabases } from "./journal-database-settings";
import { MENU_GROUPS, MENU_SECTIONS } from "./menu";
import { Rules } from "./rules";

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
  updatePrefsUI();
  setupCustomDataReset(pane);
  setupJournalDatabases(pane);
  setupDependencies(pane);
  setupSettingsSearch(pane);
  setupShortcutInputs();
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
    if (!input.closest("[data-journal-database]")) {
      button.addEventListener("command", () => {
        const key = input.getAttribute("preference")!.replace(`${addon.data.config.prefsPrefix}.`, "");
        setPref(key as any, "");
        input.value = "";
      });
    }
    input.parentElement!.appendChild(button);
  }
}

function updatePrefsUI() {
  // You can initialize some UI elements on prefs window
  // with addon.data.prefs.window.document
  // Or bind some events to the elements

  addon.data.prefs?.window.document
    .querySelector(`#${addon.data.config.addonRef}-abbr-choose-custom-data-button`)
    ?.addEventListener("command", async () => {
      const filename = await new ztoolkit.FilePicker(
        "Select File",
        "open",
        [
          ["CSV File (*.csv)", "*.csv"],
          ["JSON File (*.json)", "*.json"],
          ["Any", "*.*"],
        ],
        "metaref-custom-abbr-data.csv",
      ).open();
      if (filename) {
        setPref("rule.require-journal-abbr.customDataPath", filename);
      }
    });

  addon.data.prefs?.window.document
    .querySelector(`#${addon.data.config.addonRef}-title-choose-custom-data-button`)
    ?.addEventListener("command", async () => {
      const filename = await new ztoolkit.FilePicker(
        "Select File",
        "open",
        [
          ["CSV File (*.csv)", "*.csv"],
          ["Any", "*.*"],
        ],
        "metaref-custom-title-terms.csv",
      ).open();
      if (filename) {
        setPref("rule.correct-title-sentence-case.custom-term-path", filename);
      }
    });
}

function setupDependencies(pane: Element) {
  const prefix = `${addon.data.config.prefsPrefix}.`;
  const controls = [...pane.querySelectorAll<HTMLInputElement>("[preference]")];
  const key = (control: Element) => control.getAttribute("preference")!.replace(prefix, "");
  const update = () => {
    for (const control of controls) {
      const pref = key(control);
      const parents = controls.filter(parent => parent !== control && parent.localName === "checkbox"
        && pref.startsWith(`${key(parent)}.`));
      control.disabled = parents.some(parent => !parent.checked);
    }
    const auto = controls.find(control => key(control) === "lint.onAdded");
    const group = controls.find(control => key(control) === "lint.onGroup");
    if (auto && group)
      group.disabled = !auto.checked;
    for (const button of pane.querySelectorAll<HTMLButtonElement>("hbox button")) {
      if (button.closest("[data-journal-database][data-busy='true']")) {
        button.disabled = true;
        continue;
      }
      const input = button.parentElement?.querySelector("input[preference]") as HTMLInputElement | null;
      if (input)
        button.disabled = input.disabled;
    }
  };
  pane.addEventListener("command", update);
  pane.addEventListener("syncfrompreference", () => setTimeout(update, 0));
  update();
}

function setupSettingsSearch(pane: Element) {
  const search = pane.querySelector<HTMLInputElement>(".metaref-settings-search");
  if (!search)
    return;
  const groups = [...pane.querySelectorAll<HTMLElement>(":scope > groupbox")];
  const details = [...pane.querySelectorAll<HTMLDetailsElement>("details")];
  let openStates: Map<HTMLDetailsElement, boolean> | undefined;
  const text = (element: Element) => `${element.textContent} ${[...element.querySelectorAll("[label]")].map(node => node.getAttribute("label")).join(" ")}`.toLocaleLowerCase();
  const update = () => {
    const query = search.value.trim().toLocaleLowerCase();
    if (query && !openStates)
      openStates = new Map(details.map(detail => [detail, detail.open]));
    for (const group of groups)
      group.hidden = !!query && !text(group).includes(query);
    for (const detail of details) {
      detail.hidden = !!query && !text(detail).includes(query);
      if (query)
        detail.open = !detail.hidden;
      else if (openStates)
        detail.open = openStates.get(detail)!;
    }
    if (!query)
      openStates = undefined;
    const empty = pane.querySelector<HTMLElement>(".metaref-settings-empty");
    if (empty)
      empty.hidden = groups.some(group => !group.hidden);
  };
  search.addEventListener("input", update);
  search.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      search.value = "";
      update();
    }
  });
}

// ---------- Shortcut input recording & preview ----------

function setupShortcutInputs() {
  const win = addon.data.prefs?.window;
  if (!win)
    return;
  const doc = win.document;
  const status = doc.querySelector<HTMLElement>(".metaref-shortcut-status");
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
