import { describe, expect, it } from "vitest";
import { normalizeKey } from "./str";

describe("journal lookup keys", () => {
  it("normalizes standalone conjunctions while retaining letters inside names", () => {
    expect(normalizeKey("The Scandinavian Journal of Medicine and Science"))
      .toBe("scandinavianjournalofmedicinescience");
    expect(normalizeKey("Landscape Research")).not.toBe(normalizeKey("Lscape Research"));
    expect(normalizeKey("Nature\n Materials")).toBe(normalizeKey("Nature Materials"));
  });
});
