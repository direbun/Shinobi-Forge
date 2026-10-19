# Shinobi Forge secure migration analysis

## Current application

Shinobi Forge is a buildless static application:

- `index.html` contains the complete ten-step character-creation interface.
- `styles.css` contains all presentation and responsive rules.
- `app.js` owns browser state, rendering, searches, autosave, import, and export.
- `model.mjs` owns sanitisation, formulas, progression, derived statistics, and validation.
- `data/rules.json` is a 3.3 MB browser-downloadable master catalogue.
- `tools/extract_rules.py` rebuilds the catalogue from the supplied workbook and PDFs.
- `tests/model.test.mjs` verifies the browser model.

There are no runtime third-party libraries or external application services. Clan images may refer to remote image URLs, but the creator itself is otherwise self-contained. `start.ps1` only starts a local static HTTP server.

The repository also contains two distinct consumers:

- `enemy-builder/` is a separate adversary application and is not part of this migration.
- `shinobi-forge-importer/` is a Foundry VTT module. It consumes the exported character schema and has its own bundled rules fallback. It must remain installable separately and must never be served by the public Shinobi Forge container.

## Current browser trust and exposure

Today every visitor receives:

- all 13 classes and their feature progressions;
- all 168 subclasses and their feature progressions;
- all 80 clans and their feature progressions;
- all 74 backgrounds;
- all 1,804 jutsu including full descriptions;
- armor, weapon, summon, proficiency, and progression tables;
- all formulas and validation logic in readable JavaScript.

The browser is authoritative. It sanitises imported files, calculates ability scores, proficiencies, summon statistics, puppet statistics, timelines, and validation messages, then directly creates the final JSON download. A copied page plus `model.mjs` and `rules.json` is therefore a complete standalone creator.

## Logic inventory

The following currently runs in `model.mjs` and must become authoritative server logic:

- character schema migration and sanitisation;
- ability modifiers, proficiency bonus, mastery caps, and mastery bonuses;
- class/background proficiency grants and duplicate replacements;
- ability increase breakdowns and final scores;
- starting-weapon choice requirements;
- summon rank, ability, HP, AC, role, feature, and limit calculations;
- puppet count, ability pool, chassis, HP, AC, speed, seal, and upgrade calculations;
- character validation across build, equipment, skills, summons, puppets, abilities, and jutsu;
- level timeline construction;
- final export validation.

The following currently runs in `app.js` but also encodes rules or valuable policy and should move server-side:

- automatic capability/release inference from selected feature names;
- jutsu discipline, element, and Hijutsu filtering;
- class-specific starting equipment resolution;
- jutsu eligibility and puppet/summon jutsu restrictions;
- catalogue price enforcement and authoritative Ryo changes;
- selection-dependent class, clan, subclass, and background feature retrieval.

## JSON compatibility

The current public format is `schema: "naruto5e-character"`, schema version 8. Existing imports are sanitised into the latest shape and exports contain character choices and derived ability values, but not the complete rules catalogue.

The secure application should preserve this document shape. The server will become the only component allowed to approve and emit an export. A small `exportValidation` block may be added in a future schema version, but the existing fields must remain compatible with the Foundry importer.

## Required browser-visible information

Players must still receive information needed for the current interaction:

- IDs and labels for selectable classes, clans, backgrounds, and subclasses;
- details for the currently selected class/clan/background/subclass;
- paginated jutsu and equipment search results;
- the selected summon tribe and its currently relevant rank choices;
- proficiency labels/actions needed for the current character;
- calculated view data and validation messages for their current choices;
- their own character document and approved export.

This information is observable by design. Security comes from never returning the full database or authoritative engine, not from attempting to hide data that must be displayed.

## Threat model and limits

The migration can prevent a copied frontend from functioning without the private API. It cannot stop an authorised player from saving individual responses, recording text they can see, or automating many permitted searches. Cloudflare Access, rate limits, response minimisation, and audit logs raise the cost of bulk extraction but cannot make displayed content impossible to copy.

Cloudflare Access protects the public origin, while the application verifies the Access JWT before using identity. The container must not publish a host port; the existing Cloudflare Tunnel should reach it only through a private Docker network. The static server will use an explicit allowlist, so backend files, source data, backups, tests, and directory listings are never routable.

