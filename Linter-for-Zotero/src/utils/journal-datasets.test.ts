import { describe, expect, it } from "vitest";
import { parseESIDataset, parseNatureDataset } from "./journal-datasets";

describe("custom journal database validation", () => {
  it("accepts ESI arrays, envelopes and CSV column aliases", () => {
    const row = { Title: " Test ", Category: "PHYSICS", ISSN: "1234-5678" };
    for (const data of [[row], { journals: [row] }])
      expect(parseESIDataset(data)[0]).toMatchObject({ title: "Test", category: "PHYSICS", issn: "1234-5678" });
  });
  it("rejects partial malformed ESI lists with the failing record number", () => {
    expect(() => parseESIDataset([{ title: "Good", category: "PHYSICS" }, { title: "Bad" }])).toThrow("Record 2");
    expect(() => parseESIDataset([{ title: "Bad", category: [] }])).toThrow("category must be text");
    expect(() => parseESIDataset([{ title: "Bad", category: ";/" }])).toThrow("requires category");
    expect(() => parseESIDataset([{ title: "Bad", category: "PHYSICS", issn: "123-4567" }])).toThrow("invalid ISSN");
  });
  it("accepts Nature Index envelopes and CSV text lists with an implicit journal type", () => {
    const rows = [{ title: "Test", aliases: "Alias;Alt|Alias", issn: "1234-5678", eissn: "8765-4321" }];
    for (const data of [rows, { venues: rows }])
      expect(parseNatureDataset(data)[0]).toEqual({ title: "Test", type: "journal", aliases: ["Alias", "Alt"], issn: ["1234-5678", "8765-4321"] });
  });
  it("rejects malformed types and nested arrays instead of silently dropping records", () => {
    for (const row of [{ title: "Test", type: "article" }, { title: "Test", aliases: [1] }, { title: "Test", issn: "missing" }, { title: [] }])
      expect(() => parseNatureDataset([row])).toThrow("Record 1");
    expect(() => parseNatureDataset([{ title: "Conference", type: "conference" }])).toThrow("at least one journal");
  });
  it("rejects empty, non-record and oversized datasets", () => {
    for (const data of [[], {}, { Test: { title: "Test", category: "PHYSICS" } }, null, "text", 42, Array.from({ length: 100_001 }, () => ({}))])
      expect(() => parseESIDataset(data)).toThrow("1–100000");
    expect(() => parseNatureDataset([null])).toThrow("journal object");
  });
});
