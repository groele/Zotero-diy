/**
 * Most of this code is from Zotero team's official Make It Red example[1]
 * or the Zotero 7 documentation[2].
 * [1] https://github.com/zotero/make-it-red
 * [2] https://www.zotero.org/support/dev/zotero_7_for_developers
 */

function install(data, reason) {}

function setDefaultPrefs(rootURI) {
  try {
    const branch = Services.prefs.getDefaultBranch("");
    Services.scriptloader.loadSubScript(`${rootURI}prefs.js`, {
      pref(pref, value) {
        switch (typeof value) {
          case "boolean":
            branch.setBoolPref(pref, value);
            break;
          case "string":
            branch.setStringPref(pref, value);
            break;
          case "number":
            branch.setIntPref(pref, value);
            break;
          default:
            break;
        }
      },
    });
  }
  catch (e) {
    dump(`[MetaRef] Error loading default prefs: ${e}\n`);
  }
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  /**
   * Global variables for plugin code.
   * The `_globalThis` is the global root variable of the plugin sandbox environment
   * and all child variables assigned to it is globally accessible.
   * See `src/index.ts` for details.
   */
  const ctx = {
    rootURI,
  };
  ctx._globalThis = ctx;
  setDefaultPrefs(rootURI);

  Services.scriptloader.loadSubScript(`${rootURI}/content/scripts/__addonRef__.js`, ctx);
  await Zotero.__addonInstance__.hooks.onStartup();
}

async function onMainWindowLoad({ window }, reason) {
  await Zotero.__addonInstance__?.hooks.onMainWindowLoad(window);
}

async function onMainWindowUnload({ window }, reason) {
  await Zotero.__addonInstance__?.hooks.onMainWindowUnload(window);
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  return Zotero.__addonInstance__?.hooks.onShutdown();
}

function uninstall(data, reason) {}
