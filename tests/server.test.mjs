import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { createShinobiServer } from "../server/server.mjs";

function rawStatus(url, headers) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { headers }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    request.on("error", reject);
    request.end();
  });
}

const server = createShinobiServer({
  host: "127.0.0.1",
  port: 0,
  publicOrigin: "http://127.0.0.1",
  allowedHosts: new Set(["127.0.0.1"]),
  maxBodyBytes: 32 * 1024,
  rateLimit: 100,
  access: { required: false, issuer: "", audience: "" },
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
const origin = `http://127.0.0.1:${address.port}`;

try {
  const bootstrap = await fetch(`${origin}/api/v1/bootstrap`, { headers: { host: "127.0.0.1" } });
  assert.equal(bootstrap.status, 200);
  const payload = await bootstrap.json();
  assert.equal(payload.counts.jutsu, 1804);
  assert.equal(JSON.stringify(payload).includes("higherRanks"), false);

  const privateData = await fetch(`${origin}/private-data/rules.json`, { headers: { host: "127.0.0.1" } });
  assert.equal(privateData.status, 404);

  const traversal = await fetch(`${origin}/../server/server.mjs`, { headers: { host: "127.0.0.1" } });
  assert.equal(traversal.status, 404);

  const badOrigin = await fetch(`${origin}/api/v1/evaluate`, {
    method: "POST",
    headers: { host: "127.0.0.1", origin: "https://attacker.example", "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(badOrigin.status, 403);

  assert.equal(await rawStatus(`${origin}/api/v1/bootstrap`, { host: "wrong.example" }), 421);
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

console.log("secure server tests passed");
