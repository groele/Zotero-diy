import type { MetadataContext } from "./base-service";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineService } from "./base-service";

afterEach(() => vi.useRealTimers());

describe("service request scheduling", () => {
  it("shares a cooldown between identifier enrichment and metadata fetching", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
    const requests: string[] = [];
    const service = defineService({
      id: "test-service",
      name: "Test service",
      cooldown: 100,
      shouldApply: () => true,
      async updateIdentifiers() {
        requests.push("identifier");
        return true;
      },
      async fetch() {
        requests.push("metadata");
        return { title: "Paper" };
      },
    });
    const context = {} as MetadataContext;
    const pending = Promise.all([service.updateIdentifiers!(context), service.fetch!(context)]);
    await vi.advanceTimersByTimeAsync(0);
    expect(requests).toEqual(["identifier"]);
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(requests).toEqual(["identifier", "metadata"]);
  });

  it("skips a queued request whose rule has already been aborted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
    const fetch = vi.fn(async () => ({ title: "Paper" }));
    const service = defineService({ id: "test-service", name: "Test service", cooldown: 100, shouldApply: () => true, fetch });
    const controller = new AbortController();
    const context = { signal: controller.signal } as MetadataContext;
    const first = service.fetch!({} as MetadataContext);
    const second = expect(service.fetch!(context)).rejects.toThrow("cancelled request");
    controller.abort(new Error("cancelled request"));
    await vi.advanceTimersByTimeAsync(100);
    await first;
    await second;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
