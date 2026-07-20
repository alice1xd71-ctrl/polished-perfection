/**
 * Engine control server function.
 *
 * Forwards Start / Stop / Restart / Reconnect / Sync actions from the
 * dashboard to the real P1 control endpoint: `POST /api/v2/bot/control`
 * with `{ action, mode }` body (P1's Next.js route in
 * `app/api/v2/bot/control/route.ts`).
 *
 * URL resolution — no runtime UI configuration required:
 *   1. `engine_instances.control_url` for the target (user_id, mode).
 *      Written by the engine's own `register` call at boot from
 *      `ENGINE_CONTROL_URL` / `ENGINE_PUBLIC_URL`.
 *   2. `ENGINE_API_BASE_URL` deployment env var (single-tenant fallback).
 *   3. Otherwise return a structured `engine_offline` result the UI can
 *      render as "Waiting for Engine" instead of a runtime error.
 *
 * P1 accepts the shared-secret bearer token (`BOT_CONTROL_TOKEN` or
 * `ENGINE_API_TOKEN`) via the `Authorization` header.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// UI-facing verbs. `restart` = stop + start; `reconnect` = a fresh start
// (P1 will re-establish feeds on start). `sync` = no-op ping to check reach.
const Action = z.enum(["start", "stop", "restart", "reconnect", "sync"]);
const Mode = z.enum(["paper", "live"]);

const Input = z.object({ action: Action, mode: Mode });
export type EngineControlInput = z.infer<typeof Input>;

const CONTROL_PATH = "/api/v2/bot/control";

/** Translate the dashboard verb into the sequence of P1 control calls. */
function planCalls(action: z.infer<typeof Action>): Array<"start" | "stop"> {
  switch (action) {
    case "start":
    case "reconnect":
      return ["start"];
    case "stop":
      return ["stop"];
    case "restart":
      return ["stop", "start"];
    case "sync":
      return []; // reachability check only
  }
}

async function callP1(
  baseUrl: string,
  token: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const url = `${baseUrl.replace(/\/$/, "")}${CONTROL_PATH}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-user-id": userId,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `Engine ${res.status}: ${text || res.statusText}` };
    return { ok: true, text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Unreachable (${msg})` };
  } finally {
    clearTimeout(timeout);
  }
}

export const controlEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const token = process.env.ENGINE_API_TOKEN;
    if (!token) {
      return {
        ok: false as const,
        code: "misconfigured" as const,
        error: "ENGINE_API_TOKEN is not configured on the dashboard.",
      };
    }

    // Resolve the engine's control URL from its own registration.
    const { data: inst } = await context.supabase
      .from("engine_instances")
      .select("control_url, last_heartbeat")
      .eq("user_id", context.userId)
      .eq("engine_mode", data.mode)
      .order("last_heartbeat", { ascending: false })
      .limit(1)
      .maybeSingle();

    const baseUrl = (inst?.control_url as string | null) ?? process.env.ENGINE_API_BASE_URL ?? null;
    if (!baseUrl) {
      return {
        ok: false as const,
        code: "engine_offline" as const,
        error: `${data.mode.toUpperCase()} engine has not registered yet.`,
      };
    }

    const steps = planCalls(data.action);
    if (steps.length === 0) {
      // sync = reachability probe via a stop that P1 will accept even when idle.
      const probe = await callP1(baseUrl, token, context.userId, { action: "stop", mode: data.mode });
      return probe.ok
        ? { ok: true as const, action: data.action, mode: data.mode, payload: probe.text }
        : { ok: false as const, code: "unreachable" as const, error: probe.error };
    }

    let lastText = "";
    for (const step of steps) {
      const res = await callP1(baseUrl, token, context.userId, { action: step, mode: data.mode });
      if (!res.ok) {
        return { ok: false as const, code: "unreachable" as const, error: res.error };
      }
      lastText = res.text;
    }
    return { ok: true as const, action: data.action, mode: data.mode, payload: lastText };
  });
