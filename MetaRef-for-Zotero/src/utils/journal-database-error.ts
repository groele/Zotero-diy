import { JournalDatasetError } from "./journal-datasets";
import { getString } from "./locale";

export function journalDatabaseErrorMessage(error: unknown): string {
  if (!(error instanceof JournalDatasetError))
    return error instanceof Error ? error.message : String(error);
  const detail = getString(`journal-database-issue-${error.issue}`, { args: { field: error.field } });
  return error.row ? getString("journal-database-record-error", { args: { row: error.row, detail } }) : detail;
}
