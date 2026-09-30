import type { NatureIndexLookupMaps } from "../../utils/nature-index";
import { DataLoader } from "../../utils/data-loader";
import { isNatureIndexJournal, NATURE_INDEX_TAG } from "../../utils/nature-index";
import { defineRule } from "./rule-base";

interface Options {
  maps?: NatureIndexLookupMaps;
}

export const ToolMarkNatureIndex = defineRule<Options>({
  id: "tool-mark-nature-index",
  scope: "item",
  category: "tool",
  targetItemTypes: ["journalArticle"],

  async prepare({ items }) {
    if (!items.some(item => item.itemType === "journalArticle"))
      return false;
    return { maps: await DataLoader.getNatureIndexJournalMaps() };
  },

  apply({ item, options, debug }) {
    const matched = isNatureIndexJournal({
      publicationTitle: item.getField("publicationTitle") as string,
      journalAbbreviation: item.getField("journalAbbreviation") as string,
      issn: item.getField("ISSN") as string,
      maps: options.maps!,
    });

    if (matched && !item.hasTag(NATURE_INDEX_TAG)) {
      item.addTag(NATURE_INDEX_TAG);
      debug(`Added ${NATURE_INDEX_TAG} tag to item ${item.id}`);
    }
  },
});
