import { assert } from "chai";
import { config, version } from "../../package.json";

describe("processing efficiency in Zotero", function () {
  this.timeout(60_000);

  it("measures import dispatch, repeated indexing and batch progress on real items", async function () {
    const instance = (Zotero as any)[config.addonInstance];
    const keys = ["lint.onAdded", "lint.notify", "rule.require-journal-abbr.customDataPath", "rule.require-journal-abbr.usefull", "rule.require-journal-abbr.usefullZh"];
    const previous = new Map(keys.map(key => [key, Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true)]));
    const pref = (key: string, value: boolean | string) => Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, value, true);
    const items: Zotero.Item[] = [];
    const originalBatch = instance.hooks.onLintInBatch;
    const originalNotify = instance.hooks.onNotify;
    const originalRead = Zotero.File.getContentsAsync;
    const originalResource = Zotero.File.getResourceAsync;
    const ui = instance.runner.ui;
    const originalProgress = ui.updateProgress;
    try {
      pref("lint.onAdded", false);
      pref("lint.notify", false);
      pref("rule.require-journal-abbr.customDataPath", "");
      pref("rule.require-journal-abbr.usefull", false);
      pref("rule.require-journal-abbr.usefullZh", false);
      await Zotero.DB.executeTransaction(async () => {
        for (let index = 0; index < 160; index++) {
          const item = new Zotero.Item("journalArticle");
          item.setField("title", `Efficiency item ${index}`);
          item.setField("publicationTitle", "Physical Review Letters");
          await item.save();
          items.push(item);
        }
      });

      let reads = 0;
      const count = (path: unknown) => {
        if (String(path).replaceAll("\\", "/").endsWith("data/journal-abbr/journal-abbr.json"))
          reads++;
      };
      (Zotero.File as any).getContentsAsync = (...args: any[]) => {
        count(args[0]);
        return (originalRead as any).apply(Zotero.File, args);
      };
      (Zotero.File as any).getResourceAsync = (...args: any[]) => {
        count(args[0]);
        return (originalResource as any).apply(Zotero.File, args);
      };
      const indexingStart = Date.now();
      for (let index = 0; index < 8; index++) {
        items[0].setField("journalAbbreviation", "");
        await originalBatch("require-journal-abbr", [items[0]]);
        assert.equal(items[0].getField("journalAbbreviation"), "Phys. Rev. Lett.");
        assert.isFalse(items[0].hasChanged());
      }
      const indexingMs = Date.now() - indexingStart;

      let progressUpdates = 0;
      ui.updateProgress = (...args: any[]) => {
        progressUpdates++;
        return originalProgress.apply(ui, args);
      };
      pref("lint.notify", true);
      const batchStart = Date.now();
      await instance.runner.add({ items, rules: [{ id: "test-efficiency", scope: "item", apply({ item }: { item: Zotero.Item }) {
        item.setField("title", `${item.getField("title")} organized`);
      } }] });
      const batchMs = Date.now() - batchStart;
      assert.equal(instance.runner.lastResult.saved, items.length);
      assert.equal(instance.runner.lastResult.failed, 0);
      assert.isTrue(items.every(item => !item.hasChanged()));
      ui.close();

      const dispatched: number[][] = [];
      instance.hooks.onLintInBatch = async (_rules: unknown, batch: Zotero.Item[]) => {
        dispatched.push(batch.map(item => item.id));
        await Zotero.Promise.delay(25);
      };
      pref("lint.onAdded", true);
      const burstStart = Date.now();
      await Promise.all(items.slice(0, 16).map(item => originalNotify("add", "item", [item.id], {})));
      const burstMs = Date.now() - burstStart;
      const burstBatches = dispatched.length;
      assert.equal(new Set(dispatched.flat()).size, 16);
      assert.equal(burstBatches, 1, "one import burst is dispatched as one batch");
      assert.isAtMost(reads, 1, "built-in journal data is retained across batches");
      assert.isBelow(progressUpdates, items.length, "progress rendering is throttled without losing saves");
      const notifications: Promise<void>[] = [];
      instance.hooks.onNotify = (...args: any[]) => {
        const pending = originalNotify(...args);
        notifications.push(pending);
        return pending;
      };
      const notificationStart = Date.now();
      await Zotero.Notifier.trigger("add", "item", [items[0].id], {}, true);
      const notificationMs = Date.now() - notificationStart;
      await Promise.all(notifications);
      const metrics = { version, zoteroVersion: Zotero.version, locale: Zotero.locale, itemCount: items.length, sequentialBatches: 8, journalFileReads: reads, indexingMs, batchMs, progressUpdates, burstItems: 16, burstBatches, burstMs, notificationMs };
      const fixturePath = Zotero.Prefs.get("metaref.test.fixturePath", true) as string;
      await Zotero.File.putContentsAsync(PathUtils.join(PathUtils.parent(PathUtils.parent(fixturePath)!)!, ".scaffold", "qa", `performance-${version}-${Zotero.locale}.json`), JSON.stringify(metrics, null, 2));
    }
    finally {
      instance.hooks.onLintInBatch = originalBatch;
      instance.hooks.onNotify = originalNotify;
      Zotero.File.getContentsAsync = originalRead;
      Zotero.File.getResourceAsync = originalResource;
      ui.updateProgress = originalProgress;
      pref("lint.onAdded", false);
      await Zotero.DB.executeTransaction(async () => {
        for (const item of items)
          await item.erase();
      });
      for (const [key, value] of previous)
        Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, value as boolean | string, true);
    }
  });
});
