import app from './index.js';

const DEFAULT_ORIGIN = 'https://erkaa2323-sudo.github.io';
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_TRACKED_CLIENTS = 10_000;
const AI_PATH = '/api/oni-ai';
const buckets = new Map();

function allowedOrigins(env) {
  return String(env.ONI_ALLOWED_ORIGINS || DEFAULT_ORIGIN).split(',').map(value => value.trim()).filter(Boolean);
}
function cors(origin) {
  return {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Max-Age': '600', Vary: 'Origin', 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store'};
}
function json(data, status, origin, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {status, headers: {...cors(origin), ...extraHeaders}});
}
function clientKey(req) {
  // CF-Connecting-IP is supplied by Cloudflare. Do not trust a client supplied
  // X-Forwarded-For value as a rate-limit identity.
  return req.headers.get('CF-Connecting-IP') || 'unknown';
}
function rateLimit(key) {
  const now = Date.now();
  for (const [bucketKey, value] of buckets) if (now - value.start >= WINDOW_MS) buckets.delete(bucketKey);
  const row = buckets.get(key);
  if (!row) {
    // Rate limiting is intentionally best-effort per Worker isolate. Bound the
    // in-memory map so a flood of unique IPs cannot grow it without limit.
    if (buckets.size >= MAX_TRACKED_CLIENTS) buckets.delete(buckets.keys().next().value);
    buckets.set(key, {start: now, count: 1});
    return null;
  }
  row.count += 1;
  return row.count > MAX_REQUESTS ? Math.max(1, Math.ceil((WINDOW_MS - (now - row.start)) / 1000)) : null;
}
function withCors(response, origin) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors(origin))) headers.set(key, value);
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}
async function boundedRequest(req, origin) {
  const declaredLength = req.headers.get('Content-Length');
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES)) {
    return {error: json({ok: false, error: 'Request body too large'}, 413, origin)};
  }
  // Content-Length is optional and spoofable. Bound the stream itself so a
  // chunked request cannot force the Worker to buffer an oversized payload.
  const reader = req.body?.getReader();
  if (!reader) return {request: new Request(req.url, {method: req.method, headers: req.headers, body: new Uint8Array()})};
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel('request body too large');
        return {error: json({ok: false, error: 'Request body too large'}, 413, origin)};
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return {request: new Request(req.url, {method: req.method, headers: req.headers, body})};
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get('Origin') || '';
    const origins = allowedOrigins(env);
    const responseOrigin = origin || origins[0] || DEFAULT_ORIGIN;
    if (new URL(req.url).pathname !== AI_PATH) return json({ok: false, error: 'Not found'}, 404, responseOrigin);
    if (origin && !origins.includes(origin)) return json({ok: false, error: 'Origin not allowed'}, 403, responseOrigin);
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors(responseOrigin)});
    if (!origin) return json({ok: false, error: 'Origin required'}, 403, responseOrigin);
    if (req.method !== 'POST') return json({ok: false, error: 'Method not allowed'}, 405, responseOrigin, {Allow: 'POST, OPTIONS'});
    if (!String(req.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return json({ok: false, error: 'Content-Type must be application/json'}, 415, responseOrigin);
    const retryAfter = rateLimit(clientKey(req));
    if (retryAfter) return json({ok: false, error: 'Too many requests. Please try again later.'}, 429, responseOrigin, {'Retry-After': String(retryAfter)});
    try {
      const bounded = await boundedRequest(req, responseOrigin);
      if (bounded.error) return bounded.error;
      return withCors(await app.fetch(bounded.request, env, ctx), responseOrigin);
    } catch (error) {
      console.error('ONI AI gateway error', {message: String(error?.message || error)});
      return json({ok: false, error: 'Invalid request'}, 400, responseOrigin);
    }
  },
};
