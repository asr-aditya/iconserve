export const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, mcp-session-id, mcp-protocol-version",
  "access-control-expose-headers": "mcp-session-id",
};

const IMMUTABLE = "public, max-age=31536000, immutable";

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...extra },
  });
}

export function text(body: string, status = 200, contentType = "text/plain; charset=utf-8"): Response {
  return new Response(body, { status, headers: { "content-type": contentType, ...CORS } });
}

export function svgResponse(body: string): Response {
  return new Response(body, {
    headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": IMMUTABLE, ...CORS },
  });
}

export function pngResponse(body: Uint8Array): Response {
  return new Response(body, {
    headers: { "content-type": "image/png", "cache-control": IMMUTABLE, ...CORS },
  });
}

export function notFound(msg = "not found"): Response {
  return json({ error: msg }, 404);
}

export function badRequest(msg: string): Response {
  return json({ error: msg }, 400);
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS });
}
