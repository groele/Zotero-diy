import { describe, expect, it } from "vitest";
import { isPublisherURL } from "./no-article-webpage";

describe("publisher URL matching", () => {
  it("accepts publisher domains and subdomains", () => {
    expect(isPublisherURL("https://www.nature.com/articles/paper")).toBe(true);
    expect(isPublisherURL("https://NATURE.COM./paper")).toBe(true);
    expect(isPublisherURL("https://sci-hub.se/paper")).toBe(true);
  });
  it("ignores names appearing only in paths, queries or unrelated domains", () => {
    for (const url of ["https://example.org/nature.com", "https://example.org/?url=https://nature.com", "https://nature.com.example.org", "https://notnature.com", "file:///nature.com", "not a URL"])
      expect(isPublisherURL(url)).toBe(false);
  });
});
