import { logger } from "../utils/logger";

let notifierID: string | undefined;

export function registerNotifier() {
  unregisterNotifier();
  // Register the callback in Zotero as an item observer
  notifierID = Zotero.Notifier.registerObserver(
    {
      notify: (
        event: string,
        type: string,
        ids: number[] | string[],
        extraData: { [key: string]: unknown },
      ) => {
        if (!addon?.data.alive) {
          unregisterNotifier();
          return;
        }
        // Zotero awaits each observer; background formatting must not delay imports.
        void addon.hooks.onNotify(event, type, ids, extraData).catch(error => logger.error("Automatic metadata processing failed:", error));
      },
    },
    ["item"],
    "metaref",
    // We expect the MetaRef to run after all plugins so that we can
    // clear up any unexpected data performed by other plugins.
    666,
  );
}

export function unregisterNotifier() {
  if (!notifierID)
    return;
  Zotero.Notifier.unregisterObserver(notifierID);
  notifierID = undefined;
}
