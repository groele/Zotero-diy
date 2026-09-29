import type { Data } from "../../utils/data-loader";
import { DataLoader } from "../../utils/data-loader";
import { getString } from "../../utils/locale";
import { getPref } from "../../utils/prefs";
import { getTextLanguage, normalizeKey } from "../../utils/str";
import { defineRule } from "./rule-base";

interface Options {
  customDataPath: string;
  infer: boolean;
  usefull: boolean;
  usefullZh: boolean;
  customAbbr?: Map<string, string>;
  customDataError?: string;
}

async function prepare(): Promise<Options> {
  const options: Options = {
    customDataPath: getPref("rule.require-journal-abbr.customDataPath"),
    infer: getPref("rule.require-journal-abbr.infer"),
    usefull: getPref("rule.require-journal-abbr.usefull"),
    usefullZh: getPref("rule.require-journal-abbr.usefullZh"),
  };
  if (options.customDataPath) {
    try {
      options.customAbbr = await loadCustomAbbreviations(options.customDataPath);
    }
    catch (error) {
      options.customDataError = error instanceof Error ? error.message : String(error);
    }
  }
  return options;
}

export const RequireJournalAbbr = defineRule<Options>({
  id: "require-journal-abbr",
  scope: "field",
  targetItemTypes: ["journalArticle"],
  targetItemField: "journalAbbreviation",
  async apply({ item, options, debug, report }) {
    const publicationTitle = item.getField("publicationTitle") as string;

    // 无期刊全称直接跳过
    if (publicationTitle === "")
      return;

    let journalAbbr: string | undefined;

    // 从自定义数据集获取
    journalAbbr = options.customAbbr?.get(normalizeKey(publicationTitle));
    if (options.customDataError)
      report({ level: "warning", message: getString("rule-require-journal-abbr-custom-data-error", { args: { error: options.customDataError } }) });

    // 从本地数据集获取缩写
    if (!journalAbbr) {
      const { abbrMap } = await DataLoader.getJournalAbbrMaps();
      journalAbbr = abbrMap.get(normalizeKey(publicationTitle));
    }

    // 从 ISSN LTWA 推断完整期刊缩写
    if (!journalAbbr && options.infer) {
      debug("try to infer abbreviation via abbreviso");
      journalAbbr = await getAbbrFromLTWAOnline(publicationTitle);
    // journalAbbr = await this.getAbbrFromLTWALocally(publicationTitle);
    }

    // 以期刊全称填充
    if (!journalAbbr) {
      debug("try to fill the abbreviation with its full name");
      // 获取条目语言，若无则根据期刊全称判断语言
      const itemLanguage = (item.getField("language") as string) || getTextLanguage(publicationTitle);
      const isChinese = ["zh", "zh-CN"].includes(itemLanguage);
      if (isChinese && options.usefullZh) {
      // 中文，无缩写的，是否以全称替代
        debug(`[Abbr] The abbr. of ${publicationTitle} is replaced by its full name`);
        journalAbbr = publicationTitle;
      }
      else if (!isChinese && options.usefull) {
      // 非中文，无缩写的，是否以全称替代
        debug(`[Abbr] The abbr. of ${publicationTitle} is replaced by its full name`);
        journalAbbr = publicationTitle;
      }
    }

    // 无缩写且不以全称替代，返回空值
    if (!journalAbbr)
      return;

    const currentAbbr = item.getField("journalAbbreviation") as string;
    if (currentAbbr !== journalAbbr) {
      item.setField("journalAbbreviation", journalAbbr);
    }
  },

  prepare,

  fieldMenu: {
    l10nID: "rule-require-journal-abbr-menu-field",
  },
});

