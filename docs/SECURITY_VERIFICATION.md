# Security verification record

## Automated checks

Run from `secure-app/`:

```powershell
node --check public\app.js
node --check server\access.mjs
node --check server\engine.mjs
node --check server\server.mjs
node tests\engine.test.mjs
node tests\server.test.mjs
npm run build
```

The server tests cover private-path denial, traversal denial, host validation, same-origin POST enforcement, and a bounded bootstrap. The engine tests cover representative character calculations, private searches, Ryo purchase enforcement, jutsu selection restrictions, and compatible server-approved exports.

## Production artifact expectations

- `dist/` contains only `index.html`, minified `app.js`, and minified `styles.css`.
- No `.map` files are emitted.
- The runtime Docker stage contains `dist/`, `server/`, and `private-data/`, but not `public/`, tests, source maps, or development dependencies.
- The container runs as a non-root user, with a read-only filesystem, dropped Linux capabilities, `no-new-privileges`, a small tmpfs, resource limits, and no host port.

## Remaining environment verification

The Docker CLI is not installed in the local Windows development environment, so the image and Compose configuration must be built once on the target mini PC. Cloudflare Access cannot be verified end-to-end until the real team domain and audience are placed in `.env` and the hostname is attached to the tunnel.
