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
 * On failure the response body includes:
 *   { success: false, reason: "<code>", hint?: "..." }
 *
 * Reason codes and logs never leak token bytes. Logs include only booleans and
 * lengths so operators can diagnose production deployment mismatch safely.
 */
export type EngineAuthOk = { ok: true; userId: string };
export type EngineAuthErr = { ok: false; response: Response };

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

export function engineJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function fail(
  status: number,
  reason: string,
  extra: Record<string, unknown> = {},
): EngineAuthErr {
  return {
    ok: false,
    response: engineJson({ success: false, reason, ...extra }, status),
  };
}

function logAuthDebug(fields: Record<string, unknown>): void {
  const parts = Object.entries(fields).map(([k, v]) => `${k}=${v}`);
  console.warn(`[engine-auth] AUTH DEBUG ${parts.join(" ")}`);
}

export function requireEngineAuth(request: Request): EngineAuthOk | EngineAuthErr {
  const token = process.env.ENGINE_API_TOKEN?.trim();
  const auth = request.headers.get("authorization") ?? "";
  const userId = request.headers.get("x-user-id");

  const authPresent = auth.length > 0;
  const bearerValid = /^Bearer\s+\S+$/i.test(auth);
  const received = bearerValid ? auth.replace(/^Bearer\s+/i, "") : "";
  const receivedLen = received.length;
  const configuredLen = token?.length ?? 0;
  const userIdPresent = !!userId;

  const baseDebug = {
    authorization_present: authPresent,
    bearer_valid: bearerValid,
    received_length: receivedLen,
    configured_length: configuredLen,
    user_id_present: userIdPresent,
  };

  if (!token) {
    logAuthDebug({ ...baseDebug, reason: "engine_api_token_not_configured" });
    console.error(
      "[engine-auth] ENGINE_API_TOKEN is not set on the dashboard deployment",
    );
    return fail(500, "engine_api_token_not_configured", {
      hint: "Set ENGINE_API_TOKEN as a project secret on the dashboard, then republish.",
    });
  }

  if (!authPresent) {
    logAuthDebug({ ...baseDebug, reason: "missing_authorization_header" });
    return fail(401, "missing_authorization_header");
  }
  if (!bearerValid) {
    logAuthDebug({ ...baseDebug, reason: "invalid_bearer_format" });
    return fail(401, "invalid_bearer_format", {
      hint: "Header must be: Authorization: Bearer <ENGINE_API_TOKEN>",
    });
  }
  if (!userIdPresent) {
    logAuthDebug({ ...baseDebug, reason: "missing_user_id" });
    return fail(400, "missing_user_id", {
      hint: "Engine must send x-user-id: <supabase auth.users.id>",
    });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId!)) {
    logAuthDebug({ ...baseDebug, reason: "invalid_user_id_format" });
    return fail(400, "invalid_user_id_format");
  }
  if (receivedLen !== configuredLen) {
    logAuthDebug({ ...baseDebug, reason: "token_length_mismatch" });
    return fail(401, "token_length_mismatch", {
      hint: "The ENGINE_API_TOKEN on the dashboard does not match P1 .env. Values must be byte-for-byte identical (no trailing newline / quotes).",
    });
  }
  let mismatch = 0;
  for (let i = 0; i < receivedLen; i++) {
    mismatch |= received.charCodeAt(i) ^ token.charCodeAt(i);
  }
  if (mismatch !== 0) {
    logAuthDebug({ ...baseDebug, reason: "token_value_mismatch" });
    return fail(401, "token_value_mismatch", {
      hint: "Same length, different contents. Regenerate one token and paste identical values into the dashboard secret and P1 .env (and BOT_CONTROL_TOKEN).",
    });
  }

  logAuthDebug({ ...baseDebug, reason: "authenticated" });
  return { ok: true, userId: userId! };
}
