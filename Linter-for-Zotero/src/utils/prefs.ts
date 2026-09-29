import { config } from "../../package.json";

const PREFS_PREFIX = config.prefsPrefix;

type PluginPrefsMap = _ZoteroTypes.Prefs["PluginPrefsMap"];

export function getPref<K extends keyof PluginPrefsMap>(key: K, fallback?: PluginPrefsMap[K]) {
  if (typeof Zotero === "undefined" || !Zotero.Prefs) {
    return fallback as PluginPrefsMap[K];
  }
  const value = Zotero.Prefs.get(`${PREFS_PREFIX}.${key}`, true) as PluginPrefsMap[K];
  return (value !== undefined ? value : fallback) as PluginPrefsMap[K];
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
