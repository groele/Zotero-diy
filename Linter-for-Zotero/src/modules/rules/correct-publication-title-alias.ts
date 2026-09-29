import { DataLoader } from "../../utils/data-loader";
import { normalizeKey } from "../../utils/str";
import { defineRule } from "./rule-base";

export const CorrectPublicationTitleAlias = defineRule({
  id: "correct-publication-title-alias",
  scope: "field",

  targetItemTypes: ["journalArticle"],
  targetItemField: "publicationTitle",
  fieldMenu: {
    l10nID: "rule-correct-publication-title-alias-menu-field",
  },
  async apply({ item, debug }) {
    const publicationTitle = item.getField("publicationTitle", false, true) as string;
    if (!publicationTitle)
      return;

    const { titleMap } = await DataLoader.getJournalAbbrMaps();
    const publicationTitleDisambiguation = titleMap.get(normalizeKey(publicationTitle));
    if (publicationTitleDisambiguation && publicationTitleDisambiguation !== publicationTitle) {
      debug(`Found alias for ${publicationTitle} -> ${publicationTitleDisambiguation}`);
      item.setField("publicationTitle", publicationTitleDisambiguation);
    }
  },
});
