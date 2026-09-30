import "server-only";

/*
  Shared by the POST routes. SameSite=Lax already keeps the session cookie
  off cross-site POSTs; this refuses them outright.
*/
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

/** JSON that no cache or CDN keeps: every answer here is for one player. */
export function privateJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
