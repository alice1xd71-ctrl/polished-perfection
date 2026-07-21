/**
 * Engine API authentication.
 *
 * The Node.js trading engine authenticates against `/api/public/engine/*`
 * routes with a shared secret bearer token AND a user_id header identifying
 * which Lovable user's data the request mutates.
 *
 * Required headers:
 *   Authorization: Bearer <ENGINE_API_TOKEN>
 *   x-user-id: <auth.users.id>
 *
 * On failure the 401/400 body includes a `reason` code and masked hints
 * (token length + first/last 2 chars) so operators can diff the deployed
 * secret against the P1 .env without leaking the secret itself.
 */
export type EngineAuthOk = { ok: true; userId: string };
export type EngineAuthErr = { ok: false; response: Response };

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export function engineJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function maskToken(t: string | null | undefined): string {
  if (!t) return "<empty>";
  if (t.length <= 6) return `<len=${t.length}>`;
  return `${t.slice(0, 2)}…${t.slice(-2)} (len=${t.length})`;
}

export function requireEngineAuth(request: Request): EngineAuthOk | EngineAuthErr {
  const token = process.env.ENGINE_API_TOKEN;
  if (!token) {
    console.error("[engine-auth] ENGINE_API_TOKEN is not set on the dashboard deployment");
    return {
      ok: false,
      response: engineJson(
        {
          error: "unauthorized",
          reason: "engine_api_token_not_configured",
          hint: "Set ENGINE_API_TOKEN as a project secret on the dashboard, then redeploy.",
        },
        500,
      ),
    };
  }

  const auth = request.headers.get("authorization") ?? "";
  if (!auth) {
    return {
      ok: false,
      response: engineJson(
        { error: "unauthorized", reason: "missing_authorization_header" },
        401,
      ),
    };
  }
  if (!auth.startsWith("Bearer ")) {
    return {
      ok: false,
      response: engineJson(
        {
          error: "unauthorized",
          reason: "authorization_not_bearer",
          hint: "Header must be: Authorization: Bearer <ENGINE_API_TOKEN>",
        },
        401,
      ),
    };
  }
  const received = auth.slice("Bearer ".length);
  if (received.length !== token.length) {
    console.warn(
      `[engine-auth] token length mismatch: received=${received.length} expected=${token.length}`,
    );
    return {
      ok: false,
      response: engineJson(
        {
          error: "unauthorized",
          reason: "token_length_mismatch",
          received_token: maskToken(received),
          expected_token: maskToken(token),
          hint: "The ENGINE_API_TOKEN configured on the dashboard does not match the one in P1's .env. Values must be byte-for-byte identical.",
        },
        401,
      ),
    };
  }
  let mismatch = 0;
  for (let i = 0; i < received.length; i++) {
    mismatch |= received.charCodeAt(i) ^ token.charCodeAt(i);
  }
  if (mismatch !== 0) {
    console.warn("[engine-auth] token value mismatch");
    return {
      ok: false,
      response: engineJson(
        {
          error: "unauthorized",
          reason: "token_value_mismatch",
          received_token: maskToken(received),
          expected_token: maskToken(token),
          hint: "Same length but different contents. Regenerate one token and paste identical values into the dashboard secret and P1's .env (and BOT_CONTROL_TOKEN).",
        },
        401,
      ),
    };
  }

  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return {
      ok: false,
      response: engineJson(
        {
          error: "bad_request",
          reason: "missing_user_id_header",
          hint: "Engine must send x-user-id: <supabase auth.users.id>",
        },
        400,
      ),
    };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return {
      ok: false,
      response: engineJson(
        { error: "bad_request", reason: "invalid_user_id_format", received: userId },
        400,
      ),
    };
  }
  return { ok: true, userId };
}
