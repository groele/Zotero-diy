## menu
richtext-toolbar-label = Title formatting toolbar
menuitem-label = 
  .label = MetaRef
menuitem-stdFormatFlow = 
  .label = MetaRef: Check and Fix Metadata
field-nature-index = Nature Index

menu-group-primary = Common actions
menu-group-title = Title & rich text
menu-group-creators = Authors & creators
menu-group-publication = Language & publication
menu-group-indexing = Journal index insights
menu-group-maintenance = Identifiers, dates & Extra
journal-insights-heading =
    .label = MetaRef journal insights
    .tooltiptext = ESI disciplines and Nature Index journal membership
journal-insights-loading = Loading journal index datasets…
field-esi = ESI disciplines
journal-insights-member = Journal on the list
journal-insights-unmatched = No matching record
journal-insights-unavailable = Dataset unavailable
journal-insights-basis-ISSN = ISSN
journal-insights-basis-publicationTitle = Publication title
journal-insights-basis-journalAbbreviation = Journal abbreviation
journal-insights-source = Database versions
journal-insights-custom-fallback = Custom ESI data is unavailable; the built-in dataset is being used.
journal-insights-boundary = Journal-list matches do not establish article inclusion or quality.
journal-insights-esi-custom = ESI · Custom database
journal-insights-esi-builtin = ESI · Clarivate 2026 release 6
journal-insights-nature-custom = Nature Index · Custom database
journal-insights-nature-builtin = Nature Index · June 2026
journal-insights-nature-fallback = Custom Nature Index data is unavailable; using the built-in list.
journal-database-working = Validating or reading the database…
journal-database-choose-title = Choose a journal database
journal-database-export-title = Export the built-in journal database
journal-database-exported = Built-in database exported to: { $path }
journal-database-valid = Validated: { $count } journal records; source: { $source }
journal-database-builtin = Built-in database
journal-database-error = Database operation failed: { $error }
journal-database-fallback = Custom Nature Index data is unavailable; using built-in data: { $error }

journal-database-record-error = Record { $row }: { $detail }
journal-database-issue-records = The database must contain 1–100000 records.
journal-database-issue-object = Expected a journal object.
journal-database-issue-text = Field { $field } must be text.
journal-database-issue-esi-required = Requires a discipline category and a journal title or ISSN.
journal-database-issue-issn = Invalid ISSN format. Preserve leading zeros and use text.
journal-database-issue-list = Field { $field } must be text or an array of text.
journal-database-issue-type = type must be journal or conference.
journal-database-issue-nature-required = Requires a journal title or ISSN.
journal-database-issue-journals = At least one journal is required; conference-only lists are unsupported.

journal-insights-match-detail = Match basis: { $basis }

journal-insights-scope-note = Journal-level identification, for reference.
