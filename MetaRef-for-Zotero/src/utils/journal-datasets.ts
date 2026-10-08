import type { ESIJournalEntry } from "./esi";
import type { NatureIndexEntry } from "./nature-index";
import { extractISSNs } from "./esi";

export type JournalDatasetKind = "esi" | "nature";
type DatasetIssue = "records" | "object" | "text" | "esi-required" | "issn" | "list" | "type" | "nature-required" | "journals";

export class JournalDatasetError extends TypeError {
  constructor(message: string, public issue: DatasetIssue, public row?: number, public field = "") {
    super(message);
  }
}

function records(data: unknown, key: string): unknown[] {
  const value = data && typeof data === "object" && key in data ? (data as Record<string, unknown>)[key] : data;
  const list = Array.isArray(value) ? value : undefined;
  if (!list?.length || list.length > 100_000)
    throw new JournalDatasetError("Expected 1–100000 journal records", "records");
  return list;
}

function record(value: unknown, index: number): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new JournalDatasetError(`Record ${index + 1}: expected a journal object`, "object", index + 1);
  return value as Record<string, unknown>;
}

function text(row: Record<string, unknown>, keys: string[], index: number): string {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null || value === "")
      continue;
    if (typeof value !== "string")
      throw new JournalDatasetError(`Record ${index + 1}: ${key} must be text`, "text", index + 1, key);
    return value.trim();
  }
  return "";
}

export function parseESIDataset(data: unknown): ESIJournalEntry[] {
  return records(data, "journals").map((value, index) => {
    const row = record(value, index);
    const entry = {
      title: text(row, ["title", "Title", "TITLE", "Journal Title", "journal_title"], index),
      title20: text(row, ["title20", "Title20", "TITLE20", "Title 20"], index),
      title29: text(row, ["title29", "Title29", "TITLE29", "Title 29"], index),
      issn: text(row, ["issn", "ISSN", "Issn", "Print ISSN"], index),
      eissn: text(row, ["eissn", "eISSN", "EISSN", "Online ISSN"], index),
      category: text(row, ["category", "Category", "CATEGORY", "subject", "Subject", "discipline", "Discipline"], index),
    };
    if (!/[\p{L}\p{N}]/u.test(entry.category) || !(entry.title || entry.title20 || entry.title29 || extractISSNs(`${entry.issn};${entry.eissn}`).length))
      throw new JournalDatasetError(`Record ${index + 1}: requires category and title or ISSN`, "esi-required", index + 1);
    for (const value of [entry.issn, entry.eissn]) {
      if (value && value !== "****-****" && !extractISSNs(value).length)
        throw new JournalDatasetError(`Record ${index + 1}: invalid ISSN format`, "issn", index + 1);
    }
    return entry;
  });
}

function list(value: unknown, index: number, key: string): string[] {
  if (value === undefined || value === null || value === "")
    return [];
  const values = typeof value === "string" ? value.split(/[;|]/) : value;
  if (!Array.isArray(values) || values.some(entry => typeof entry !== "string"))
    throw new JournalDatasetError(`Record ${index + 1}: ${key} must be text or an array of text`, "list", index + 1, key);
  return [...new Set(values.map(entry => entry.trim()).filter(Boolean))];
}

export function parseNatureDataset(data: unknown): NatureIndexEntry[] {
  const entries = records(data, "venues").map((value, index): NatureIndexEntry => {
    const row = record(value, index);
    const type = text(row, ["type", "Type"], index).toLowerCase() || "journal";
    if (type !== "journal" && type !== "conference")
      throw new JournalDatasetError(`Record ${index + 1}: type must be journal or conference`, "type", index + 1);
    const title = text(row, ["title", "Title", "publicationTitle"], index);
    const aliases = list(row.aliases ?? row.abbreviation, index, "aliases");
    const issn = list(row.issn ?? row.ISSN, index, "issn");
    const eissn = list(row.eissn ?? row.eISSN, index, "eissn");
    if ([...issn, ...eissn].some(value => !extractISSNs(value).length))
      throw new JournalDatasetError(`Record ${index + 1}: invalid ISSN format`, "issn", index + 1);
    if (!(title || [...issn, ...eissn].some(value => extractISSNs(value).length)))
      throw new JournalDatasetError(`Record ${index + 1}: requires title or ISSN`, "nature-required", index + 1);
    return { title, type, aliases, issn: [...new Set([...issn, ...eissn])] };
  });
  if (!entries.some(entry => entry.type === "journal"))
    throw new JournalDatasetError("Expected at least one journal (conference-only lists are not supported)", "journals");
  return entries;
}
