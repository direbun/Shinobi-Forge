import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize } from "node:path";
import { accessConfigFromEnv, authenticateRequest } from "./access.mjs";
import { createEngine } from "./engine.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = dirname(here);
const publicRoot = join(appRoot, process.env.STATIC_DIRECTORY || (process.env.NODE_ENV === "production" ? "dist" : "."));
const rulesPath = join(appRoot, "private-data", "rules.json");
const rules = JSON.parse(await readFile(rulesPath, "utf8"));
const engine = createEngine(rules);

const STATIC_FILES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/app.js", "app.js"],
]);
const MIME_TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

function configFromEnv(env = process.env) {
  const publicOrigin = String(env.PUBLIC_ORIGIN || "http://localhost:4173").replace(/\/$/, "");
  const originUrl = new URL(publicOrigin);
  return {
    host: String(env.HOST || "127.0.0.1"),
    port: Math.max(1, Number(env.PORT) || 4173),
    publicOrigin,
    allowedHosts: new Set(String(env.ALLOWED_HOSTS || originUrl.host).split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean)),
    maxBodyBytes: Math.min(1024 * 1024, Math.max(16 * 1024, Number(env.MAX_BODY_BYTES) || 256 * 1024)),
    rateLimit: Math.min(1000, Math.max(10, Number(env.RATE_LIMIT_PER_MINUTE) || 120)),
    access: accessConfigFromEnv(env),
  };
}

function secureHeaders(response, requestId) {
  response.setHeader("X-Request-Id", requestId);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
}

function json(response, status, value) {
  const body = JSON.stringify(value);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.end(body);
}

function apiError(response, status, code, message) {
  json(response, status, { error: { code, message } });
}

async function readJson(request, maximum) {
  const type = String(request.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
  if (type !== "application/json") throw Object.assign(new Error("Requests must use application/json."), { status: 415, code: "UNSUPPORTED_MEDIA_TYPE" });
  const declared = Number(request.headers["content-length"] || 0);
  if (declared > maximum) throw Object.assign(new Error("Request body is too large."), { status: 413, code: "BODY_TOO_LARGE" });
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximum) throw Object.assign(new Error("Request body is too large."), { status: 413, code: "BODY_TOO_LARGE" });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw Object.assign(new Error("Request body is not valid JSON."), { status: 400, code: "INVALID_JSON" }); }
}

function sameOrigin(request, config) {
  const origin = request.headers.origin;
  return !origin || origin === config.publicOrigin;
}

function hostAllowed(request, config) {
  const host = String(request.headers.host || "").toLowerCase();
  let hostname = host;
  try { hostname = new URL(`http://${host}`).hostname.toLowerCase(); } catch { /* exact host matching still applies */ }
  return config.allowedHosts.has(host) || config.allowedHosts.has(hostname);
}

function clientKey(request, identity) {
  return identity.subject || identity.email || String(request.socket.remoteAddress || "unknown");
}

function createRateLimiter(limit) {
  const buckets = new Map();
  return (key, cost = 1) => {
    const minute = Math.floor(Date.now() / 60000);
    const bucket = buckets.get(key);
    const next = !bucket || bucket.minute !== minute ? { minute, used: cost } : { minute, used: bucket.used + cost };
    buckets.set(key, next);
    if (buckets.size > 5000) for (const [entryKey, entry] of buckets) if (entry.minute < minute - 1) buckets.delete(entryKey);
    return next.used <= limit;
  };
}

async function serveStatic(pathname, response) {
  const filename = STATIC_FILES.get(pathname);
  if (!filename) return false;
  const resolved = normalize(join(publicRoot, filename));
  if (!resolved.startsWith(publicRoot)) return false;
  try {
    const body = await readFile(resolved);
    response.statusCode = 200;
    response.setHeader("Content-Type", MIME_TYPES[extname(filename)] || "application/octet-stream");
    response.setHeader("Cache-Control", filename === "index.html" ? "no-store" : "public, max-age=3600");
    response.setHeader("Content-Length", body.length);
    response.end(body);
    return true;
  } catch {
    return false;
  }
}

