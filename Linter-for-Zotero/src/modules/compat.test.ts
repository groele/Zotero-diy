import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../../package.json";
import { checkCompat, compareVersion, mvPref } from "./compat";

vi.mock("../utils/logger", () => ({ logger: { debug: vi.fn() } }));

describe("compareVersion", () => {
  it("should compare version correctly", () => {
    expect(compareVersion("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersion("1.0.0", "1.0.1")).toBe(-1);
    expect(compareVersion("1.0.1", "1.0.0")).toBe(1);
    expect(compareVersion("1.0.0", "1.1.0")).toBe(-1);
    expect(compareVersion("1.0.0-beta.1", "1.0.0-beta.2")).toBe(-1);
    expect(compareVersion("1.0.0-beta.10", "1.0.0-beta.12")).toBe(-1);
  });
  it.each([
    ["1.9.0", "1.10.0", -1],
    ["2.0.0-beta.2", "2.0.0-beta.16", -1],
    ["2.0.0-beta.22", "2.0.0", -1],
    ["2.0.0", "2.0.0-beta.22", 1],
    ["v4.0.1+build.4", "4.0.1", 0],
  ])("orders %s and %s", (a, b, expected) => expect(compareVersion(a, b)).toBe(expected));
});

describe("preference migration", () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([false, "", 0])("preserves the explicit value %s and clears only its source", (value) => {
    const prefs = new Map<string, unknown>([[`${config.prefsPrefix}.old`, value]]);
    vi.stubGlobal("Zotero", { Prefs: {
      get: (key: string) => prefs.get(key),
      set: (key: string, data: unknown) => prefs.set(key, data),
      clear: (key: string) => prefs.delete(key),
    } });
    mvPref("old", "new", true);
    expect(prefs.get(`${config.prefsPrefix}.new`)).toBe(value);
    expect(prefs.has(`${config.prefsPrefix}.old`)).toBe(false);
  });
  it("upgrades an old profile without legacy publication preferences or plugin reloads", async () => {
    const prefs = new Map<string, unknown>([
      [`${config.prefsPrefix}.version`, "1.9.0"],
      [`${config.prefsPrefix}.noExtraZeros`, false],
      [`${config.prefsPrefix}.lint.numConcurrent`, "4"],
    ]);
    vi.stubGlobal("Zotero", { Prefs: {
      get: (key: string) => prefs.get(key),
      set: (key: string, data: unknown) => {
        if (data === undefined)
          throw new Error("Undefined preference");
        prefs.set(key, data);
      },
      clear: (key: string) => prefs.delete(key),
    } });
    await checkCompat();
    for (const field of ["issue", "pages", "volume"])
      expect(prefs.get(`${config.prefsPrefix}.rule.no-${field}-extra-zeros`)).toBe(false);
    expect(prefs.get(`${config.prefsPrefix}.lint.numConcurrent`)).toBe(1);
    expect(prefs.has(`${config.prefsPrefix}.noExtraZeros`)).toBe(false);
  });
});
