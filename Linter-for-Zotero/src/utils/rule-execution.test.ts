import { describe, expect, it } from "vitest";
import { executeRule, normalizedConcurrency } from "./rule-execution";

describe("rule deadlines", () => {
  it("rejects a late field write without affecting a subsequent rule", async () => {
    const item = { title: "before", setField(_field: string, value: string) {
      this.title = value;
    } };
    let release!: () => void;
    let late!: Promise<void>;
    await expect(executeRule(item, async (guarded) => {
      late = new Promise<void>((resolve) => {
        release = resolve;
      }).then(() => guarded.setField("title", "late"));
      await late;
    }, 10)).rejects.toThrow("timed out");
    item.setField("title", "next");
    release();
    await expect(late).rejects.toThrow("timed out");
    expect(item.title).toBe("next");
  });

  it("revokes mutations after a rule rejects", async () => {
    const item = { value: "old" };
    let escaped!: typeof item;
    await expect(executeRule(item, async (guarded) => {
      escaped = guarded;
      throw new Error("failed");
    })).rejects.toThrow("failed");
    expect(() => {
      escaped.value = "late";
    }).toThrow("failed");
    expect(item.value).toBe("old");
  });

  it("revokes mutations after a successful rule returns", async () => {
    const item = { value: "old" };
    let escaped!: typeof item;
    await executeRule(item, async (guarded) => {
      escaped = guarded;
      guarded.value = "completed";
    });
    expect(() => {
      escaped.value = "late";
    }).toThrow("finished");
    expect(item.value).toBe("completed");
  });

  it.each([[0, 1], [-2, 1], [2.5, 2], [200, 16], [Number.NaN, 1], ["4", 1]])("bounds concurrency %s to %s", (value, expected) => {
    expect(normalizedConcurrency(value)).toBe(expected);
  });
});
