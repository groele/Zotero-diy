import { assert } from "chai";
import { config, version } from "../../package.json";

describe("production XPI installation", function () {
  this.timeout(60_000);

  it("replaces the test directory with the production XPI and reads bundled reference data", async function () {
    const packagePath = Zotero.Prefs.get("linter.test.packagePath", true) as string;
    assert.isNotEmpty(packagePath, "use pnpm test:e2e to build and retain the production package");
    const autoKey = `${config.prefsPrefix}.lint.onAdded`;
    const previous = Zotero.Prefs.get(autoKey, true);
    Zotero.Prefs.set(autoKey, false, true);
    const item = new Zotero.Item("journalArticle");
    item.setField("title", "Packaged MoS2");
    item.setField("publicationTitle", "Physical Review Letters");
    assert.isTrue(Zotero.ItemFields.isValidForType(Zotero.ItemFields.getID("archive"), item.itemTypeID), "journal articles support the Archive field");
    assert.isTrue(Zotero.ItemFields.isValidForType(Zotero.ItemFields.getID("archiveLocation"), item.itemTypeID), "journal articles support the Archive Location field shown as 档案编号");
    item.setField("archive", "Institutional archive");
    item.setField("archiveLocation", "Local record 42");
    item.addTag("user-topic");
    await item.saveTx();
    const crossDisciplinary = new Zotero.Item("journalArticle");
    crossDisciplinary.setField("title", "Packaged interdisciplinary test");
    crossDisciplinary.setField("publicationTitle", "Nature Communications");
    await crossDisciplinary.saveTx();
    const unmatched = new Zotero.Item("journalArticle");
    unmatched.setField("title", "Near match test");
    unmatched.setField("publicationTitle", "Nature Communications Research");
    await unmatched.saveTx();
    try {
      const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs") as any;
      const installed = await AddonManager.installTemporaryAddon(Zotero.File.pathToFile(packagePath));
      assert.equal(installed.id, config.addonID);
      assert.equal(installed.version, version);
      for (let attempt = 0; attempt < 100 && !(Zotero as any)[config.addonInstance]?.data.alive; attempt++)
        await Zotero.Promise.delay(50);
      const plugin = (Zotero as any)[config.addonInstance];
      assert.isTrue(plugin.data.alive);
      await plugin.hooks.onLintInBatch(["correct-title-chemical-formula", "require-journal-abbr", "require-series-esi", "tool-mark-nature-index"], [item, crossDisciplinary, unmatched]);
      await item.reload(["itemData"], true);
      await crossDisciplinary.reload(["itemData"], true);
      await unmatched.reload(["itemData"], true);
      assert.equal(item.getField("title", false, true), "Packaged MoS<sub>2</sub>");
      assert.isNotEmpty(item.getField("journalAbbreviation"));
      assert.include(item.getField("series"), "ESI");
      assert.equal(item.getField("archive"), `Institutional archive; ${item.getField("series")}`);
      assert.equal(item.getField("archiveLocation"), "Local record 42; Nature Index");
      assert.isTrue(item.hasTag("Nature Index"));
      assert.isTrue(item.hasTag("user-topic"));
      assert.include(crossDisciplinary.getField("series"), "综合交叉学科" + "ESI");
      assert.include(crossDisciplinary.getField("archive"), "综合交叉学科" + "ESI");
      assert.isTrue(crossDisciplinary.hasTag("Nature Index"));
      assert.include(crossDisciplinary.getField("archiveLocation"), "Nature Index");
      assert.isFalse(unmatched.hasTag("Nature Index"), "partial title matches should not be tagged");
      assert.equal(plugin.runner.lastResult.failed, 0);
      assert.isFalse(item.hasChanged());
      await plugin.hooks.onLintInBatch(["tool-mark-nature-index"], [item]);
      await item.reload(["itemData"], true);
      assert.equal(item.getTags().filter((tag: any) => tag.tag === "Nature Index").length, 1, "repeated marking should not duplicate the tag");
      assert.equal(item.getField("archiveLocation"), "Local record 42; Nature Index", "repeated marking should not duplicate the field marker");
    }
    finally {
      await item.eraseTx();
      await crossDisciplinary.eraseTx();
      await unmatched.eraseTx();
      Zotero.Prefs.set(autoKey, previous as boolean, true);
    }
  });
});
