import { DataLoader } from "./data-loader";
import { convertToRegex } from "./str";

export function validateTitleTerms(rows: unknown[]): { search: string; replace: string }[] {
  return rows.map((value, index) => {
    const row = value as { search?: unknown; replace?: unknown } | null;
    if (!row || typeof row.search !== "string" || !row.search.trim() || typeof row.replace !== "string")
      throw new TypeError(`Invalid title term at row ${index + 1}: expected a search term and a text replacement`);
    convertToRegex(row.search);
    return { search: row.search, replace: row.replace };
  });
}

export async function loadTitleTerms(path: string) {
  if (!/\.csv$/i.test(path))
    throw new TypeError("Expected a CSV title terms file");
  return validateTitleTerms(await DataLoader.load("csv", path, { headers: ["search", "replace"] }));
}
