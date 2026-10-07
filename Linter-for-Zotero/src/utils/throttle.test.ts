import { afterEach, describe, expect, it, vi } from "vitest";
import { withThrottle } from "./throttle";

afterEach(() => vi.useRealTimers());

describe("api cooldown", () => {
  it("spaces calls by the full cooldown under concurrent load", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
    const starts: number[] = [];
    const throttled = withThrottle(async () => {
      starts.push(Date.now());
    }, 100);
    const pending = Promise.all([throttled(), throttled(), throttled()]);
    await vi.advanceTimersByTimeAsync(0);
    expect(starts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(99);
    expect(starts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(101);
    await pending;
    expect(starts.map(time => time - starts[0])).toEqual([0, 100, 200]);
  });

  it("keeps local rules synchronous when cooldown is disabled", () => {
    const apply = vi.fn(() => "done");
    expect(withThrottle(apply, 0)).toBe(apply);
    expect(withThrottle(undefined, 0)).toBeUndefined();
  });
});
