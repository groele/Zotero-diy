import { defineRule } from "./rule-base";

export const CorrectPagesConnector = defineRule({
  id: "correct-pages-connector",
  scope: "field",
  targetItemTypes: ["journalArticle"],
  targetItemField: "pages",
  apply({ item }) {
    const pages = item.getField("pages");
    if (!pages)
      return;
    const newPages = normizePages(pages);
    if (newPages !== pages) {
      item.setField("pages", newPages);
    }
  },

});

function normizePages(pages: string): string {
  return pages
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\uFF0D\u2212~]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\+/g, ", ");
}
