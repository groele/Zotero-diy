import { DataLoader } from "../utils/data-loader";
import { getString } from "../utils/locale";
import { setPref } from "../utils/prefs";
import { loadTitleTerms } from "../utils/title-terms";
import { loadCustomAbbreviations } from "./rules/require-abbr";

export function setupCustomDataFiles(pane: Element) {
  const doc = pane.ownerDocument!;
  for (const kind of ["abbr", "title"] as const) {
    const button = pane.querySelector<HTMLButtonElement>(`#metaref-${kind}-choose-custom-data-button`)!;
    const row = button.parentElement!;
    const input = row.querySelector<HTMLInputElement>("input[preference]")!;
    const key = input.getAttribute("preference")!.replace(`${addon.data.config.prefsPrefix}.`, "");
    const status = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    status.className = "metaref-input-status metaref-custom-data-status";
    status.id = `metaref-${kind}-file-status`;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    row.appendChild(status);
    input.setAttribute("aria-describedby", status.id);
    let busy = false;
    button.addEventListener("command", async () => {
      if (busy)
        return;
      busy = true;
      row.setAttribute("data-busy", "true");
      row.setAttribute("aria-busy", "true");
      const buttons = [...row.querySelectorAll<HTMLButtonElement>("button")];
      buttons.forEach(button => button.disabled = true);
      status.textContent = getString("settings-file-working");
      try {
        const path = await new ztoolkit.FilePicker(
          getString(kind === "abbr" ? "settings-abbr-file-title" : "settings-title-file-title"),
          "open",
          kind === "abbr" ? [["CSV", "*.csv"], ["JSON", "*.json"]] : [["CSV", "*.csv"]],
          kind === "abbr" ? "metaref-custom-abbr-data.csv" : "metaref-custom-title-terms.csv",
        ).open();
        if (!path) {
          status.textContent = "";
          return;
        }
        DataLoader.invalidateFile(path);
        const count = kind === "abbr" ? (await loadCustomAbbreviations(path)).size : (await loadTitleTerms(path)).length;
        if (!count)
          throw new Error(getString("settings-file-empty"));
        setPref(key as any, path);
        input.value = path;
        status.textContent = getString("settings-file-valid", { args: { count } });
      }
      catch (error) {
        status.textContent = getString("settings-file-error", { args: { error: error instanceof Error ? error.message : String(error) } });
      }
      finally {
        busy = false;
        row.removeAttribute("data-busy");
        row.removeAttribute("aria-busy");
        buttons.forEach(button => button.disabled = input.disabled || (button.dataset.resetPath === "true" && !input.value));
      }
    });
  }
}
