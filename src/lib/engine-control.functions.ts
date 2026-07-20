/**
 * Engine control server function.
 *
 * Forwards Start / Stop / Restart / Reconnect / Sync actions from the
 * dashboard to the external Node.js trading engine.
 *
 * URL resolution (no runtime UI configuration required):
 *   1. `engine_instances.control_url` for the target (user_id, mode) — set
 *      by the engine's own `register` call at startup.
 *   2. `ENGINE_API_BASE_URL` deployment env var (single-tenant fallback).
 *   3. Otherwise return a clear, actionable error.
 *
 * Auth: shared `ENGINE_API_TOKEN` bearer + Lovable user id header. The token
 * never reaches the browser — this proxy runs server-side only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Action = z.enum(["start", "stop", "restart", "reconnect", "sync"]);
const Mode = z.enum(["paper", "live"]);

const Input = z.object({ action: Action, mode: Mode });
export type EngineControlInput = z.infer<typeof Input>;

export const controlEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const token = process.env.ENGINE_API_TOKEN;
    if (!token) {
      return {
        ok: false as const,
        error: "ENGINE_API_TOKEN is not configured on the dashboard.",
      };
    }

    // Look up the per-mode engine registration and prefer its self-reported
    // control URL. Falls back to the deployment env var for single-tenant setups.
    const { data: inst } = await context.supabase
      .from("engine_instances")
      .select("control_url, last_heartbeat")
      .eq("user_id", context.userId)
      .eq("engine_mode", data.mode)
      .order("last_heartbeat", { ascending: false })
      .limit(1)
      .maybeSingle();

    const envBase = process.env.ENGINE_API_BASE_URL ?? null;
    const baseUrl = inst?.control_url ?? envBase;

    if (!baseUrl) {
      return {
        ok: false as const,
        error:
          `No control URL for ${data.mode.toUpperCase()} engine. Start the engine with ENGINE_MODE=${data.mode} so it registers a control_url, or set ENGINE_API_BASE_URL as a deployment env var on the dashboard.`,
      };
    }

    const url = `${baseUrl.replace(/\/$/, "")}/control/${data.action}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-user-id": context.userId,
        },
        body: JSON.stringify({ mode: data.mode, user_id: context.userId }),
      });
      const text = await res.text();
      if (!res.ok) {
        return {
          ok: false as const,
          error: `Engine responded ${res.status}: ${text || res.statusText}`,
        };
      }
      return { ok: true as const, action: data.action, mode: data.mode, payload: text || null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false as const,
        error: `Failed to reach engine at ${url}: ${msg}`,
      };
    } finally {
      clearTimeout(timeout);
    }
  });