export const CorrectConferenceAbbr = defineRule<Options>({
  id: "correct-conference-abbr",
  nameKey: "abbr-conference",
  scope: "field",
  targetItemTypes: ["conferencePaper"],
  targetItemField: "conferenceName",
  fieldMenu: {
    l10nID: "rule-require-journal-abbr-menu-field",
  },
  async apply({ item, options, report }) {
    const conferenceNames = [
      item.getField("conferenceName") as string,
      item.getField("proceedingsTitle") as string,
    ].filter(Boolean);

    // 无全称直接跳过
    if (conferenceNames.length === 0)
      return;
    if (options.customDataError)
      report({ level: "warning", message: getString("rule-require-journal-abbr-custom-data-error", { args: { error: options.customDataError } }) });

    let shortConferenceName: string | undefined;

    for (const conferenceName of conferenceNames) {
      // 先精确匹配，再移除会议届次序数（如 32nd）后匹配
      const conferenceNameWithoutOrdinal = conferenceName.replace(/\b\d+(?:st|nd|rd|th)\b/gi, "");
      const conferenceNameVariants = conferenceNameWithoutOrdinal === conferenceName
        ? [conferenceName]
        : [conferenceName, conferenceNameWithoutOrdinal];

      for (const conferenceNameVariant of conferenceNameVariants) {
        // 从自定义数据集获取
        shortConferenceName = options.customAbbr?.get(normalizeKey(conferenceNameVariant));

        // 从本地数据集获取缩写
        if (!shortConferenceName) {
          const confMap = await DataLoader.getConferenceAbbrMap();
          shortConferenceName = confMap.get(normalizeKey(conferenceNameVariant));
        }

        if (shortConferenceName)
          break;
      }

      if (shortConferenceName)
        break;
    }

    if (!shortConferenceName)
      return;

    const currentShortConf = ztoolkit.ExtraField.getExtraField(item, "shortConferenceName");
    if (currentShortConf !== shortConferenceName) {
      await ztoolkit.ExtraField.setExtraField(item, "shortConferenceName", shortConferenceName, { save: false });
    }
  },

  prepare,

});

async function _getAbbrLocally(publicationTitle: string, data: Data): Promise<string | undefined> {
  const normalizedPublicationTitle = normalizeKey(publicationTitle);

  for (const term in data) {
    if (normalizedPublicationTitle === normalizeKey(term) && data[term]) {
      return data[term];
    }
  }

  return undefined;
}

/**
 *
 * Get abbreviation from abbreviso API.
 * This API infer journal abbreviation from ISSN List of Title Word Abbreviations.
 * Until March 31, 2023, this API uses the LTWA released in 2017.
 * @param publicationTitle
 * @returns
 * - String of `ISO 4 with dot abbr` when API returns a valid response
 * - `undefined` when API returns an invalid response
 */
async function getAbbrFromLTWAOnline(publicationTitle: string): Promise<string | undefined> {
  publicationTitle = encodeURIComponent(publicationTitle);
  const url = `https://abbreviso.toolforge.org/abbreviso/a/${publicationTitle}`;
  const res = await Zotero.HTTP.request("GET", url, { timeout: 15_000 });
  const result = res.response as string;
  if (result === "" || result === null || result === undefined) {
    return undefined;
  }
  return result;
}

async function _getAbbrFromLTWALocally(publicationTitle: string): Promise<string | undefined> {
  const shortwords = await Zotero.File.getContentsAsync(`${rootURI}/lib/abbreviso/shortwords.txt`);
  const ltwa = await Zotero.File.getContentsAsync(`${rootURI}/lib/abbreviso/LTWA_20210702-modified.csv`);
  Services.scriptloader.loadSubScript(`${rootURI}/lib/abbreviso/browserBundle.js`);
  // @ts-expect-error AbbrevIso 来自引入的脚本
  const abbrevIso = new AbbrevIso.AbbrevIso(ltwa, shortwords);
  const abbr = abbrevIso.makeAbbreviation(publicationTitle);
  return abbr;
}

export async function loadCustomAbbreviations(path: string): Promise<Map<string, string>> {
  let rows: [unknown, unknown][];
  if (/\.json$/i.test(path)) {
    const data = await DataLoader.load("json", path);
    if (!data || Array.isArray(data) || typeof data !== "object")
      throw new TypeError("Expected a JSON object mapping titles to abbreviations");
    rows = Object.entries(data);
  }
  else if (/\.csv$/i.test(path)) {
    const data = await DataLoader.load("csv", path, { headers: ["publicationTitle", "abbr"] });
    rows = data.map(row => [row.publicationTitle, row.abbr]);
  }
  else {
    throw new TypeError("Expected a CSV or JSON abbreviation file");
  }
  const map = new Map<string, string>();
  for (const [title, abbr] of rows) {
    if (typeof title !== "string" || typeof abbr !== "string")
      throw new TypeError("Each abbreviation row must contain a title and a text abbreviation");
    if (title.trim() && abbr.trim())
      map.set(normalizeKey(title), abbr.trim());
  }
  return map;
}
