/**
 * Engine control server function.
 *
 * Forwards Start / Stop / Restart / Reconnect / Sync / Refresh actions from
 * the dashboard to the external Node.js trading engine. The engine exposes
 * a control HTTP endpoint at `ENGINE_API_BASE_URL` authenticated with
 * `ENGINE_API_TOKEN`. This proxy verifies the Lovable user first (so an
 * anonymous caller can never trigger an engine action) and then relays the
 * request server-side, keeping the shared secret out of the browser.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Action = z.enum(["start", "stop", "restart", "reconnect", "sync"]);
const Mode = z.enum(["paper", "live"]);

const Input = z.object({
  action: Action,
  mode: Mode,
});

export type EngineControlInput = z.infer<typeof Input>;

export const controlEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const baseUrl = process.env.ENGINE_API_BASE_URL;
    const token = process.env.ENGINE_API_TOKEN;
    if (!baseUrl) {
      return {
        ok: false as const,
        error:
          "ENGINE_API_BASE_URL is not configured on the dashboard. Set it to the engine's control URL (e.g. https://engine.example.com).",
      };
    }
    if (!token) {
      return {
        ok: false as const,
        error: "ENGINE_API_TOKEN is not configured on the dashboard.",
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
      let payload: string | null = null;
      payload = text || null;
      if (!res.ok) {
        return {
          ok: false as const,
          error: `Engine responded ${res.status}: ${typeof payload === "string" ? payload : JSON.stringify(payload)}`,
        };
      }
      return { ok: true as const, action: data.action, mode: data.mode, payload };
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
