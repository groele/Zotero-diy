import { defineRule } from "./rule-base";

export function removeLeadingZeros(input: string): string {
  return input
    .replace(/\b0+(\d+)/g, "$1")
    .replace("0-", "1-");
}

type Field = "pages" | "issue" | "volume";

function createRule(targetItemField: Field) {
  return defineRule({
    id: `no-${targetItemField}-extra-zeros`,
    scope: "field",
    targetItemTypes: ["journalArticle"],
    targetItemField,
    apply: ({ item }) => {
      const fieldValue = item.getField(targetItemField);
      if (!fieldValue)
        return;
      const newFieldValue = removeLeadingZeros(String(fieldValue));
      if (newFieldValue !== String(fieldValue)) {
        item.setField(targetItemField, newFieldValue);
      }
    },
  });
}

export const NoPagesExtraZeros = createRule("pages");
export const NoIssueExtraZeros = createRule("issue");
export const NoVolumeExtraZeros = createRule("volume");
