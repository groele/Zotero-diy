# Linter for Zotero V10 — 10.0.5

## 10.0.5 — 2026-10-07

- Isolated rule applicability failures so subsequent rules still run and their changes are saved. Added separate preparation-failure and skipped-item counts.
- Kept progress and report window failures from interrupting concurrent processing, persistence, batch cleanup, or runner shutdown. Silent batches retain records without opening reports.
- Enforced API cooldowns independently of item concurrency, shared each metadata service's request schedule, and blocked aborted queued requests.
- Reported duplicate-search failures instead of treating them as an absence of duplicates. Prevented duplicate notifier registrations and late property deletion or redefinition after rule execution.
- Limited title previews to the focused editor in the active library window and made the live focus regression test confirm window focus.
- Restricted unit test discovery to current source files, excluding stale publish-checkout copies. Validation: 193 unit tests in 26 files, 35 live Zotero tests per locale, production XPI installation, lint, build, and both TypeScript checks.

Zotero compatibility remains 10.0–10.999. Live runtime verification uses Windows Zotero 10.0.5; external service responses are controlled rather than evidence of live website availability.

## 10.0.4

- Added native, keyboard-accessible collapsible headings to item-type rule groups. Common item, title, and journal-article settings stay expanded; less frequently changed groups start collapsed to shorten the panel.
- Added bilingual guidance clarifying that collapsing a group only changes its visibility and does not disable its rules.
- Verified expand/collapse behavior and retained preference controls in a live Zotero settings pane.

## 10.0.3

- Reorganized the preferences panel with explicit journal abbreviation, ESI, and pagination subgroups; fixed duplicate rule controls and duplicate IDs.
- Updated context-menu settings to describe the actual first-level Linter menu, localized the remaining hard-coded section headings, and removed outdated restart instructions.
- Masked the Semantic Scholar API key field and clarified when settings take effect.

## 10.0.2

- ESI recognition now mirrors the selected discipline text into Zotero's Archive field, and Nature Index marking writes `Nature Index` into Archive Location (shown as「档案编号」in Simplified Chinese).
- Existing Archive and Archive Location text is retained. Repeated recognition updates the managed marker instead of adding duplicates.
- Preserved existing series-field behavior and Nature Index tags while saving all field changes through the batch transaction.

## 10.0.1

- Flattened the item context menu so every Linter action is directly under **Linter**. Section dividers remain, but there are no second-level tool submenus.

## 10.0.0

## Added

- Added a localized Nature Index action directly to the Zotero item context menu. The action recognizes selected journal articles by exact title, unambiguous title alias, or ISSN/eISSN, then adds the `Nature Index` tag without changing bibliographic fields or existing tags.
- Added a Nature Index marker column to the item list. It displays a check for tagged journal articles.
- Bundled the June 2026 Nature Index list (177 journals and one conference proceeding) and Clarivate ESI 2026 Release 6 (12,245 journal titles across all 22 ESI categories).

## Improved

- Fixed the Nature Index menu label binding. The menu was registered but referenced the generic `rule-...` localization key, while translations used a tool-specific key, so Zotero could not resolve the intended localized label.
- Kept Nature Index membership separate from article subject classification. The 2026 method assigns disciplines at the article level, so a journal match is not reported as a fixed journal discipline.
- Cached both reference datasets as local batch lookups and kept the Nature Index action user-invoked rather than part of automatic linting.
- Preserved the last verified Nature Index snapshot when the publisher website blocks scripted refresh requests; the generator does not advance the snapshot date in that case.

## Validation

- 376 unit tests passed across 48 test files.
- 29 E2E tests passed in an isolated Windows Zotero 10.0.3 profile, including the localized Nature Index menu entry and production XPI dataset loading.
- Production build, type checks, ESLint, and AutoCorrect passed.
