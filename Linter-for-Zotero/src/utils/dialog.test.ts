import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeAllDialogs, useDialog } from "./dialog";

vi.mock("./logger", () => ({ createLogger: () => ({ debug: vi.fn(), error: vi.fn() }) }));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createDialog() {
  const loadLock = deferred();
  const unloadLock = deferred();
  let loaded = false;
  void loadLock.promise.then(() => {
    loaded = true;
  });
  const events = new EventTarget();
  const window = Object.assign(events, {
    closed: false,
    document: { getElementById: () => null },
    focus: vi.fn(),
    close: vi.fn(() => {
      window.closed = true;
      events.dispatchEvent(new Event("unload"));
      // Toolkit does not resolve unloadLock when a window closes before loading.
      if (loaded)
        unloadLock.resolve();
    }),
  });
  const dialog = {
    elementProps: { styles: {} },
    dialogData: { loadLock, unloadLock },
    window,
    setDialogData: vi.fn(),
    open: vi.fn(),
  };
  return { dialog, loadLock, unloadLock, window };
}

describe("dialog lifecycle", () => {
  beforeEach(() => {
    vi.stubGlobal("addon", { data: { alive: true, dialogs: new Map() } });
    vi.stubGlobal("Zotero", { Utilities: { randomString: () => "qa" } });
    vi.stubGlobal("Components", {});
  });
  afterEach(() => vi.unstubAllGlobals());

  it("tracks and closes a dialog before its load lock resolves", async () => {
    const { dialog, window } = createDialog();
    const pending = useDialog(dialog as any).openAndWaitClose("Early close");
    expect(addon.data.dialogs.size).toBe(0);
    closeAllDialogs();
    await pending;
    expect(window.closed).toBe(true);
    expect(window.focus).not.toHaveBeenCalled();
    expect(addon.data.dialogs.size).toBe(0);
  });

  it("removes a loaded dialog from tracking when focusing it fails", async () => {
    const { dialog, loadLock, window } = createDialog();
    window.focus.mockImplementation(() => {
      throw new Error("focus failure");
    });
    const pending = useDialog(dialog as any).openAndWaitClose("Focus failure");
    loadLock.resolve();
    await expect(pending).rejects.toThrow("focus failure");
    expect(window.closed).toBe(true);
    expect(addon.data.dialogs.size).toBe(0);
  });

  it("waits for an open loaded window until it closes", async () => {
    const { dialog, loadLock, window } = createDialog();
    const pending = useDialog(dialog as any).openAndWaitClose("Normal close");
    loadLock.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(addon.data.dialogs.size).toBe(1);
    window.close();
    await pending;
    expect(addon.data.dialogs.size).toBe(0);
  });
});
