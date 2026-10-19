# Browser/server boundary

## Private and authoritative on the server

- The complete `rules.json` catalogue, including full jutsu, class, subclass, clan, background, equipment, summon, feature, and proficiency records.
- Character normalization, sanitization, derived ability scores, proficiency degrees, mastery caps, overlaps, level timeline, summon statistics, puppet statistics, validation, and export approval.
- Jutsu filtering and eligibility checks, including Hijutsu restrictions for summons and upgrade requirements for puppets.
- Equipment lookup, price lookup, Ryo deductions, and inventory additions.
- Cloudflare Access JWT signature, issuer, audience, and lifetime verification.

These files are copied into the runtime image outside its static document root. The HTTP server uses an explicit static allowlist, so paths such as `/private-data/rules.json`, `/server/engine.mjs`, and traversal variants return 404.

## Intentionally visible in the browser

- HTML, CSS, labels, navigation, presentation-only release metadata, and input event handling.
- A bounded list of names/IDs needed to render selectors.
- The current user's character draft and the server-derived view returned for that draft.
- Search results requested by that user, capped by the server.
- Local autosave data. It is convenience storage only and is never trusted as authoritative input.

The client cannot calculate a valid character, search the private catalogue, approve a purchase, add a protected jutsu, or produce a server-approved export without the authenticated API.

## Compatibility

The character schema remains version 8 and the application version remains `0.8.0`. Exported files retain the fields used by the existing Foundry VTT importer. The importer itself was not modified.
