# Test Data

## `pages-three.pdf`

A synthetic three-page document used to test Zotero attachment import, full-text indexing, and numeric page-range completion. It contains no user library data. Regenerate with `python test/data/generate-pages-fixture.py` (requires `reportlab`). The Git attributes preserve PDF bytes without line-ending conversion.

## `sentenceCase`

Copyed from [`zotero/utilities -> sentenceCase.json`](https://github.com/zotero/utilities/blob/f9c86c0d62b492b5b703c9b442f52610979df8fd/test/data/sentenceCase.json).

```diff
---  "Research in Natural Language Understanding: Quarterly Technical Progress Report No. 1,1": "Research in natural language understanding: quarterly technical progress report no. 1,1",
+++  "Research in Natural Language Understanding: Quarterly Technical Progress Report No. 1,1": "Research in natural language understanding: quarterly technical progress report No. 1,1",
```
