import type { JournalDatasetKind } from "./journal-datasets";
import { DataLoader } from "./data-loader";
import { parseESIDataset, parseNatureDataset } from "./journal-datasets";

export async function validateJournalDatabase(kind: JournalDatasetKind, path: string) {
  DataLoader.clearCache();
  const data = path
    ? await DataLoader.load(/\.csv$/i.test(path) ? "csv" : "json", path, { noheader: false })
    : await DataLoader.load(kind === "esi" ? "esiJournals" : "natureIndexJournals");
  const records = kind === "esi" ? parseESIDataset(data) : parseNatureDataset(data);
  return { records: records.length, journals: records.filter(entry => !("type" in entry) || entry.type === "journal").length };
}

export async function exportJournalDatabase(kind: JournalDatasetKind, path: string) {
  const data = await DataLoader.load(kind === "esi" ? "esiJournals" : "natureIndexJournals");
  if (kind === "esi")
    parseESIDataset(data);
  else
    parseNatureDataset(data);
  await Zotero.File.putContentsAsync(path, `${JSON.stringify(data, null, 2)}\n`);
}
