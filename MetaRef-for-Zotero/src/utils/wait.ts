/**
 * Wait async until the condition is `true` or timeout.
 * @param condition
 * @param interval
 * @param timeout
 */
export function waitUtilAsync(condition: () => boolean, interval = 100, timeout = 10000) {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const clear = ztoolkit.getGlobal("clearInterval");
    const intervalId = ztoolkit.getGlobal("setInterval")(() => {
      try {
        if (condition()) {
          clear(intervalId);
          resolve();
        }
        else if (Date.now() - start >= timeout) {
          clear(intervalId);
          reject(new Error("timeout"));
        }
      }
      catch (error) {
        clear(intervalId);
        reject(error);
      }
    }, interval);
  });
}
