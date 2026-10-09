import { afterEach, describe, expect, it, vi } from "vitest";
import { AutomaticItems } from "./automatic-items";

afterEach(() => vi.useRealTimers());

describe("automatic import queue", () => {
  it("coalesces bursts, deduplicates IDs and completes all callers after processing", async () => {
    vi.useFakeTimers();
    const process = vi.fn(async () => {});
    const queue = new AutomaticItems(process, () => 500);
    const pending = Promise.all([queue.enqueue([1, "2", 1]), queue.enqueue([2, 3, "invalid", -1])]);
    await vi.advanceTimersByTimeAsync(499);
    expect(process).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(process).toHaveBeenCalledExactlyOnceWith([1, 2, 3]);
  });

  it("buffers events received during processing without overlapping batches", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const process = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => {
      release = resolve;
    })).mockResolvedValue(undefined);
    const queue = new AutomaticItems(process, () => 500);
    const first = queue.enqueue([1]);
    await vi.advanceTimersByTimeAsync(500);
    const second = queue.enqueue([2]);
    const third = queue.enqueue([3]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(process).toHaveBeenCalledTimes(1);
    release();
    await first;
    await vi.advanceTimersByTimeAsync(500);
    await Promise.all([second, third]);
    expect(process.mock.calls).toEqual([[[1]], [[2, 3]]]);
  });

  it("releases pending callers on shutdown and accepts a later startup", async () => {
    vi.useFakeTimers();
    const process = vi.fn(async () => {});
    const queue = new AutomaticItems(process, () => 500);
    const pending = queue.enqueue([1]);
    queue.cancelPending();
    await pending;
    await vi.advanceTimersByTimeAsync(500);
    expect(process).not.toHaveBeenCalled();
    const next = queue.enqueue([2]);
    await vi.advanceTimersByTimeAsync(500);
    await next;
    expect(process).toHaveBeenCalledExactlyOnceWith([2]);
  });

  it("reports a failed batch to its callers and keeps later events processable", async () => {
    vi.useFakeTimers();
    const process = vi.fn().mockRejectedValueOnce(new Error("failed")).mockResolvedValue(undefined);
    const queue = new AutomaticItems(process, () => 500);
    const first = expect(queue.enqueue([1])).rejects.toThrow("failed");
    await vi.advanceTimersByTimeAsync(500);
    await first;
    const second = queue.enqueue([2]);
    await vi.advanceTimersByTimeAsync(500);
    await second;
    expect(process).toHaveBeenCalledTimes(2);
  });
});
