# Linter for Zotero V10 — 10.0.0

## Added

- Added a localized Nature Index action to the Zotero item context menu under **Linter other tools**. The action recognizes selected journal articles by exact title, unambiguous title alias, or ISSN/eISSN, then adds the `Nature Index` tag without changing bibliographic fields or existing tags.
- Added a Nature Index marker column to the item list. It displays a check for tagged journal articles.
- Bundled the June 2026 Nature Index list (177 journals and one conference proceeding) and Clarivate ESI 2026 Release 6 (12,245 journal titles across all 22 ESI categories).

## Improved

- Fixed the Nature Index menu label binding. The menu was registered but referenced the generic `rule-...` localization key, while translations used a tool-specific key, so Zotero could not resolve the intended localized label.
- Kept Nature Index membership separate from article subject classification. The 2026 method assigns disciplines at the article level, so a journal match is not reported as a fixed journal discipline.
- Cached both reference datasets as local batch lookups and kept the Nature Index action user-invoked rather than part of automatic linting.
- Preserved the last verified Nature Index snapshot when the publisher website blocks scripted refresh requests; the generator does not advance the snapshot date in that case.

## Validation

- 368 unit tests passed across 46 test files.
- 29 E2E tests passed in an isolated Windows Zotero 10.0.3 profile, including the localized Nature Index menu entry and production XPI dataset loading.
- Production build, type checks, ESLint, and AutoCorrect passed.
