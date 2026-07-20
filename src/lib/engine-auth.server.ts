/**
 * Engine API authentication.
 *
 * The Node.js trading engine authenticates against `/api/public/engine/*`
 * routes with a shared secret bearer token AND a user_id header identifying
 * which Lovable user's data the request mutates. All writes go through the
 * service-role client server-side; we never expose it to the browser.
 *
 * Required headers:
 *   Authorization: Bearer <ENGINE_API_TOKEN>
 *   x-user-id: <auth.users.id>
 */
export type EngineAuthOk = { ok: true; userId: string };
export type EngineAuthErr = { ok: false; response: Response };

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export function engineJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function requireEngineAuth(request: Request): EngineAuthOk | EngineAuthErr {
  const token = process.env.ENGINE_API_TOKEN;
  if (!token) {
    return {
      ok: false,
      response: engineJson({ error: "engine_api_token_not_configured" }, 500),
    };
  }
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${token}`;
  // Constant-time-ish compare — length check plus per-byte accumulator.
  if (auth.length !== expected.length) {
    return { ok: false, response: engineJson({ error: "unauthorized" }, 401) };
  }
  let mismatch = 0;
  for (let i = 0; i < auth.length; i++) mismatch |= auth.charCodeAt(i) ^ expected.charCodeAt(i);
  if (mismatch !== 0) {
    return { ok: false, response: engineJson({ error: "unauthorized" }, 401) };
  }
  const userId = request.headers.get("x-user-id");
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return { ok: false, response: engineJson({ error: "missing_or_invalid_user_id" }, 400) };
  }
  return { ok: true, userId };
}
