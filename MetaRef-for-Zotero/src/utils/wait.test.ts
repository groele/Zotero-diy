import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitUtilAsync } from "./wait";

describe("runtime polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("ztoolkit", { getGlobal: (key: string) => key === "setInterval" ? setInterval : clearInterval });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("clears the timer when the condition throws", async () => {
    const pending = waitUtilAsync(() => {
      throw new Error("closed window");
    });
    const checked = expect(pending).rejects.toThrow("closed window");
    await vi.advanceTimersByTimeAsync(100);
    await checked;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("clears the timer on success and at the timeout boundary", async () => {
    const success = waitUtilAsync(() => true);
    await vi.advanceTimersByTimeAsync(100);
    await success;
    const pending = waitUtilAsync(() => false, 100, 200);
    const checked = expect(pending).rejects.toThrow("timeout");
    await vi.advanceTimersByTimeAsync(200);
    await checked;
    expect(vi.getTimerCount()).toBe(0);
  });
});
