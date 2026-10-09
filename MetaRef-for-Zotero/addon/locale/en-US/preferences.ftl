## General settings
section-general = General Settings
lint-on-item-added =
    .label = MetaRef: Check and organize new items automatically
lint-on-item-added-description = Enabled by default. Nearby additions are grouped and processed in the background; turning this off skips pending tasks. It only processes saved, titled, editable regular items; blank items, attachments, feed items, deleted items, and synced imports are skipped. Enabled standard rules may normalize or fill fields, and changes are saved automatically.
lint-on-groupItem-added =
    .label = Also run for items added to group libraries
lint-on-groupItem-added-description = This option only applies when automatic checks above are enabled. Turn it off to skip automatic processing in group libraries.
notify-on-lint =
    .label = Show progress notification during checks
lint-numConcurrent = Number of concurrent:
lint-numConcurrent-description = Range: 1–16. Recommended: 1. Changes apply to the next metadata check. Concurrency does not increase external service request rates.
settings-search =
    .placeholder = Search names or preference keys; separate keywords with spaces; Esc clears
    .aria-label = Search MetaRef settings
settings-no-results = No matching settings. Try a different keyword.
settings-custom-data-reset =
    .label = Clear path
    .tooltiptext = Stop using the custom file and return to built-in data or default terms

enable-richtext-toolbar =
    .label = Enable rich text toolbar
enable-richtext-hotkey =
    .label = Enable rich text hotkey
richtext-settings-description = The toolbar appears while editing the main title; shortcut changes apply immediately.

shortcuts-header = Keyboard shortcuts
shortcut-description = Click to record or paste a binding; Esc exits. Changes apply immediately. Rich text acts on title selections; batch actions act on the item list.
shortcut-subscript = Subscript
shortcut-supscript = Superscript
shortcut-bold = Bold
shortcut-italic = Italic
shortcut-nocase = No-case
shortcut-lint = MetaRef: Check & Fix
    .tooltiptext = Check and fix metadata of selected items

wip =
    .label = Work in progress...


## Menu settings
section-menu = Context Menu Settings
section-menu-description = Choose which actions appear in context menus. Unchecking an action only hides its menu entry; it does not disable automatic rules or remove the feature.
menu-standard-description = “MetaRef: Check and Fix Metadata” runs enabled standard rules to check and correct title, creator, date, identifier, journal, and other fields. Changes are saved; unresolved findings appear in the results. It does not run manual tools. Enabled DOI lookup, DOI validation, and journal abbreviation inference rules may use the network; disable them in their rule settings if needed.
menu-update-metadata-description = “MetaRef: Update Metadata and Check” retrieves bibliographic data from available services using the item type, DOI, or URL, applies the selected update mode, then runs enabled standard rules and saves changes. “All fields” can overwrite existing values. “Blank fields only” preserves existing values and prevents item-type changes that could clear fields.
section-menu-field = Field Context Menus
menu-standard =
    .label = MetaRef: Check and Fix Metadata
menu-field-correct-title-punctuation =
    .label = Normalize punctuation in title
menu-field-correct-extra-order =
    .label = Normalize extra fields order


## 分组标题
section-item = Item Level Rules
section-item-description = Expand or collapse a group by selecting its heading. Collapsing only changes visibility; it does not disable rules.
section-rich-text = Rich Text Edit Tools
section-title = Title
section-creators = Creators
section-language = Language
section-article = Journal Articles & Publication
section-article-abbreviation = Journal Titles & Abbreviations
section-article-esi = Journal insights & custom databases
section-article-pagination = Volume, Issue & Pages
section-conference = Conference Papers
section-thesis = Theses
section-book = Books & Chapters
section-patent = Patents
section-identifier = Identifier
section-others = Other Fields
section-updateMetadata = Update Metadata
metadata-update-defaults = Default Update Options
metadata-provider-options = Data Provider Options
section-about = About


## 关于
help-version = { $name }, Build { $version }, { $time }
about-repo-label = Repository:

shortcut-chemicalFormula = Chemical formulas
shortcut-clear =
    .label = Disable
    .tooltiptext = Disable this shortcut
shortcut-reset =
    .label = Reset
    .tooltiptext = Restore the default shortcut for this action
shortcut-input-hint =
    .title = Record a binding or paste accel,key syntax; accel means Ctrl (Cmd on macOS). Tab moves focus, Esc exits, Backspace/Delete disables.
    .placeholder = Click to record
shortcut-conflict = Conflicts with { $action }; not saved. Choose a different combination.
shortcut-invalid = Invalid shortcut; not saved. Use a Ctrl, Cmd or Alt combination.
shortcut-saved = Shortcut saved and active immediately.
shortcut-disabled = This shortcut is disabled.

insights-show-pane =
    .label = Show the independent MetaRef journal insights section
insights-description = Show ESI and Nature Index in an independent section and optional columns without writing fields or tags. Menu queries remain available; database changes apply immediately.

journal-database-nature = Custom Nature Index journal database
journal-database-nature-path =
    .placeholder = Leave blank for built-in data; JSON / CSV supported
    .aria-label = Custom Nature Index database path
journal-database-description = Custom files replace the built-in list without merging. Every record is validated before changing the path. After editing the file, select Reload. Clear the path to restore built-in data. User-defined lists do not imply official inclusion.
journal-database-validate =
    .label = Validate database
journal-database-reload =
    .label = Reload
journal-database-export =
    .label = Export built-in JSON

## Settings navigation and validation
section-rules = Metadata Rules
settings-search-clear =
    .label = Clear
    .tooltiptext = Clear search and restore your expanded rule groups
settings-jump =
    .aria-label = Jump to a settings section
settings-jump-placeholder = Jump to section…
settings-results = Matching settings: { $count }
settings-expand-all =
    .label = Expand all rule groups
    .tooltiptext = Changes visibility only; does not enable rules. Unavailable during search.
settings-collapse-all =
    .label = Collapse all rule groups
    .tooltiptext = Changes visibility only; does not disable rules. Unavailable during search.
settings-concurrency-invalid = Enter a whole number from 1 to 16. This value has not been saved.
settings-concurrency-restored = Invalid value discarded; the last saved value has been restored.

settings-abbr-file-title = Select a custom abbreviation file
settings-title-file-title = Select a custom title terms file
settings-file-working = Reading and validating the file…
settings-file-empty = The file has no usable records.
settings-file-valid = Validated and activated { $count } records. Changes apply to the next check.
settings-file-error = File not activated; the previous path is unchanged. { $error }
