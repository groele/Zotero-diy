import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoJournalPreprint } from "./no-journal-preprint";
import { extractIdentifiers, isPreprint } from "./tool-update-metadata/identifiers";

vi.mock("../../utils/locale", () => ({
  getString: (id: string) => id,
}));

vi.mock("./tool-update-metadata/identifiers", () => ({
  extractIdentifiers: vi.fn(() => ({ arXiv: "1234.5678" })),
  isPreprint: vi.fn(() => true),
}));

describe("no-journal-preprint", () => {
  const item = { id: 42, deleted: false } as Zotero.Item;
  const report = vi.fn();
  const onLintInBatch = vi.fn();
  const getItem = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getItem.mockReturnValue(item);
    Object.assign(globalThis, {
      Zotero: { Items: { get: getItem } },
      addon: { hooks: { onLintInBatch } },
    });
  });

  it("reports identified preprints and offers metadata updating", async () => {
    await NoJournalPreprint.apply({ item, options: {}, debug: vi.fn(), report } as any);

    expect(extractIdentifiers).toHaveBeenCalledWith(item);
    expect(isPreprint).toHaveBeenCalledWith(item, { arXiv: "1234.5678" });
    expect(report).toHaveBeenCalledOnce();

    const action = report.mock.calls[0][0].action;
    expect(action.label).toBe("rule-no-journal-preprint-report-action");
    await action.callback();
    expect(getItem).toHaveBeenCalledWith(item.id);
    expect(onLintInBatch).toHaveBeenCalledWith(["tool-update-metadata"], [item]);
  });

  it("does not offer an action for deleted or missing items", async () => {
    getItem.mockReturnValue({ ...item, deleted: true });
    await NoJournalPreprint.apply({ item, options: {}, debug: vi.fn(), report } as any);

    await report.mock.calls[0][0].action.callback();
    expect(onLintInBatch).not.toHaveBeenCalled();
  });

  it("does not report a journal article without a preprint identifier", async () => {
    vi.mocked(isPreprint).mockReturnValue(false);
    await NoJournalPreprint.apply({ item, options: {}, debug: vi.fn(), report } as any);

    expect(report).not.toHaveBeenCalled();
  });
});
