import { assert } from "chai";
import { config } from "../../package.json";

describe("data processing resilience in Zotero", function () {
  this.timeout(45_000);
  const plugin = () => (Zotero as any)[config.addonInstance];
  const created: Zotero.Item[] = [];
  const prefs = new Map<string, unknown>();
  const pref = (key: string, value: boolean | number | string) => {
    const full = `${config.prefsPrefix}.${key}`;
    if (!prefs.has(full))
      prefs.set(full, Zotero.Prefs.get(full, true));
    Zotero.Prefs.set(full, value, true);
  };
  const create = async (title: string, type: _ZoteroTypes.Item.ItemType = "journalArticle") => {
    const item = new Zotero.Item(type as ConstructorParameters<typeof Zotero.Item>[0]);
    item.setField("title", title);
    await item.saveTx();
    created.push(item);
    return item;
  };
  const closeReports = async () => {
    await Zotero.Promise.delay(200);
    for (const dialog of plugin().data.dialogs.values())
      dialog.close();
  };
  const changeTitle = { id: "test-change-title", scope: "item", apply({ item }: { item: Zotero.Item }) {
    item.setField("title", `${item.getField("title")} saved`);
  } };

  before(function () {
    pref("lint.onAdded", false);
    pref("lint.numConcurrent", 1);
    pref("rule.require-journal-abbr.infer", false);
  });

  afterEach(closeReports);

  after(async function () {
    for (const item of created)
      await item.eraseTx();
    for (const [key, value] of prefs) {
      if (value === undefined)
        Zotero.Prefs.clear(key, true);
      else
        Zotero.Prefs.set(key, value as string | boolean | number, true);
    }
  });

  it("recovers every modified item after a transaction rollback", async function () {
    const first = await create("rollback first");
    const second = await create("rollback second");
    const save = second.save;
    let fail = true;
    second.save = async function (options) {
      if (fail) {
        fail = false;
        throw new Error("injected transaction failure");
      }
      return save.call(this, options);
    };
    try {
      await plugin().runner.add({ items: [first, second], rules: [changeTitle], silent: true });
      const result = plugin().runner.lastResult;
      assert.equal(result.saved, 2);
      assert.equal(result.failed, 0);
      await first.reload(["itemData"], true);
      await second.reload(["itemData"], true);
      assert.equal(first.getField("title"), "rollback first saved");
      assert.equal(second.getField("title"), "rollback second saved");
      assert.isFalse(first.hasChanged());
      assert.isFalse(second.hasChanged());
    }
    finally {
      second.save = save;
    }
  });

  it("reports permanent save failure instead of counting it as success", async function () {
    const item = await create("failed save");
    const save = item.save;
    item.save = async () => {
      throw new Error("injected permanent save failure");
    };
    try {
      await plugin().runner.add({ items: [item], rules: [changeTitle], silent: true });
      const result = plugin().runner.lastResult;
      assert.equal(result.failed, 1);
      assert.equal(result.passed, 0);
      assert.equal(result.saved, 0);
      assert.include(result.records.map((row: { ruleID: string }) => row.ruleID), "item-save");
    }
    finally {
      item.save = save;
      await item.reload(["primaryData", "itemData"], true);
    }
  });

  it("isolates applicability failures and still saves sibling rule changes", async function () {
    const item = await create("applicability");
    const getID = Zotero.ItemFields.getID;
    Zotero.ItemFields.getID = function (field: Parameters<typeof getID>[0]) {
      if (String(field) === "qa-invalid-field")
        throw new Error("injected applicability failure");
      return getID.call(this, field);
    };
    try {
      await plugin().runner.add({ items: [item], silent: true, rules: [
        { id: "test-invalid-field", scope: "field", targetItemField: "qa-invalid-field", apply() { throw new Error("must not apply"); } },
        changeTitle,
      ] });
      const result = plugin().runner.lastResult;
      assert.equal(result.processed, 1);
      assert.equal(result.failed, 1);
      assert.equal(result.saved, 1);
      assert.equal(item.getField("title"), "applicability saved");
      assert.isFalse(item.hasChanged());
      assert.include(result.records[0].message, "injected applicability failure");
      await Zotero.Promise.delay(100);
      assert.equal(plugin().data.dialogs.size, 0, "silent batches retain errors without opening reports");
    }
    finally {
      Zotero.ItemFields.getID = getID;
    }
  });

  it("records preparation failures separately and keeps unaffected rules available", async function () {
    const item = await create("prepare failure");
    let applied = false;
    const bad = {
      id: "test-prepare-failure",
      scope: "item",
      prepare() { throw new Error("injected prepare failure"); },
      apply() { applied = true; },
    };
    await plugin().runner.add({ items: [item], rules: [bad], silent: true });
    let result = plugin().runner.lastResult;
    assert.equal(result.preparationFailed, 1);
    assert.equal(result.processed, 0);
    assert.equal(result.skipped, 1);
    assert.equal(result.passed, 0);
    assert.equal(result.saved, 0);
    assert.isFalse(applied);
    await plugin().runner.add({ items: [item], rules: [bad, changeTitle], silent: true });
    result = plugin().runner.lastResult;
    assert.equal(result.preparationFailed, 1);
    assert.equal(result.processed, 1);
    assert.equal(result.skipped, 0);
    assert.equal(result.saved, 1);
    assert.equal(item.getField("title"), "prepare failure saved");
    assert.isFalse(applied);
  });

  it("starts a fresh batch after a results window fails", async function () {
    const item = await create("results failure");
    const runner = plugin().runner;
    const showFinished = runner.ui.showFinished;
    runner.ui.showFinished = () => {
      throw new Error("injected window failure");
    };
    try {
      await runner.add({ items: [item], rules: [changeTitle], silent: true });
      assert.equal(runner.lastResult.saved, 1);
    }
    finally {
      runner.ui.showFinished = showFinished;
    }
    await runner.add({ items: [item], rules: [changeTitle], silent: true });
    assert.equal(runner.lastResult.total, 1);
    assert.equal(runner.lastResult.processed, 1);
    assert.equal(runner.lastResult.passed, 1);
    assert.equal(runner.lastResult.preparationFailed, 0);
    assert.equal(item.getField("title"), "results failure saved saved");
    assert.isFalse(item.hasChanged());
  });

  it("finishes concurrent items and commits once even when progress updates fail", async function () {
    const items = [await create("progress first"), await create("progress second")];
    const runner = plugin().runner;
    const updateProgress = runner.ui.updateProgress;
    pref("lint.numConcurrent", 2);
    runner.ui.updateProgress = () => {
      throw new Error("injected progress window failure");
    };
    try {
      await runner.add({ items, rules: [changeTitle], silent: true });
      assert.equal(runner.lastResult.processed, 2);
      assert.equal(runner.lastResult.passed, 2);
      assert.equal(runner.lastResult.saved, 2);
      for (const item of items) {
        assert.include(item.getField("title"), " saved");
        assert.isFalse(item.hasChanged());
      }
    }
    finally {
      runner.ui.updateProgress = updateProgress;
      pref("lint.numConcurrent", 1);
    }
  });

  it("reports a failed duplicate search without blocking the following formatter", async function () {
    const item = await create("duplicate search MoS2");
    const Duplicates = (Zotero as any).Duplicates;
    (Zotero as any).Duplicates = class {
      async getSearchObject() { throw new Error("injected duplicate search failure"); }
    };
    try {
      await plugin().hooks.onLintInBatch(["no-item-duplication", "correct-title-chemical-formula"], [item]);
      const result = plugin().runner.lastResult;
      assert.equal(result.failed, 1);
      assert.equal(result.saved, 1);
      assert.include(result.records[0].message, "injected duplicate search failure");
      assert.equal(item.getField("title", false, true), "duplicate search MoS<sub>2</sub>");
      assert.isFalse(item.hasChanged());
    }
    finally {
      (Zotero as any).Duplicates = Duplicates;
    }
  });

  it("stops before the next rule and item, saves completed work, then accepts another batch", async function () {
    const first = await create("cancel first");
    const second = await create("cancel second");
    let started!: () => void;
    let release!: () => void;
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = plugin().runner.add({ items: [first, second], silent: true, rules: [
      { id: "test-cancel-gate", scope: "item", async apply({ item }: { item: Zotero.Item }) {
        started();
        await gate;
        item.setField("title", "completed before stop");
      } },
      changeTitle,
    ] });
    await began;
    plugin().runner.cancel();
    release();
    await pending;
    assert.equal(first.getField("title"), "completed before stop");
    assert.equal(second.getField("title"), "cancel second");
    assert.equal(plugin().runner.lastResult.processed, 1);
    assert.isTrue(plugin().runner.lastResult.cancelled);
    await plugin().runner.add({ items: [second], rules: [changeTitle], silent: true });
    assert.equal(second.getField("title"), "cancel second saved");
    assert.isFalse(plugin().runner.lastResult.cancelled);
  });

  it("blocks late writes and reports from a timed-out rule", async function () {
    const item = await create("deadline");
    await plugin().runner.add({ items: [item], silent: true, rules: [
      { id: "test-deadline", scope: "item", timeout: 20, async apply({ item: target, report }: { item: Zotero.Item; report: (info: { message: string }) => void }) {
        await Zotero.Promise.delay(100);
        report({ message: "late report must be ignored" });
        target.setField("title", "late mutation");
      } },
      changeTitle,
    ] });
    const result = plugin().runner.lastResult;
    assert.equal(result.failed, 1);
    assert.equal(result.saved, 1);
    await Zotero.Promise.delay(150);
    assert.equal(item.getField("title"), "deadline saved");
    assert.isFalse(item.hasChanged());
    assert.notInclude(result.records.map((row: { message: string }) => row.message), "late report must be ignored");
  });

  it("uses the live item when a report action starts a new batch after its rule has finished", async function () {
    const item = await create("publisher action", "webpage");
    item.setField("url", "https://www.nature.com/articles/test");
    await item.saveTx();
    await plugin().hooks.onLintInBatch("no-article-webpage", [item]);
    const action = plugin().runner.lastResult.records.find((record: { ruleID: string }) => record.ruleID === "no-article-webpage")?.action;
    assert.isDefined(action);
    const onLint = plugin().hooks.onLintInBatch;
    plugin().hooks.onLintInBatch = async (_rules: unknown, items: Zotero.Item[]) => {
      assert.strictEqual(items[0], item, "report action must retrieve the live item rather than retaining an expired proxy");
      await plugin().runner.add({ items, rules: [changeTitle], silent: true });
    };
    try {
      await action.callback();
      assert.equal(item.getField("title"), "publisher action saved");
      assert.equal(plugin().runner.lastResult.saved, 1);
    }
    finally {
      plugin().hooks.onLintInBatch = onLint;
    }
  });

  it("runs all local standard rules across article, conference, thesis, book and patent fields", async function () {
    const rules: ID[] = [
      "no-item-duplication",
      "no-article-webpage",
      "no-journal-preprint",
      "no-value-nullish",
      "no-field-misuse",
      "require-language",
      "no-title-trailing-dot",
      "correct-title-punctuation",
      "correct-title-sentence-case",
      "correct-title-chemical-formula",
      "require-short-title",
      "correct-shortTitle-sentence-case",
      "require-creators",
      "correct-creators-punctuation",
      "correct-creators-case",
      "correct-creators-pinyin",
      "correct-date-format",
      "correct-extra-order",
      "no-doi-prefix",
      "correct-publication-title-alias",
      "correct-publication-title-case",
      "require-journal-abbr",
      "tool-query-esi",
      "correct-pages-connector",
      "correct-pages-range",
      "no-issue-extra-zeros",
      "no-pages-extra-zeros",
      "no-volume-extra-zeros",
      "correct-conference-abbr",
      "correct-proceedingsTitle-sentence-case",
      "correct-thesis-type",
      "correct-university-punctuation",
      "require-university-place",
      "correct-edition-numeral",
      "correct-volume-numeral",
      "correct-bookTitle-sentence-case",
      "correct-filing-date-format",
      "correct-issue-date-format",
      "correct-priority-date-format",
    ];
    const items: Zotero.Item[] = [];
    for (const type of ["journalArticle", "conferencePaper", "thesis", "book", "patent", "webpage", "preprint"] as const) {
      const item = await create(`MetaRef QA ${type} H2O: Metadata formatting`, type);
      item.setCreators([{ creatorType: type === "patent" ? "inventor" : "author", firstName: "Jane", lastName: "Doe" }]);
      for (const [field, value] of Object.entries({ language: "en", publicationTitle: "Physical Review Letters", conferenceName: "International Conference on Machine Learning", university: "清华大学", date: "2024/03/07", pages: "001-009", issue: "003", volume: "004", edition: "2nd", filingDate: "2024/03/07", issueDate: "2024/03/08", priorityDate: "2024/03/06", extra: "Z-field: value\nCitation Key: QAtest" })) {
        if (Zotero.ItemFields.isValidForType(Zotero.ItemFields.getID(field), item.itemTypeID))
          item.setField(field, value);
      }
      await item.saveTx();
      items.push(item);
    }
    await plugin().hooks.onLintInBatch(rules, items);
    const result = plugin().runner.lastResult;
    assert.equal(result.processed, 7);
    assert.equal(result.failed, 0, JSON.stringify(result.records));
    for (const item of items) {
      assert.isFalse(item.hasChanged(), item.itemType);
      assert.include(item.getField("title", false, true), "H<sub>2</sub>O");
    }
    assert.isNotEmpty(items[0].getField("journalAbbreviation"));
    assert.include((await plugin().api.getJournalInsights(items[0])).esi, "ESI");
    assert.isNotEmpty(items[2].getField("place"));
  });

  it("preserves a manually entered abbreviation and series when no replacement is available", async function () {
    const item = await create("preserve fields");
    item.setField("publicationTitle", "Unknown QA Journal");
    item.setField("journalAbbreviation", "Manual QA Abbr.");
    item.setField("series", "Original series");
    await item.saveTx();
    await plugin().hooks.onLintInBatch("require-journal-abbr", [item]);
    assert.equal(item.getField("journalAbbreviation"), "Manual QA Abbr.");
    item.setField("publicationTitle", "Physical Review Letters");
    await item.saveTx();
    await plugin().hooks.onLintInBatch("tool-query-esi", [item]);
    assert.equal(item.getField("series"), "Original series");
  });

  it("updates creator annotations and CSL extra data without saving inside a rule", async function () {
    const item = await create("tools");
    item.setCreators([{ creatorType: "author", firstName: "Jane", lastName: "Doe" }]);
    await item.saveTx();
    await plugin().runner.applyRuleByID(item, "tool-creators-ext", { mark: "[]", country: "US" });
    assert.equal(item.getCreators()[0].lastName, "[US] Doe");
    assert.isTrue(item.hasChanged());
    await plugin().runner.applyRuleByID(item, "tool-creators-ext", { mark: "[]", country: "UK" });
    assert.equal(item.getCreators()[0].lastName, "[UK] Doe");
    await plugin().runner.applyRuleByID(item, "tool-csl-helper", { data: { "original-title": ["Original title"] } });
    assert.include(item.getField("extra"), "original-title: Original title");
    assert.isTrue(item.hasChanged());
    await item.saveTx();
  });

  it("falls back after a malformed service result and preserves fields in blank mode", async function () {
    const item = await create("original metadata title");
    item.setField("DOI", "10.1234/qa");
    item.setCreators([{ creatorType: "author", firstName: "Jane", lastName: "Doe" }]);
    await item.saveTx();
    pref("rule.tool-update-metadata.option.slient", true);
    pref("rule.tool-update-metadata.option.mode", "blank");
    pref("rule.tool-update-metadata.option.allow-type-changed", false);
    const OriginalSearch = Zotero.Translate.Search;
    let calls = 0;
    (Zotero.Translate as any).Search = class {
      setSearch() {}
      setIdentifier() {}
      setTranslator() {}
      async getTranslators() { return [{}]; }
      async translate() {
        calls++;
        if (calls === 1) {
          const bad = {};
          Object.defineProperty(bad, "title", { enumerable: true, get() {
            throw new Error("malformed service field");
          } });
          return [bad];
        }
        return [{ itemType: "journalArticle", title: "replacement title", publicationTitle: "QA Journal", creators: [], accessDate: "invalid-date", volume: { invalid: true }, libraryCatalog: "QA service" }];
      }
    };
    try {
      await plugin().hooks.onLintInBatch("tool-update-metadata", [item]);
      assert.equal(calls, 2);
      assert.equal(item.getField("title"), "original metadata title");
      assert.equal(item.getField("publicationTitle"), "QA Journal");
      assert.equal(item.getCreators()[0].lastName, "Doe");
      assert.equal(item.getField("accessDate"), "");
      assert.equal(item.getField("volume"), "");
      assert.equal(plugin().runner.lastResult.failed, 0);
      assert.isFalse(item.hasChanged());
    }
    finally {
      (Zotero.Translate as any).Search = OriginalSearch;
    }
  });

  it("preserves incompatible fields and creator roles during blank-only metadata updates", async function () {
    const article = await create("retained article title");
    article.setField("DOI", "10.1234/type-qa");
    article.setField("volume", "42");
    await article.saveTx();
    const page = await create("retained webpage title", "webpage");
    page.setField("url", "https://doi.org/10.1234/type-qa");
    page.setCreators([{ creatorType: "translator", lastName: "Original translator" }]);
    await page.saveTx();
    const OriginalSearch = Zotero.Translate.Search;
    (Zotero.Translate as any).Search = class {
      setSearch() {}
      setIdentifier() {}
      setTranslator() {}
      async getTranslators() { return [{}]; }
      async translate() {
        return [{ itemType: "preprint", title: "service title", abstractNote: "new abstract", creators: [{ creatorType: "author", lastName: "New author" }] }];
      }
    };
    pref("rule.tool-update-metadata.option.slient", true);
    pref("rule.tool-update-metadata.option.mode", "blank");
    pref("rule.tool-update-metadata.option.allow-type-changed", true);
    try {
      for (const item of [article, page]) {
        const before = item.toJSON();
        const beforeType = item.itemType;
        await plugin().hooks.onLintInBatch("tool-update-metadata", [item]);
        assert.equal(item.itemType, beforeType);
        assert.equal(item.getField("title"), before.title);
        assert.equal(item.getField("abstractNote"), "new abstract");
        assert.isTrue(plugin().runner.lastResult.records.some((row: { level: string }) => row.level === "warning"));
        assert.equal(plugin().runner.lastResult.failed, 0);
        await item.reload(["primaryData", "itemData", "creators"], true);
      }
      assert.equal(article.getField("volume"), "42");
      assert.equal(page.getCreators()[0].creatorTypeID, Zotero.CreatorTypes.getID("translator"));
      assert.equal(page.getCreators()[0].lastName, "Original translator");
    }
    finally {
      (Zotero.Translate as any).Search = OriginalSearch;
    }
  });

  it("updates preprints and resolves PMID and URL service fallbacks", async function () {
    const preprint = await create("original preprint", "preprint");
    preprint.setField("url", "https://arxiv.org/abs/2401.12345v2");
    await preprint.saveTx();
    const pmid = await create("original PMID article");
    pmid.setField("extra", "PMID: 12345678");
    await pmid.saveTx();
    const webpage = await create("original webpage", "webpage");
    webpage.setField("url", "https://invalid.example/metadata-qa");
    await webpage.saveTx();
    const request = Zotero.HTTP.request;
    const processDocuments = Zotero.HTTP.processDocuments;
    const OriginalSearch = Zotero.Translate.Search;
    const OriginalWeb = Zotero.Translate.Web;
    const urls: string[] = [];
    (Zotero.Translate as any).Search = class {
      setSearch() {}
      setIdentifier() {}
      async getTranslators() { return []; }
    };
    (Zotero.Translate as any).Web = class {
      setDocument() {}
      setTranslator() {}
      async getTranslators() { return [{}]; }
      async translate() { return [{ itemType: "journalArticle", title: "web result", DOI: "10.1234/web-qa", creators: [] }]; }
    };
    (Zotero.HTTP as any).processDocuments = async (_url: string, callback: (doc: Document) => Document) => [callback(Zotero.getMainWindow().document)];
    (Zotero.HTTP as any).request = async (_method: string, url: string) => {
      urls.push(url);
      if (url.startsWith("https://export.arxiv.org/"))
        return { status: 200, response: "<feed xmlns='http://www.w3.org/2005/Atom' xmlns:arxiv='http://arxiv.org/schemas/atom'><entry><arxiv:doi>10.1234/published-qa</arxiv:doi></entry></feed>" };
      if (url.includes("PMID%3A12345678"))
        return { status: 200, response: JSON.stringify({ paperId: "pmid-qa", title: "PMID result", publicationDate: "2025-02-01" }) };
      if (url.includes("DOI%3A10.1234%2Fpublished-qa"))
        return { status: 200, response: JSON.stringify({ paperId: "arxiv-qa", title: "published result", publicationTypes: ["Journal Article"], externalIds: { DOI: "10.1234/published-qa" }, publicationDate: "2025-01-01" }) };
      throw new Error("injected service fallback");
    };
    pref("rule.tool-update-metadata.option.slient", true);
    pref("rule.tool-update-metadata.option.mode", "all");
    pref("rule.tool-update-metadata.option.allow-type-changed", true);
    try {
      for (const item of [preprint, pmid, webpage]) {
        await plugin().hooks.onLintInBatch("tool-update-metadata", [item]);
        assert.equal(plugin().runner.lastResult.failed, 0);
        assert.isFalse(item.hasChanged());
      }
      assert.equal(preprint.itemType, "journalArticle");
      assert.equal(preprint.getField("DOI"), "10.1234/published-qa");
      assert.equal(preprint.getField("title"), "published result");
      assert.equal(pmid.getField("title"), "PMID result");
      assert.equal(webpage.getField("title"), "web result");
      assert.isTrue(urls.some(url => url.includes("PMID%3A12345678")));
      assert.isTrue(urls.some(url => url.includes("DOI%3A10.1234%2Fpublished-qa")), "the DOI obtained from arXiv reaches the metadata service");
    }
    finally {
      Zotero.HTTP.request = request;
      Zotero.HTTP.processDocuments = processDocuments;
      (Zotero.Translate as any).Search = OriginalSearch;
      (Zotero.Translate as any).Web = OriginalWeb;
    }
  });

  it("keeps menus, columns and title listeners stable on repeated window initialization", async function () {
    const win = Zotero.getMainWindow();
    await plugin().hooks.onMainWindowLoad(win);
    await plugin().hooks.onMainWindowLoad(win);
    const entries = (Zotero.MenuManager as any)._menuManager.getCustomMenuOptions("main/library/item").filter((entry: any) => entry.pluginID === config.addonID);
    assert.equal(entries.length, 1, "the main menu is registered only once");
    const columns = (Zotero.ItemTreeManager as any).getCustomColumns(undefined, { pluginID: config.addonID });
    assert.equal(columns.length, 3);
    const countESI = (menus: any[]): number => menus.reduce((count, menu) => count + (menu.l10nID === "metaref-rule-tool-query-esi-menu-item" ? 1 : 0) + countESI(menu.menus || []), 0);
    assert.equal(countESI(entries.flatMap((entry: any) => entry.menus)), 1);
    const metarefMenu = entries.flatMap((entry: any) => entry.menus).find((menu: any) => menu.l10nID === "metaref-menuitem-label");
    assert.isDefined(metarefMenu, "the MetaRef root item is registered");
    assert.equal(metarefMenu.menus.filter((menu: any) => menu.menuType === "submenu").length, 0, "all commands are directly accessible without nested submenus");
    assert.equal(metarefMenu.menus.filter((menu: any) => menu.menuType === "menuitem").length, 22);
    assert.equal(metarefMenu.menus.filter((menu: any) => menu.l10nID === "metaref-tool-query-nature-index-menu-item").length, 1);
    const item = await create("inline title formatting");
    await win.ZoteroPane.selectItem(item.id);
    const editor = win.document.querySelector("item-pane-header .title editable-text textarea") as HTMLTextAreaElement;
    assert.isNotNull(editor);
    win.focus();
    for (let attempt = 0; attempt < 100 && !win.document.hasFocus(); attempt++)
      await Zotero.Promise.delay(25);
    assert.isTrue(win.document.hasFocus(), "focus the library window before testing title editor events");
    editor.focus();
    await Zotero.Promise.delay(50);
    const titleField = editor.closest("item-pane-header .title")!;
    const toolbar = titleField.querySelector(".metaref-richtext-toolbar")!;
    assert.isNotNull(toolbar, "formatting toolbar appears beneath the main header title");
    assert.isNull(win.document.querySelector("#zotero-item-pane editable-text[fieldname='title'] .metaref-richtext-toolbar"), "the info section does not get a toolbar");
    assert.equal(toolbar.querySelectorAll("button").length, 6);
    editor.value = "H2O";
    editor.setSelectionRange(1, 2);
    toolbar.querySelector<HTMLButtonElement>("#metaref-richtext-subscript-btn")!
      .dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    assert.equal(editor.value, "H<sub>2</sub>O", "toolbar formats the selected title text");
    const subscriptStart = editor.value.indexOf("<sub>");
    const digitStart = editor.value.indexOf("2", subscriptStart);
    editor.setSelectionRange(digitStart, digitStart + 1);
    editor.dispatchEvent(new win.Event("select"));
    const boldButton = toolbar.querySelector<HTMLButtonElement>("#metaref-richtext-bold-btn")!;
    boldButton.focus();
    boldButton.dispatchEvent(new win.MouseEvent("click", { bubbles: true, detail: 0 }));
    assert.equal(editor.value, "H<sub><b>2</b></sub>O", "keyboard activation keeps the title selection and adds nested formatting");
    editor.setSelectionRange(subscriptStart, editor.value.indexOf("</sub>") + "</sub>".length);
    editor.dispatchEvent(new win.Event("select"));
    const subscriptButton = toolbar.querySelector<HTMLButtonElement>("#metaref-richtext-subscript-btn")!;
    subscriptButton.focus();
    subscriptButton.dispatchEvent(new win.MouseEvent("click", { bubbles: true, detail: 0 }));
    assert.equal(editor.value, "H<b>2</b>O", "removing a format preserves nested bold markup");
    assert.isNull(titleField.querySelector("#metaref-title-preview"), "title formatting does not add a duplicate preview box");
    editor.value = "inline title formatting";
    editor.dispatchEvent(new win.Event("input", { bubbles: true }));
    const otherInput = win.document.createElementNS("http://www.w3.org/1999/xhtml", "input") as HTMLInputElement;
    win.document.documentElement!.appendChild(otherInput);
    win.focus();
    for (let attempt = 0; attempt < 100 && !win.document.hasFocus(); attempt++)
      await Zotero.Promise.delay(25);
    assert.isTrue(win.document.hasFocus(), "focus changes must occur in the active library window");
    otherInput.focus();
    for (let attempt = 0; attempt < 20 && win.document.querySelector(".metaref-richtext-toolbar"); attempt++)
      await Zotero.Promise.delay(25);
    assert.isNull(win.document.querySelector(".metaref-richtext-toolbar"), `toolbar closes after blur: active=${win.document.activeElement?.localName}, focused=${win.document.hasFocus()}`);
    const infoEditor = win.document.querySelector("#zotero-item-pane editable-text[fieldname='title'] textarea") as HTMLTextAreaElement;
    assert.isNotNull(infoEditor);
    infoEditor.focus();
    await Zotero.Promise.delay(50);
    assert.isNull(win.document.querySelector(".metaref-richtext-toolbar"), "the info title field never opens the header toolbar");
    infoEditor.blur();
    otherInput.remove();
  });

  it("delivers each item notification once after repeated plugin initialization", async function () {
    const item = await create("single observer");
    const instance = plugin();
    const onNotify = instance.hooks.onNotify;
    let calls = 0;
    instance.hooks.onNotify = async (event: string, type: string, ids: number[]) => {
      if (event === "add" && type === "item" && ids.includes(item.id))
        calls++;
    };
    try {
      await instance.hooks.onStartup();
      await instance.hooks.onStartup();
      await Zotero.Notifier.trigger("add", "item", [item.id], {}, true);
      assert.equal(calls, 1);
    }
    finally {
      instance.hooks.onNotify = onNotify;
    }
  });

  it("cancels the entire combined workflow when a tool dialog is cancelled", async function () {
    const item = await create("tool cancelled");
    await plugin().runner.add({ items: [item], silent: true, rules: [
      { id: "test-tool-dialog", scope: "item", category: "tool", prepare() { return false; }, apply() {
        throw new Error("cancelled tool must not run");
      } },
      changeTitle,
    ] });
    assert.equal(item.getField("title"), "tool cancelled");
    assert.equal(plugin().runner.lastResult.saved, 0);
    assert.isTrue(plugin().runner.lastResult.cancelled);
  });

  it("runs DOI services and remaining tools through the same save boundary", async function () {
    const item = await create(["《", "QA", "》"].join(""));
    item.setField("DOI", "10/qa");
    await item.saveTx();
    const request = Zotero.HTTP.request;
    const urls: string[] = [];
    (Zotero.HTTP as any).request = async (_method: string, url: string) => {
      urls.push(url);
      if (url.startsWith("https://doi.org/api/handles/"))
        return { status: 200, response: { responseCode: 1, values: [{ type: "HS_ALIAS", data: { value: "10.1234/qa" } }] } };
      if (url.startsWith("https://shortdoi.org/"))
        return { status: 200, responseText: JSON.stringify({ ShortDOI: "10/qa2" }) };
      if (url.startsWith("https://www.crossref.org/openurl")) {
        const responseXML = new (Zotero.getMainWindow() as unknown as Window & typeof globalThis).DOMParser().parseFromString("<doi_records><query status=\"resolved\"><doi>10.1234/resolved</doi></query></doi_records>", "application/xml");
        return { status: 200, responseXML };
      }
      throw new Error(`Unexpected request: ${url}`);
    };
    try {
      await plugin().runner.applyRuleByID(item, "correct-doi-long", {});
      assert.equal(item.getField("DOI"), "10.1234/qa");
      assert.isTrue(item.hasChanged());
      item.setField("extra", "");
      await plugin().runner.applyRuleByID(item, "tool-get-short-doi", {});
      assert.include(item.getField("extra"), "10/qa2");
      item.setField("DOI", "");
      await plugin().runner.applyRuleByID(item, "require-doi", {});
      assert.equal(item.getField("DOI"), "10.1234/resolved");
      assert.lengthOf(urls, 3);
      await plugin().runner.applyRuleByID(item, "tool-title-guillemet", { target: "single" });
      assert.equal(item.getField("title"), "〈QA〉");
      await plugin().runner.applyRuleByID(item, "tool-set-language", { language: "de" });
      assert.equal(item.getField("language"), "de");
      await plugin().runner.applyRuleByID(item, "tool-clean-extra", { fieldsToClean: ["short-doi"] });
      assert.equal(item.getField("extra"), "");
      assert.isTrue(item.hasChanged());
      await item.saveTx();
    }
    finally {
      Zotero.HTTP.request = request;
    }
  });

  it("bounds concurrent items and captures the selection when queuing a later batch", async function () {
    pref("lint.numConcurrent", 3);
    const items: Zotero.Item[] = [];
    for (let i = 0; i < 6; i++)
      items.push(await create(`concurrent ${i}`));
    let active = 0;
    let maximum = 0;
    const pending = plugin().runner.add({ items: [...items, items[0]], silent: true, rules: [{
      id: "test-concurrency",
      scope: "item",
      async apply({ item }: { item: Zotero.Item }) {
        active++;
        maximum = Math.max(maximum, active);
        await Zotero.Promise.delay(30);
        item.setField("title", `${item.getField("title")} first`);
        active--;
      },
    }] });
    const selected = [items[5]];
    const next = plugin().runner.add({ items: selected, rules: [changeTitle], silent: true });
    selected.length = 0;
    await pending;
    assert.isAtMost(maximum, 3);
    assert.isAbove(maximum, 1);
    assert.equal(plugin().runner.lastResult.processed, 6);
    await next;
    assert.equal(items[5].getField("title"), "concurrent 5 first saved");
    for (const item of items)
      assert.isFalse(item.hasChanged());
    pref("lint.numConcurrent", 1);
  });

  it("rechecks automatic lint preferences after its import delay", async function () {
    const item = await create("MoS2 automatic delay");
    pref("lint.onAdded", true);
    const delayed = plugin().hooks.onNotify("add", "item", [item.id], {});
    pref("lint.onAdded", false);
    await delayed;
    assert.equal(item.getField("title"), "MoS2 automatic delay");
    assert.isFalse(item.hasChanged());
  });

  it("runs the collection menu on that collection's items instead of the item-list selection", async function () {
    const win = Zotero.getMainWindow();
    const item = await create("collection MoS2");
    const unrelated = await create("outside WS2");
    const collection = new Zotero.Collection();
    const tree = win.ZoteroPane.collectionsView;
    if (!tree)
      throw new Error("Collection tree unavailable");
    collection.name = "MetaRef QA collection";
    await collection.saveTx();
    try {
      item.setCollections([collection.id]);
      await item.saveTx();
      await tree.selectCollection(collection.id);
      const rowIndex = tree.getRowIndexByID(`C${collection.id}`);
      if (rowIndex === false)
        throw new Error("Test collection not found");
      const row = tree.getRow(rowIndex);
      assert.isTrue(row.isCollection());
      const entries = (Zotero.MenuManager as any)._menuManager.getCustomMenuOptions("main/library/collection").filter((entry: any) => entry.pluginID === config.addonID);
      const find = (menus: any[]): any => menus.find(menu => menu.l10nID === "metaref-rule-correct-title-chemical-formula-menu-item") || menus.map(menu => find(menu.menus || [])).find(Boolean);
      const command = find(entries.flatMap((entry: any) => entry.menus));
      assert.isDefined(command);
      await command.onCommand(null, { collectionTreeRows: [row] });
      assert.equal(item.getField("title", false, true), "collection MoS<sub>2</sub>");
      assert.equal(unrelated.getField("title", false, true), "outside WS2");
      await tree.selectLibrary(Zotero.Libraries.userLibraryID);
    }
    finally {
      await collection.eraseTx();
    }
  });

  it("undoes and redoes an entire successful metadata batch", async function () {
    const item = await create("undo MoS2");
    const undo = (Zotero as any).UndoHistory;
    assert.isDefined(undo);
    await plugin().hooks.onLintInBatch("correct-title-chemical-formula", [item]);
    assert.equal(item.getField("title", false, true), "undo MoS<sub>2</sub>");
    assert.isTrue(undo.canUndo());
    await undo.undo();
    await item.reload(["itemData"], true);
    assert.equal(item.getField("title", false, true), "undo MoS2");
    assert.isTrue(undo.canRedo());
    await undo.redo();
    await item.reload(["itemData"], true);
    assert.equal(item.getField("title", false, true), "undo MoS<sub>2</sub>");
  });

  it("falls back to bundled reference data when custom abbreviation and ESI files are invalid", async function () {
    const path = PathUtils.join(PathUtils.tempDir, `metaref-invalid-custom-${Date.now()}.json`);
    await IOUtils.writeUTF8(path, "{\"Physical Review Letters\":42}");
    const item = await create("custom data fallback");
    item.setField("publicationTitle", "Physical Review Letters");
    await item.saveTx();
    pref("rule.require-journal-abbr.customDataPath", path);
    pref("insights.esiCustomDataPath", path);
    try {
      await plugin().hooks.onLintInBatch(["require-journal-abbr", "tool-query-esi"], [item]);
      assert.isNotEmpty(item.getField("journalAbbreviation"));
      assert.include((await plugin().api.getJournalInsights(item)).esi, "ESI");
      assert.equal(plugin().runner.lastResult.failed, 0);
      assert.equal(plugin().runner.lastResult.records.filter((row: { level: string }) => row.level === "warning").length, 2);
    }
    finally {
      pref("rule.require-journal-abbr.customDataPath", "");
      pref("insights.esiCustomDataPath", "");
      await IOUtils.remove(path);
    }
  });

  it("opens each settings tool and cancels it without running the following formatter", async function () {
    const item = await create("settings tools MoS2");
    item.setCreators([{ creatorType: "author", firstName: "Jane", lastName: "Doe" }]);
    item.setField("extra", "QA field: value");
    await item.saveTx();
    pref("rule.tool-update-metadata.option.slient", false);
    for (const id of ["tool-title-guillemet", "tool-creators-ext", "tool-set-language", "tool-update-metadata", "tool-csl-helper", "tool-clean-extra"] as ID[]) {
      const previousDialogs = new Set(plugin().data.dialogs.keys());
      const pending = plugin().hooks.onLintInBatch([id, "correct-title-chemical-formula"], [item]);
      let dialog: Window | undefined;
      for (let attempt = 0; attempt < 100 && !dialog; attempt++) {
        await Zotero.Promise.delay(50);
        dialog = [...plugin().data.dialogs.entries()].find(([key]: any) => !previousDialogs.has(key))?.[1] as Window | undefined;
      }
      assert.isDefined(dialog, `${id} settings opens`);
      assert.isNotEmpty(dialog!.document.querySelectorAll("input, select"), `${id} settings has editable controls`);
      dialog!.close();
      await pending;
      assert.equal(item.getField("title", false, true), "settings tools MoS2", id);
      assert.isFalse(item.hasChanged(), id);
      assert.isTrue(plugin().runner.lastResult.cancelled, id);
    }
  });

  it("accepts settings before applying a tool and the following formatter", async function () {
    const item = await create("accepted settings MoS2");
    item.setField("extra", "QA field: value");
    await item.saveTx();
    const pending = plugin().hooks.onLintInBatch(["tool-clean-extra", "correct-title-chemical-formula"], [item]);
    let dialog: Window | undefined;
    for (let attempt = 0; attempt < 100 && !dialog; attempt++) {
      await Zotero.Promise.delay(50);
      dialog = [...plugin().data.dialogs.values()][0] as Window | undefined;
    }
    assert.isDefined(dialog);
    const checkbox = dialog!.document.querySelector("input[type='checkbox']") as HTMLInputElement;
    checkbox.checked = true;
    (dialog!.document.getElementById("btn-ok") as HTMLButtonElement).click();
    await pending;
    assert.equal(item.getField("extra"), "");
    assert.equal(item.getField("title", false, true), "accepted settings MoS<sub>2</sub>");
    assert.isFalse(plugin().runner.lastResult.cancelled);
    assert.equal(plugin().runner.lastResult.saved, 1);
  });

  it("closes a pending tool before waiting for shutdown and removes registered UI", async function () {
    const item = await create("shutdown MoS2");
    item.setField("extra", "QA field: value");
    await item.saveTx();
    const instance = plugin();
    const pending = instance.hooks.onLintInBatch(["tool-clean-extra", "correct-title-chemical-formula"], [item]);
    for (let attempt = 0; attempt < 100 && !instance.data.dialogs.size; attempt++)
      await Zotero.Promise.delay(50);
    assert.isAbove(instance.data.dialogs.size, 0);
    try {
      await instance.hooks.onShutdown();
      await pending;
      assert.equal(item.getField("title"), "shutdown MoS2");
      assert.equal(instance.data.dialogs.size, 0);
      assert.isUndefined(plugin());
      assert.isEmpty((Zotero.ItemTreeManager as any).getCustomColumns(undefined, { pluginID: config.addonID }));
      const entries = (Zotero.MenuManager as any)._menuManager.getCustomMenuOptions("main/library/item").filter((entry: any) => entry.pluginID === config.addonID);
      assert.isEmpty(entries);
    }
    finally {
      (Zotero as any)[config.addonInstance] = instance;
      instance.data.alive = true;
      await instance.hooks.onStartup();
    }
  });
});
