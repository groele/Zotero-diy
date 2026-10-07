import { getString } from "../../utils/locale";
import { defineRule } from "./rule-base";

// 当条目为 webpage，且 url 为各期刊出版社时，警告

const publisherUrlKeyWords = [
  "acm.org",
  "acs.org",
  "aiaa.org",
  "aip.org",
  "ams.org",
  "annualreviews.org",
  "aps.org",
  "ascelibrary.org",
  "asm.org",
  "asme.org",
  "astm.org",
  "blackwell-synergy.com",
  "bmj.com",
  "cabdirect.org",
  "cambridge.org",
  "cas.org",
  "cell.com",
  "clarivate.com",
  "cnki.net",
  "cqvip.com",
  "crossref.org",
  "csiro.au",
  "deepdyve.com",
  "doi.org",
  "ebscohost.com",
  "els-cdn.com",
  "elsevier.com",
  "emerald.com",
  "endnote.com",
  "engineeringvillage.com",
  "icevirtuallibrary.com",
  "ieee.org",
  "imf.org",
  "iop.org",
  "jamanetwork.com",
  "jbc.org",
  "jhu.edu",
  "jstor.org",
  "karger.com",
  "libguides.com",
  "madsrevolution.net",
  "mdpi.com",
  "mpg.de",
  "myilibrary.com",
  "nature.com",
  "ncbi.nlm.nih.gov",
  "oecd-ilibrary.org",
  "osapublishing.org",
  "oup.com",
  "ovid.com",
  "oxfordartonline.com",
  "oxfordbibliographies.com",
  "oxfordmusiconline.com",
  "pkulaw.com",
  "pnas.org",
  "proquest.com",
  "readcube.com",
  "researchgate.net",
  "rsc.org",
  "sagepub.com",
  "sci-hub",
  "science.org",
  "sciencedirect.com",
  "sciencemag.org",
  "scitation.org",
  "scopus.com",
  "semanticscholar.org",
  "siam.org",
  "spiedigitallibrary.org",
  "springer.com",
  "springerlink.com",
  "tandfonline.com",
  "un.org",
  "uni-bielefeld.de",
  "wanfangdata.com",
  "webofknowledge.com",
  "westlaw.com",
  "westlawchina.com",
  "wiley.com",
  "worldbank.org",
  "worldscientific.com",
  "zotero.org",
];

export const NoArticleWebPage = defineRule({
  id: "no-article-webpage",
  scope: "item",
  targetItemTypes: ["webpage"],

  apply({ item, report }) {
    const url = item.getField("url");
    if (url === "")
      return;

    if (isPublisherURL(url)) {
      report({
        level: "error",
        message: getString("rule-no-article-webpage-report-message"),
        action: {
          label: getString("rule-no-article-webpage-report-action"),
          callback: () => {
            const currentItem = Zotero.Items.get(item.id);
            if (currentItem && !currentItem.deleted)
              return addon.hooks.onLintInBatch(["tool-update-metadata", "standard"], [currentItem]);
          },
        },
      });
    }
  },
});

export function isPublisherURL(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  }
  catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return publisherUrlKeyWords.some(domain => domain === "sci-hub"
    ? /(?:^|\.)sci-hub\.[a-z.]+$/.test(host)
    : host === domain || host.endsWith(`.${domain}`));
}
