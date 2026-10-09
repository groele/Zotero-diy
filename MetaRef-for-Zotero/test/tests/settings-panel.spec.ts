import { assert } from "chai";
import { config } from "../../package.json";

describe("settings panel navigation and validation in Zotero", function () {
  this.timeout(30_000);
  let win: Window & typeof globalThis;
  let pane: HTMLElement;
  let search: HTMLInputElement;
  let previousConcurrency: number;
  const pref = (key: string) => `${config.prefsPrefix}.${key}`;
  const find = (key: string) => pane.querySelector<HTMLElement>(`[preference='${pref(key)}']`)!;
  const query = (value: string) => {
    search.value = value;
    search.dispatchEvent(new win.Event("input", { bubbles: true }));
  };

  before(async function () {
    previousConcurrency = Zotero.Prefs.get(pref("lint.numConcurrent"), true) as number;
    const entry = (Zotero.PreferencePanes as any).pluginPanes.find((entry: any) => entry.pluginID === config.addonID);
    win = Zotero.Utilities.Internal.openPreferences(entry.id)! as Window & typeof globalThis;
    for (let attempt = 0; attempt < 100 && !win.document.getElementById("metaref-concurrency-status"); attempt++)
      await Zotero.Promise.delay(50);
    await (win as any).Zotero_Preferences.waitForFirstPaneLoad();
    pane = win.document.getElementById("metaref") as HTMLElement;
    await win.document.l10n!.translateFragment(pane);
    await Zotero.Promise.delay(50);
    search = pane.querySelector<HTMLInputElement>(".metaref-settings-search")!;
  });

  after(function () {
    Zotero.Prefs.set(pref("lint.numConcurrent"), previousConcurrency, true);
    win?.close();
  });

  it("filters individual settings by multiple keywords, retains parent switches and never indexes secrets", function () {
    const detail = find("rule.correct-title-sentence-case").closest("details") as HTMLDetailsElement;
    const originalOpen = detail.open;
    query("sentence-case custom-term");
    assert.isTrue(detail.open);
    assert.isFalse(find("rule.correct-title-sentence-case").hidden, "parent switch stays visible");
    assert.isFalse((find("rule.correct-title-sentence-case.custom-term-path").closest("hbox") as HTMLElement).hidden);
    assert.isTrue(find("rule.no-title-trailing-dot").hidden, "unrelated setting is hidden within the same group");
    assert.isTrue((pane.querySelector(".metaref-settings-disclosure") as HTMLButtonElement).disabled);
    query("");
    assert.equal(detail.open, originalOpen);
    assert.isFalse(find("rule.no-title-trailing-dot").hidden);
    const secret = find("semanticScholarToken") as HTMLInputElement;
    const previous = secret.value;
    secret.value = "private-settings-search-secret-qa";
    query(secret.value);
    assert.isFalse(pane.querySelector<HTMLElement>(".metaref-settings-empty")!.hidden);
    secret.value = previous;
    pane.querySelector(".metaref-settings-clear")!.dispatchEvent(new win.Event("command", { bubbles: true }));
    assert.equal(search.value, "");
    assert.equal(win.document.activeElement, search);
    assert.isTrue((pane.querySelector(".metaref-settings-clear") as HTMLButtonElement).disabled);
  });

  it("jumps between all seven sections and expands or collapses rules without changing preferences", function () {
    const details = [...pane.querySelectorAll<HTMLDetailsElement>("details")];
    const initial = details.map(detail => detail.open);
    const keys = [...pane.querySelectorAll<HTMLElement>("[preference]")].map(control => control.getAttribute("preference")!);
    const snapshot = keys.map(key => Zotero.Prefs.get(key, true));
    const expand = pane.querySelector(".metaref-settings-disclosure[data-open='true']")!;
    const collapse = pane.querySelector(".metaref-settings-disclosure[data-open='false']")!;
    expand.dispatchEvent(new win.Event("command", { bubbles: true }));
    assert.isTrue(details.every(detail => detail.open));
    collapse.dispatchEvent(new win.Event("command", { bubbles: true }));
    assert.isTrue(details.every(detail => !detail.open));
    assert.deepEqual(keys.map(key => Zotero.Prefs.get(key, true)), snapshot);
    details.forEach((detail, index) => detail.open = initial[index]);
    query("no-such-setting-qa");
    const jump = pane.querySelector<HTMLSelectElement>(".metaref-settings-jump")!;
    assert.lengthOf(jump.options, 8);
    for (const option of (Array.from(jump.options) as HTMLOptionElement[]).slice(1)) {
      assert.isNotEmpty(option.textContent!.trim());
      jump.value = option.value;
      jump.dispatchEvent(new win.Event("change", { bubbles: true }));
      const group = win.document.getElementById(option.value)!;
      assert.isFalse((group as HTMLElement).hidden);
      assert.equal(search.value, "");
      assert.equal(win.document.activeElement, group.querySelector("h2"));
    }
    pane.dispatchEvent(new win.KeyboardEvent("keydown", { key: "f", ctrlKey: !Zotero.isMac, metaKey: Zotero.isMac, bubbles: true, cancelable: true }));
    assert.equal(win.document.activeElement, search);
  });

  it("validates custom files before activation, rejects edits at the same path, and keeps paths on cancellation", async function () {
    const plugin = (Zotero as any)[config.addonInstance];
    const picker = plugin.data.ztoolkit.FilePicker.prototype;
    const originalOpen = picker.open;
    const paths: string[] = [];
    const previous = new Map<string, unknown>();
    const choices: (string | undefined)[] = [];
    picker.open = async () => choices.shift();
    try {
      for (const [kind, rule, key, content, broken] of [
        ["abbr", "rule.require-journal-abbr", "rule.require-journal-abbr.customDataPath", "{\"QA Journal\":\"QA J.\"}", "broken JSON"],
        ["title", "rule.correct-title-sentence-case", "rule.correct-title-sentence-case.custom-term-path", "mos2,MoS2\n", "/[/g,invalid\n"],
      ]) {
        query("");
        for (const name of [rule, key])
          previous.set(pref(name), Zotero.Prefs.get(pref(name), true));
        const control = find(rule) as HTMLInputElement;
        control.checked = true;
        control.dispatchEvent(new win.Event("command", { bubbles: true }));
        const path = PathUtils.join(PathUtils.tempDir, `metaref-settings-${Date.now()}-${kind}.${kind === "abbr" ? "json" : "csv"}`);
        paths.push(path);
        await Zotero.File.putContentsAsync(path, content);
        const input = find(key) as HTMLInputElement;
        const row = input.parentElement!;
        const button = row.querySelector(`#metaref-${kind}-choose-custom-data-button`)!;
        const status = row.querySelector(".metaref-custom-data-status")!;
        const choose = async (value: string | undefined) => {
          choices.push(value);
          button.dispatchEvent(new win.Event("command", { bubbles: true }));
          assert.equal(row.getAttribute("aria-busy"), "true");
          button.dispatchEvent(new win.Event("command", { bubbles: true }));
          for (let attempt = 0; attempt < 200 && row.hasAttribute("data-busy"); attempt++)
            await Zotero.Promise.delay(25);
          assert.isFalse(row.hasAttribute("data-busy"));
          assert.isFalse((button as HTMLButtonElement).disabled);
          assert.isEmpty(choices, "a repeated command must not open another picker");
        };
        await choose(path);
        assert.equal(Zotero.Prefs.get(pref(key), true), path);
        assert.equal(input.value, path);
        assert.include(status.textContent!, "1");
        const acceptedStatus = status.textContent;
        await Zotero.File.putContentsAsync(path, broken);
        await choose(path);
        assert.equal(Zotero.Prefs.get(pref(key), true), path, "failed validation preserves the previous choice");
        assert.notEqual(status.textContent, acceptedStatus, "edited contents must be revalidated rather than read from the old cache");
        assert.isNotEmpty(status.textContent!.trim());
        await choose(undefined);
        assert.equal(input.value, path);
        assert.equal(status.textContent, "");
        row.querySelector("[data-reset-path='true']")!.dispatchEvent(new win.Event("command", { bubbles: true }));
        assert.equal(input.value, "");
        assert.equal(Zotero.Prefs.get(pref(key), true), "");
      }
    }
    finally {
      picker.open = originalOpen;
      for (const [key, value] of previous) {
        if (value === undefined)
          Zotero.Prefs.clear(key, true);
        else
          Zotero.Prefs.set(key, value as string | boolean, true);
      }
      for (const path of paths)
        await IOUtils.remove(path, { ignoreAbsent: true });
    }
  });

  it("keeps invalid numeric values out of preferences and labels all input controls", async function () {
    const input = find("lint.numConcurrent") as HTMLInputElement;
    for (const value of ["4", "16", "1"]) {
      input.value = value;
      input.dispatchEvent(new win.Event("input", { bubbles: true }));
      assert.equal(Zotero.Prefs.get(pref("lint.numConcurrent"), true), Number(value));
    }
    for (const value of ["", "0", "17", "1.5"]) {
      input.value = value;
      input.dispatchEvent(new win.Event("input", { bubbles: true }));
      input.dispatchEvent(new win.Event("change", { bubbles: true }));
      assert.equal(input.getAttribute("aria-invalid"), "true");
      assert.equal(Zotero.Prefs.get(pref("lint.numConcurrent"), true), 1);
      input.dispatchEvent(new win.Event("blur"));
      assert.equal(input.value, "1");
      assert.isFalse(input.hasAttribute("aria-invalid"));
    }
    for (const control of pane.querySelectorAll<HTMLElement>("input[preference], radiogroup[preference]")) {
      const labelID = control.getAttribute("aria-labelledby");
      assert.isNotNull(labelID, `${control.getAttribute("preference")} has an accessible label`);
      assert.isNotNull(win.document.getElementById(labelID!));
    }
    win.resizeTo(780, 720);
    query("sentence-case custom-term");
    search.scrollIntoView({ block: "start" });
    await Zotero.Promise.delay(100);
    const rect = pane.getBoundingClientRect();
    assert.isAtMost(pane.scrollWidth, pane.clientWidth + 1, "the settings panel fits its available width");
    const canvas = win.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas") as HTMLCanvasElement;
    canvas.width = Math.ceil(rect.width);
    canvas.height = Math.min(600, Math.ceil(rect.height));
    const context = canvas.getContext("2d")!;
    (context as any).drawWindow(win, rect.left, rect.top, canvas.width, canvas.height, "rgb(245,245,245)");
    const bytes = Uint8Array.from(win.atob(canvas.toDataURL("image/png").split(",")[1]), char => char.charCodeAt(0));
    await IOUtils.write(PathUtils.join(PathUtils.tempDir, `metaref-settings-${Zotero.locale}.png`), bytes);
    query("");
  });
});
