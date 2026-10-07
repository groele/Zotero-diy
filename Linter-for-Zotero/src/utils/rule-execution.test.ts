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

  it("rejects a stale reload that would discard a later rule's fields", async () => {
    const item = {
      value: "stored",
      reload() {
        this.value = "stored";
      },
    };
    let escaped!: typeof item;
    await executeRule(item, async (guarded) => {
      escaped = guarded;
    });
    item.value = "next rule";
    expect(() => escaped.reload()).toThrow("finished");
    expect(item.value).toBe("next rule");
  });

  it("revokes property deletion and redefinition after a deadline", async () => {
    const item = { value: "original" };
    let escaped!: typeof item;
    await expect(executeRule(item, async (guarded) => {
      escaped = guarded;
      await new Promise<void>(() => {});
    }, 10)).rejects.toThrow("timed out");
    expect(() => Reflect.deleteProperty(escaped, "value")).toThrow("timed out");
    expect(() => Object.defineProperty(escaped, "value", { value: "late" })).toThrow("timed out");
    expect(item.value).toBe("original");
  });

  it.each([[0, 1], [-2, 1], [2.5, 2], [200, 16], [Number.NaN, 1], ["4", 1]])("bounds concurrency %s to %s", (value, expected) => {
    expect(normalizedConcurrency(value)).toBe(expected);
  });
});
