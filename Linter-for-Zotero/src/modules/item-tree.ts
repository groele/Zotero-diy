import { cachedJournalInsights } from "../utils/journal-insights";
import { getString } from "../utils/locale";

const registeredColumns: string[] = [];

export function registerExtraColumns() {
  if (registeredColumns.length)
    return;
  const abbreviationColumn = Zotero.ItemTreeManager.registerColumn({
    dataKey: "abbr",
    label: getString("field-abbr"),
    dataProvider: (item, _dataKey) => {
      if (!addon?.data?.alive || !ztoolkit?.ExtraField)
        return "";
      if (item.itemType === "journalArticle")
        return item.getField("journalAbbreviation");
      else if (item.itemType === "thesis")
        return item.getField("university");
      else if (item.itemType === "patent")
        return item.getField("country");
      else if (item.itemType === "conferencePaper")
        return ztoolkit.ExtraField.getExtraField(item, "shortConferenceName") || "";
      else
        return ztoolkit.ExtraField.getExtraField(item, "abbr") || "";
    },
    pluginID: addon.data.config.addonID,
    zoteroPersist: ["width", "hidden", "sortDirection"],
  });
  if (abbreviationColumn)
    registeredColumns.push(abbreviationColumn);
  const esiColumn = Zotero.ItemTreeManager.registerColumn({
    dataKey: "esiDiscipline",
    label: getString("field-esi"),
    dataProvider: item => addon.data.alive && item.itemType === "journalArticle" ? cachedJournalInsights(item)?.esi || "" : "",
    pluginID: addon.data.config.addonID,
    zoteroPersist: ["width", "hidden", "sortDirection"],
  });
  if (esiColumn)
    registeredColumns.push(esiColumn);

  const natureIndexColumn = Zotero.ItemTreeManager.registerColumn({
    dataKey: "natureIndex",
    label: getString("field-nature-index"),
    dataProvider: (item) => {
      if (!addon?.data?.alive || item.itemType !== "journalArticle")
        return "";
      return cachedJournalInsights(item)?.natureIndex ? "✓" : "";
    },
    pluginID: addon.data.config.addonID,
    zoteroPersist: ["width", "hidden", "sortDirection"],
  });
  if (natureIndexColumn)
    registeredColumns.push(natureIndexColumn);
}

export function unregisterExtraColumns() {
  registeredColumns.splice(0).forEach(id => Zotero.ItemTreeManager.unregisterColumn(id));
}
