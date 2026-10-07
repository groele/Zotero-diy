import { describe, expect, it, vi } from "vitest";
import { presentJournalInsights } from "./journal-insights-presentation";

vi.mock("./locale", () => ({ getString: (id: string, options?: any) => options?.args?.basis ? `Matched by ${options.args.basis}` : id }));
const result = { categories: ["MATERIALS SCIENCE"], esi: "材料科学".concat("ESI"), natureIndex: false, esiSource: "builtin" as const, natureSource: "builtin" as const, esiBasis: "ISSN" as const };

describe("journal insight presentation", () => {
  it("shows localized disciplines without repeating ESI and only shows a successful match basis", () => {
    const rows = presentJournalInsights(result, "zh-CN");
    expect(rows[0].value).toBe("材料科学");
    expect(rows[0].basis).toContain("ISSN");
    expect(rows[1].basis).toBe("");
    expect(presentJournalInsights(result, "en-US")[0].value).toBe("Materials Science");
  });
  it("distinguishes dataset failure from a negative match and keeps the fallback diagnosis", () => {
    const rows = presentJournalInsights({ ...result, esiError: "Broken database", customFallback: "Invalid row", natureFallback: "Unreadable file" }, "en-US");
    expect(rows[0].value).toBe("journal-insights-unavailable");
    expect(rows[0].basis).toBe("");
    expect(rows[0].warning).toBe("Broken database");
    expect(rows[1].warning).toContain("Unreadable file");
    expect(rows[1].source).toBe("journal-insights-nature-builtin");
  });
});
