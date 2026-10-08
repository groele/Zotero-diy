import type { ESILookupMaps } from "../../utils/esi";
import { DataLoader } from "../../utils/data-loader";
import { formatESICategories, matchESICategories } from "../../utils/esi";
import { getString } from "../../utils/locale";
import { upsertMetadataMarker } from "../../utils/metadata-marker";
import { getPref } from "../../utils/prefs";
import { isFieldValidForItemType } from "../../utils/zotero";
import { defineRule } from "./rule-base";

interface Options {
  format: string;
  customDataPath: string;
  overwrite: boolean;
  maps?: ESILookupMaps;
  customDataError?: string;
}

async function prepare({ items }: { items: Zotero.Item[] }): Promise<Options> {
  const options: Options = {
    format: getPref("rule.require-series-esi.format") || "{subject}ESI",
    customDataPath: getPref("rule.require-series-esi.customDataPath") || "",
    overwrite: getPref("rule.require-series-esi.overwrite"),
  };
  if (!items.some(item => item.itemType === "journalArticle"))
    return options;
  if (options.customDataPath) {
    try {
      options.maps = await DataLoader.getESIJournalMaps(options.customDataPath);
    }
    catch (error) {
      options.customDataError = error instanceof Error ? error.message : String(error);
    }
  }
  options.maps ??= await DataLoader.getESIJournalMaps();
  return options;
}

export const RequireSeriesESI = defineRule<Options>({
  id: "require-series-esi",
  scope: "field",
  targetItemTypes: ["journalArticle"],
  targetItemField: "series",
  fieldMenu: {
    l10nID: "rule-require-series-esi-menu-field",
  },
  async apply({ item, options, debug, report }) {
    const publicationTitle = (item.getField("publicationTitle") as string) || "";
    const journalAbbreviation = (item.getField("journalAbbreviation") as string) || "";
    const issnField = (item.getField("ISSN") as string) || "";

    if (!publicationTitle && !journalAbbreviation && !issnField)
      return;

    const maps = options.maps ?? await DataLoader.getESIJournalMaps(options.customDataPath);
    if (options.customDataError)
      report({ level: "warning", message: getString("rule-require-series-esi-custom-data-error", { args: { error: options.customDataError } }) });
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
    const currentSeries = (item.getField("series") as string) || "";
    if (currentSeries && currentSeries !== formatted && !options.overwrite && !/ESI/i.test(currentSeries)) {
      report({ level: "warning", message: getString("rule-require-series-esi-preserved") });
    }
    else if (currentSeries !== formatted) {
      debug(`Updating series from "${currentSeries}" to "${formatted}"`);
      item.setField("series", formatted);
    }

    if (isFieldValidForItemType("archive", item.itemType)) {
      const currentArchive = (item.getField("archive") as string) || "";
      const nextArchive = upsertMetadataMarker(currentArchive, formatted, value => /\bESI\b/i.test(value));
      if (currentArchive !== nextArchive) {
        item.setField("archive", nextArchive);
        debug(`Updated ESI marker in archive field to "${nextArchive}"`);
      }
    }
  },
  prepare,
});
