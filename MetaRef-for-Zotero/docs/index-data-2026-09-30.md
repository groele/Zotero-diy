# Index data update audit — 2026-09-30

## ESI

- Source: Clarivate Essential Science Indicators, 2026 release 6 master journal list, from the official [scope and coverage page](https://essentialscienceindicators.zendesk.com/hc/en-gb/articles/28150642413201-Scope-and-Coverage).
- The downloaded workbook contains 12,246 source rows, normalized to 12,245 unique journal titles, and covers all 22 Clarivate ESI fields. The 311 physics titles from the old snapshot remain represented in the full master list.
- Recognition can use normalized title, the title variants supplied by Clarivate, or ISSN/eISSN. A source title (`Journal of Cultural Heritage`) appears in two fields; both categories are preserved and the plugin does not silently select one.
- Clarivate ESI does not cover art and humanities. “All fields” means all fields defined by ESI, not all academic disciplines universally.
- The source page does not declare an open license for the workbook. The repository documents provenance and does not claim unrestricted licensing.

## Nature Index

- Source: the official [Nature Index FAQ](https://www.nature.com/nature-index/faq), June 2026 release, snapshot dated 2026-09-30: 177 journals and one conference proceeding.
- Matching uses exact normalized titles, exact unambiguous known abbreviations, and ISSN/eISSN. It excludes the conference from journal matching and avoids fuzzy partial matches.
- The tool adds a `Nature Index` Zotero tag and the item list can show a Nature Index marker column. It preserves unrelated tags and is idempotent.
- The 2026 method assigns subject areas to articles. A journal match is only venue membership; it does not establish that every item from a journal is included or that the journal has one fixed subject.
- The website blocks some direct scripted refresh requests. The generator preserves its last verified title snapshot in that case and does not advance its snapshot date.
- Nature Index's brief guide describes a CC BY-NC-SA 4.0 license for its most recent 12 months of data. The project only includes the publication identifiers needed for recognition and directs users to the publisher's terms for the license applying to this title-list extract.

## Runtime and validation

Both datasets are packaged as local read-only reference assets, loaded lazily, and cached for a batch. ESI and Nature Index use independent lookup maps. The Nature Index marking action only runs when selected by the user; it does not alter bibliographic fields or run automatically.
