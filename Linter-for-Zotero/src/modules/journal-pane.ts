import { cachedJournalInsights, clearJournalInsights, getJournalInsights, loadJournalInsights } from "../utils/journal-insights";
import { presentJournalInsights } from "../utils/journal-insights-presentation";
import { getLocaleID, getString } from "../utils/locale";
import { createLogger } from "../utils/logger";
import { getPref } from "../utils/prefs";

let sectionID: string | undefined;
const observers: symbol[] = [];
const refreshers = new Map<HTMLElement, () => Promise<void>>();
const renders = new WeakMap<HTMLElement, object>();
const items = new WeakMap<HTMLElement, Zotero.Item>();
const logger = createLogger("journal-pane");
type Context = _ZoteroTypes.ItemPaneManagerSection.SectionHookArgs;

export function registerJournalPane() {
  if (sectionID)
    return;
  const icon = `${rootURI}content/icons/metaref.svg`;
  const id = Zotero.ItemPaneManager.registerSection({
    paneID: "metaref-journal-insights",
    pluginID: addon.data.config.addonID,
    header: { icon: "", l10nID: getLocaleID("journal-insights-heading")! },
    sidenav: { icon, l10nID: getLocaleID("journal-insights-heading")! },
    onInit({ body, refresh, setEnabled }) {
      refreshers.set(body, async () => {
        setEnabled(getPref("insights.showPane", true) && items.get(body)?.itemType === "journalArticle");
        await refresh();
      });
    },
    onDestroy({ body }) {
      refreshers.delete(body);
      renders.delete(body);
      items.delete(body);
    },
    onItemChange({ item, body, setEnabled }) {
      if (item)
        items.set(body, item);
      else
        items.delete(body);
      renders.delete(body);
      body.replaceChildren();
      setEnabled(getPref("insights.showPane", true) && item?.isRegularItem() && item.itemType === "journalArticle");
    },
    onRender({ body, item, setEnabled }) {
      renders.delete(body);
      setEnabled(getPref("insights.showPane", true) && item?.isRegularItem() && item.itemType === "journalArticle");
      body.textContent = getString("journal-insights-loading");
    },
    onAsyncRender: render,
  });
  if (id)
    sectionID = id;
  for (const pref of ["insights.showPane", "insights.esiCustomDataPath", "insights.esiFormat", "insights.natureCustomDataPath"]) {
    observers.push(Zotero.Prefs.registerObserver(`${addon.data.config.prefsPrefix}.${pref}`, () => {
      if (pref.endsWith("DataPath"))
        clearJournalInsights();
      refreshData();
      for (const refresh of refreshers.values())
        void refresh().catch(error => logger.error(error));
    }, true));
  }
}

function refreshData() {
  void loadJournalInsights().then(() => {
    if (addon.data.alive)
      Zotero.ItemTreeManager.refreshColumns();
  }).catch(error => logger.error(error));
}

export async function refreshJournalInsights() {
  clearJournalInsights();
  await loadJournalInsights();
  if (!addon.data.alive)
    return;
  Zotero.ItemTreeManager.refreshColumns();
  await Promise.all([...refreshers.values()].map(refresh => refresh()));
}

async function render({ item, body, doc, setSectionSummary }: Context) {
  if (!item || item.itemType !== "journalArticle" || !getPref("insights.showPane", true))
    return;
  const token = {};
  renders.set(body, token);
  const result = cachedJournalInsights(item) ?? await getJournalInsights(item);
  if (!addon.data.alive || renders.get(body) !== token || !body.isConnected)
    return;
  body.replaceChildren();
  body.style.cssText = "padding:10px 12px 12px;line-height:1.5;overflow-wrap:anywhere;color:var(--fill-primary);";
  const rows = presentJournalInsights(result, Zotero.locale);
  const text = (tag: string, value: string, style = "") => {
    const node = doc.createElementNS("http://www.w3.org/1999/xhtml", tag);
    node.textContent = value;
    node.setAttribute("style", style);
    return node;
  };
  const sharedBasis = rows.every(row => row.basis && row.basis === rows[0].basis) ? rows[0].basis : "";
  const results = text("dl", "", "margin:0;display:grid;gap:14px;");
  for (const row of rows) {
    const node = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    node.setAttribute("data-journal-result", row.label);
    node.setAttribute("style", "display:grid;grid-template-columns:88px minmax(0,1fr);column-gap:12px;align-items:baseline;");
    const value = text("dd", "", "margin:0;min-width:0;");
    value.append(text("div", row.value, row.matched ? "font-size:14px;font-weight:600;" : "font-size:13px;color:var(--fill-secondary);"));
    if (row.basis && !sharedBasis)
      value.append(text("div", row.basis, "font-size:12px;color:var(--fill-secondary);margin-top:2px;"));
    if (row.warning)
      value.append(text("div", row.warning, "font-size:12px;color:var(--accent-orange);margin-top:4px;"));
    node.append(text("dt", row.label, "margin:0;font-size:12px;color:var(--fill-secondary);"), value);
    results.append(node);
  }
  body.append(results);
  if (sharedBasis) {
    const basis = text("div", sharedBasis, "font-size:12px;color:var(--fill-secondary);margin-top:10px;");
    basis.setAttribute("data-journal-shared-basis", "true");
    body.append(basis);
  }
  const sources = text("div", "", "border-top:1px solid var(--fill-quinary);margin-top:12px;padding-top:10px;font-size:12px;color:var(--fill-secondary);line-height:1.6;");
  sources.setAttribute("data-journal-sources", "true");
  sources.append(text("div", getString("journal-insights-source"), "margin-bottom:4px;"), ...rows.map(row => text("div", row.source)));
  const note = text("div", getString("journal-insights-scope-note"), "margin-top:8px;");
  note.setAttribute("title", getString("journal-insights-boundary"));
  sources.append(note);
  body.append(sources);
  setSectionSummary([result.categories.length ? rows[0].value : "", result.natureIndex ? "Nature Index" : ""].filter(Boolean).join(" · "));
}

export function unregisterJournalPane() {
  observers.splice(0).forEach(id => Zotero.Prefs.unregisterObserver(id));
  refreshers.clear();
  if (sectionID)
    Zotero.ItemPaneManager.unregisterSection(sectionID);
  sectionID = undefined;
  clearJournalInsights();
}
