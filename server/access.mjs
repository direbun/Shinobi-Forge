import { createPublicKey, verify as verifySignature } from "node:crypto";

const encoder = new TextEncoder();
const jwksCache = new Map();

function decodeBase64Url(value) {
  return Buffer.from(String(value).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function parseJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Malformed Access assertion.");
  const [headerPart, payloadPart, signaturePart] = parts;
  return {
    header: JSON.parse(decodeBase64Url(headerPart).toString("utf8")),
    payload: JSON.parse(decodeBase64Url(payloadPart).toString("utf8")),
    signed: encoder.encode(`${headerPart}.${payloadPart}`),
    signature: decodeBase64Url(signaturePart),
  };
}

function audienceMatches(actual, expected) {
  const audiences = Array.isArray(actual) ? actual : [actual];
  return audiences.includes(expected);
}

async function loadJwks(issuer) {
  const cached = jwksCache.get(issuer);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetch(`${issuer}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Could not load Cloudflare Access signing keys.");
  const document = await response.json();
  const keys = Array.isArray(document.keys) ? document.keys : [];
  if (!keys.length) throw new Error("Cloudflare Access returned no signing keys.");
  jwksCache.set(issuer, { keys, expiresAt: Date.now() + 60 * 60 * 1000 });
  return keys;
}

export async function verifyAccessAssertion(token, config, now = Date.now()) {
  const parsed = parseJwt(token);
  if (parsed.header.alg !== "RS256" || !parsed.header.kid) throw new Error("Unsupported Access assertion signature.");
  const keys = await loadJwks(config.issuer);
  const jwk = keys.find((entry) => entry.kid === parsed.header.kid);
  if (!jwk) throw new Error("Access signing key was not found.");
  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const verified = verifySignature("RSA-SHA256", parsed.signed, publicKey, parsed.signature);
  if (!verified) throw new Error("Invalid Access assertion signature.");
  const seconds = Math.floor(now / 1000);
  if (parsed.payload.iss !== config.issuer) throw new Error("Invalid Access assertion issuer.");
  if (!audienceMatches(parsed.payload.aud, config.audience)) throw new Error("Invalid Access assertion audience.");
  if (!Number.isFinite(parsed.payload.exp) || parsed.payload.exp <= seconds) throw new Error("Expired Access assertion.");
  if (Number.isFinite(parsed.payload.nbf) && parsed.payload.nbf > seconds + 30) throw new Error("Access assertion is not active yet.");
  return {
    subject: String(parsed.payload.sub || ""),
    email: String(parsed.payload.email || ""),
    country: String(parsed.payload.country || ""),
  };
}

export function accessConfigFromEnv(env = process.env) {
  const teamDomain = String(env.CF_ACCESS_TEAM_DOMAIN || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const audience = String(env.CF_ACCESS_AUD || "").trim();
  const required = String(env.REQUIRE_CF_ACCESS ?? (env.NODE_ENV === "production" ? "true" : "false")).toLowerCase() !== "false";
  if (required && (!teamDomain || !audience)) throw new Error("CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD are required when Cloudflare Access verification is enabled.");
  return { required, issuer: teamDomain ? `https://${teamDomain}` : "", audience };
}

export async function authenticateRequest(request, config) {
  if (!config.required) return { subject: "development", email: "development@local", country: "" };
  const assertion = request.headers["cf-access-jwt-assertion"];
  if (!assertion) throw new Error("Cloudflare Access authentication is required.");
  return verifyAccessAssertion(assertion, config);
}
