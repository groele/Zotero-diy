import { describe, expect, it } from "vitest";
import { extractDOIFromUrl } from "./identifiers";
import { normalizeMetadata } from "./index";
import { parsePaperID } from "./services/semantic-scholar-service";

describe("metadata boundaries", () => {
  it("drops structured values and empty creators instead of coercing them into fields", () => {
    expect(normalizeMetadata({ title: "Paper", volume: { unexpected: 2 }, abstractNote: null, creators: [null, { name: "" }, { lastName: "Doe", firstName: 8 }] }))
      .toEqual({ title: "Paper", creators: [] });
    expect(normalizeMetadata({ libraryCatalog: "Broken service", title: false })).toBeNull();
    expect(normalizeMetadata([])).toBeNull();
  });
  it("keeps valid corporate and personal author records", () => {
    const creators = [{ creatorType: "author", name: "Institute" }, { creatorType: "author", lastName: "Doe", firstName: "Jane" }];
    expect(normalizeMetadata({ title: "Paper", creators })?.creators).toEqual(creators);
  });
  it("separates PubMed and PubMed Central identifiers", () => {
    expect(parsePaperID("PMID", "123")).toBe("PMID:123");
    expect(parsePaperID("PMCID", "PMC123")).toBe("PMCID:PMC123");
  });
  it("decodes resolver URLs while excluding query and fragment data", () => {
    expect(extractDOIFromUrl("https://doi.org/10.1234%2Ftest[1]?utm_source=x#part")).toBe("10.1234/test[1]");
    expect(extractDOIFromUrl("https://example.org/paper?doi=10.1234/abc&x=1")).toBe("10.1234/abc");
    expect(extractDOIFromUrl("https://example.org/ordinary")).toBeNull();
  });
});
