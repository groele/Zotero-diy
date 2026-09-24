# ZoteroPreview V40

ZoteroPreview adds a citation preview to Zotero's item pane and Reader sidebar. It can preview bibliography entries and in-text citations for selected items, using Zotero Quick Copy and CSL styles. Copy controls remain available by mouse and keyboard.

This directory contains a maintained derivative of ZoteroPreview V40.0.0. Version 40.0.1 adds a visible, localized notice when the configured multi-item preview limit truncates a selection, fixes startup logging to respect the debug preference, and makes update metadata point to this maintained copy.

## Compatibility

The add-on manifest declares Zotero 8.0 through the Zotero 10.0 release line (`10.0.*`). This range comes from the manifest and static compatibility checks; it is not a claim of successful installation against every Zotero build. Reader and Zotero 10 GUI behavior still needs a manual smoke test after installation.

## Install

1. Download [`dist/ZoteroPreview-40.0.1.xpi`](dist/ZoteroPreview-40.0.1.xpi).
2. In Zotero, open **Tools → Plugins** (or **Add-ons**, depending on the Zotero build).
3. Use the gear menu and choose **Install Plugin From File…**.
4. Select the downloaded XPI and restart Zotero if requested.

## Build and test

Requirements: PowerShell 7 and Node.js 18 or later. The runtime package uses only the files listed by `scripts/build.ps1`; documentation and tests are not copied into the XPI.

```powershell
pwsh -NoProfile -File ./test.ps1
pwsh -NoProfile -File ./scripts/build.ps1
```

The test suite checks manifest and update-feed consistency, declared Zotero compatibility, lifecycle cleanup, bounded multi-item rendering, the visible SVG copy-control contract, locale message coverage, and JavaScript syntax. Build output is written to `dist/`.

## Settings

- **Preview placement** selects the item-pane position.
- **Preview content** selects bibliography, in-text citation, or both.
- **Font size** accepts 0.2–3 times the base size.
- **Line spacing** accepts 1–3.
- **Maximum preview items** accepts 1–500 (default 100). When the current selection is larger, only the first configured number are previewed and the pane reports the count.

## Development notes

- Keep the inline SVG copy icon inside the focusable `.zotero-preview-copy` span. Its role, keyboard support, and `data-copy-citation` attribute are covered by regression checks.
- Keep localized runtime message IDs in every locale under `locale/`.
- Before release, install the generated XPI in supported Zotero builds and manually exercise the main window, Reader sidebar, preference pane, item selection changes, and both copy actions.

## Provenance and copyright

This project is a derivative work based on [ZoteroPreview by David Carter](https://github.com/dcartertod/zotero-plugins), including its ZoteroPreview source and existing attribution notices. The upstream repository identifies its license as Apache-2.0; the upstream `LICENSE` is retained in this project. This repository adds later compatibility and maintenance changes. Copyright in the original work remains with its respective authors; this notice does not claim ownership of upstream code.

Zotero and Zotero trademarks belong to their respective owners. This community-maintained derivative is not affiliated with or endorsed by the Zotero project or the upstream author.
