# Shinobi Forge secure migration plan

## Target architecture

```text
Player browser
  │  HTTPS + Cloudflare Access
  ▼
Cloudflare Tunnel
  │  private Docker network only
  ▼
Shinobi Forge Node service
  ├─ static allowlist: thin UI assets only
  ├─ identity boundary: verified Access JWT
  ├─ API: bootstrap, selected records, searches, evaluate, import, export
  ├─ authoritative engine: private model and validation
  └─ private catalogue: rules.json outside the static root
```

The UI remains same-origin. This avoids public CORS, keeps cookies and Access protection simple, and prevents an alternate API hostname from becoming a bypass.

## API shape

- `GET /api/v1/bootstrap` — versions, selectable IDs/names, and small UI constants.
- `POST /api/v1/selection` — only the full records for the supplied class, clan, subclass, and background IDs.
- `POST /api/v1/jutsu/search` — filtered, paginated results; never the complete catalogue.
- `POST /api/v1/equipment/search` — filtered, bounded equipment results.
- `POST /api/v1/summon/tribe` — one requested tribe and relevant rank data.
- `POST /api/v1/evaluate` — sanitised character plus authoritative derived view data and problems.
- `POST /api/v1/import` — migrate and validate an existing JSON character.
- `POST /api/v1/export` — validate and return a compatible downloadable character document.

Every request is schema-checked, size-limited, same-origin, Access-authenticated in production, and rate-limited. Search limits and maximum page sizes are fixed server-side.

## Migration stages

### Stage 0 — preserve and measure

- Keep an immutable copy of the current static application and rules.
- Record baseline model tests and representative exports.
- Do not change the currently working root preview while the secure application is built.

### Stage 1 — private server foundation

- Create a dependency-light Node service with a static allowlist.
- Place the authoritative model and master rules outside the public directory.
- Add request limits, rate limiting, security headers, Access JWT verification, and API tests.
- Add Docker, Compose, environment examples, and Cloudflare configuration guidance.

### Stage 2 — catalogue and evaluation API

- Implement bounded bootstrap, selection, jutsu, equipment, and summon endpoints.
- Implement server-side evaluate, import, and export endpoints.
- Add golden tests comparing server results to the preserved static model.

### Stage 3 — thin frontend migration

- Copy the existing visual markup and CSS without redesigning it.
- Replace direct `rules.json` loading with the API client.
- Replace browser model calculations with server evaluation responses.
- Retain browser autosave only as untrusted draft storage.
- Make export call the server and download only the approved response.

### Stage 4 — parity and security verification

- Exercise all ten stages on desktop and mobile.
- Compare representative original and migrated character results.
- Test existing JSON import and Foundry compatibility.
- Prove saved frontend assets cannot work without the API.
- Test traversal, oversized bodies, invalid IDs, rate limits, forged identity headers, and static-route leakage.

### Stage 5 — deployment

- Build and start the independent container without publishing a host port.
- Add `shinobi.scarletbunnygames.uk` to the existing Tunnel as a private Docker-network service.
- Apply a Cloudflare Access application to the hostname and configure the matching audience/team values in the container.
- Keep Foundry containers and configuration unchanged.

## Security decisions

- Cloudflare email headers are informational only; authorisation uses a verified JWT assertion.
- Production refuses to start with Access verification disabled.
- No administrative API is exposed in the initial application.
- No source maps are generated.
- The production image contains no workbook, PDFs, extractors, tests, Git metadata, or legacy backup.
- The process runs as a non-root user with a read-only filesystem, dropped capabilities, and `no-new-privileges`.
- Compose exposes the service to a named Docker network, not the host or public Internet.
- Secrets and Access configuration come from environment variables and are excluded from source control.

## Rollback

The original static creator remains in `legacy-static-backup/`. The secure application is developed in `secure-app/`, so it can be tested and deployed independently. No existing Foundry or adversary-builder files are modified by the migration.

