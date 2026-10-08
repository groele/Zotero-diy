import { getString } from "../../utils/locale";
import { defineRule } from "./rule-base";
import { extractIdentifiers, isPreprint } from "./tool-update-metadata/identifiers";

export const NoJournalPreprint = defineRule({
  id: "no-journal-preprint",
  scope: "item",
  targetItemTypes: ["journalArticle"],
  apply({ item, report }) {
    const identifiers = extractIdentifiers(item);
    if (isPreprint(item, identifiers)) {
      report({
        level: "warning",
        message: getString("rule-no-journal-preprint-report-message"),
        action: {
          label: getString("rule-no-journal-preprint-report-action"),
          callback: () => {
            const currentItem = Zotero.Items.get(item.id);
            if (currentItem && !currentItem.deleted)
              return addon.hooks.onLintInBatch(["tool-update-metadata"], [currentItem]);
          },
        },
      });
    }
  },
});
