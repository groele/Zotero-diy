import { getString } from "../utils/locale";

let registeredColumn: string | false = false;

export function registerExtraColumns() {
  if (registeredColumn)
    return;
  registeredColumn = Zotero.ItemTreeManager.registerColumn({
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
}

export function unregisterExtraColumns() {
  if (registeredColumn)
    Zotero.ItemTreeManager.unregisterColumn(registeredColumn);
  registeredColumn = false;
}
