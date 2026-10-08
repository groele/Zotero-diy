import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataLoader } from "./data-loader";
import { buildESILookupMaps } from "./esi";
import { cachedJournalInsights, clearJournalInsights, getJournalInsights } from "./journal-insights";
import { buildNatureIndexLookupMaps } from "./nature-index";

const prefs = vi.hoisted(() => ({ path: "", naturePath: "", format: "{subject}ESI" }));
vi.mock("./prefs", () => ({ getPref: (key: string) => key === "insights.natureCustomDataPath" ? prefs.naturePath : key === "insights.esiCustomDataPath" ? prefs.path : prefs.format }));
vi.mock("./data-loader", () => ({ DataLoader: { getESIJournalMaps: vi.fn(), getNatureIndexJournalMaps: vi.fn(), clearCache: vi.fn() } }));
const esi = buildESILookupMaps([{ title: "Known Journal", issn: "1234-5678", category: "PHYSICS" }]);
const nature = buildNatureIndexLookupMaps([{ title: "Known Journal", type: "journal", issn: ["1234-5678"] }]);
const item = (fields: Record<string, string>) => ({ itemType: "journalArticle", getField: (key: string) => fields[key] || "", hasTag: () => true, setField: vi.fn(), addTag: vi.fn() }) as unknown as Zotero.Item;

describe("independent journal insights", () => {
  beforeEach(() => {
    prefs.path = "";
    prefs.naturePath = "";
    prefs.format = "{subject}ESI";
    clearJournalInsights();
    vi.mocked(DataLoader.getESIJournalMaps).mockReset().mockResolvedValue(esi);
    vi.mocked(DataLoader.getNatureIndexJournalMaps).mockReset().mockResolvedValue(nature);
  });
  it("matches ISSN without writing fields or tags and recomputes changed metadata", async () => {
    const fields = { ISSN: "1234-5678", publicationTitle: "Known Journal", series: "Manual", archive: "Archive" };
    const target = item(fields);
    expect(await getJournalInsights(target)).toMatchObject({ esi: "物理学".concat("ESI"), natureIndex: true, esiBasis: "ISSN" });
    expect(target.setField).not.toHaveBeenCalled();
    expect(target.addTag).not.toHaveBeenCalled();
    fields.ISSN = "";
    fields.publicationTitle = "Unknown Journal";
    expect(cachedJournalInsights(target)).toMatchObject({ esi: "", natureIndex: false });
    expect(fields.series).toBe("Manual");
  });
  it("falls back from custom ESI errors while preserving a healthy Nature Index result", async () => {
    prefs.path = "bad.json";
    vi.mocked(DataLoader.getESIJournalMaps).mockRejectedValueOnce(new Error("bad custom file"));
    expect(await getJournalInsights(item({ publicationTitle: "Known Journal" })))
      .toMatchObject({ esiSource: "builtin", customFallback: "bad custom file", natureIndex: true, categories: ["PHYSICS"] });
  });
  it("distinguishes an unavailable dataset from a negative match", async () => {
    vi.mocked(DataLoader.getNatureIndexJournalMaps).mockRejectedValue(new Error("missing dataset"));
    expect(await getJournalInsights(item({ publicationTitle: "Known Journal" })))
      .toMatchObject({ esi: "物理学".concat("ESI"), natureIndex: undefined, natureError: "missing dataset" });
  });
  it("uses a user-defined Nature Index list and independently falls back on errors", async () => {
    prefs.naturePath = "custom.csv";
    expect(await getJournalInsights(item({ publicationTitle: "Known Journal" }))).toMatchObject({ natureSource: "custom", natureIndex: true });
    expect(DataLoader.getNatureIndexJournalMaps).toHaveBeenCalledWith("custom.csv");
    clearJournalInsights();
    vi.mocked(DataLoader.getNatureIndexJournalMaps).mockRejectedValueOnce(new Error("invalid nature list"));
    expect(await getJournalInsights(item({ publicationTitle: "Known Journal" }))).toMatchObject({ natureSource: "builtin", natureFallback: "invalid nature list", categories: ["PHYSICS"] });
  });
  it("does not let a slow old dataset replace the current custom dataset", async () => {
    let resolve!: (data: typeof esi) => void;
    vi.mocked(DataLoader.getESIJournalMaps).mockReturnValueOnce(new Promise((done) => {
      resolve = done;
    }));
    const old = getJournalInsights(item({ publicationTitle: "Known Journal" }));
    prefs.path = "new.json";
    const custom = buildESILookupMaps([{ title: "Known Journal", category: "CHEMISTRY" }]);
    vi.mocked(DataLoader.getESIJournalMaps).mockResolvedValue(custom);
    await getJournalInsights(item({ publicationTitle: "Known Journal" }));
    resolve(esi);
    await old;
    expect(cachedJournalInsights(item({ publicationTitle: "Known Journal" }))?.categories).toEqual(["CHEMISTRY"]);
  });
});
