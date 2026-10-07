import type { JournalDatasetKind } from "../utils/journal-datasets";
import { journalDatabaseErrorMessage } from "../utils/journal-database-error";
import { exportJournalDatabase, validateJournalDatabase } from "../utils/journal-database-file";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { refreshJournalInsights } from "./journal-pane";

export function setupJournalDatabases(pane: Element) {
  for (const kind of ["esi", "nature"] as JournalDatasetKind[]) {
    const key = kind === "esi" ? "insights.esiCustomDataPath" : "insights.natureCustomDataPath";
    const group = pane.querySelector(`[data-journal-database='${kind}']`)!;
    const status = group.querySelector<HTMLElement>(".journal-database-status")!;
    const buttons = [...group.querySelectorAll<HTMLButtonElement>("button")];
    const pathInput = group.querySelector<HTMLInputElement>("input[readonly]")!;
    let busy = false;
    for (const action of ["choose", "validate", "export", "reload"] as const) {
      group.querySelector(`#metaref-${kind}-${action}-custom-data-button`)!.addEventListener("command", async () => {
        if (busy)
          return;
        busy = true;
        group.setAttribute("data-busy", "true");
        buttons.forEach(button => button.disabled = true);
        status.textContent = getString("journal-database-working");
        try {
          if (action === "export") {
            const path = await new ztoolkit.FilePicker(getString("journal-database-export-title"), "save", [["JSON", "*.json"]], `metaref-${kind}-journals.json`).open();
            if (!path) {
              status.textContent = "";
              return;
            }
            await exportJournalDatabase(kind, path);
            status.textContent = getString("journal-database-exported", { args: { path } });
          }
          else {
            let path = getPref(key);
            if (action === "choose") {
              const selected = await new ztoolkit.FilePicker(getString("journal-database-choose-title"), "open", [["JSON", "*.json"], ["CSV", "*.csv"]], `metaref-${kind}-journals.json`).open();
              if (!selected) {
                status.textContent = "";
                return;
              }
              path = selected;
            }
            const result = await validateJournalDatabase(kind, path);
            if (action === "choose") {
              setPref(key, path);
              pathInput.value = path;
            }
            await refreshJournalInsights();
            status.textContent = getString("journal-database-valid", { args: { count: result.journals, source: path || getString("journal-database-builtin") } });
          }
        }
        catch (error) {
          status.textContent = getString("journal-database-error", { args: { error: journalDatabaseErrorMessage(error) } });
          if (action !== "choose" && action !== "export")
            await refreshJournalInsights().catch(refreshError => ztoolkit.log(refreshError));
        }
        finally {
          busy = false;
          group.removeAttribute("data-busy");
          buttons.forEach(button => button.disabled = false);
        }
      });
    }
    group.querySelector("[data-l10n-id='metaref-settings-custom-data-reset']")!.addEventListener("command", () => {
      status.textContent = "";
    });
  }
}
