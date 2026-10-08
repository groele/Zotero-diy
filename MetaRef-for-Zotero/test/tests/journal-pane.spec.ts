import { assert } from "chai";
import { config } from "../../package.json";

const prefix = config.prefsPrefix;

describe("independent journal insights in Zotero", function () {
  this.timeout(30_000);
  const plugin = () => (Zotero as any)[config.addonInstance];
  const created: Zotero.Item[] = [];
  const key = `${prefix}.insights.showPane`;
  let original: unknown;
  let auto: unknown;
  const autoKey = `${prefix}.lint.onAdded`;

  before(function () {
    original = Zotero.Prefs.get(key, true);
    auto = Zotero.Prefs.get(autoKey, true);
    Zotero.Prefs.set(key, true, true);
    Zotero.Prefs.set(autoKey, false, true);
  });

  after(async function () {
    for (const item of created)
      await item.eraseTx();
    Zotero.Prefs.set(key, original as boolean, true);
    Zotero.Prefs.set(autoKey, auto as boolean, true);
  });
  const create = async (journal: string) => {
    const item = new Zotero.Item("journalArticle");
    item.setField("title", "Independent index test");
    item.setField("publicationTitle", journal);
    item.setField("series", "Manual series");
    item.setField("archive", "Manual archive");
    item.setField("archiveLocation", "Manual identifier");
    item.addTag("user-topic");
    await item.saveTx();
    created.push(item);
    return item;
  };

  it("renders its own section and columns without changing item metadata", async function () {
    const item = await create("Physical Review Letters");
    item.setField("ISSN", "0031-9007");
    await item.saveTx();
    const win = Zotero.getMainWindow();
    await win.ZoteroPane.selectItem(item.id);
    const section = win.document.querySelector("item-pane-custom-section[data-pane*='metaref-journal-insights']") as any;
    assert.isNotNull(section);
    const heading = section.querySelector("collapsible-section > .head .title");
    assert.equal(win.getComputedStyle(heading!, "::before")?.display, "none", "the empty custom section icon does not indent the heading");
    await section._handleRefresh();
    const body = section.querySelector("[data-type='body']") as HTMLElement;
    assert.include(body.textContent!, "ESI");
    assert.include(body.textContent!, "Nature Index");
    assert.equal(body.querySelectorAll("[data-journal-result]").length, 2);
    assert.equal(body.querySelectorAll("[data-journal-sources]").length, 1);
    assert.equal(body.querySelectorAll("dt").length, 2);
    assert.equal(body.querySelectorAll("dd").length, 2);
    assert.equal(body.querySelectorAll("[data-journal-shared-basis]").length, 1, "the same basis is shown once");
    assert.notInclude(body.textContent!, "旧版本");
    assert.notInclude(body.textContent!, "legacy");
    assert.notInclude(body.textContent!, "物理学".concat("ESI"));
    assert.isNull(section.querySelector("[data-type='refresh']"), "no header refresh icon");
    assert.isFalse(section.hidden, "the journal section is initially visible");
    section.scrollIntoView({ block: "start" });
    await Zotero.Promise.delay(100);
    const rect = section.getBoundingClientRect();
    const canvas = win.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas") as HTMLCanvasElement;
    canvas.width = Math.ceil(rect.width);
    canvas.height = Math.ceil(rect.height);
    const context = canvas.getContext("2d")!;
    if ("drawWindow" in context) {
      (context as any).drawWindow(win, rect.left, rect.top, rect.width, rect.height, "rgb(245,245,245)");
      const bytes = Uint8Array.from(atob(canvas.toDataURL("image/png").split(",")[1]), char => char.charCodeAt(0));
      await IOUtils.write(PathUtils.join(PathUtils.tempDir, `metaref-journal-insights-${Zotero.locale}.png`), bytes);
    }
    const before = JSON.stringify(item.toJSON());
    await plugin().hooks.onLintInBatch(["tool-query-esi", "tool-query-nature-index"], [item]);
    assert.equal(JSON.stringify(item.toJSON()), before);
    assert.equal(plugin().runner.lastResult.saved, 0);
    const columns = (Zotero.ItemTreeManager as any).getCustomColumns(undefined, { pluginID: config.addonID });
    const esiColumn = columns.find((column: any) => column.dataKey.endsWith("esiDiscipline"));
    const natureColumn = columns.find((column: any) => column.dataKey.endsWith("natureIndex"));
    assert.include(esiColumn.dataProvider(item), "ESI");
    assert.equal(natureColumn.dataProvider(item), "✓");
    Zotero.Prefs.set(key, false, true);
    await Zotero.Promise.delay(100);
    assert.isTrue(section.hidden, "the section toggle applies immediately");
    Zotero.Prefs.set(key, true, true);
    await Zotero.Promise.delay(100);
    assert.isFalse(section.hidden, "the section can be enabled again immediately");
    item.setField("publicationTitle", "Unknown journal QA");
    item.setField("ISSN", "");
    await item.saveTx();
    await section._handleRefresh();
    assert.equal((await plugin().api.getJournalInsights(item)).esi, "");
    assert.isFalse((await plugin().api.getJournalInsights(item)).natureIndex);
    assert.isNull(body.querySelector("[data-journal-shared-basis]"), "unmatched results show no successful basis");
    assert.equal(natureColumn.dataProvider(item), "");
    assert.equal(item.getField("series"), "Manual series");
    assert.equal(item.getField("archive"), "Manual archive");
    assert.equal(item.getField("archiveLocation"), "Manual identifier");
    assert.isFalse(item.hasTag("Nature Index"));
    assert.isTrue(item.hasTag("user-topic"));
  });
});
