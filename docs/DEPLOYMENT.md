# Production deployment

The deployable project is `secure-app/`. It is designed to join the Docker network already used by an existing `cloudflared` container; it does not publish a host port and is independent of Foundry VTT.

## One-time Cloudflare setup

1. Create a Cloudflare Access self-hosted application for `shinobi.scarletbunnygames.uk`.
2. Add the approved-player email policy.
3. Copy the Access application audience tag and note the Access team domain (for example, `your-team.cloudflareaccess.com`).
4. Add a Tunnel public hostname for `shinobi.scarletbunnygames.uk` with service URL `http://shinobi-forge:8080`.
5. Ensure the tunnel container and this Compose project share a user-defined Docker network.

## Configure and start

From `secure-app/` on the mini PC:

```bash
cp .env.example .env
# Edit .env with the Access team domain, audience tag, and tunnel network name.
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 shinobi-forge
```

The service should report healthy. Visit the HTTPS hostname and confirm Access prompts for an approved identity before the builder loads.

## Security checks

```bash
curl -I https://shinobi.scarletbunnygames.uk/
curl -I https://shinobi.scarletbunnygames.uk/private-data/rules.json
docker compose config
```

The first unauthenticated request should be intercepted by Access. The private-data path must never return the rules file. `docker compose config` should show no `ports:` entry for this service.

Do not set `REQUIRE_CF_ACCESS=false` in production. Do not publish `8080` on `0.0.0.0`. If the tunnel runs directly on the host instead of Docker, bind only to `127.0.0.1` and keep the host firewall closed to remote traffic.

## Update and rollback

Build updates with `docker compose up -d --build`. The original static implementation is preserved in `legacy-static-backup/`; the secure application's browser source is in `secure-app/public/`, while its generated production bundle is in `secure-app/dist/`.
