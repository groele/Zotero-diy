import type { NatureIndexLookupMaps } from "../../utils/nature-index";
import { DataLoader } from "../../utils/data-loader";
import { upsertMetadataMarker } from "../../utils/metadata-marker";
import { isNatureIndexJournal, NATURE_INDEX_TAG } from "../../utils/nature-index";
import { isFieldValidForItemType } from "../../utils/zotero";
import { defineRule } from "./rule-base";

interface Options {
  maps?: NatureIndexLookupMaps;
}

export const ToolMarkNatureIndex = defineRule<Options>({
  id: "tool-mark-nature-index",
  scope: "item",
  category: "tool",
  targetItemTypes: ["journalArticle"],
  getItemMenu: () => ({
    l10nID: "tool-mark-nature-index-menu-item",
  }),

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
    if (matched && isFieldValidForItemType("archiveLocation", item.itemType)) {
      const currentArchiveLocation = (item.getField("archiveLocation") as string) || "";
      const nextArchiveLocation = upsertMetadataMarker(currentArchiveLocation, NATURE_INDEX_TAG, value => value.toLowerCase() === NATURE_INDEX_TAG.toLowerCase());
      if (currentArchiveLocation !== nextArchiveLocation) {
        item.setField("archiveLocation", nextArchiveLocation);
        debug(`Updated Nature Index marker in archive location field to "${nextArchiveLocation}"`);
      }
    }
  },
});
