# Shinobi Forge

A local-first Naruto 5e character builder generated from the supplied Google Sheet export. Characters autosave in the browser and can be exported or imported as readable, versioned JSON files.

## Run it

From PowerShell:

```powershell
.\start.ps1
```

Then open <http://localhost:4173>.

## Current coverage

- Identity, level, clan, class, subclass, background, and ability scores
- Guided class/background skill proficiency grants, duplicate replacements, toolkit grants, and automatic source tracking
- Source-backed class armor, weapon, ninja-tool, and saving-throw proficiencies
- Toggleable basic and advanced elemental releases, Medical/Sensory/Fuinjutsu/Hijutsu access, automatic source suggestions, and custom capabilities
- Itemized ability math for clan +2/+1, background +1 or feat, class-level increases, and exceptional adjustments
- Searchable jutsu catalogue with the level learned
- Visible jutsu classifications, elemental keywords, other keywords, components, range, and casting time
- Editable Ryo wallet, priced purchases, class-specific starting packages, and nested simple/martial/exotic weapon choices
- Searchable weapon/armor catalogues and custom inventory items
- Persistent decisions for class, subclass, and clan features that ask the player to choose or select an option
- Summon roster based on 36 imported tribes, with one or two roles, rank-based size, calculated HP/AC, chosen ability increases, cumulative rank features, and an individual keyword-aware jutsu list
- Puppet Tool workshop with chassis rules, calculated HP/AC, shared ASI and tiered upgrade budgets, seals, weapons, Expanded Puppetry allowances, and upgrade-gated jutsu
- Level-by-level class, subclass, clan, jutsu, and freeform choice timeline
- Browser autosave
- Portable JSON import/export with validation
- Print-friendly review view

The first release validates file structure and cross-choice consistency. Complex prerequisites written in natural language are displayed from source data but are not all machine-enforced yet.

## Refresh source data

`data/rules.json` is generated from the downloaded workbook without executing formulas or following links:

```powershell
& "C:\Users\Dire\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" tools\extract_rules.py source-character-sheet.xlsx data\rules.json
```

The source PDFs can be passed after the output path to record their names and page counts in the catalogue metadata.
