import { version as currentVersion } from "../../package.json";
import { logger } from "../utils/logger";
import { clearPref, getPref, setPref } from "../utils/prefs";

export async function checkCompat() {
  const version = (getPref("version")) ?? "0.0.0";

  if (compareVersion(version, currentVersion) >= 0) {
    setPref("version", currentVersion);
    return;
  }

  if (compareVersion(version, "1.8.0") === -1) {
    // 1.8.0 废弃期刊缩写类型
    clearPref("abbr.type");
    clearPref("enable");
  }

  if (compareVersion(version, "1.10.0") === -1) {
    // 1.10.0
    clearPref("richText.toolbarPosition.left");
    clearPref("richText.toolbarPosition.top");
  }

  if (compareVersion(version, "1.11.0") === -1) {
    mvPref("add.update", "lint.onAdded", true);
    mvPref("add.updateOnAddedForGroup", "lint.onGroup", true);
    mvPref("richtext.isEnableToolBar", "richtext.toolBar", true);
    mvPref("richtext.isEnableRichTextHotKey", "richtext.hotkey", true);
    mvPref("isEnableCheckDuplication", "noDuplicationItems", true);
    mvPref("isEnableCheckWebpage", "checkWebpage", true);
    mvPref("isEnableTitleCase", "titleSentenceCase", true);
    mvPref("isEnableCreators", "creatorsCase", true);
    mvPref("isEnableLang", "lang", true);
    mvPref("lang.only.enable", "lang.only", true);
    // mvPref("lang.only.cmn", "lang.only.zh", true)
    // mvPref("lang.only.eng", "lang.only.en", true)
    // mvPref("lang.only.other", "lang.only.other", "")
    mvPref("isEnableDateISO", "dateISO", true);
    mvPref("isEnablePublicationTitle", "publicationTitleCase", true);
    mvPref("isEnableAbbr", "abbr", true);
    // mvPref("abbr.customDataPath")
    mvPref("NoExtraZeros", "noExtraZeros", true);
    mvPref("isEnableDOI", "noDOIPrefix", true);
    mvPref("isEnablePlace", "universityPlace", true);
    mvPref("isEnableCleanFields", "cleanExtra", true);
    clearPref("richtext.isEnableChem");
    clearPref("lintAfterRetriveByDOI");
  }

  if (compareVersion(version, "1.20.2") === -1) {
    mvPref("abbr", "abbr.journalArticle", true);
  }

  // v2.0.0 refactor the rules id and preference key
  if (compareVersion(version, "2.0.0") === -1) {
    mvPref("noDuplicationItems", "rule.no-item-duplication");
    mvPref("checkWebpage", "rule.no-article-webpage");
    mvPref("noPreprintJournalArticle", "rule.no-journal-preprint");
    mvPref("titleDotEnd", "rule.no-title-trailing-dot");
    mvPref("noDOIPrefix", "rule.no-doi-prefix");
    mvPref("noExtraZeros", "rule.no-issue-extra-zeros", true, false);
    mvPref("noExtraZeros", "rule.no-pages-extra-zeros", true, false);
    mvPref("noExtraZeros", "rule.no-volume-extra-zeros", true);

    mvPref("lang", "rule.require-language");
    mvPref("lang.only", "rule.require-language.only");
    mvPref("lang.only.cmn", "rule.require-language.only.cmn");
    mvPref("lang.only.eng", "rule.require-language.only.eng");
    mvPref("lang.only.other", "rule.require-language.only.other", "");
    mvPref("titleSentenceCase", "rule.correct-title-sentence-case");
    mvPref("title.shortTitle", "rule.correct-shortTitle-sentence-case");
    mvPref("title.customTermPath", "rule.correct-title-sentence-case.custom-term-path");
    mvPref("abbr", "rule.require-journal-abbr");
    mvPref("abbr.journalArticle", "rule.require-journal-abbr");
    mvPref("abbr.infer", "rule.require-journal-abbr.infer");
    mvPref("abbr.usefull", "rule.require-journal-abbr.usefull");
    mvPref("abbr.usefullZh", "rule.require-journal-abbr.usefullZh");
    mvPref("abbr.customDataPath", "rule.require-journal-abbr.customDataPath");
    mvPref("universityPlace", "rule.require-university-place");

    mvPref("creatorsCase", "rule.correct-creators-case");
    mvPref("creatorsPinyin", "rule.correct-creators-pinyin");
    mvPref("dateISO", "rule.correct-date-format");
    mvPref("publicationTitleCase", "rule.correct-publication-title");
    mvPref("pagesConnector", "rule.correct-pages-connector");
    mvPref("abbr.conferencePaper", "rule.correct-conference-abbr");
    mvPref("thesisType", "rule.correct-thesis-type");
    mvPref("university", "rule.correct-university-punctuation");

    mvPref("title.guillement", "rule.tool-title-guillemet");
    mvPref("creatorsExt", "rule.tool-creators-ext");
    mvPref("lang.set", "rule.tool-set-language");
    mvPref("updateMetadate", "rule.tool-update-metadata");
    mvPref("updateMetadate.confirmWhenItemTypeChange", "rule.tool-update-metadata.confirm-when-item-type-change", false);
  }

  // v2.0.0-beta.4 rename rule id
  if (compareVersion(version, "2.0.0-beta.4") === -1) {
    clearPref("rule.no-nullish-value");
  }

  // v2.0.0-beta.16 split correct-publication-title to correct-publication-title-case and correct-publication-title-alias
  if (compareVersion(version, "2.0.0-beta.16") === -1) {
    // @ts-expect-error has been removed
    const old = getPref("rule.correct-publication-title") as boolean;
    if (old !== undefined) {
      setPref("rule.correct-publication-title-case", old);
      setPref("rule.correct-publication-title-alias", old);
    }
    clearPref("rule.correct-publication-title");
  }

  // v2.0.0-beta.22 refactors rule.tool-update-metadata, now we donot need this pref
  if (compareVersion(version, "2.0.0-beta.22") === -1) {
    clearPref("rule.tool-update-metadata.confirm-when-item-type-change");
  }

  // v2.2.0-2.2.2 incorrectly modified the type of `lint.numConcurrent`, we need to fix this type error in v2.2.3
  if (compareVersion(version, "2.2.3") === -1 && typeof getPref("lint.numConcurrent") !== "number") {
    logger.debug("[Pref] reset lint.numConcurrent to 1");
    clearPref("lint.numConcurrent");
    setPref("lint.numConcurrent", 1);
  }

  setPref("version", currentVersion);
}

