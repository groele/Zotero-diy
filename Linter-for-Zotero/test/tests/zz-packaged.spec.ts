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
    await item.saveTx();
    try {
      const { AddonManager } = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs") as any;
      const installed = await AddonManager.installTemporaryAddon(Zotero.File.pathToFile(packagePath));
      assert.equal(installed.id, config.addonID);
      assert.equal(installed.version, version);
      for (let attempt = 0; attempt < 100 && !(Zotero as any)[config.addonInstance]?.data.alive; attempt++)
        await Zotero.Promise.delay(50);
      const plugin = (Zotero as any)[config.addonInstance];
      assert.isTrue(plugin.data.alive);
      await plugin.hooks.onLintInBatch(["correct-title-chemical-formula", "require-journal-abbr", "require-series-esi"], [item]);
      await item.reload(["itemData"], true);
      assert.equal(item.getField("title", false, true), "Packaged MoS<sub>2</sub>");
      assert.isNotEmpty(item.getField("journalAbbreviation"));
      assert.include(item.getField("series"), "ESI");
      assert.equal(plugin.runner.lastResult.saved, 1);
      assert.equal(plugin.runner.lastResult.failed, 0);
      assert.isFalse(item.hasChanged());
    }
    finally {
      await item.eraseTx();
      Zotero.Prefs.set(autoKey, previous as boolean, true);
    }
  });
});
