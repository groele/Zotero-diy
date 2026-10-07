import type { ESILookupMaps } from "../../utils/esi";
import { formatESICategories, matchESICategories } from "../../utils/esi";
import { loadJournalInsights } from "../../utils/journal-insights";
import { getString } from "../../utils/locale";
import { getPref } from "../../utils/prefs";
import { defineRule } from "./rule-base";

interface Options {
  format: string;
  maps?: ESILookupMaps;
  customDataError?: string;
}

async function prepare({ items }: { items: Zotero.Item[] }): Promise<Options> {
  const options: Options = {
    format: getPref("insights.esiFormat") || "{subject}ESI",
  };
  if (!items.some(item => item.itemType === "journalArticle"))
    return options;
  const data = await loadJournalInsights();
  if (data.esiError)
    throw new Error(data.esiError);
  options.maps = data.esi;
  options.customDataError = data.customFallback;
  return options;
}

export const ToolQueryESI = defineRule<Options>({
  id: "tool-query-esi",
  scope: "item",
  category: "tool",
  targetItemTypes: ["journalArticle"],
  apply({ item, options, debug, report }) {
    const publicationTitle = (item.getField("publicationTitle") as string) || "";
    const journalAbbreviation = (item.getField("journalAbbreviation") as string) || "";
    const issnField = (item.getField("ISSN") as string) || "";

    if (!publicationTitle && !journalAbbreviation && !issnField)
      return;

    const maps = options.maps!;
    if (options.customDataError)
      report({ level: "warning", message: getString("rule-tool-query-esi-custom-data-error", { args: { error: options.customDataError } }) });
    const categories = matchESICategories({
      publicationTitle,
      journalAbbreviation,
      issn: issnField,
      maps,
    });

    if (!categories || categories.length === 0) {
      debug(`No ESI discipline found for publicationTitle="${publicationTitle}", ISSN="${issnField}"`);
      return;
    }

    const formatted = formatESICategories(categories, options.format);
    debug(`ESI insight: ${formatted}; reference fields remain unchanged`);
  },
  prepare,
});