export function mvPref(source: string, target: string, defaultValue?: boolean | string | number, removeSource = true) {
  // @ts-expect-error target and source may not exist in prefs.js
  const sourceValue = getPref(source) as string | boolean | number | undefined;
  // An absent legacy setting must not overwrite an already migrated value.
  // @ts-expect-error historical target keys may not be in prefs.js
  if (sourceValue === undefined && getPref(target) !== undefined)
    return;
  if (sourceValue === undefined && defaultValue === undefined)
    return;

  // @ts-expect-error target and source may not exist in prefs.js
  setPref(target, sourceValue ?? defaultValue);
  if (removeSource)
    clearPref(source);
}

/**
 * Compare two version strings
 * `versionA` < `versionB` => -1
 * `versionA` > `versionB` => 1
 * `versionA` === `versionB` => 0
 * @param versionA Version string
 * @param versionB Another version string
 * @returns -1|1|0
 * @see https://github.com/syt2/zotero-addons/blob/ba9e5fbf66b11a0fe790d5a116744ba3291245ee/src/utils/utils.ts
 */
export function compareVersion(versionA: string, versionB: string): 1 | -1 | 0 {
  const parse = (version: string) => {
    const [core, ...pre] = version.trim().toLowerCase().replace(/^v/, "").split("+")[0].split("-");
    return { core: core.split(".").map(Number), pre: pre.join("-").split(".").filter(Boolean) };
  };
  const a = parse(versionA);
  const b = parse(versionB);
  for (let i = 0; i < Math.max(a.core.length, b.core.length); i++) {
    const diff = (a.core[i] || 0) - (b.core[i] || 0);
    if (diff)
      return diff < 0 ? -1 : 1;
  }
  if (!a.pre.length || !b.pre.length)
    return a.pre.length === b.pre.length ? 0 : a.pre.length ? -1 : 1;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i];
    const y = b.pre[i];
    if (x === y)
      continue;
    if (x === undefined || y === undefined)
      return x === undefined ? -1 : 1;
    const numericX = /^\d+$/.test(x);
    const numericY = /^\d+$/.test(y);
    if (numericX && numericY)
      return Number(x) < Number(y) ? -1 : 1;
    if (numericX !== numericY)
      return numericX ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
