import type { NatureIndexLookupMaps } from "../../utils/nature-index";
import { loadJournalInsights } from "../../utils/journal-insights";
import { getString } from "../../utils/locale";
import { isNatureIndexJournal } from "../../utils/nature-index";
import { defineRule } from "./rule-base";

interface Options {
  maps?: NatureIndexLookupMaps;
  customDataError?: string;
}

export const ToolQueryNatureIndex = defineRule<Options>({
  id: "tool-query-nature-index",
  scope: "item",
  category: "tool",
  targetItemTypes: ["journalArticle"],
  getItemMenu: () => ({
    l10nID: "tool-query-nature-index-menu-item",
  }),

  async prepare({ items }) {
    if (!items.some(item => item.itemType === "journalArticle"))
      return false;
    const data = await loadJournalInsights();
    if (data.natureError)
      throw new Error(data.natureError);
    return { maps: data.nature, customDataError: data.natureFallback };
  },

  apply({ item, options, debug, report }) {
    if (options.customDataError)
      report({ level: "warning", message: getString("journal-database-fallback", { args: { error: options.customDataError } }) });
    const matched = isNatureIndexJournal({
      publicationTitle: item.getField("publicationTitle") as string,
      journalAbbreviation: item.getField("journalAbbreviation") as string,
      issn: item.getField("ISSN") as string,
      maps: options.maps!,
    });

    debug(`Nature Index journal membership: ${matched}; reference fields and tags remain unchanged`);
  },
});
