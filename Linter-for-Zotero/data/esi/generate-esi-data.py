#!/usr/bin/env python3
"""
Generate ESI journals JSON dataset from Excel (.xlsx) file(s).
Supports:
- Auto-detecting ESI Excel files in project root or current directory
- Dynamic column resolution by header names
- Multiple sheets and multiple Excel files
- Journal deduplication and multi-category merging
- Deterministic alphabetical sorting
"""

import json
import os
from pathlib import Path
import re
import openpyxl

SCRIPT_DIR = Path(__file__).parent.resolve()
ROOT_DIR = SCRIPT_DIR.parent.parent
OUTPUT_JSON = SCRIPT_DIR / "esi-journals.json"

def normalize_title_key(s: str) -> str:
    if not s:
        return ""
    return re.sub(r"[\s_\-:.+]+", "", str(s).lower())

def find_column_index(headers: list, candidate_names: list) -> int | None:
    for idx, h in enumerate(headers):
        if not h:
            continue
        cleaned = re.sub(r"[\s_\-]+", "", str(h).lower())
        for cand in candidate_names:
            if cleaned == re.sub(r"[\s_\-]+", "", cand.lower()):
                return idx
    return None

def clean_issn(val) -> str:
    if not val:
        return ""
    s = str(val).strip()
    if s in ("****-****", "null", "None"):
        return ""
    return s

def scan_excel_files() -> list[Path]:
    files = set()
    for pattern in ("*ESI*.xlsx", "*esi*.xlsx", "*.xlsx"):
        for p in ROOT_DIR.glob(pattern):
            if not p.name.startswith("~$") and "ESI" in p.name.upper():
                files.add(p)
        for p in SCRIPT_DIR.glob(pattern):
            if not p.name.startswith("~$") and "ESI" in p.name.upper():
                files.add(p)

    # Check common explicit names
    for name in ("物理学" + "ESI.xlsx", "物理学 ESI.xlsx"):
        candidate = ROOT_DIR / name
        if candidate.exists() and not candidate.name.startswith("~$"):
            files.add(candidate)

    # Prefer an official master list over older local discipline-only extracts.
    # Otherwise a previously curated subject workbook could widen one subject
    # and assign journals to conflicting fields after the master list updates.
    master_lists = [p for p in files if re.search(r"esi-master-journal-list-\d+-\d{4}\.xlsx$", p.name, re.IGNORECASE)]
    if master_lists:
        def release_key(path: Path) -> tuple[int, int]:
            match = re.search(r"esi-master-journal-list-(\d+)-(\d{4})\.xlsx$", path.name, re.IGNORECASE)
            return int(match.group(2)), int(match.group(1))

        return [max(master_lists, key=release_key)]

    return sorted(files)

def main():
    excel_files = scan_excel_files()
    if not excel_files:
        print(f"No ESI Excel files found in {ROOT_DIR} or {SCRIPT_DIR}.")
        return

    journal_map = {}
    category_counts = {}

    print(f"Found {len(excel_files)} ESI Excel file(s): {[f.name for f in excel_files]}")

    for file_path in excel_files:
        print(f"Processing: {file_path.name}")
        wb = openpyxl.load_workbook(file_path, data_only=True)
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            rows = list(ws.iter_rows(values_only=True))
            if not rows or len(rows) < 2:
                continue

            headers = [str(h).strip() if h is not None else "" for h in rows[0]]
            title_idx = find_column_index(headers, ["title", "journal title", "journal", "publication title"])
            if title_idx is None:
                title_idx = 0

            t20_idx = find_column_index(headers, ["title20", "title 20", "20-character title"])
            t29_idx = find_column_index(headers, ["title29", "title 29", "29-character title"])
            issn_idx = find_column_index(headers, ["issn", "print issn", "issn (print)"])
            eissn_idx = find_column_index(headers, ["eissn", "e-issn", "online issn", "electronic issn"])
            cat_idx = find_column_index(headers, ["category", "subject", "discipline", "esi category"])

            for r in rows[1:]:
                if not r or title_idx >= len(r):
                    continue
                title = str(r[title_idx]).strip() if r[title_idx] is not None else ""
                if not title:
                    continue

                t20 = str(r[t20_idx]).strip() if t20_idx is not None and t20_idx < len(r) and r[t20_idx] is not None else ""
                t29 = str(r[t29_idx]).strip() if t29_idx is not None and t29_idx < len(r) and r[t29_idx] is not None else ""
                issn = clean_issn(r[issn_idx]) if issn_idx is not None and issn_idx < len(r) else ""
                eissn = clean_issn(r[eissn_idx]) if eissn_idx is not None and eissn_idx < len(r) else ""
                cat = str(r[cat_idx]).strip() if cat_idx is not None and cat_idx < len(r) and r[cat_idx] is not None else ""

                if cat:
                    category_counts[cat] = category_counts.get(cat, 0) + 1

                key = normalize_title_key(title)
                if key in journal_map:
                    entry = journal_map[key]
                    if cat:
                        cats = set([c.strip() for c in entry["category"].split(";") if c.strip()])
                        cats.add(cat)
                        entry["category"] = "; ".join(sorted(cats))
                    if not entry["issn"] and issn:
                        entry["issn"] = issn
                    if not entry["eissn"] and eissn:
                        entry["eissn"] = eissn
                    if not entry["title20"] and t20:
                        entry["title20"] = t20
                    if not entry["title29"] and t29:
                        entry["title29"] = t29
                else:
                    journal_map[key] = {
                        "title": title,
                        "title20": t20,
                        "title29": t29,
                        "issn": issn,
                        "eissn": eissn,
                        "category": cat
                    }

    journals = sorted(journal_map.values(), key=lambda j: j["title"].upper())

    os.makedirs(SCRIPT_DIR, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(journals, f, ensure_ascii=False, indent=2)

    print(f"Successfully generated {OUTPUT_JSON} with {len(journals)} unique journals.")
    print("Discipline distribution:", category_counts)

if __name__ == "__main__":
    main()
