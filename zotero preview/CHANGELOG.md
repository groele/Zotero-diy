# Changelog

## 40.1.7 — 2026-10-14

- Serialize native placement work per sidebar and merge mutations received during an asynchronous move.
- Reorder without recursive host rendering; refresh unrendered previews separately and cancel late moves after shutdown.
- Avoid duplicate placement-observer registrations and isolate observer disconnect failures.
- Hide trashed reader items immediately and prevent copying their cached content.
- Correct cache byte accounting when replacing an existing key; release copy-feedback timers before DOM replacement.
- Release preference listeners on fragment unload as well as window unload and plugin disable.
- Expand regressions for asynchronous placement, cancellation, trash notifications, cache replacement, and cleanup failures.

## 40.1.6 — 2026-10-14

- Restore the default preview position above Info once on upgrade, while retaining subsequent user-selected placement.
- Observe native pane insertion and reordering so Zotero sidebar-order restoration cannot leave the preview at the bottom.
- Translate pane destinations to actual sidenav wrapper indices, accounting for hidden buttons, and recover when sidenav movement does not update the pane DOM.
- Disconnect placement observers and cancel their timers when sections are destroyed or the plugin is disabled.
- Add regressions for upgrade placement, restored native order, hidden sidenav buttons, and observer cleanup.

## 40.1.5 — 2026-10-14

- Prepare for Zotero 11 / Firefox 153 using the official platform migration checklist.
- Remove the inline preferences load handler and initialize via captured native fragment load events, with per-document state and listener cleanup.
- Explicitly request XUL parsing for the existing preferences fragment.
- Cancel startup when disabled during host initialization; isolate cleanup failures and release Fluent resources even after a partial startup error.
- Catch synchronous native refresh errors through the asynchronous refresh path.
- Add frozen-sandbox, preference event, startup cancellation, cleanup failure, and obsolete-platform-pattern regressions.
- Retain the Zotero 10 compatibility ceiling as requested by the current official Zotero 11 developer notice; dev/beta builds permit testing without raising it.

## 40.1.4 — 2026-10-13

- Remove the bottom border under citation preview content, including its dark-theme color override.

## 40.1.3 — 2026-10-13

- Restore the original position preference: top by default, after Info, or bottom, shared by library and main-window reader sidebars.
- Apply placement through native section reordering without persisting changes to other sidebar preferences.
- Restore the original copy animation: 1.2 scale and green checkmark, remove scale at 300 ms, restore clipboard icon at 1000 ms.
- Cancel previous feedback timers on repeated copy and clear timers during section destruction.
- Add placement and copy-animation regressions while retaining the reader lifecycle and caching improvements.

## 40.1.2 — 2026-10-13

- Apply LF normalization to all text payloads, including LICENSE, and define repository attributes for reproducible checkouts.
- Verify all 14 XPI entries against the staged Git index before publishing; runtime behavior remains unchanged.

## 40.1.1 — 2026-10-13

- Normalize SVG line endings so every packaged runtime file matches the published Git blob byte for byte.
- Refresh the versioned XPI, update-feed SHA-256, and download links; runtime behavior is unchanged from 40.1.0.

## 40.1.0 — 2026-10-13

- Register the citation preview through Zotero ItemPaneManager in library and main-window reader sidebars.
- Resolve reader attachments to their parent bibliography item, independently of library selection.
- Add coalesced asynchronous rendering, bounded shared LRU caching, cached rich-text copying, and native lifecycle cleanup.
- Replace DOM mount probes, window retries, global selection listeners, and private clipboard window lookup.
- Preserve visible SVG copy controls and constrain layout to narrow native sidebars with ResizeObserver.
- Replace legacy placement controls with Zotero native section ordering and pinning.
- Update the maintained update feed, versioned XPI, build scripts, regression tests, and verification documentation.
- Validate preview, clipboard, and shutdown on Windows Zotero 10.0.6. Zotero 8/9 and restart-after-install remain unverified; standalone reader windows in 10.0.6 do not provide a native item-details sidebar.

## 40.0.1 — 2026-09-24

- Show a localized notice when selection size exceeds the configured preview cap.
- Respect the debug preference in bootstrap lifecycle logging and remove the stale `0.1` prefix.
- Point the homepage and update feed at the maintained `groele/Zotero-diy` copy.
- Add reproducible build instructions and regression tests for the source tree.

## 40.0.0

- Zotero 10 compatibility metadata and Fluent resource registration.
- Bounded multi-item citation preview, lifecycle cleanup, copy feedback, and localized status messages.
- Visible inline SVG copy controls with mouse and keyboard interaction.
