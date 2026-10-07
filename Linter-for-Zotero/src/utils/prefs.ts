import { config } from "../../package.json";

const PREFS_PREFIX = config.prefsPrefix;

type PluginPrefsMap = _ZoteroTypes.Prefs["PluginPrefsMap"];

export const DEFAULT_PREFS: Partial<PluginPrefsMap> = {
  "lint.onAdded": true,
  "lint.onGroup": false,
  "lint.notify": true,
  "lint.numConcurrent": 1,
  "lint.delayOnAdded": 500,
  "richtext.toolBar": true,
  "richtext.hotkey": true,
  "richtext.preview": true,
  "shortcut.subscript": "accel,=",
  "shortcut.supscript": "accel,shift,=",
  "shortcut.bold": "accel,B",
  "shortcut.italic": "accel,I",
  "shortcut.nocase": "accel,N",
  "shortcut.lint": "accel,alt,L",
  "shortcut.chemicalFormula": "accel,alt,S",
  "rule.no-item-duplication": true,
  "rule.no-article-webpage": true,
  "rule.no-journal-preprint": true,
  "rule.no-value-nullish": true,
  "rule.no-field-misuse": true,
  "rule.no-title-trailing-dot": true,
  "rule.no-doi-prefix": true,
  "rule.no-issue-extra-zeros": true,
  "rule.no-pages-extra-zeros": false,
  "rule.no-volume-extra-zeros": true,
  "rule.require-language": true,
  "rule.require-language.only": true,
  "rule.require-language.only.cmn": true,
  "rule.require-language.only.eng": true,
  "rule.require-language.only.other": "",
  "rule.require-language.verify-before": false,
  "rule.require-short-title": true,
  "rule.require-journal-abbr": true,
  "rule.require-journal-abbr.infer": true,
  "rule.require-journal-abbr.usefull": false,
  "rule.require-journal-abbr.usefullZh": false,
  "rule.require-journal-abbr.customDataPath": "",
  "insights.esiFormat": "{subject}ESI",
  "insights.esiCustomDataPath": "",
  "insights.showPane": true,
  "insights.natureCustomDataPath": "",
  "rule.require-university-place": true,
  "rule.require-doi": true,
  "rule.require-creators": true,
  "rule.correct-title-sentence-case": true,
  "rule.correct-title-sentence-case.custom-term-path": "",
  "rule.correct-title-sentence-case.disabled-languages": "zh,de",
  "rule.correct-title-chemical-formula": false,
  "rule.correct-title-chemical-formula.normalize-spaces": true,
  "rule.correct-title-punctuation": true,
  "rule.correct-title-punctuation.quotes": false,
  "rule.correct-shortTitle-sentence-case": true,
  "rule.correct-creators-case": true,
  "rule.correct-creators-pinyin": false,
  "rule.correct-creators-punctuation": true,
  "rule.correct-date-format": true,
  "rule.correct-filing-date-format": true,
  "rule.correct-issue-date-format": true,
  "rule.correct-priority-date-format": true,
  "rule.correct-publication-title-alias": true,
  "rule.correct-publication-title-case": true,
  "rule.correct-pages-connector": true,
  "rule.correct-pages-range": false,
  "rule.correct-conference-abbr": true,
  "rule.correct-thesis-type": true,
  "rule.correct-university-punctuation": true,
  "rule.correct-doi-long": true,
  "rule.correct-edition-numeral": true,
  "rule.correct-volume-numeral": true,
  "rule.correct-bookTitle-sentence-case": true,
  "rule.correct-proceedingsTitle-sentence-case": false,
  "rule.correct-extra-order": true,
  "rule.tool-update-metadata.option.slient": false,
  "rule.tool-update-metadata.option.mode": "all",
  "rule.tool-update-metadata.option.allow-type-changed": true,
  "semanticScholarToken": "",
  "menu.standard": true,
  "menu.correct-title-sentence-case": true,
  "menu.correct-title-chemical-formula": true,
  "menu.correct-creators-case": true,
  "menu.correct-creators-pinyin": true,
  "menu.require-language": true,
  "menu.tool-set-language": true,
  "menu.correct-publication-title-alias": true,
  "menu.correct-publication-title-case": true,
  "menu.require-journal-abbr": true,
  "menu.tool-query-esi": true,
  "menu.correct-conference-abbr": true,
  "menu.require-university-place": true,
  "menu.tool-update-metadata": true,
  "menu.tool-title-guillemet": true,
  "menu.no-doi-prefix": true,
  "menu.tool-get-short-doi": true,
  "menu.correct-date-format": true,
  "menu.tool-clean-extra": true,
  "menu.tool-csl-helper": true,
  "menu.tool-creators-ext": true,
  "menu.tool-query-nature-index": true,
  "menu.correct-title-punctuation": true,
  "menu.correct-extra-order": true,
  "rule.tool-set-language": true,
  "rule.tool-title-guillemet": true,
  "rule.tool-clean-extra": true,
  "rule.tool-csl-helper": true,
  "rule.tool-creators-ext": true,
  "rule.tool-get-short-doi": true,
  "rule.tool-query-nature-index": true,
  "cleanExtra": false,
};

export function getPref<K extends keyof PluginPrefsMap>(key: K, fallback?: PluginPrefsMap[K]) {
  const effectiveFallback = (fallback !== undefined ? fallback : DEFAULT_PREFS[key]) as PluginPrefsMap[K];
  if (typeof Zotero === "undefined" || !Zotero.Prefs) {
    return effectiveFallback;
  }
  const value = Zotero.Prefs.get(`${PREFS_PREFIX}.${key}`, true) as PluginPrefsMap[K];
  return (value !== undefined ? value : effectiveFallback) as PluginPrefsMap[K];
}

export function setPref<K extends keyof PluginPrefsMap>(key: K, value: PluginPrefsMap[K]) {
  if (typeof Zotero === "undefined" || !Zotero.Prefs) {
    return;
  }
  return Zotero.Prefs.set(`${PREFS_PREFIX}.${key}`, value, true);
}

export function clearPref(key: string) {
  if (typeof Zotero === "undefined" || !Zotero.Prefs) {
    return;
  }
  return Zotero.Prefs.clear(`${PREFS_PREFIX}.${key}`, true);
}
