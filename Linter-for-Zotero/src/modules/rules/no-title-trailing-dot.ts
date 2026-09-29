import { defineRule } from "./rule-base";

/**
 * Replaces dot in title end
 * @see https://github.com/northword/zotero-format-metadata/issues/213
 */
export const NoTitleTrailingDot = defineRule({
  id: "no-title-trailing-dot",
  scope: "field",
  targetItemField: "title",
  async apply({ item }) {
    const title = item.getField("title", false, true);
    if (!title)
      return;
    const newTitle = removeTrailingDot(title);
    if (newTitle !== title)
      item.setField("title", newTitle);
  },
});

export function removeTrailingDot(input: string): string {
  if (!input || /\.{2,}$/.test(input) || input.endsWith("…"))
    return input;
  return input.replace(/\.$/, "");
}
