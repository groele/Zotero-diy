import { assert } from "chai";
import { config } from "../../package.json";

const key = `${config.prefsPrefix}.lint.onAdded`;

describe("native flat menu commands", function () {
  this.timeout(30_000);
  const plugin = () => (Zotero as any)[config.addonInstance];
  const items: Zotero.Item[] = [];
  let original: unknown;

  before(function () {
    original = Zotero.Prefs.get(key, true);
    Zotero.Prefs.set(key, false, true);
  });

  after(async function () {
    for (const item of items)
      await item.eraseTx();
    Zotero.Prefs.set(key, original as boolean, true);
  });

  afterEach(function () {
    for (const dialog of plugin().data.dialogs.values())
      dialog.close();
    const win = Zotero.getMainWindow();
    (win.document.getElementById("zotero-itemmenu") as any).hidePopup();
  });
  const wait = async (condition: () => boolean, label = "native command") => {
    for (let attempt = 0; attempt < 200 && !condition(); attempt++)
      await Zotero.Promise.delay(50);
    const windows = [...plugin().data.dialogs].map(([id, window]: [string, Window]) => ({ id, closed: window.closed, title: window.document?.title }));
    assert.isTrue(condition(), `${label} must complete; tracked=${JSON.stringify(windows)}`);
  };

  beforeEach(async function () {
    for (const dialog of plugin().data.dialogs.values())
      dialog.close();
    await wait(() => plugin().data.dialogs.size === 0, "earlier report cleanup");
  });

  const menu = async () => {
    const win = Zotero.getMainWindow();
    win.focus();
    await wait(() => win.document.hasFocus(), "main window focus");
    await win.ZoteroPane.buildItemContextMenu();
    const popup = win.document.getElementById("zotero-itemmenu") as any;
    if (popup.state !== "closed") {
      popup.hidePopup();
      await wait(() => popup.state === "closed", "previous popup closing");
    }
    popup.openPopup(win.document.getElementById("zotero-items-tree"), "after_start", 0, 0, true);
    await wait(() => popup.state === "open", "main popup opening");
    const root = popup.querySelector("menu[data-l10n-id='metaref-menuitem-label']") as any;
    assert.isNotNull(root);
    assert.isFalse(root.disabled);
    root.open = true;
    const sub = root.querySelector("menupopup") as any;
    await wait(() => sub.state === "open", "MetaRef popup opening");
    assert.equal(sub.querySelectorAll(":scope > menu").length, 0, "no nested menu arrows");
    assert.equal(sub.querySelectorAll(":scope > menuitem").length, 22);
    return { win, popup, sub };
  };

  it("runs a formatter from its actual menu element on two consecutive openings", async function () {
    const item = new Zotero.Item("journalArticle");
    item.setField("publicationTitle", "Physical Review Letters");
    item.setField("title", "Native MoS2");
    await item.saveTx();
    items.push(item);
    const win = Zotero.getMainWindow();
    await win.ZoteroPane.selectItem(item.id);
    for (let run = 0; run < 2; run++) {
      item.setField("title", `Native ${run} MoS2`);
      await item.saveTx();
      const { popup, sub } = await menu();
      const command = sub.querySelector("menuitem[data-l10n-id='metaref-rule-correct-title-chemical-formula-menu-item']") as any;
      assert.isFalse(command.disabled);
      command.dispatchEvent(new win.Event("command", { bubbles: true }));
      popup.hidePopup();
      await wait(() => item.getField("title", false, true) === `Native ${run} MoS<sub>2</sub>` && !item.hasChanged());
    }
  });

  it("shows visible results for both index commands without saving item metadata", async function () {
    this.timeout(60_000);
    const item = items[0];
    const snapshot = JSON.stringify(item.toJSON());
    const commands = [["rule-tool-query-esi-menu-item", "ESI"], ["tool-query-nature-index-menu-item", "Nature Index"]];
    for (const [id, expected] of [...commands, ...commands, ...commands]) {
      const { win, popup, sub } = await menu();
      const command = sub.querySelector(`menuitem[data-l10n-id='metaref-${id}']`) as any;
      assert.isFalse(command.disabled);
      command.dispatchEvent(new win.Event("command", { bubbles: true }));
      popup.hidePopup();
      await wait(() => plugin().data.dialogs.size > 0, `${id} result window opening`);
      const report = [...plugin().data.dialogs.values()][0] as Window;
      assert.include(report.document.body!.textContent!, expected);
      assert.equal(JSON.stringify(item.toJSON()), snapshot);
      report.close();
      await wait(() => plugin().data.dialogs.size === 0, `${id} result window closing (initial closed=${report.closed})`);
    }
  });
});
