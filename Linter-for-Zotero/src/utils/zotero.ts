export function isRegularItem() {
  const items = Zotero.getActiveZoteroPane()?.getSelectedItems() ?? [];
  const isRegularItem = items.some(item => item.isRegularItem());
  return isRegularItem;
}

export function isFieldValidForItemType(field: _ZoteroTypes.Item.ItemField, itemTypeID: number): boolean;
export function isFieldValidForItemType(field: _ZoteroTypes.Item.ItemField, itemType: _ZoteroTypes.Item.ItemType): boolean;
export function isFieldValidForItemType(field: _ZoteroTypes.Item.ItemField, itemType: _ZoteroTypes.Item.ItemType | number) {
  return Zotero.ItemFields.isValidForType(
    Zotero.ItemFields.getID(field),
    typeof itemType === "number" ? itemType : Zotero.ItemTypes.getID(itemType),
  );
}

export function getUsedItemFields(item: Zotero.Item): _ZoteroTypes.Item.ItemField[] {
  return item.getUsedFields().map(Zotero.ItemFields.getName);
}

/**
 * Resolves the actual valid field name for an item when baseField or mappedField is used
 */
export function getActualField(item: Zotero.Item, baseField: _ZoteroTypes.Item.ItemField): _ZoteroTypes.Item.ItemField | undefined {
  if (isFieldValidForItemType(baseField, item.itemType)) {
    return baseField;
  }
  const mapped = (Zotero.ItemFields.getTypeFieldsFromBase(baseField, true) as _ZoteroTypes.Item.ItemField[])
    ?.find(f => isFieldValidForItemType(f, item.itemType));
  return mapped;
}
