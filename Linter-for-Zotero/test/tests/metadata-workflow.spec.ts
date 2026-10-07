import { assert } from "chai";
import { config } from "../../package.json";

const prefix = config.prefsPrefix;

describe("metadata workflow in Zotero", function () {
  this.timeout(30_000);
  let previousAutoLint: unknown;
  const created: Zotero.Item[] = [];
  const plugin = () => (Zotero as any)[config.addonInstance];

  before(function () {
    previousAutoLint = Zotero.Prefs.get(`${prefix}.lint.onAdded`, true);
    Zotero.Prefs.set(`${prefix}.lint.onAdded`, false, true);
  });

  after(async function () {
    for (const item of created)
      await item.eraseTx();
    Zotero.Prefs.set(`${prefix}.lint.onAdded`, previousAutoLint as boolean, true);
  });

  const create = async (title: string, type: _ZoteroTypes.Item.ItemType = "journalArticle") => {
    const item = new Zotero.Item(type as ConstructorParameters<typeof Zotero.Item>[0]);
    item.setField("title", title);
    await item.saveTx();
    created.push(item);
    return item;
  };

  it("persists formulas in a single batch, including book titles and duplicate inputs", async function () {
    const article = await create("MoS2 / WS2: Optical properties");
    const book = await create("Chemistry of Fe(NO3)3", "book");
    await plugin().hooks.onLintInBatch(["correct-title-chemical-formula", "correct-title-chemical-formula", "require-short-title"], [article, article, book]);
    assert.equal(article.getField("title", false, true), "MoS<sub>2</sub>/WS<sub>2</sub>: Optical properties", JSON.stringify(plugin().runner.lastResult));
    assert.equal(article.getField("shortTitle", false, true), "MoS<sub>2</sub>/WS<sub>2</sub>");
    assert.equal(book.getField("title", false, true), "Chemistry of Fe(NO<sub>3</sub>)<sub>3</sub>");
    assert.isFalse(article.hasChanged());
    assert.isFalse(book.hasChanged());
    await plugin().hooks.onLintInBatch("correct-title-chemical-formula", [article, book]);
    assert.isFalse(article.hasChanged());
    assert.isFalse(book.hasChanged());
  });

  it("applies the formula shortcut only once and leaves unrelated input fields alone", async function () {
    const item = await create("MoS2 heterostructure");
    const win = Zotero.getMainWindow();
    await win.ZoteroPane.selectItem(item.id);
    const target = win.document.getElementById("zotero-items-tree") as HTMLElement;
    target.focus();
    target.dispatchEvent(new win.KeyboardEvent("keydown", {
      key: "s",
      code: "KeyS",
      ctrlKey: !Zotero.isMac,
      metaKey: Zotero.isMac,
      altKey: true,
      bubbles: true,
      cancelable: true,
    }));
    await plugin().runner.add({ items: [], rules: [], silent: true });
    assert.equal(item.getField("title", false, true), "MoS<sub>2</sub> heterostructure");

    const input = win.document.createElement("textarea");
    input.value = "H2O";
    win.document.documentElement!.appendChild(input);
    input.focus();
    input.setSelectionRange(1, 2);
    input.dispatchEvent(new win.KeyboardEvent("keydown", {
      key: "=",
      code: "Equal",
      ctrlKey: !Zotero.isMac,
      metaKey: Zotero.isMac,
      bubbles: true,
      cancelable: true,
    }));
    assert.equal(input.value, "H2O");
    input.remove();
  });

  it("shows the automatic rule and records, rejects conflicts, disables and resets shortcuts", async function () {
    const panes = (Zotero.PreferencePanes as any).pluginPanes;
    const pane = panes.find((entry: any) => entry.pluginID === config.addonID);
    assert.isDefined(pane);
    const win = Zotero.Utilities.Internal.openPreferences(pane.id)! as Window & typeof globalThis;
    assert.isNotNull(win);
    try {
      for (let attempt = 0; attempt < 100 && !win.document.getElementById("metaref-shortcut-chemicalFormula"); attempt++)
        await Zotero.Promise.delay(100);
      await (win as any).Zotero_Preferences.waitForFirstPaneLoad();
      const doc = win.document;
      await doc.l10n!.translateFragment(doc.getElementById("metaref")!);
      const metarefPane = doc.getElementById("metaref")!;
      await plugin().hooks.onPrefsEvent("load", { window: win });
      await plugin().hooks.onPrefsEvent("load", { window: win });
      assert.lengthOf(metarefPane.querySelectorAll(".metaref-shortcut-actions"), 7, "reloading the pane must not duplicate shortcut buttons");
      const search = metarefPane.querySelector<HTMLInputElement>(".metaref-settings-search")!;
      search.value = "no-such-setting-qa-12345";
      search.dispatchEvent(new win.Event("input", { bubbles: true }));
      assert.isFalse(metarefPane.querySelector<HTMLElement>(".metaref-settings-empty")!.hidden);
      search.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      assert.equal(search.value, "");
      assert.isTrue(metarefPane.querySelector<HTMLElement>(".metaref-settings-empty")!.hidden);
      const creatorDetails = metarefPane.querySelector("[data-l10n-id='metaref-section-creators']")!.closest("details") as HTMLDetailsElement;
      const creatorLabel = metarefPane.querySelector(`[preference='${prefix}.rule.require-creators']`)!.getAttribute("label")!;
      search.value = creatorLabel;
      search.dispatchEvent(new win.Event("input", { bubbles: true }));
      assert.isFalse(creatorDetails.hidden);
      assert.isTrue(creatorDetails.open, "search reveals matches inside collapsed rule groups");
      search.value = "";
      search.dispatchEvent(new win.Event("input", { bubbles: true }));
      assert.isFalse(creatorDetails.open, "clearing search restores the original collapsed state");
      const resets = metarefPane.querySelectorAll("button[data-l10n-id='metaref-settings-custom-data-reset']");
      assert.lengthOf(resets, 4);
      const resetPath = resets[0].parentElement!.querySelector("input[preference]") as HTMLInputElement;
      const resetPref = resetPath.getAttribute("preference")!;
      const originalPath = Zotero.Prefs.get(resetPref, true);
      Zotero.Prefs.set(resetPref, "missing-qa.csv", true);
      resets[0].dispatchEvent(new win.Event("command", { bubbles: true }));
      assert.equal(Zotero.Prefs.get(resetPref, true), "");
      assert.equal(resetPath.value, "");
      Zotero.Prefs.set(resetPref, originalPath as string, true);
      const concurrency = metarefPane.querySelector<HTMLInputElement>(`[preference='${prefix}.lint.numConcurrent']`)!;
      assert.equal(concurrency.min, "1");
      assert.equal(concurrency.max, "16");
      for (const id of ["section-item-description", "section-creators", "section-conference"]) {
        const heading = metarefPane.querySelector(`[data-l10n-id='metaref-${id}']`);
        assert.isNotNull(heading, `collapsible settings group ${id} should be present`);
        assert.isNotEmpty(heading!.textContent!.trim(), `collapsible settings group ${id} should be localized`);
      }
      const creatorsHeading = metarefPane.querySelector("[data-l10n-id='metaref-section-creators']")!;
      const creatorsGroup = creatorsHeading.closest("details") as HTMLDetailsElement;
      assert.isFalse(creatorsGroup.open, "less frequently changed creator rules should start collapsed");
      assert.isNotNull(creatorsGroup.querySelector(`[preference='${prefix}.rule.require-creators']`), "collapsed rules remain registered in the panel");
      creatorsGroup.querySelector<HTMLElement>("summary")!.click();
      assert.isTrue(creatorsGroup.open, "selecting a group heading should expand the group");
      creatorsGroup.querySelector<HTMLElement>("summary")!.click();
      assert.isFalse(creatorsGroup.open, "selecting the heading again should collapse the group");
      const preferenceKeys = [...metarefPane.querySelectorAll<HTMLElement>("[preference]")]
        .map(element => element.getAttribute("preference"));
      assert.equal(new Set(preferenceKeys).size, preferenceKeys.length, "each preference should have one visible control");
      const controlIDs = [...metarefPane.querySelectorAll<HTMLElement>("[id]")].map(element => element.id);
      assert.equal(new Set(controlIDs).size, controlIDs.length, "settings controls should have unique IDs");
      for (const id of ["menu-group-maintenance", "section-article-abbreviation", "section-article-esi", "section-article-pagination", "metadata-update-defaults", "metadata-provider-options", "section-about"]) {
        const heading = metarefPane.querySelector(`[data-l10n-id='metaref-${id}']`);
        assert.isNotNull(heading, `settings group ${id} should be present`);
        assert.isNotEmpty(heading!.textContent!.trim(), `settings group ${id} should be localized`);
      }
      assert.notInclude(metarefPane.querySelector("[data-l10n-id='metaref-menu-group-maintenance']")!.textContent!, "子菜单");
      assert.equal(metarefPane.querySelector<HTMLInputElement>(`[preference='${prefix}.semanticScholarToken']`)?.type, "password", "the API key should be masked in the settings panel");
      const rule = doc.querySelector(`[preference='${prefix}.rule.correct-title-chemical-formula']`) as XULElement;
      assert.isNotNull(rule);
      assert.isNotEmpty(rule.getAttribute("label")!);
      (rule as any).checked = true;
      rule.dispatchEvent(new win.Event("command", { bubbles: true }));
      assert.isTrue(Zotero.Prefs.get(`${prefix}.rule.correct-title-chemical-formula`, true));
      const spaces = metarefPane.querySelector<HTMLInputElement>(`[preference='${prefix}.rule.correct-title-chemical-formula.normalize-spaces']`)!;
      assert.isFalse(spaces.disabled);
      (rule as any).checked = false;
      rule.dispatchEvent(new win.Event("command", { bubbles: true }));
      assert.isTrue(spaces.disabled);
      (rule as any).checked = true;
      rule.dispatchEvent(new win.Event("command", { bubbles: true }));
      const input = doc.getElementById("metaref-shortcut-chemicalFormula") as HTMLInputElement;
      assert.isNotNull(input);
      const reset = input.parentElement!.querySelector("button[data-l10n-id='metaref-shortcut-reset']")!;
      assert.equal(input.value, "accel,alt,S", "initial shortcut value");
      input.value = "accel,b,c";
      input.dispatchEvent(new win.Event("input", { bubbles: true }));
      assert.equal(input.value, "accel,alt,S", "invalid paste restores shortcut value");
      assert.equal(Zotero.Prefs.get(`${prefix}.shortcut.chemicalFormula`, true), "accel,alt,S");
      reset.dispatchEvent(new win.Event("command", { bubbles: true }));
      win.resizeTo(780, 720);
      await Zotero.Promise.delay(100);
      for (const row of doc.querySelectorAll<HTMLElement>(".metaref-shortcut-row")) {
        assert.isAtMost(row.scrollWidth, row.clientWidth + 1, "shortcut row must wrap inside preferences");
      }
      const list = doc.querySelector<HTMLElement>(".metaref-shortcut-list")!;
      win.resizeTo(1000, 760);
      const layouts = [];
      for (const width of [570, 470, 350]) {
        list.style.width = `${width}px`;
        list.scrollIntoView({ block: "center" });
        await Zotero.Promise.delay(100);
        const rows = [...list.querySelectorAll<HTMLElement>(".metaref-shortcut-row")];
        const metrics = rows.map((row: HTMLElement) => {
          const rect = row.getBoundingClientRect();
          const buttons = [...row.querySelectorAll<HTMLElement>(".metaref-shortcut-action")];
          const [clear, reset] = buttons.map(button => button.getBoundingClientRect());
          assert.isAtMost(Math.abs(clear.top - reset.top), 1, "action buttons stay together");
          assert.isAtMost(reset.right, rect.right + 1, "actions remain within the row");
          assert.isAtMost(row.scrollWidth, row.clientWidth + 1, "row does not overflow");
          assert.isAtMost(rect.height, width === 570 ? 52 : 76, "shortcut row remains compact");
          return { height: rect.height, width: rect.width, buttonTop: clear.top, resetTop: reset.top };
        });
        const rect = list.getBoundingClientRect();
        const screenshotPath = PathUtils.join(PathUtils.tempDir, `metaref-shortcuts-${Zotero.locale}-${width}.png`);
        const canvas = doc.createElementNS("http://www.w3.org/1999/xhtml", "canvas") as HTMLCanvasElement;
        canvas.width = Math.ceil(rect.width);
        canvas.height = Math.ceil(rect.height);
        const context = canvas.getContext("2d")!;
        if ("drawWindow" in context) {
          (context as any).drawWindow(win, rect.left, rect.top, rect.width, rect.height, "rgb(245,245,245)");
          const bytes = Uint8Array.from(win.atob(canvas.toDataURL("image/png").split(",")[1]), char => char.charCodeAt(0));
          await IOUtils.write(screenshotPath, bytes);
        }
        layouts.push({ width, listHeight: rect.height, metrics, screenshotPath });
      }
      await Zotero.File.putContentsAsync(PathUtils.join(Zotero.DataDirectory.dir, "shortcut-layout.json"), JSON.stringify(layouts));
      list.style.removeProperty("width");
      for (const field of doc.querySelectorAll<HTMLInputElement>(".metaref-shortcut-input")) {
        assert.match(field.id, /^metaref-shortcut-/);
        assert.isNotNull(field.parentElement?.querySelector("button[data-l10n-id='metaref-shortcut-reset']"));
      }
      const event = (key: string, code: string, extra = {}) => new win.KeyboardEvent("keydown", {
        key,
        code,
        ctrlKey: !Zotero.isMac,
        metaKey: Zotero.isMac,
        altKey: true,
        bubbles: true,
        cancelable: true,
        ...extra,
      });
      input.focus();
      input.dispatchEvent(event("j", "KeyJ"));
      assert.equal(Zotero.Prefs.get(`${prefix}.shortcut.chemicalFormula`, true), "accel,alt,J");
      input.focus();
      input.dispatchEvent(event("l", "KeyL"));
      assert.equal(input.getAttribute("aria-invalid"), "true");
      assert.equal(Zotero.Prefs.get(`${prefix}.shortcut.chemicalFormula`, true), "accel,alt,J");
      input.dispatchEvent(event("Backspace", "Backspace", { ctrlKey: false, metaKey: false, altKey: false }));
      assert.equal(Zotero.Prefs.get(`${prefix}.shortcut.chemicalFormula`, true), "");
      reset.dispatchEvent(new win.Event("command", { bubbles: true }));
      assert.equal(Zotero.Prefs.get(`${prefix}.shortcut.chemicalFormula`, true), "accel,alt,S");
      assert.equal(input.value, "accel,alt,S", "reset restores shortcut value");
    }
    finally {
      Zotero.Prefs.clear(`${prefix}.shortcut.chemicalFormula`, true);
      Zotero.Prefs.clear(`${prefix}.rule.correct-title-chemical-formula`, true);
      win.close();
    }
  });

  it("formats the actual title editor selection and toggles only the requested tag", async function () {
    const item = await create("H2O");
    const win = Zotero.getMainWindow();
    await win.ZoteroPane.selectItem(item.id);
    const field = win.document.querySelector("#zotero-item-pane editable-text[fieldname='title']")
      ?? win.document.querySelector("editable-text[fieldname='title']");
    assert.isNotNull(field);
    const editor = field!.querySelector("textarea") as HTMLTextAreaElement;
    assert.isNotNull(editor);
    editor.focus();
    editor.setSelectionRange(1, 2);
    const press = (repeat = false) => editor.dispatchEvent(new win.KeyboardEvent("keydown", {
      key: "=",
      code: "Equal",
      ctrlKey: !Zotero.isMac,
      metaKey: Zotero.isMac,
      repeat,
      bubbles: true,
      cancelable: true,
    }));
    press();
    assert.equal(editor.value, "H<sub>2</sub>O");
    press(true);
    assert.equal(editor.value, "H<sub>2</sub>O");
    press();
    assert.equal(editor.value, "H2O");
    editor.value = "<i>2</i>";
    editor.setSelectionRange(0, editor.value.length);
    plugin().hooks.onShortcuts("subscript", win);
    assert.equal(editor.value, "<sub><i>2</i></sub>");
    plugin().hooks.onShortcuts("subscript", win);
    assert.equal(editor.value, "<i>2</i>");
    editor.value = "H2O";
    editor.dispatchEvent(new win.Event("input", { bubbles: true }));
    editor.blur();
  });

  it("continues healthy rules after preparation failures and primitive apply errors", async function () {
    const item = await create("initial");
    await plugin().runner.add({ items: [item, item], silent: true, rules: [
      {
        id: "test-prepare",
        scope: "item",
        prepare() { throw new Error("expected preparation failure"); },
        apply() { throw new Error("must be skipped"); },
      },
      {
        id: "test-apply",
        scope: "item",
        apply() {
          // eslint-disable-next-line prefer-promise-reject-errors -- Exercise primitive rejection handling from third-party rules.
          return Promise.reject(null);
        },
      },
      { id: "test-sibling", scope: "item", apply({ item: target }: { item: Zotero.Item }) { target.setField("title", "saved sibling"); } },
    ] });
    assert.equal(item.getField("title"), "saved sibling");
    assert.isFalse(item.hasChanged());
    for (const dialog of plugin().data.dialogs.values())
      dialog.close();
    await plugin().runner.add({ items: [], rules: [], silent: true });
  });
});
