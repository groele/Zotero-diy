import { defineRule } from "./rule-base";

export const CorrectPagesRange = defineRule({
  id: "correct-pages-range",
  scope: "field",
  targetItemTypes: ["journalArticle"],
  targetItemField: "pages",
  async apply({ item, debug }) {
    const pages = item.getField("pages").trim();

    if (!shouldApply(pages)) {
      debug(`Skip process pages ${pages}, it may be alrady a range, or a paper id`);
      return;
    }

    const numberOfPages = await getPDFPages(item);
    if (!numberOfPages) {
      debug(`Can not get number of pages from PDF`);
      return;
    }

    const newPages = generateRange(pages, numberOfPages);
    if (newPages && newPages !== pages)
      item.setField("pages", newPages);
  },
});

export function shouldApply(pages: string) {
  return /^\d{1,3}$/.test(pages) && Number(pages) > 0;
}

async function getPDFPages(item: Zotero.Item): Promise<number | void> {
  const attachment = await item.getBestAttachment();
  if (!attachment)
    return;

  if (attachment.attachmentContentType !== "application/pdf")
    return;

  const pages = await Zotero.Fulltext.getPages(attachment.id);
  if (!pages || !Number.isSafeInteger(pages.total) || pages.total <= 0)
    return;

  return pages.total;
}

export function generateRange(first: string, total: number): string {
  if (Number(first))
    return `${Number(first)}-${Number(first) + total - 1}`;
  else
    return `${1}-${total}`;
}
