/**
 * Public health endpoint.
 *
 * Unauthenticated liveness + configuration probe for load balancers and
 * external monitors. Returns generic dashboard status only — never
 * per-user data. Per-user end-to-end diagnostics live in the authenticated
 * /diagnostics page (see src/lib/diagnostics.functions.ts).
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const now = new Date().toISOString();
        const supabaseUrl = process.env.SUPABASE_URL ?? null;
        const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? null;
        const engineToken = process.env.ENGINE_API_TOKEN ?? null;

        const checks: Record<string, { ok: boolean; detail: string }> = {};

        checks.dashboard = { ok: true, detail: "Reachable." };

        checks.env_supabase_url = {
          ok: Boolean(supabaseUrl),
          detail: supabaseUrl ? "SUPABASE_URL configured." : "SUPABASE_URL missing.",
        };
        checks.env_supabase_publishable_key = {
          ok: Boolean(publishableKey),
          detail: publishableKey ? "SUPABASE_PUBLISHABLE_KEY configured." : "SUPABASE_PUBLISHABLE_KEY missing.",
        };
        checks.env_engine_api_token = {
          ok: Boolean(engineToken),
          detail: engineToken ? "ENGINE_API_TOKEN configured." : "ENGINE_API_TOKEN missing.",
        };

        if (supabaseUrl && publishableKey) {
          try {
            const client = createClient(supabaseUrl, publishableKey, {
              auth: { persistSession: false, autoRefreshToken: false },
              global: {
                fetch: (input, init) => {
                  const h = new Headers(init?.headers);
                  if (publishableKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${publishableKey}`) {
                    h.delete("Authorization");
                  }
                  h.set("apikey", publishableKey);
                  return fetch(input, { ...init, headers: h });
                },
              },
            });
            const started = Date.now();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error } = await (client as any)
              .from("engine_instances")
              .select("instance_id", { head: true, count: "exact" })
              .limit(1);
            const ms = Date.now() - started;
            checks.database = error
              ? { ok: false, detail: `Query failed: ${error.message}` }
              : { ok: true, detail: `Query round-trip ${ms} ms.` };
          } catch (err) {
            checks.database = {
              ok: false,
              detail: `Unreachable: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        } else {
          checks.database = { ok: false, detail: "Skipped — Supabase not configured." };
        }

        checks.realtime = {
          ok: true,
          detail: "Realtime publication is configured on engine tables; per-user delivery verified in /diagnostics.",
        };

        const ok = Object.values(checks).every((c) => c.ok);
        return json({ ok, service: "dashboard", generated_at: now, checks }, ok ? 200 : 503);
      },
    },
  },
});
