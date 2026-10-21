# Shinobi Forge secure application

This repository contains the complete secure client-server Shinobi Forge application. It is self-contained: no files from the original development workspace are required.

This is the full project repository, not a deployment-only subset. It includes the editable frontend, server, shared character model, both static and server rules copies, production build output, tests, extraction tooling, documentation, and the source character-sheet workbook.

The same root frontend also supports a static GitHub Pages preview. When the server API is unavailable, it loads `private-data/rules.json` and the shared rules engine directly in the browser so the character builder remains usable for bug checking.

## Guided character advancement

The Class & Levels screen presents advancement as a guided workflow with a level controller, current and next-level summaries, and constrained selectors for verified feature choices. The Level Timeline always displays levels 1–20, distinguishes attained and future levels, exposes full feature descriptions, and allows the player to jump directly to a future level.

All thirteen classes expose their verified guided progression groups, subclass timing, and nested feature choices. Those decisions are validated and saved in exported character JSON alongside the full level timeline.

## Feat catalogue

The Feats step contains 373 extracted feats from the supplied core, class, and clan rulebooks. It creates slots for the background feat option and class advancement levels 4, 8, 12, 16, and 19, while allowing explicit campaign or downtime slots for extra feats. Search and category filters cover General, Skill, Chakra, Ninjutsu, Taijutsu, Bukijutsu, Genjutsu, Critical, Clan, Class, and Archetype feats.

The rules engine checks supported level, ability, proficiency, prior-feat, Clan, Class, Rare, and Archetype-downtime prerequisites. A locked feat remains visible with the reason it cannot currently be selected. Book text containing a bounded choice is converted into follow-up dropdowns; unbounded wording is marked for a table ruling rather than silently guessed. Feat-granted ability increases are reflected in the live ability ledger, and exported JSON includes readable feat names with every nested choice.

## Security boundary

- `index.html`, `app.js`, and `styles.css` at the repository root are the single canonical frontend source. There is no second frontend copy hidden in another folder.
- `public/` mirrors the current frontend for historical/server-source inspection, while `dist/` contains the verified production build output.
- `model.mjs`, `data/`, `tools/`, `tests/`, `docs/`, and `source-character-sheet.xlsx` are included so rules extraction and bug investigation can be reproduced from the repository.
- During a server deployment, `private-data/rules.json` is loaded only by Node and is not routable. In a public GitHub Pages preview, the same file is necessarily downloadable because the repository and preview are public.
- `server/character-model.mjs` is the authoritative rules engine and is not routable.
- All production requests require a valid Cloudflare Access assertion.
- The container publishes no host port in `compose.yaml`.

See `GITHUB-UPLOAD.md` for the simplest way to place this project in a GitHub repository.

## Local API development

Cloudflare Access verification is disabled by default outside production:

```powershell
$env:PUBLIC_ORIGIN = "http://localhost:4173"
$env:ALLOWED_HOSTS = "localhost:4173,127.0.0.1:4173"
$env:REQUIRE_CF_ACCESS = "false"
node server\server.mjs
```

Never set `REQUIRE_CF_ACCESS=false` in production.

## Tests

```powershell
node tests\engine.test.mjs
node tests\server.test.mjs
```

The tests confirm bounded bootstrap/search data, model parity for representative calculations, readable-name export/import round trips, server-approved exports, origin and host rejection, and that private/static traversal paths are unavailable.

Character exports include readable class, subclass, clan, background, and equipment names alongside internal catalogue references. Imports resolve those names back to the current catalogue, so a changed extraction row ID cannot turn a Tachi into a visible item named `weapon-117`.

## Production frontend build

`npm run build` bundles and minifies the root frontend files into `dist/` with source maps disabled. The Docker image performs this in a separate build stage and copies only `dist/` into the runtime image; unminified browser source and build dependencies are not present in the final container.

## Production deployment

1. Create a dedicated Access application for `shinobi.scarletbunnygames.uk` and add the approved-player email policy.
2. Copy `.env.example` to `.env` and fill the Access team domain and application audience tag.
3. Ensure the existing `cloudflared` container and this service share the Docker network named by `CLOUDFLARE_TUNNEL_NETWORK`.
4. Add a Tunnel public hostname mapping from `shinobi.scarletbunnygames.uk` to `http://shinobi-forge:8080`.
5. Build and start this Compose project independently of Foundry:

   ```bash
   docker compose up -d --build
   ```

6. Confirm `docker compose ps` reports the service healthy, then test through the Access-protected HTTPS hostname.

There is deliberately no `ports:` entry. Do not add `0.0.0.0:8080:8080`; that would create an origin path outside Cloudflare Access. If the existing Tunnel runs directly on the host rather than in Docker, bind a port to `127.0.0.1` only and keep the host firewall closed to remote traffic.

## Cloudflare Access notes

The service verifies `Cf-Access-Jwt-Assertion` using Cloudflare's published signing keys, the configured issuer, expiry, and the application audience. It does not trust `Cf-Access-Authenticated-User-Email` or any user-supplied email header by itself.

Use a separate Access application and audience for any future administration surface. This release intentionally exposes no administrative endpoints.
