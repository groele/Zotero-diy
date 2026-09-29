/** Prevent a timed-out rule from changing the live item or reporting into a later batch. */
export async function executeRule<T extends object>(
  item: T,
  apply: (item: T, signal: AbortSignal) => Promise<void>,
  timeout = 60_000,
  createController: () => AbortController = () => new AbortController(),
): Promise<void> {
  const controller = createController();
  const guarded = new Proxy(item, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (typeof value !== "function")
        return value;
      return (...args: unknown[]) => {
        if (/^(?:set|add|remove|erase|save|fromJSON)/.test(String(key)))
          controller.signal.throwIfAborted();
        return value.apply(target, args);
      };
    },
    set(target, key, value) {
      controller.signal.throwIfAborted();
      return Reflect.set(target, key, value, target);
    },
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`Rule timed out after ${timeout}ms`);
      controller.abort(error);
      reject(error);
    }, timeout);
  });
  try {
    await Promise.race([Promise.resolve().then(() => apply(guarded, controller.signal)), deadline]);
  }
  catch (error) {
    controller.abort(error);
    throw error;
  }
  finally {
    clearTimeout(timer);
    if (!controller.signal.aborted)
      controller.abort(new Error("Rule execution has finished"));
  }
}

export function normalizedConcurrency(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(16, Math.floor(value)))
    : 1;
}
