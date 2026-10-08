import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DataLoader } from "./data-loader";

vi.mock("./logger", () => ({ createLogger: () => ({ debug: vi.fn() }) }));

describe("batch data cache", () => {
  const read = vi.fn();
  beforeEach(() => {
    read.mockReset();
    DataLoader.clearCache();
    vi.stubGlobal("Zotero", { File: { getContentsAsync: read } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shares concurrent file reads and parsed objects", async () => {
    read.mockResolvedValue("{\"Nature\":\"Nature\"}");
    const [first, second] = await Promise.all([DataLoader.load("json", "journals.json"), DataLoader.load("json", "journals.json")]);
    expect(read).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it("retries failed reads rather than caching rejection", async () => {
    read.mockRejectedValueOnce(new Error("missing file")).mockResolvedValueOnce("{}");
    await expect(DataLoader.load("json", "journals.json")).rejects.toThrow("missing file");
    expect(DataLoader.getCacheKeys()).toEqual([]);
    await expect(DataLoader.load("json", "journals.json")).resolves.toEqual({});
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("keeps CSV parsing options independent", async () => {
    read.mockResolvedValue("title,abbr\nNature,Nat.");
    const plain = await DataLoader.load("csv", "journals.csv", { noheader: true });
    const header = await DataLoader.load("csv", "journals.csv", { noheader: false });
    expect(plain).toHaveLength(2);
    expect(header).toEqual([{ title: "Nature", abbr: "Nat." }]);
  });

  it("does not repopulate a cleared cache when an old read finishes", async () => {
    let resolve!: (data: string) => void;
    read.mockReturnValue(new Promise<string>((done) => {
      resolve = done;
    }));
    const pending = DataLoader.load("json", "journals.json");
    DataLoader.clearCache();
    resolve("{}");
    await pending;
    expect(DataLoader.getCacheKeys()).toEqual([]);
  });
  it("shares derived indexes and accepts BOM-prefixed JSON with uppercase file extensions", async () => {
    vi.stubGlobal("rootURI", "test/");
    read.mockResolvedValue("\uFEFF{\"Nature\":\"Nat.\"}");
    const [a, b] = await Promise.all([DataLoader.getJournalAbbrMaps(), DataLoader.getJournalAbbrMaps()]);
    expect(a).toBe(b);
    expect(a.abbrMap.get("nature")).toBe("Nat.");
    expect(read).toHaveBeenCalledTimes(1);
    expect(await DataLoader.load("json", "custom.JSON")).toEqual({ Nature: "Nat." });
  });
});
