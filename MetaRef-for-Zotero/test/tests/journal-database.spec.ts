import { assert } from "chai";
import { config } from "../../package.json";

describe("user-defined journal databases in Zotero", function () {
  this.timeout(60_000);
  const plugin = () => (Zotero as any)[config.addonInstance];
  const files: string[] = [];
  const items: Zotero.Item[] = [];
  const original = new Map<string, unknown>();
  const pref = (name: string, value: string | boolean) => {
    const key = `${config.prefsPrefix}.${name}`;
    if (!original.has(key))
      original.set(key, Zotero.Prefs.get(key, true));
    Zotero.Prefs.set(key, value, true);
  };
  const file = async (name: string, content: string) => {
    const path = PathUtils.join(PathUtils.tempDir, `metaref-db-${Date.now()}-${name}`);
    files.push(path);
    await Zotero.File.putContentsAsync(path, content);
    return path;
  };

  before(function () {
    pref("lint.onAdded", false);
    pref("insights.showPane", true);
    pref("insights.esiCustomDataPath", "");
    pref("insights.natureCustomDataPath", "");
  });

  after(async function () {
    for (const item of items)
      await item.eraseTx();
    for (const path of files)
      await IOUtils.remove(path, { ignoreAbsent: true });
    for (const [key, value] of original) {
      if (value === undefined)
        Zotero.Prefs.clear(key, true);
      else
        Zotero.Prefs.set(key, value as string | boolean, true);
    }
    await plugin().api.refreshJournalInsights();
  });

  it("uses custom JSON and BOM CSV consistently in the pane, columns and rules, and reloads edited files", async function () {
    const esi = await file("esi.JSON", JSON.stringify({ journals: [{ title: "Custom QA Journal", category: "PHYSICS" }] }));
    const nature = await file("nature.CSV", "\uFEFFtitle,type,aliases,issn\nCustom QA Journal,journal,Custom. QA.,\n");
    assert.equal((await plugin().api.validateJournalDatabase("nature", nature)).journals, 1);
    pref("insights.esiCustomDataPath", esi);
    pref("insights.natureCustomDataPath", nature);
    const item = new Zotero.Item("journalArticle");
    item.setField("title", "Custom database regression");
    item.setField("publicationTitle", "Custom QA Journal");
    item.setField("archiveLocation", "Manual location");
    item.addTag("Manual tag");
    await item.saveTx();
    items.push(item);
    const win = Zotero.getMainWindow();
    await win.ZoteroPane.selectItem(item.id);
    await plugin().api.refreshJournalInsights();
    const section = win.document.querySelector("item-pane-custom-section[data-pane*='metaref-journal-insights']") as any;
    await section._handleRefresh();
    const body = section.querySelector("[data-type='body']");
    assert.include(body.textContent, "Nature Index");
    const result = await plugin().api.getJournalInsights(item);
    assert.equal(result.esiSource, "custom");
    assert.equal(result.natureSource, "custom");
    assert.isTrue(result.natureIndex);
    const columns = (Zotero.ItemTreeManager as any).getCustomColumns(undefined, { pluginID: config.addonID });
    const natureColumn = columns.find((column: any) => column.dataKey.endsWith("natureIndex"));
    assert.equal(natureColumn.dataProvider(item), "✓");
    const snapshot = JSON.stringify(item.toJSON());
    await plugin().hooks.onLintInBatch(["tool-query-esi", "tool-query-nature-index"], [item]);
    assert.equal(plugin().runner.lastResult.failed, 0);
    assert.equal(plugin().runner.lastResult.saved, 0);
    assert.equal(JSON.stringify(item.toJSON()), snapshot);
    await Zotero.File.putContentsAsync(nature, "title\nDifferent QA Journal\n");
    await plugin().api.refreshJournalInsights();
    assert.isFalse((await plugin().api.getJournalInsights(item)).natureIndex);
    assert.equal(natureColumn.dataProvider(item), "");
    await Zotero.File.putContentsAsync(nature, "title,aliases\nCustom QA Journal,123\n");
    pref("insights.natureCustomDataPath", "missing-nature-qa.json");
    await plugin().api.refreshJournalInsights();
    const fallback = await plugin().api.getJournalInsights(item);
    assert.equal(fallback.natureSource, "builtin");
    assert.isNotEmpty(fallback.natureFallback);
    assert.equal(fallback.esiSource, "custom");
    assert.include(fallback.esi, "ESI");
    await plugin().hooks.onLintInBatch(["tool-query-nature-index"], [item]);
    assert.equal(plugin().runner.lastResult.failed, 0);
    assert.isTrue(plugin().runner.lastResult.records.some((record: any) => record.level === "warning"));
    assert.equal(JSON.stringify(item.toJSON()), snapshot);
    pref("insights.esiCustomDataPath", "");
    pref("insights.natureCustomDataPath", "");
  });

  it("validates before activating, preserves paths on errors or cancellation, exports real files and resets from settings", async function () {
    const valid = await file("ui-nature.json", JSON.stringify([{ title: "Custom QA Journal" }]));
    const invalid = await file("invalid.json", JSON.stringify([{ title: "Good" }, { title: [] }]));
    const output = await file("export.json", "");
    const pane = (Zotero.PreferencePanes as any).pluginPanes.find((entry: any) => entry.pluginID === config.addonID);
    const win = Zotero.Utilities.Internal.openPreferences(pane.id)! as Window & typeof globalThis;
    const picker = plugin().data.ztoolkit.FilePicker.prototype;
    const open = picker.open;
    const choices: (string | undefined)[] = [valid, invalid, undefined, output];
    picker.open = async () => choices.shift();
    try {
      for (let attempt = 0; attempt < 100 && !win.document.getElementById("metaref-nature-custom-path"); attempt++)
        await Zotero.Promise.delay(50);
      await (win as any).Zotero_Preferences.waitForFirstPaneLoad();
      await plugin().hooks.onPrefsEvent("load", { window: win });
      const group = win.document.querySelector("[data-journal-database='nature']")!;
      const status = group.querySelector(".journal-database-status")!;
      const act = async (action: string) => {
        const button = group.querySelector(`#metaref-nature-${action}-custom-data-button`) as any;
        button.dispatchEvent(new win.Event("command", { bubbles: true }));
        assert.isTrue(button.disabled, "the active control must stay disabled while loading");
        button.dispatchEvent(new win.Event("command", { bubbles: true }));
        for (let attempt = 0; attempt < 200 && button.disabled; attempt++)
          await Zotero.Promise.delay(50);
        assert.isFalse(button.disabled, "database action should finish");
      };
      await act("choose");
      assert.equal(Zotero.Prefs.get(`${config.prefsPrefix}.insights.natureCustomDataPath`, true), valid);
      assert.include(status.textContent!, "1");
      assert.isTrue((await plugin().api.getJournalInsights(items[0])).natureIndex);
      await act("choose");
      assert.equal(Zotero.Prefs.get(`${config.prefsPrefix}.insights.natureCustomDataPath`, true), valid);
      assert.include(status.textContent!, "2");
      await Zotero.File.putContentsAsync(valid, JSON.stringify([{ title: "Edited QA Journal" }]));
      await act("reload");
      assert.isFalse((await plugin().api.getJournalInsights(items[0])).natureIndex);
      await act("validate");
      await act("choose");
      assert.equal(status.textContent, "");
      assert.equal(Zotero.Prefs.get(`${config.prefsPrefix}.insights.natureCustomDataPath`, true), valid);
      await act("export");
      assert.equal((await plugin().api.validateJournalDatabase("nature", output)).journals, 177);
      assert.equal(JSON.parse(await Zotero.File.getContentsAsync(output) as string).venues.length, 178);
      const builtinItem = new Zotero.Item("journalArticle");
      builtinItem.setField("title", "Database reset regression");
      builtinItem.setField("publicationTitle", "Physical Review Letters");
      await builtinItem.saveTx();
      items.push(builtinItem);
      assert.isFalse((await plugin().api.getJournalInsights(builtinItem)).natureIndex);
      const reset = group.querySelector("[data-l10n-id='metaref-settings-custom-data-reset']") as HTMLButtonElement;
      reset.dispatchEvent(new win.Event("command", { bubbles: true }));
      assert.isTrue(reset.disabled, "reset remains disabled until the built-in database is active");
      for (let attempt = 0; attempt < 200 && group.hasAttribute("data-busy"); attempt++)
        await Zotero.Promise.delay(50);
      assert.isFalse(group.hasAttribute("data-busy"));
      assert.isTrue(reset.disabled, "a built-in database has no custom path to clear");
      assert.isFalse((group.querySelector("#metaref-nature-choose-custom-data-button") as HTMLButtonElement).disabled);
      assert.equal(Zotero.Prefs.get(`${config.prefsPrefix}.insights.natureCustomDataPath`, true), "");
      assert.equal((group.querySelector("input[readonly]") as HTMLInputElement).value, "");
      assert.include(status.textContent!, "177");
      assert.isTrue((await plugin().api.getJournalInsights(builtinItem)).natureIndex, "reset restores the built-in journal matches");
      assert.isEmpty(choices);
    }
    finally {
      picker.open = open;
      win.close();
    }
  });

  it("imports both delivered JSON and CSV databases and round-trips the built-in ESI export", async function () {
    const fixture = Zotero.Prefs.get("metaref.test.fixturePath", true) as string;
    const root = PathUtils.join(PathUtils.parent(PathUtils.parent(fixture)!)!, "dist", "databases");
    const item = new Zotero.Item("journalArticle");
    item.setField("title", "Delivered database regression");
    item.setField("publicationTitle", "Physical Review Letters");
    await item.saveTx();
    items.push(item);
    for (const extension of ["json", "csv"]) {
      assert.equal((await plugin().api.validateJournalDatabase("esi", PathUtils.join(root, `esi-journals.${extension}`))).journals, 12245);
      assert.equal((await plugin().api.validateJournalDatabase("nature", PathUtils.join(root, `nature-index-journals.${extension}`))).journals, 177);
      pref("insights.esiCustomDataPath", PathUtils.join(root, `esi-journals.${extension}`));
      pref("insights.natureCustomDataPath", PathUtils.join(root, `nature-index-journals.${extension}`));
      await plugin().api.refreshJournalInsights();
      const insight = await plugin().api.getJournalInsights(item);
      assert.equal(insight.esiSource, "custom");
      assert.equal(insight.natureSource, "custom");
      assert.deepEqual(insight.categories, ["PHYSICS"]);
      assert.isTrue(insight.natureIndex);
    }
    const output = await file("esi-export.json", "");
    await plugin().api.exportJournalDatabase("esi", output);
    assert.equal((await plugin().api.validateJournalDatabase("esi", output)).journals, 12245);
  });
});
