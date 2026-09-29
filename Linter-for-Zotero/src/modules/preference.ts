import { homepage } from "../../package.json";
import { getString } from "../utils/locale";
import { createLogger } from "../utils/logger";
import { getPref, setPref } from "../utils/prefs";
import { normalizeShortcut, recordShortcut, SHORTCUT_DEFAULTS, shortcutPreview } from "../utils/shortcuts";

const logger = createLogger("prefrence");

export function registerPrefs() {
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: `${rootURI}content/preferences.xhtml`,
    label: getString("prefs-title"),
    image: `${rootURI}/content/icons/favicon.png`,
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

  updatePrefsUI();
  bindPrefEvents();
  setupShortcutInputs();
}

async function updatePrefsUI() {
  // You can initialize some UI elements on prefs window
  // with addon.data.prefs.window.document
  // Or bind some events to the elements
  disablePrefsTitleLang();
  disablePrefsLang();

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
        "zotero-format-metadata-custom-abbr-data.csv",
      ).open();
      if (filename) {
        setPref("rule.require-journal-abbr.customDataPath", filename);
      }
    });

  addon.data.prefs?.window.document
    .querySelector(`#${addon.data.config.addonRef}-esi-choose-custom-data-button`)
    ?.addEventListener("command", async () => {
      const filename = await new ztoolkit.FilePicker(
        "Select File",
        "open",
        [
          ["JSON File (*.json)", "*.json"],
          ["CSV File (*.csv)", "*.csv"],
          ["Any", "*.*"],
        ],
        "zotero-format-metadata-custom-esi-data.json",
      ).open();
      if (filename) {
        setPref("rule.require-series-esi.customDataPath", filename);
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
        "zotero-format-metadata-custom-abbr-data.json",
      ).open();
      if (filename) {
        setPref("rule.correct-title-sentence-case.custom-term-path", filename);
      }
    });
}

function bindPrefEvents() {
  addon.data.prefs?.window.document
    .querySelector(`#${addon.data.config.addonRef}-title-case`)
    ?.addEventListener("command", (e: Event) => {
      logger.debug(e);
      disablePrefsTitleLang();
    });
  addon.data.prefs?.window.document
    .querySelector(`#${addon.data.config.addonRef}-lang-only`)
    ?.addEventListener("command", (e: Event) => {
      logger.debug(e);
      disablePrefsLang();
    });
}

function disablePrefsTitleLang() {
  const titleCaseState = getPref("rule.correct-title-sentence-case");
  const languageElement = addon.data.prefs?.window.document
    .getElementById(`${addon.data.config.addonRef}-title-case-disabled-languages`) as HTMLInputElement;
  if (languageElement)
    languageElement.disabled = !titleCaseState;
}

function disablePrefsLang() {
  const state = getPref("rule.require-language.only");
  const cmnElement = addon.data.prefs?.window.document
    .getElementById(`${addon.data.config.addonRef}-lang-only-cmn`) as HTMLInputElement;
  const engElement = addon.data.prefs?.window.document
    .getElementById(`${addon.data.config.addonRef}-lang-only-eng`) as HTMLInputElement;
  const otherElement = addon.data.prefs?.window.document
    .getElementById(`${addon.data.config.addonRef}-lang-only-other`) as HTMLInputElement;
  if (cmnElement)
    cmnElement.disabled = !state;
  if (engElement)
    engElement.disabled = !state;
  if (otherElement)
    otherElement.disabled = !state;
}

// ---------- Shortcut input recording & preview ----------

function setupShortcutInputs() {
  const win = addon.data.prefs?.window;
  if (!win)
    return;
  const doc = win.document;
  const status = doc.querySelector<HTMLElement>(".linter-shortcut-status");
  const inputs = [...doc.querySelectorAll<HTMLInputElement>(".linter-shortcut-input")];
  const prefKey = (input: HTMLInputElement) => input.getAttribute("preference")!
    .replace(`${addon.data.config.prefsPrefix}.`, "");

  const updatePreview = (input: HTMLInputElement) => {
    const preview = input.parentElement?.querySelector<HTMLElement>(".linter-shortcut-preview");
    if (preview) {
      preview.textContent = shortcutPreview(input.value, Zotero.isMac);
      preview.title = preview.textContent;
    }
  };
  const showStatus = (id: string, args?: Record<string, unknown>) => {
    if (status)
      doc.l10n!.setAttributes(status, `linter-${id}`, args);
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
    input.id = `linter-shortcut-${action}`;
    const label = row.querySelector("label")!;
    label.id = `${input.id}-label`;
    label.setAttribute("control", input.id);
    input.setAttribute("aria-labelledby", label.id);
    doc.l10n!.setAttributes(input, "linter-shortcut-input-hint");
    const actions = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    actions.className = "linter-shortcut-actions";
    actions.setAttribute("role", "group");
    actions.setAttribute("aria-labelledby", label.id);
    row.appendChild(actions);
    const makeButton = (l10nID: string, onCommand: () => void) => {
      const button = doc.createXULElement("button");
      doc.l10n!.setAttributes(button, `linter-${l10nID}`);
      button.setAttribute("native", "true");
      button.classList.add("linter-shortcut-action");
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
