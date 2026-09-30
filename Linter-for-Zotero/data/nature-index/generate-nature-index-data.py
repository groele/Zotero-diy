#!/usr/bin/env python3
"""Build the current Nature Index publication-title snapshot from its official FAQ."""

from datetime import date
from html.parser import HTMLParser
from collections import defaultdict
import json
import re
from urllib.request import Request, urlopen
from pathlib import Path

SOURCE_URL = "https://www.nature.com/nature-index/faq"
OUTPUT = Path(__file__).parent / "nature-index-journals.json"
DATA_DIR = Path(__file__).parent.parent
ROOT = DATA_DIR.parent


class JournalListParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_journals_section = False
        self.in_journal_list = False
        self.in_list_item = False
        self.current = []
        self.entries = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "h2" and attributes.get("id") == "journals":
            self.in_journals_section = True
        elif self.in_journals_section and tag == "h2":
            self.in_journals_section = False
            self.in_journal_list = False
        elif self.in_journals_section and tag == "ul" and "c-faq-journals" in attributes.get("class", "").split():
            self.in_journal_list = True
        elif self.in_journal_list and tag == "li":
            self.in_list_item = True
            self.current = []

    def handle_data(self, data):
        if self.in_list_item:
            self.current.append(data)

    def handle_endtag(self, tag):
        if tag == "li" and self.in_list_item:
            value = " ".join(" ".join(self.current).split())
            value = re.sub(r"\s*\(\d[\d,]* articles\)\s*$", "", value, flags=re.IGNORECASE)
            if value:
                self.entries.append(value)
            self.in_list_item = False
        elif tag == "ul" and self.in_journal_list:
            self.in_journal_list = False


def main():
    request = Request(SOURCE_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        document = response.read().decode("utf-8", errors="replace")

    parser = JournalListParser()
    parser.feed(document)
    titles = sorted(set(parser.entries), key=str.casefold)
    if len(titles) != 178:
        # nature.com may return a bot-challenge page to scripted clients. In
        # that case, keep the last manually verified official snapshot intact.
        if not OUTPUT.exists():
            raise RuntimeError(f"Expected 178 Nature Index publications; parsed {len(titles)} and no verified snapshot exists")
        previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
        titles = sorted({venue["title"] for venue in previous.get("venues", [])}, key=str.casefold)
        if len(titles) != 178:
            raise RuntimeError(f"Expected 178 Nature Index publications; parsed {len(titles)} and verified snapshot is invalid")
        snapshot = previous.get("snapshot", "2026-09-30")
        print(f"Nature.com did not provide a parseable FAQ; retaining verified {snapshot} publication list")
    else:
        snapshot = date.today().isoformat()
    conference = "IEEE/RSJ International Conference on Intelligent Robots and Systems (IROS)"
    if conference not in titles:
        raise RuntimeError("The current Nature Index conference venue was not found")

    output = {
        "snapshot": snapshot,
        "release": "2026-06",
        "publicationCount": len(titles),
        "journalCount": len(titles) - 1,
        "conferenceCount": 1,
        "source": SOURCE_URL,
        "sourceLicense": "The Nature Index states that its most recent 12 months of data are available under CC BY-NC-SA 4.0; refer to the publisher's terms for the applicable license.",
        "venues": [
            {
                "title": title,
                "type": "conference" if title == conference else "journal",
            }
            for title in titles
        ],
    }

    def normalize(value):
        value = value.lower().strip()
        value = re.sub(r"[.+]", "", value)
        value = re.sub(r"\b(the|and)\b", "", value)
        value = re.sub(r"[&\-:, ()]", "", value)
        return re.sub(r"\s+", "", value)

    # Enrich official names with exact matches from the bundled Clarivate
    # identifiers and the project's journal-abbreviation reference data.
    esi_path = DATA_DIR / "esi" / "esi-journals.json"
    abbreviation_path = DATA_DIR / "journal-abbr" / "journal-abbr.json"
    esi = json.loads(esi_path.read_text(encoding="utf-8")) if esi_path.exists() else []
    abbreviations = json.loads(abbreviation_path.read_text(encoding="utf-8")) if abbreviation_path.exists() else {}
    esi_by_title = defaultdict(list)
    abbreviations_by_title = defaultdict(set)
    for record in esi:
        if record.get("title"):
            esi_by_title[normalize(record["title"])].append(record)
    for title, abbreviation in abbreviations.items():
        if title and abbreviation:
            abbreviations_by_title[normalize(title)].add(abbreviation)
    for venue in output["venues"]:
        if venue["type"] != "journal":
            continue
        key = normalize(venue["title"])
        aliases = abbreviations_by_title.get(key, set())
        source_records = esi_by_title.get(key, [])
        venue["aliases"] = sorted(aliases, key=str.casefold)
        venue["issn"] = sorted({
            identifier
            for record in source_records
            for identifier in (record.get("issn"), record.get("eissn"))
            if identifier and identifier != "****-****"
        })
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(titles) - 1} journals and 1 conference to {OUTPUT}")


if __name__ == "__main__":
    main()
