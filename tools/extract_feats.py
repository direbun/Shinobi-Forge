"""Build Shinobi Forge's checked-in feat catalogue from the Naruto 5e PDFs.

The application does not need the PDFs at runtime.  Run this script only when the
source books change; it writes the portable catalogue used by both server and
static GitHub Pages builds.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCES = [
    (Path.home() / "Downloads" / "Naruto 5e - Full Document.pdf", 139, 165, "Naruto 5e Full Document"),
    (Path.home() / "Downloads" / "Orochimarus_Observation_Compendium.pdf", 256, 270, "Orochimaru's Observation Compendium"),
    (Path.home() / "Downloads" / "Tsunades_Studies_Compendium.pdf", 1, 256, "Tsunade's Studies Compendium"),
]

FEAT_START = re.compile(r"(?m)^\s*([^\n]+?)\s*\n\s*Categor(?:y|v):\s*([^\n]+)")


def slug(value: str) -> str:
    clean = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", clean.lower()).strip("-")


def clean_text(value: str) -> str:
    value = value.replace("\u00ad", "").replace("•", "\n• ").replace("\no ", "\n  ◦ ")
    value = re.sub(r"(?<=\w)\s+-\s*(?=\w)", "-", value)
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n\s*\n+", "\n", value)
    return value.strip()


def extract_prerequisite(body: str) -> tuple[str, str]:
    match = re.search(r"(?is)^\s*Prerequisites?:\s*(.+?)(?=\n(?:You|Your|When|While|As|By|Having|Whenever|This|After|Increase|Through|Learning|To|Creatures|All|The|There|Few|Driven|Fueled|A |An |Being|Born|Trained|Using|With|Unlike|Every|Researching)\b|\n•|$)", body)
    if not match:
        return "", body.strip()
    prerequisite = re.sub(r"\s*\n\s*", " ", match.group(1)).strip(" ,.;")
    return prerequisite, (body[: match.start()] + body[match.end() :]).strip()


def normalized_category(raw: str) -> tuple[str, bool]:
    raw = clean_text(raw)
    rare = bool(re.search(r"\bRare\b", raw, re.I))
    known = next((name for name in ["General", "Skill", "Chakra", "Ninjutsu", "Taijutsu", "Bukijutsu", "Genjutsu", "Critical", "Clan", "Archetype", "Class"] if re.search(rf"\b{name}\b", raw, re.I)), "General")
    return known, rare


def infer_owner(category: str, prerequisite: str, body: str) -> str:
    if category == "Clan":
        match = re.search(r"(?:the\s+)?([^,]+?)\s+Clan\b", prerequisite, re.I)
        if match:
            return re.sub(r"^(?:Prerequisite:\s*)", "", match.group(1), flags=re.I).strip()
        direct = prerequisite.split(",", 1)[0].strip()
        if direct and len(direct.split()) <= 3 and not re.search(r"Level|Bloodline|Feat|Proficiency", direct, re.I):
            return direct
    if category == "Class":
        match = re.search(r"levels?\s+in\s+(?:the\s+)?([A-Z][A-Za-z -]+?)(?:\s+class)?(?:\s*$|,)", prerequisite, re.I)
        if match:
            return re.sub(r"\s+", " ", match.group(1)).strip().title().replace("-Nin", "-Nin")
        direct = re.match(r"([A-Z][A-Za-z -]+?)(?:\s+class)?(?:,|$)", prerequisite)
        if direct and not re.match(r"Level\b", direct.group(1), re.I):
            return re.sub(r"\s+", " ", direct.group(1)).strip()
    if category == "Archetype":
        match = re.search(r"(?im)^\s*Archetype:\s*([^\n]+)", body)
        if match:
            return clean_text(match.group(1))
    return ""


def parse_pdf(path: Path, first_page: int, last_page: int, source_book: str) -> list[dict]:
    reader = PdfReader(str(path))
    feats: list[dict] = []
    final_page = min(last_page, len(reader.pages))
    pages = {page_number: reader.pages[page_number - 1].extract_text() or "" for page_number in range(first_page, final_page + 1)}
    for page_number, raw in pages.items():
        matches = list(FEAT_START.finditer(raw))
        for index, match in enumerate(matches):
            title = re.sub(r"\s*\[(?:NEW!?|CHANGED|NAME/CHANGED)[^\]]*\]\s*", "", clean_text(match.group(1)), flags=re.I).strip()
            if title in {"GENERAL FEATS", "CLASS FEATS", "CLAN FEATS"}:
                continue
            if index + 1 < len(matches):
                body_raw = raw[match.end() : matches[index + 1].start()]
            else:
                body_raw = raw[match.end() :]
                # Preserve a feat continued onto the immediately following page,
                # but stop before that page's first new feat. This avoids pulling
                # whole clan chapters into the preceding feat description.
                next_raw = pages.get(page_number + 1, "")
                next_match = FEAT_START.search(next_raw)
                if next_match:
                    body_raw += "\n" + next_raw[: next_match.start()]
            body = clean_text(body_raw)
            body = re.sub(r"(?m)^\s*\d{1,3}\s*$", "", body)
            body = re.split(r"\n\s*(?:ART CREDIT|(?:GENERAL|SKILL|CHAKRA|NINJUTSU|TAIJUTSU|GENJUTSU|CRITICAL|CLASS|CLAN) FEATS)(?:\s*\n|\s*$)", body, maxsplit=1)[0].strip()
            category, rare = normalized_category(match.group(2))
            prerequisite_body = re.sub(r"(?im)^\s*Archetype:\s*[^\n]+\n?", "", body).strip()
            prerequisite, description = extract_prerequisite(prerequisite_body)
            owner = infer_owner(category, prerequisite, body)
            feat = {
                "id": f"feat-{slug(title)}",
                "name": title.title().replace("'S", "'s").replace("’S", "’s"),
                "category": category,
                "rare": rare,
                "owner": owner,
                "prerequisite": prerequisite,
                "description": description,
                "sourceBook": source_book,
                "sourcePage": page_number,
            }
            feats.append(feat)
    return feats


def main() -> None:
    sources = DEFAULT_SOURCES
    missing = [str(path) for path, *_ in sources if not path.exists()]
    if missing:
        raise SystemExit("Missing source PDFs: " + ", ".join(missing))
    feats: list[dict] = []
    for source in sources:
        feats.extend(parse_pdf(*source))
    # Keep the newest encountered version of duplicate names while retaining a stable order.
    unique: dict[str, dict] = {}
    for feat in feats:
        key = slug(feat["name"])
        if key in unique:
            feat["id"] = f'{feat["id"]}-{slug(feat["sourceBook"])}'
            key = feat["id"]
        unique[key] = feat
    catalogue = {
        "schemaVersion": 1,
        "generatedFrom": [source_book for _, _, _, source_book in sources],
        "feats": list(unique.values()),
    }
    output = ROOT / "private-data" / "feats.json"
    output.write_text(json.dumps(catalogue, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    counts: dict[str, int] = {}
    for feat in catalogue["feats"]:
        counts[feat["category"]] = counts.get(feat["category"], 0) + 1
    print(f"Wrote {len(catalogue['feats'])} feats to {output}")
    print(json.dumps(counts, sort_keys=True))


if __name__ == "__main__":
    main()
