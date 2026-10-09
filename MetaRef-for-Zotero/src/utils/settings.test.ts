import { describe, expect, it } from "vitest";
import { matchesSettings, settingsTokens, validConcurrency } from "./settings";

describe("settings search", () => {
  it("normalizes case, whitespace and full-width characters", () => {
    expect(settingsTokens("  \uFF24\uFF2F\uFF29\t检查 \n")).toEqual(["doi", "检查"]);
    expect(matchesSettings("DOI 校验与检查", settingsTokens("doi 检查"))).toBe(true);
    expect(matchesSettings("DOI 校验", settingsTokens("doi 检查"))).toBe(false);
    expect(matchesSettings("anything", settingsTokens("  "))).toBe(true);
  });
  it("treats punctuation and preference keys literally", () => {
    expect(matchesSettings("rule.correct-title-sentence-case.custom-term-path", settingsTokens("sentence-case custom-term"))).toBe(true);
    expect(matchesSettings("A [B]", settingsTokens("[b]"))).toBe(true);
    expect(matchesSettings("A B", settingsTokens("[b]"))).toBe(false);
  });
});

describe("concurrency setting", () => {
  it.each(["1", "16", " 4 ", "4.0"])("accepts whole values: %s", (raw) => {
    expect(validConcurrency(raw)).toBe(Number(raw));
  });
  it.each(["", " ", "0", "17", "-1", "1.5", "NaN", "Infinity", "text"])("rejects invalid values: %s", (raw) => {
    expect(validConcurrency(raw)).toBeNull();
  });
});
