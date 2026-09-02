import app from "./index.js";

const DEFAULT_ORIGIN = "https://erkaa2323-sudo.github.io";
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const MAX_BODY_BYTES = 16 * 1024;
const buckets = new Map();

function allowedOrigins(env) {
  return String(env.ONI_ALLOWED_ORIGINS || DEFAULT_ORIGIN)
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: cors(origin),
  });
}

function clientKey(req) {
  return req.headers.get("CF-Connecting-IP") ||
    req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown";
}

function rateLimited(key) {
  const now = Date.now();
  const row = buckets.get(key);

  if (!row || now - row.start >= WINDOW_MS) {
    buckets.set(key, {start: now, count: 1});
    return false;
  }

  row.count += 1;
  return row.count > MAX_REQUESTS;
}

function withCors(response, origin) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors(origin))) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get("Origin") || "";
    const origins = allowedOrigins(env);

    if (origin && !origins.includes(origin)) {
      return json(
        {ok: false, error: "Origin not allowed"},
        403,
        origins[0] || DEFAULT_ORIGIN
      );
    }

    const responseOrigin = origin || origins[0] || DEFAULT_ORIGIN;

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors(responseOrigin),
      });
    }

    if (req.method === "POST") {
      const length = Number(req.headers.get("Content-Length") || 0);

      if (length > MAX_BODY_BYTES) {
        return json(
          {ok: false, error: "Request body too large"},
          413,
          responseOrigin
        );
      }

      const key = clientKey(req);

      if (rateLimited(key)) {
        return json(
          {ok: false, error: "Too many requests. Please try again later."},
          429,
          responseOrigin
        );
      }
    }

    return withCors(await app.fetch(req, env, ctx), responseOrigin);
  },
};
