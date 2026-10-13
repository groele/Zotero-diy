# Changelog

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
