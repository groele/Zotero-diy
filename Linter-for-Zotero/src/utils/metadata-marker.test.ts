import { describe, expect, it } from "vitest";
import { upsertMetadataMarker } from "./metadata-marker";

describe("upsertMetadataMarker", () => {
  it("adds a marker without discarding existing metadata", () => {
    expect(upsertMetadataMarker("University Archive", "Physics ESI", value => /\bESI\b/i.test(value)))
      .toBe("University Archive; Physics ESI");
  });

  it("updates an existing marker instead of duplicating it", () => {
    expect(upsertMetadataMarker("University Archive; Physics ESI", "Chemistry ESI", value => /\bESI\b/i.test(value)))
      .toBe("University Archive; Chemistry ESI");
  });

  it("keeps an exact marker idempotent", () => {
    expect(upsertMetadataMarker("Nature Index", "Nature Index", value => value.toLowerCase() === "nature index"))
      .toBe("Nature Index");
  });

  it("does not duplicate a marker already stored beside another value", () => {
    expect(upsertMetadataMarker("Repository ID; Nature Index", "Nature Index", value => value.toLowerCase() === "nature index"))
      .toBe("Repository ID; Nature Index");
  });
});