async function routeApi(request, response, pathname, config, identity) {
  const method = request.method || "GET";
  if (method === "GET" && pathname === "/api/v1/bootstrap") return json(response, 200, engine.bootstrap());
  if (method !== "POST") return apiError(response, 405, "METHOD_NOT_ALLOWED", "This API route requires POST.");
  if (!sameOrigin(request, config)) return apiError(response, 403, "ORIGIN_REJECTED", "The request origin is not allowed.");
  const body = await readJson(request, config.maxBodyBytes);
  if (pathname === "/api/v1/selection") return json(response, 200, engine.selection(body));
  if (pathname === "/api/v1/jutsu/search") return json(response, 200, engine.searchJutsu(body));
  if (pathname === "/api/v1/equipment/search") return json(response, 200, engine.searchEquipment(body));
  if (pathname === "/api/v1/summon/tribe") {
    const tribe = engine.summonTribe(body.id);
    return tribe ? json(response, 200, tribe) : apiError(response, 404, "TRIBE_NOT_FOUND", "The requested summon tribe does not exist.");
  }
  if (pathname === "/api/v1/evaluate") return json(response, 200, engine.evaluate(body.character || body));
  if (pathname === "/api/v1/import") return json(response, 200, engine.importCharacter(body.character || body));
  if (pathname === "/api/v1/equipment/purchase") return json(response, 200, engine.purchaseEquipment(body.character, String(body.itemId || "")));
  if (pathname === "/api/v1/jutsu/select") return json(response, 200, engine.selectJutsu(body.character, String(body.jutsuId || ""), body.target || {}));
  if (pathname === "/api/v1/export") return json(response, 200, engine.exportCharacter(body.character || body));
  return apiError(response, 404, "API_NOT_FOUND", "API route not found.");
}

export function createShinobiServer(overrides = {}) {
  const config = { ...configFromEnv(), ...overrides };
  const allowRequest = createRateLimiter(config.rateLimit);
  return createHttpServer(async (request, response) => {
    const requestId = crypto.randomUUID();
    secureHeaders(response, requestId);
    let pathname = "/";
    try {
      pathname = new URL(request.url || "/", config.publicOrigin).pathname;
      if (pathname === "/healthz") { response.statusCode = 204; response.end(); return; }
      if (!hostAllowed(request, config)) return apiError(response, 421, "HOST_REJECTED", "Host is not configured for this service.");
      const identity = await authenticateRequest(request, config.access);
      const cost = pathname === "/api/v1/export" ? 5 : pathname.includes("/search") ? 2 : 1;
      if (!allowRequest(clientKey(request, identity), cost)) return apiError(response, 429, "RATE_LIMITED", "Too many requests. Try again shortly.");
      if (pathname.startsWith("/api/")) return await routeApi(request, response, pathname, config, identity);
      if ((request.method === "GET" || request.method === "HEAD") && await serveStatic(pathname, response)) return;
      return apiError(response, 404, "NOT_FOUND", "Resource not found.");
    } catch (error) {
      const status = Number(error.status) || (/Access assertion|Cloudflare Access/.test(error.message) ? 401 : 400);
      const code = error.code || (status === 401 ? "AUTHENTICATION_REQUIRED" : "BAD_REQUEST");
      console.warn(JSON.stringify({ requestId, method: request.method, path: pathname, status, code }));
      if (!response.headersSent) apiError(response, status, code, status >= 500 ? "Internal server error." : error.message);
      else response.destroy();
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = configFromEnv();
  const server = createShinobiServer(config);
  server.listen(config.port, config.host, () => console.log(`Shinobi Forge secure server listening on ${config.host}:${config.port}`));
}
