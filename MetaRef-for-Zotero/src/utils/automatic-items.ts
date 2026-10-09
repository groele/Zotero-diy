interface Waiter {
  resolve: () => void;
  reject: (error: unknown) => void;
}

/** Coalesce import events without holding Zotero's notification transaction open. */
export class AutomaticItems {
  private pending = new Set<number>();
  private waiters: Waiter[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;

  constructor(private process: (ids: number[]) => Promise<void>, private delay: () => number) {}

  enqueue(ids: Array<string | number>): Promise<void> {
    const valid = ids.map(Number).filter(id => Number.isSafeInteger(id) && id > 0);
    if (!valid.length)
      return Promise.resolve();
    valid.forEach(id => this.pending.add(id));
    const completion = new Promise<void>((resolve, reject) => this.waiters.push({ resolve, reject }));
    this.schedule();
    return completion;
  }

  cancelPending(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending.clear();
    this.waiters.splice(0).forEach(waiter => waiter.resolve());
  }

  private schedule(): void {
    if (this.timer !== undefined || this.running || !this.pending.size)
      return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, this.delay());
  }

  private async flush(): Promise<void> {
    const ids = [...this.pending];
    const waiters = this.waiters.splice(0);
    this.pending.clear();
    this.running = true;
    try {
      await this.process(ids);
      waiters.forEach(waiter => waiter.resolve());
    }
    catch (error) {
      waiters.forEach(waiter => waiter.reject(error));
    }
    finally {
      this.running = false;
      this.schedule();
    }
  }
}
