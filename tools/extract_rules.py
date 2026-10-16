"""Extract the usable Naruto 5e rules catalogue from the supplied sheet export.

Usage:
  python tools/extract_rules.py source-character-sheet.xlsx data/rules.json [pdf ...]

The workbook is treated as untrusted input. This script only reads cell values and
does not evaluate formulas, follow links, or execute embedded content.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from openpyxl import load_workbook
from pypdf import PdfReader


LEVELS = list(range(1, 21))
CLAN_LEVELS = [1, 3, 5, 7, 11, 15, 18]

STARTING_EQUIPMENT = {
    "Genjutsu-Specialist": [
        ["1 Simple Weapon"], ["Kunai Stack", "Shuriken Stack"], ["Padded Cloth"], ["Poison Kit"], ["Smoke Bomb"],
    ],
    "Hunter-Nin": [
        ["Padded Cloth"], ["2 Simple Weapons", "1 Martial Weapon"], ["Kunai Stack", "Shuriken Stack"],
        ["Flash Tag", "Paper Bomb"], ["2 Kits of your choice"],
    ],
    "Intelligence-Operative": [
        ["Padded Cloth", "Combat Jacket"], ["1 Simple Weapon", "2 Knuckle Blades"], ["Kunai Stack", "Fuma Shuriken"],
        ["1 Tool Kit of your choice"], ["Paper Bomb"],
    ],
    "Medical-Nin": [
        ["Padded Cloth", "Combat Jacket"], ["1 Simple Weapon"], ["Kunai Stack", "Senbon Stack"], ["Flash Tag"], ["Medicine Kit"],
    ],
    "Ninjutsu-Specialist": [
        ["Padded Cloth"], ["1 Simple Weapon"], ["Kunai Stack", "Shuriken Stack"], ["D-Rank Ninjutsu Scroll"],
    ],
    "Scout-Nin": [
        ["Padded Cloth", "Combat Jacket", "Combat Armor"], ["1 Simple Weapon", "1 Martial Weapon"],
        ["Kunai Stack", "Shuriken Stack"], ["Paper Bomb", "Flash Tag"], ["1 Toolkit of your choice"],
    ],
    "Taijutsu-Specialist": [
        ["No Armor", "Padded Cloth", "Combat Jacket"], ["Combat Bracers", "Iron Claw"], ["Kunai Stack", "Shuriken Stack"],
        ["2 Paper Bombs", "2 Flash Tags"], ["Smoke Bomb"],
    ],
    "Weapon-Specialist": [
        ["Padded Cloth", "Combat Jacket", "Combat Armor"], ["1 Simple Weapon", "1 Martial Weapon"],
        ["1 Simple Weapon", "1 Martial Weapon"], ["Kunai Stack", "Shuriken Stack"], ["2 Paper Bombs"],
    ],
    "Puppet-Master": [
        ["Hand Crossbow and Bolt Stack", "2 Simple Weapons"], ["Kunai Stack", "Shuriken Stack"],
        ["Padded Cloth", "Combat Jacket"], ["Crafter's Pack"], ["Paper Bomb"],
    ],
    "Cooking-Nin": [
        ["Padded Cloth", "Combat Jacket"], ["1 Simple Weapon"], ["Kunai Stack", "Shuriken Stack"],
        ["Cooking Tools"], ["Flash Tag"], ["Paper Bomb"],
    ],
    "Science-Nin": [
        ["Padded Cloth", "Combat Jacket"], ["1 Simple Weapon"], ["Kunai Stack", "Shuriken Stack"],
        ["Paper Bomb", "Flash Tag"], ["2 Kits of your choice"],
    ],
    "Jujutsu-Sorcerer": [
        ["Padded Cloth", "Combat Jacket"], ["1 Martial Weapon", "1 Exotic Weapon"], ["Kunai Stack", "Chakram"],
        ["2 Simple Weapons"], ["2 Paper Bombs", "2 Flash Tags"], ["Tracking Kit", "Forensics Kit"],
    ],
    "Lunar-Slayer": [
        ["Padded Cloth", "Combat Jacket"], ["1 Simple Weapon", "1 Martial Weapon"], ["1 Simple Weapon", "1 Martial Weapon"],
        ["Shinobi Waist Bag, Belt Pouch, and Leg Pouch"], ["1 Kit of your choice"],
    ],
}

WEAPON_MARKET = {
    "kunai": (10, "Simple"), "hand axe": (10, "Simple"), "sai": (20, "Simple"),
    "tanto (shortsword)": (10, "Simple"), "kama (hand scythe)": (10, "Simple"),
    "gunsen": (10, "Simple"), "quarterstaff": (10, "Simple"), "spear": (10, "Simple"),
    "weighted chain": (10, "Simple"), "kusarigama (chained hand scythe)": (10, "Simple"),
    "tekko": (20, "Simple"), "senbon": (15, "Simple"), "short bow": (20, "Simple"),
    "shuriken": (10, "Simple"), "sling": (5, "Simple"), "light crossbow": (20, "Simple"),
    "bola": (5, "Simple"),
    "broadsword": (20, "Martial"), "iron claw": (20, "Martial"), "taichi": (40, "Martial"),
    "katana": (30, "Martial"), "odachi (great sword)": (80, "Martial"),
    "knuckle blades": (20, "Martial"), "hidden blade": (20, "Martial"),
    "chained spear": (20, "Martial"), "chigiriki": (25, "Martial"), "whip": (20, "Martial"),
    "battle wire": (20, "Martial"), "naginata": (40, "Martial"),
    "sasumata (forked spear)": (40, "Martial"), "great axe": (40, "Martial"),
    "scythe": (40, "Martial"), "tinbe rochin": (15, "Martial"), "yari": (40, "Martial"),
    "hooked lance": (40, "Martial"), "tetsubo": (40, "Martial"), "tonfa": (20, "Martial"),
    "war club": (40, "Martial"), "nunchaku": (20, "Martial"),
    "combat bracers": (20, "Martial"), "jitte": (20, "Martial"), "gunbai fan": (40, "Martial"),
    "kanabo": (30, "Martial"), "otsuchi hammer": (40, "Martial"), "chakram": (40, "Martial"),
    "monster chakram": (40, "Martial"), "fuma-shuriken": (20, "Martial"),
    "monster shuriken": (40, "Martial"), "torinawa": (5, "Martial"), "boomerang": (25, "Martial"),
    "monster boomerang": (50, "Martial"), "longbow": (40, "Martial"),
    "crossbow, hand": (20, "Martial"), "crossbow, heavy": (40, "Martial"),
    "blowgun": (20, "Martial"), "net": (20, "Martial"),
    "sansetsukon": (100, "Exotic"), "triple-bladed scythe": (100, "Exotic"),
    "cleaver sword": (100, "Exotic"), "triple katar": (100, "Exotic"), "urumi": (100, "Exotic"),
    "chokuto": (20, "Exotic"), "matchlock pistol": (200, "Exotic"),
    "matchlock rifle": (250, "Exotic"), "hiya taihou": (500, "Exotic"),
    "combat scroll": (250, "Exotic"), "giant combat scroll": (500, "Exotic"),
    "ballistic kunai gun": (300, "Exotic"), "ballistic shuriken rifle": (500, "Exotic"),
}

ARMOR_PRICES = {
    "padded cloth": 100, "leather weave": 250, "armored cloth": 500, "reinforced cloth": 750,
    "synthetic weave": 1500, "shinobi weave": 2500, "combat jacket": 100,
    "shinobi jacket": 250, "shinobi combat jacket": 500, "chunin jacket": 750,
    "battle coat": 1500, "armored chunin coat": 2500, "combat armor": 100,
    "synthetic armor": 250, "jonin armor": 500, "elite jonin armor": 750,
    "ronin armor": 1500, "samurai armor": 2500,
}

SUMMON_ROLES = {
    "Striker": "This summon has Multiattack and can make two attacks with its natural or held weapons.",
    "Caster": "This summon gains additional jutsu slots equal to its rank.",
    "Controller": "This summon gains a bonus to its save DC equal to its rank bonus.",
    "Defender": "This summon gains a bonus to AC equal to its rank bonus.",
    "Lurker": "Once per turn, it deals extra d8s equal to half its level, rounded up, when it has advantage or an ally is within 5 feet of the target.",
    "Supporter": "Healing and temporary hit points gain extra dice equal to rank: D 1, C 2, B 3, A 4, S 5.",
}

SUMMON_RANKS = {
    "D-Rank": {"level": 4, "asiPoints": 0, "statMax": 20},
    "C-Rank": {"level": 8, "asiPoints": 6, "statMax": 20},
    "B-Rank": {"level": 12, "asiPoints": 12, "statMax": 22},
    "A-Rank": {"level": 16, "asiPoints": 18, "statMax": 24},
    "S-Rank": {"level": 20, "asiPoints": 24, "statMax": 26},
}

# The sheet's Lists tab contains an older summon ability matrix. The current
# summon tables in Jiraiya's Jutsu Compendium are authoritative for these core
# tribes (D-Rank base scores, before rank-based ability increases).
SUMMON_ABILITY_OVERRIDES = {
    "bear": (16, 10, 14, 10, 12, 10),
    "boar": (16, 10, 14, 10, 10, 12),
    "deer": (14, 12, 10, 10, 16, 10),
    "dogwolf": (14, 14, 14, 10, 12, 10),
    "fox": (8, 14, 12, 10, 13, 14),
    "harerabbit": (8, 14, 10, 16, 13, 11),
    "hawk": (10, 14, 12, 10, 16, 10),
    "insectswarm": (8, 13, 11, 16, 14, 10),
    "lizard": (16, 12, 12, 10, 14, 8),
    "monkey": (16, 14, 12, 10, 10, 10),
    "oxram": (16, 10, 14, 10, 12, 10),
    "rat": (8, 16, 10, 14, 13, 11),
    "shark": (16, 10, 12, 10, 10, 14),
    "slug": (10, 10, 12, 14, 16, 10),
    "snake": (10, 16, 12, 10, 10, 14),
    "spider": (14, 10, 12, 16, 10, 10),
    "tigerlion": (16, 10, 12, 10, 14, 10),
    "toad": (14, 12, 12, 14, 12, 11),
    "turtle": (13, 8, 16, 14, 11, 10),
    "weasel": (8, 16, 12, 14, 12, 10),
}

# Armor Class uses the modifier of the tribe's named Defensive Ability. These
# are taken from the current summon entries in Jiraiya's Jutsu Compendium.
# Sheet-only supplemental tribes fall back to Dexterity below so their Armor
# still responds to their allocated ability increases.
SUMMON_DEFENSIVE_ABILITIES = {
    "bear": "constitution",
    "boar": "strength",
    "deer": "dexterity",
    "dogwolf": "dexterity",
    "fox": "dexterity",
    "harerabbit": "dexterity",
    "hawk": "dexterity",
    "insectswarm": "wisdom",
    "lizard": "strength",
    "monkey": "dexterity",
    "oxram": "constitution",
    "rat": "dexterity",
    "shark": "constitution",
    "slug": "constitution",
    "snake": "dexterity",
    "spider": "strength",
    "tigerlion": "wisdom",
    "toad": "constitution",
    "turtle": "constitution",
    "weasel": "dexterity",
}


def text(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def split_features(value) -> list[str]:
    raw = text(value)
    if not raw:
        return []
    return [item.strip() for item in re.split(r",\s*(?![^()]*\))", raw) if item.strip()]


def normalized(value: str) -> str:
    value = re.sub(r"\[[^\]]+\]", "", value)
    value = re.sub(r"\s*\([^)]*\)\s*$", "", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip().casefold()


def feature_catalog(workbook) -> dict[str, dict]:
    sheet = workbook["Feature Lookup"]
    result: dict[str, dict] = {}
    for row in sheet.iter_rows(min_row=2, max_col=7, values_only=True):
        lookup, final_name, kind, description, action, cost, data = row
        name = text(final_name) or text(lookup)
        description = text(description)
        if not name or not description:
            continue
        entry = {
            "name": name,
            "type": text(kind),
            "description": description,
            "action": text(action),
            "cost": text(cost),
            "data": text(data),
        }
        for alias in {text(lookup), name, normalized(name)}:
            if alias:
                result[normalized(alias)] = entry
    return result


def decorate_feature(name: str, catalog: dict[str, dict]) -> dict:
    entry = catalog.get(normalized(name), {})
    return {
        "name": name,
        "description": entry.get("description", ""),
        "type": entry.get("type", ""),
        "action": entry.get("action", ""),
        "cost": entry.get("cost", ""),
    }


def extract_clans(workbook, catalog) -> list[dict]:
    sheet = workbook["Lists"]
    clans = []
    for row_number in range(259, 392):
        name = text(sheet.cell(row_number, 1).value)
        if not name:
            continue
        features = {}
        for column, level in zip(range(7, 14), CLAN_LEVELS):
            names = split_features(sheet.cell(row_number, column).value)
            if names:
                features[str(level)] = [decorate_feature(item, catalog) for item in names]
        clans.append({
            "id": f"clan-{row_number}",
            "name": name,
            "speed": text(sheet.cell(row_number, 14).value),
            "featuresByLevel": features,
            "image": text(sheet.cell(row_number, 28).value),
        })
    return clans


def extract_classes(workbook, catalog) -> list[dict]:
    sheet = workbook["Lists"]
    classes = []
    for row_number in range(398, 426):
        name = text(sheet.cell(row_number, 1).value)
        if not name or name == "Example-Tester":
            continue
        features = {}
        for column, level in zip(range(7, 27), LEVELS):
            names = split_features(sheet.cell(row_number, column).value)
            if names:
                features[str(level)] = [decorate_feature(item, catalog) for item in names]
        classes.append({
            "id": f"class-{row_number}",
            "name": name,
            "hitDie": text(sheet.cell(row_number, 27).value),
            "chakraDie": text(sheet.cell(row_number, 28).value),
            "jutsuKnown": text(sheet.cell(row_number, 40).value),
            "startingEquipment": [
                {"id": f"{row_number}-{index}", "choices": choices}
                for index, choices in enumerate(STARTING_EQUIPMENT.get(name, []), 1)
            ],
            "featuresByLevel": features,
        })
    return classes


def extract_subclasses(workbook, catalog) -> list[dict]:
    sheet = workbook["Lists"]
    subclasses = []
    for row_number in range(432, 632):
        class_name = text(sheet.cell(row_number, 1).value)
        name = text(sheet.cell(row_number, 7).value)
        if not class_name or not name:
            continue
        features = {}
        for column, level in zip(range(16, 36), LEVELS):
            names = split_features(sheet.cell(row_number, column).value)
            if names:
                features[str(level)] = [decorate_feature(item, catalog) for item in names]
        subclasses.append({
            "id": f"subclass-{row_number}",
            "className": class_name,
            "name": name,
            "featuresByLevel": features,
        })
    return subclasses


def extract_backgrounds(workbook, catalog) -> list[dict]:
    sheet = workbook["Lists"]
    backgrounds = []
    for row_number in range(645, 720):
        name = text(sheet.cell(row_number, 1).value)
        if not name:
            continue
        feature_name = text(sheet.cell(row_number, 7).value)
        backgrounds.append({
            "id": f"background-{row_number}",
            "name": name,
            "feature": decorate_feature(feature_name, catalog) if feature_name else None,
        })
    return backgrounds


def extract_jutsu(workbook) -> list[dict]:
    sheet = workbook["Jutsu List (Courtesy of Kane)"]
    jutsu = []
    for row_number in range(2, 2001):
        values = [text(sheet.cell(row_number, column).value) for column in range(1, 12)]
        name, kind, rank, casting_time, range_, duration, components, cost, keywords, description, higher = values
        if not name or not kind or name in {"Feat Titles", "Jutsu Names"}:
            continue
        if rank and "Rank" not in rank:
            continue
        jutsu.append({
            "id": f"jutsu-{row_number}",
            "name": name,
            "classification": kind,
            "rank": rank,
            "castingTime": casting_time,
            "range": range_,
            "duration": duration,
            "components": components,
            "cost": cost,
            "keywords": keywords,
            "description": description,
            "higherRanks": higher,
        })
    return jutsu


def extract_equipment(workbook) -> dict:
    sheet = workbook["Lists"]
    armor = []
    for row_number in range(8, 49):
        name = text(sheet.cell(row_number, 1).value)
        if not name or name == "Skin" or name.startswith("[["):
            continue
        armor.append({
            "id": f"armor-{row_number}", "name": name, "type": text(sheet.cell(row_number, 7).value),
            "armorBonus": sheet.cell(row_number, 25).value or 0, "maxModifier": sheet.cell(row_number, 21).value,
            "bulk": sheet.cell(row_number, 33).value or 0, "price": ARMOR_PRICES.get(name.casefold()),
        })
    weapons = []
    for row_number in range(61, 167):
        name = text(sheet.cell(row_number, 1).value)
        if not name or name.startswith("[["):
            continue
        market_name = re.sub(r"\s*\((?:Two Hands)\)\s*$", "", name, flags=re.I).casefold()
        price, category = WEAPON_MARKET.get(market_name, (None, ""))
        weapons.append({
            "id": f"weapon-{row_number}", "name": name, "damage": text(sheet.cell(row_number, 8).value),
            "ability": text(sheet.cell(row_number, 11).value), "damageType": text(sheet.cell(row_number, 25).value),
            "properties": text(sheet.cell(row_number, 35).value), "price": price, "category": category,
        })
    return {"armor": armor, "weapons": weapons}


def summon_key(value: str) -> str:
    value = value.casefold().replace("predator birds", "").replace("predator bird", "").replace("primate", "")
    value = value.replace("rabbits", "rabbit")
    return re.sub(r"[^a-z0-9]", "", value)


def extract_summons(workbook) -> dict:
    sheet = workbook["Lists"]
    summon_sheet = workbook["Summon Sheet"]
    trait_descriptions = {}
    for row_number in range(3, 1003):
        trait_name = text(summon_sheet.cell(row_number, 167).value)
        description = text(summon_sheet.cell(row_number, 170).value)
        if trait_name and description:
            trait_descriptions[trait_name.casefold()] = description
    rank_columns = {
        "D-Rank": {"size": 91, "slots": 80, "speed": 112, "features": (141, 142, 143)},
        "C-Rank": {"size": 92, "slots": 81, "speed": 113, "features": (146, 147, 148)},
        "B-Rank": {"size": 93, "slots": 82, "speed": 114, "features": (151, 152, 153)},
        "A-Rank": {"size": 94, "slots": 83, "speed": 115, "features": (156, 157, 158)},
        "S-Rank": {"size": 95, "slots": 84, "speed": 116, "features": (161, 162, 163)},
    }
    advancement = {}
    for row_number in range(4, 74):
        name = text(summon_sheet.cell(row_number, 65).value)
        if not name:
            continue
        ranks = {}
        for rank, details in rank_columns.items():
            features = []
            for column in details["features"]:
                feature_name = text(summon_sheet.cell(row_number, column).value)
                if feature_name and feature_name != "-":
                    features.append({
                        "name": feature_name,
                        "description": trait_descriptions.get(feature_name.casefold(), ""),
                    })
            ranks[rank] = {
                **SUMMON_RANKS[rank],
                "sizeRange": text(summon_sheet.cell(row_number, details["size"]).value),
                "jutsuSlots": summon_sheet.cell(row_number, details["slots"]).value or 0,
                "speed": summon_sheet.cell(row_number, details["speed"]).value or 0,
                "features": features,
            }
        advancement[summon_key(name)] = {
            "summonType": text(summon_sheet.cell(row_number, 70).value),
            "toughness": summon_sheet.cell(row_number, 75).value or 0,
            "castingModifier": summon_sheet.cell(row_number, 96).value or 0,
            "defensiveModifier": summon_sheet.cell(row_number, 101).value or 0,
            "ranks": ranks,
        }
    tribes = []
    for row_number in range(173, 209):
        name = text(sheet.cell(row_number, 1).value)
        if not name:
            continue
        progression = advancement.get(summon_key(name), {})
        sheet_abilities = tuple(sheet.cell(row_number, column).value or 10 for column in (39, 41, 43, 45, 47, 49))
        ability_scores = SUMMON_ABILITY_OVERRIDES.get(summon_key(name), sheet_abilities)
        defensive_ability = SUMMON_DEFENSIVE_ABILITIES.get(summon_key(name), "dexterity")
        tribes.append({
            "id": f"tribe-{row_number}", "name": name,
            "savingThrows": [text(sheet.cell(row_number, 7).value), text(sheet.cell(row_number, 9).value)],
            "skills": text(sheet.cell(row_number, 11).value), "senses": text(sheet.cell(row_number, 15).value),
            "jutsuAccess": text(sheet.cell(row_number, 19).value), "attackAbility": text(sheet.cell(row_number, 25).value),
            "naturalWeapons": text(sheet.cell(row_number, 29).value),
            "abilities": {
                "strength": ability_scores[0], "dexterity": ability_scores[1],
                "constitution": ability_scores[2], "intelligence": ability_scores[3],
                "wisdom": ability_scores[4], "charisma": ability_scores[5],
            },
            "defensiveAbility": defensive_ability,
            "hitDie": sheet.cell(row_number, 51).value, "chakraDie": sheet.cell(row_number, 53).value,
            **progression,
        })
    templates = []
    for row_number in range(215, 253):
        tribe = text(sheet.cell(row_number, 13).value)
        if not tribe:
            continue
        templates.append({
            "id": f"summon-{row_number}", "name": text(sheet.cell(row_number, 1).value),
            "rank": text(sheet.cell(row_number, 9).value), "tribe": tribe,
            "features": [text(sheet.cell(row_number, col).value) for col in (19, 27, 35, 43) if text(sheet.cell(row_number, col).value) not in ("", "-")],
            "speed": sheet.cell(row_number, 51).value, "size": text(sheet.cell(row_number, 53).value),
        })
    return {
        "tribes": tribes,
        "templates": templates,
        "roles": [{"name": name, "description": description} for name, description in SUMMON_ROLES.items()],
        "ranks": SUMMON_RANKS,
    }


def pdf_sources(paths: list[Path]) -> list[dict]:
    sources = []
    for path in paths:
        if not path.exists():
            continue
        reader = PdfReader(str(path))
        sources.append({"name": path.name, "pages": len(reader.pages)})
    return sources


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("Expected input workbook, output JSON, and optional PDF paths")
    workbook_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    pdf_paths = [Path(value) for value in sys.argv[3:]]
    workbook = load_workbook(workbook_path, read_only=False, data_only=True)
    catalog = feature_catalog(workbook)
    payload = {
        "schemaVersion": 1,
        "source": {
            "sheetTitle": "Copy of N5E Character Sheet - Final Version (Make a Copy)",
            "sheetVersion": text(workbook["Character Info"]["X3"].value),
            "pdfs": pdf_sources(pdf_paths),
        },
        "classes": extract_classes(workbook, catalog),
        "subclasses": extract_subclasses(workbook, catalog),
        "clans": extract_clans(workbook, catalog),
        "backgrounds": extract_backgrounds(workbook, catalog),
        "jutsu": extract_jutsu(workbook),
        "equipment": extract_equipment(workbook),
        "summons": extract_summons(workbook),
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    counts = {key: len(payload[key]) for key in ("classes", "subclasses", "clans", "backgrounds", "jutsu")}
    print(json.dumps({"output": str(output_path), "counts": counts}, indent=2))


if __name__ == "__main__":
    main()
