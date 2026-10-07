import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToolUpdateMetadata } from "./index";
import { services } from "./services";

vi.mock("./services", () => ({ services: [] }));
vi.mock("./identifiers", () => ({ extractIdentifiers: () => ({ arXiv: "1234.5678" }), isPreprint: () => true }));
vi.mock("../../../utils/locale", () => ({ getString: (id: string) => id }));
vi.mock("../../../utils/zotero", () => ({ isFieldValidForItemType: (field: string) => field === "title" }));

describe("metadata service fallback", () => {
  beforeEach(() => services.splice(0));
  const run = () => {
    const item = { getField: () => "", setField: vi.fn() };
    const report = vi.fn();
    const pending = ToolUpdateMetadata.apply({ item: item as unknown as Zotero.Item, options: { mode: "all", allowTypeChanged: false }, report, debug: vi.fn() });
    return { item, report, pending };
  };
  it("isolates a broken eligibility check and reports fallback warnings", async () => {
    services.push(
      { id: "broken", name: "Broken", cooldown: 0, shouldApply() { throw new Error("bad eligibility"); } },
      { id: "working", name: "Working", cooldown: 0, shouldApply: () => true, fetch: async () => ({ title: "Recovered" }), transform: data => data },
    );
    const { item, report, pending } = run();
    await pending;
    expect(item.setField).toHaveBeenCalledWith("title", "Recovered");
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ level: "warning" }));
  });
  it("rechecks service eligibility after enriching identifiers", async () => {
    services.push(
      { id: "enrich", name: "Enrich", cooldown: 0, shouldApply: () => true, updateIdentifiers: async ({ identifiers }) => {
        identifiers.DOI = "10.1234/paper";
        return true;
      } },
      { id: "doi", name: "DOI", cooldown: 0, shouldApply: ({ identifiers }) => !!identifiers.DOI, fetch: async () => ({ title: "DOI metadata" }), transform: data => data },
    );
    const { item, pending } = run();
    await pending;
    expect(item.setField).toHaveBeenCalledWith("title", "DOI metadata");
  });
});
