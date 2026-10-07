## General settings
section-general = General Settings
lint-on-item-added =
    .label = Lint when item added to library
lint-on-groupItem-added =
    .label = Lint when item added to group
notify-on-lint =
    .label = Show progress notification when Lint
lint-numConcurrent = Number of concurrent:
lint-numConcurrent-description = Range: 1–16. Recommended: 1. Changes apply to the next lint batch. Concurrency does not increase external service request rates.
settings-search =
    .placeholder = Search settings or rule names; Esc clears
    .aria-label = Search MetaRef settings
settings-no-results = No matching settings. Try a different keyword.
settings-custom-data-reset =
    .label = Clear path
    .tooltiptext = Stop using the custom file and return to built-in data or default terms

enable-richtext-toolbar =
    .label = Enable rich text toolbar
enable-richtext-preview =
    .label = Enable rich text preview
enable-richtext-hotkey =
    .label = Enable rich text hotkey
richtext-settings-description = Toolbar and preview update the next time the title editor receives focus; the shortcut toggle applies immediately.

shortcuts-header = Keyboard shortcuts
shortcut-description = Click to record or paste a binding; Esc exits. Changes apply immediately. Rich text acts on title selections; batch actions act on the item list.
shortcut-subscript = Subscript
shortcut-supscript = Superscript
shortcut-bold = Bold
shortcut-italic = Italic
shortcut-nocase = No-case
shortcut-lint = Lint

wip =
    .label = Work in progress...


## Menu settings
section-menu = Context Menu Settings
section-menu-description = Choose which actions appear in context menus. Unchecking an action only hides its menu entry; it does not disable automatic rules or remove the feature.
section-menu-field = Field Context Menus
menu-standard =
    .label = Lint & Fix
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
