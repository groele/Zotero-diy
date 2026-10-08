import { getUsedItemFields } from "../../utils/zotero";
import { defineRule } from "./rule-base";

const NULLISH_VALUES = new Set([
  "null",
  "undefined",
  "nan",
  "n/a",
  "n.a.",
  "n/d",
  "n.d.",
  "no value",
  "none",
]);

export const NoValueNullish = defineRule({
  id: "no-value-nullish",
  scope: "item",
  apply({ item }) {
    const fields = getUsedItemFields(item);

    for (const field of fields) {
      const value = item.getField(field);
      if (typeof value !== "string" || !value)
        continue;

      const trimmed = value.trim();
      const lower = trimmed.toLowerCase();

      // Protect short legitimate titles such as "无"
      if (field === "title" && trimmed === "无")
        continue;

      if (NULLISH_VALUES.has(lower) || trimmed === "无") {
        item.setField(field, "");
      }
    }
  },
});
