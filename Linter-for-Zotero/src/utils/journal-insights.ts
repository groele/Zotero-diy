import type { ESILookupMaps } from "./esi";
import type { NatureIndexLookupMaps } from "./nature-index";
import { DataLoader } from "./data-loader";
import { formatESICategories, matchESICategories } from "./esi";
import { journalDatabaseErrorMessage } from "./journal-database-error";
import { isNatureIndexJournal } from "./nature-index";
import { getPref } from "./prefs";

interface IndexData {
  path: string;
  naturePath: string;
  esi?: ESILookupMaps;
  nature?: NatureIndexLookupMaps;
  esiError?: string;
  natureError?: string;
  customFallback?: string;
  natureFallback?: string;
}
export interface JournalInsights {
  categories: string[];
  esi: string;
  natureIndex: boolean | undefined;
  esiSource: "custom" | "builtin";
  natureSource: "custom" | "builtin";
  esiError?: string;
  natureError?: string;
  customFallback?: string;
  natureFallback?: string;
  esiBasis?: "ISSN" | "publicationTitle" | "journalAbbreviation";
  natureBasis?: "ISSN" | "publicationTitle" | "journalAbbreviation";
}
let currentPath: string | undefined;
let pending: Promise<IndexData> | undefined;
let loaded: IndexData | undefined;
let generation: object | undefined;
const message = journalDatabaseErrorMessage;
const paths = () => [getPref("insights.esiCustomDataPath") || "", getPref("insights.natureCustomDataPath") || ""] as const;

export function clearJournalInsights() {
  DataLoader.clearCache();
  currentPath = undefined;
  pending = undefined;
  loaded = undefined;
  generation = undefined;
}

export function loadJournalInsights(): Promise<IndexData> {
  const [path, naturePath] = paths();
  const key = JSON.stringify([path, naturePath]);
  if (pending && currentPath === key)
    return pending;
  currentPath = key;
  loaded = undefined;
  const token = {};
  generation = token;
  const task: Promise<IndexData> = (async () => {
    const data: IndexData = { path, naturePath };
    await Promise.all([
      (async () => {
        try {
          data.esi = await DataLoader.getESIJournalMaps(path);
        }
        catch (error) {
          if (path) {
            data.customFallback = message(error);
            try {
              data.esi = await DataLoader.getESIJournalMaps();
            }
            catch (fallbackError) { data.esiError = message(fallbackError); }
          }
          else {
            data.esiError = message(error);
          }
        }
      })(),
      (async () => {
        try {
          data.nature = await DataLoader.getNatureIndexJournalMaps(naturePath);
        }
        catch (error) {
          if (naturePath) {
            data.natureFallback = message(error);
            try {
              data.nature = await DataLoader.getNatureIndexJournalMaps();
            }
            catch (fallbackError) { data.natureError = message(fallbackError); }
          }
          else { data.natureError = message(error); }
        }
      })(),
    ]);
    if (generation === token)
      loaded = data;
    return data;
  })();
  pending = task;
  return task;
}

export function cachedJournalInsights(item: Zotero.Item): JournalInsights | undefined {
  if (currentPath !== JSON.stringify(paths()) || !loaded)
    return undefined;
  return calculate(item, loaded);
}
export async function getJournalInsights(item: Zotero.Item): Promise<JournalInsights> {
  return calculate(item, await loadJournalInsights());
}
function calculate(item: Zotero.Item, data: IndexData): JournalInsights {
  const result: JournalInsights = {
    categories: [],
    esi: "",
    natureIndex: data.nature ? false : undefined,
    esiSource: data.path && !data.customFallback ? "custom" : "builtin",
    natureSource: data.naturePath && !data.natureFallback ? "custom" : "builtin",
    esiError: data.esiError,
    natureError: data.natureError,
    customFallback: data.customFallback,
    natureFallback: data.natureFallback,
  };
  if (item.itemType !== "journalArticle")
    return result;
  const fields = [
    ["ISSN", "issn"],
    ["publicationTitle", "publicationTitle"],
    ["journalAbbreviation", "journalAbbreviation"],
  ] as const;
  for (const [field, key] of fields) {
    const value = item.getField(field) as string;
    if (!value)
      continue;
    if (data.esi && !result.categories.length) {
      const categories = matchESICategories({ [key]: value, maps: data.esi });
      if (categories?.length) {
        result.categories = [...categories];
        result.esiBasis = field;
      }
    }
    if (data.nature && !result.natureIndex && isNatureIndexJournal({ [key]: value, maps: data.nature })) {
      result.natureIndex = true;
      result.natureBasis = field;
    }
  }
  result.esi = formatESICategories(result.categories, getPref("insights.esiFormat") || "{subject}ESI");
  return result;
}
