# Essential Science Indicators source data

`esi-journals.json` is generated from Clarivate's public **ESI Master Journal List, release 6 of 2026**, downloaded from the official [Scope and Coverage page](https://essentialscienceindicators.zendesk.com/hc/en-gb/articles/28150642413201-Scope-and-Coverage). The page was updated on 23 September 2026 and says that the active journal list covers January 2016–June 2026. Its 12,246 source rows normalize to 12,245 unique titles across all 22 ESI fields.

The generator prefers an `esi-master-journal-list-<release>-<year>.xlsx` file in this directory over older local discipline-only spreadsheets. This avoids mixing the former 311-title physics-only extract into the newer all-field master list. The one title assigned two different fields in the source workbook, *Journal of Cultural Heritage*, is retained with both published categories; the source contradicts Clarivate's separate description that journals have one field, so the plugin does not guess which row to discard.

To update the snapshot, download the newest master journal list from the linked Clarivate page into this directory, then run `python data/esi/generate-esi-data.py`. The checked-in JSON keeps title variants, ISSNs, eISSNs, and the source category so the plugin can identify records by either journal name or ISSN.

Clarivate's product and data names are trademarks of their respective owners. The downloaded help page does not state a separate open license for the master-list attachment; this attribution documents provenance and does not assert a broader data license. The JSON is a normalized, minimal journal-identification extract; it contains no paper, author, citation, or ranking data.
