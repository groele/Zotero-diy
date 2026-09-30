import { assert } from "chai";
import { config } from "../../package.json";

describe("real reference files and PDF indexing", function () {
  this.timeout(60_000);
  const plugin = () => (Zotero as any)[config.addonInstance];
  const created: Zotero.Item[] = [];
  const temporaryFiles: string[] = [];
  const prefs = new Map<string, unknown>();
  const pref = (key: string, value: string | boolean) => {
    const full = `${config.prefsPrefix}.${key}`;
    if (!prefs.has(full))
      prefs.set(full, Zotero.Prefs.get(full, true));
    Zotero.Prefs.set(full, value, true);
  };
  const create = async () => {
    const item = new Zotero.Item("journalArticle");
    item.setField("title", "Runtime data regression");
    await item.saveTx();
    created.push(item);
    return item;
  };

  before(function () {
    pref("lint.onAdded", false);
  });

  afterEach(async function () {
    await Zotero.Promise.delay(200);
    for (const dialog of plugin().data.dialogs.values())
      dialog.close();
  });

  after(async function () {
    for (const item of created)
      await item.eraseTx();
    for (const file of temporaryFiles)
      await IOUtils.remove(file, { ignoreAbsent: true });
    for (const [key, value] of prefs) {
      if (value === undefined)
        Zotero.Prefs.clear(key, true);
      else
        Zotero.Prefs.set(key, value as string | boolean, true);
    }
  });

  it("reads real CSV and BOM JSON files and applies the ESI overwrite option", async function () {
    const csv = PathUtils.join(PathUtils.tempDir, `linter-abbr-${Date.now()}.CSV`);
    const json = PathUtils.join(PathUtils.tempDir, `linter-abbr-${Date.now()}.JSON`);
    const esi = PathUtils.join(PathUtils.tempDir, `linter-esi-${Date.now()}.csv`);
    temporaryFiles.push(csv, json, esi);
    await IOUtils.writeUTF8(csv, "\"Special, Journal\",\"Spec. J.\"\n");
    await IOUtils.writeUTF8(json, "\uFEFF{\"Special, Journal\":\"Custom. J.\"}");
    await IOUtils.writeUTF8(esi, "title,issn,category\n\"Special, Journal\",1234-5679,\"ENVIRONMENT/ECOLOGY; SOCIAL SCIENCES, GENERAL\"\n");
    const item = await create();
    item.setField("publicationTitle", "Special, Journal");
    item.setField("series", "Manual series");
    await item.saveTx();
    pref("rule.require-journal-abbr.customDataPath", csv);
    pref("rule.require-journal-abbr.infer", false);
    pref("rule.require-series-esi.customDataPath", esi);
    pref("rule.require-series-esi.overwrite", false);
    pref("rule.require-series-esi.format", "{subject}ESI");
    await plugin().hooks.onLintInBatch(["require-journal-abbr", "require-series-esi"], [item]);
    assert.equal(item.getField("journalAbbreviation"), "Spec. J.");
    assert.equal(item.getField("series"), "Manual series");
    assert.equal(item.getField("archive"), ["环境与生态学", "社会科学总论"].map(name => `${name}${"ESI"}`).join(" / "));
    assert.equal(plugin().runner.lastResult.failed, 0);
    pref("rule.require-journal-abbr.customDataPath", json);
    pref("rule.require-series-esi.overwrite", true);
    await plugin().hooks.onLintInBatch(["require-journal-abbr", "require-series-esi"], [item]);
    assert.equal(item.getField("journalAbbreviation"), "Custom. J.");
    assert.equal(item.getField("series"), ["环境与生态学", "社会科学总论"].map(name => `${name}${"ESI"}`).join(" / "));
    assert.equal(item.getField("archive"), ["环境与生态学", "社会科学总论"].map(name => `${name}${"ESI"}`).join(" / "));
    assert.isFalse(item.hasChanged());
    assert.equal(plugin().runner.lastResult.failed, 0);
  });

  it("imports and indexes a three-page PDF before completing a numeric page range", async function () {
    const fixtureRoot = Zotero.Prefs.get("linter.test.fixturePath", true) as string;
    const item = await create();
    item.setField("pages", "12");
    await item.saveTx();
    const attachment = await Zotero.Attachments.importFromFile({
      file: PathUtils.join(fixtureRoot, "pages-three.pdf"),
      parentItemID: item.id,
      title: "Synthetic three-page PDF",
    });
    assert.equal(attachment.attachmentContentType, "application/pdf");
    await Zotero.Fulltext.indexItems([attachment.id], { complete: true });
    const pages = await Zotero.Fulltext.getPages(attachment.id);
    assert.isNotFalse(pages);
    assert.equal((pages as { total: number }).total, 3);
    await plugin().hooks.onLintInBatch("correct-pages-range", [item]);
    await item.reload(["itemData"], true);
    assert.equal(item.getField("pages"), "12-14");
    for (const value of ["", "e01234", "12-14"]) {
      item.setField("pages", value);
      await item.saveTx();
      await plugin().hooks.onLintInBatch("correct-pages-range", [item]);
      assert.equal(item.getField("pages"), value);
      assert.isFalse(item.hasChanged());
    }
  });
});
