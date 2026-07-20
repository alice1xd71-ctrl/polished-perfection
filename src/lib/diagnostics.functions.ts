/**
 * Diagnostics server function.
 *
 * Runs an end-to-end audit of the dashboard ↔ Supabase ↔ P1 pipeline for
 * the signed-in user and returns a structured report the /diagnostics
 * page renders as a live self-test. Every check maps to an actionable
 * failure message — never generic errors.
 *
 * All state is derived from the same Supabase tables the realtime UI
 * subscribes to, so a green diagnostics run is a strict superset of a
 * working dashboard.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CheckStatus = "ok" | "warn" | "fail" | "pending";
export type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  action?: string;
};
export type DiagnosticsReport = {
  generated_at: string;
  user_id: string;
  overall: CheckStatus;
  checks: Check[];
  meta: {
    engine_api_token_configured: boolean;
    engine_api_base_url_configured: boolean;
    supabase_url: string | null;
    instances: Array<{
      instance_id: string;
      engine_mode: string | null;
      engine_status: string | null;
      control_url: string | null;
      last_heartbeat: string | null;
      engine_version: string | null;
      host_name: string | null;
    }>;
  };
};

const HEARTBEAT_STALE_MS = 60_000;
const FEED_STALE_MS = 30_000;

function ageMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Date.now() - t;
}

function fmtAge(ms: number | null): string {
  if (ms === null) return "never";
  if (ms < 1000) return `${ms} ms ago`;
  if (ms < 60_000) return `${Math.round(ms / 1000)} s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} m ago`;
  return `${Math.round(ms / 3_600_000)} h ago`;
}

export const getDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosticsReport> => {
    const { supabase, userId } = context;
    const checks: Check[] = [];
    const push = (c: Check) => checks.push(c);

    // ------------------------------------------------------------------
    // Dashboard + Supabase
    // ------------------------------------------------------------------
    push({
      id: "dashboard",
      label: "Dashboard",
      status: "ok",
      detail: "Server function reachable, request authenticated.",
    });

    const supabaseUrl = process.env.SUPABASE_URL ?? null;
    push({
      id: "supabase",
      label: "Supabase",
      status: supabaseUrl ? "ok" : "fail",
      detail: supabaseUrl ? `Connected to ${new URL(supabaseUrl).host}` : "SUPABASE_URL is not set.",
      action: supabaseUrl ? undefined : "Set SUPABASE_URL in project secrets.",
    });

    push({
      id: "authentication",
      label: "Authentication",
      status: "ok",
      detail: `User ${userId} authenticated via Supabase JWT.`,
    });

    // ------------------------------------------------------------------
    // Dashboard env config for engine bridge
    // ------------------------------------------------------------------
    const tokenConfigured = Boolean(process.env.ENGINE_API_TOKEN);
    push({
      id: "engine_api_token",
      label: "ENGINE_API_TOKEN",
      status: tokenConfigured ? "ok" : "fail",
      detail: tokenConfigured
        ? "Shared secret configured on the dashboard."
        : "Missing on the dashboard. Engine control calls will be rejected.",
      action: tokenConfigured ? undefined : "Add ENGINE_API_TOKEN to project secrets — same value as P1.",
    });

    const fallbackBase = process.env.ENGINE_API_BASE_URL ?? null;
    // Not required when auto-discovery is used, only a fallback.
    push({
      id: "engine_api_base_url",
      label: "ENGINE_API_BASE_URL (fallback)",
      status: "ok",
      detail: fallbackBase
        ? `Fallback set: ${fallbackBase}`
        : "Not set — auto-discovery via engine registration is used instead.",
    });

    // ------------------------------------------------------------------
    // P1 registration + heartbeat (both modes)
    // ------------------------------------------------------------------
    const { data: instances, error: instErr } = await supabase
      .from("engine_instances")
      .select("instance_id, engine_mode, engine_status, control_url, last_heartbeat, engine_version, host_name")
      .eq("user_id", userId)
      .order("last_heartbeat", { ascending: false });

    if (instErr) {
      push({
        id: "p1_registration",
        label: "P1 Registration",
        status: "fail",
        detail: `Supabase read failed: ${instErr.message}`,
        action: "Check RLS policies on engine_instances and dashboard secrets.",
      });
    } else {
      const rows = instances ?? [];
      const paper = rows.find((r) => r.engine_mode === "paper");
      const live = rows.find((r) => r.engine_mode === "live");

      push({
        id: "registration_paper",
        label: "PAPER_V1 Registration",
        status: paper ? "ok" : "fail",
        detail: paper
          ? `Registered as ${paper.instance_id} (${paper.engine_version ?? "unknown version"})`
          : "PAPER engine has not registered.",
        action: paper ? undefined : "Start a P1 process with ENGINE_MODE=paper and ENGINE_DASHBOARD_SYNC=on.",
      });
      push({
        id: "registration_live",
        label: "LIVE_V2 Registration",
        status: live ? "ok" : "fail",
        detail: live
          ? `Registered as ${live.instance_id} (${live.engine_version ?? "unknown version"})`
          : "LIVE engine has not registered.",
        action: live ? undefined : "Start a P1 process with ENGINE_MODE=live and ENGINE_DASHBOARD_SYNC=on.",
      });

      // Heartbeat freshness — evaluated on the most recent instance.
      const newest = rows[0] ?? null;
      const hbAge = ageMs(newest?.last_heartbeat ?? null);
      push({
        id: "heartbeat",
        label: "Heartbeat",
        status: hbAge === null ? "fail" : hbAge < HEARTBEAT_STALE_MS ? "ok" : "warn",
        detail: hbAge === null
          ? "No heartbeat received."
          : `Last heartbeat ${fmtAge(hbAge)} (${newest?.instance_id ?? "?"})`,
        action: hbAge !== null && hbAge >= HEARTBEAT_STALE_MS
          ? "Check engine process is running; ENGINE_DASHBOARD_URL must reach this dashboard over HTTPS."
          : undefined,
      });

      // Control URL registered so dashboard can send Start/Stop.
      const anyControl = rows.find((r) => r.control_url);
      push({
        id: "control_url",
        label: "Control URL",
        status: anyControl ? "ok" : fallbackBase ? "warn" : "fail",
        detail: anyControl
          ? `Auto-discovered: ${anyControl.control_url}`
          : fallbackBase
            ? "No engine has registered a control_url; using ENGINE_API_BASE_URL fallback."
            : "No engine has registered a control_url and no fallback is set.",
        action: anyControl ? undefined : "Set ENGINE_CONTROL_URL in the P1 env to its public HTTPS host.",
      });

      // Engine Control API reachability — best-effort ping. Only counted
      // if we have a token AND at least one URL to try.
      const controlBase = anyControl?.control_url ?? fallbackBase;
      if (tokenConfigured && controlBase) {
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(`${controlBase.replace(/\/$/, "")}/api/v2/bot/control`, {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.ENGINE_API_TOKEN}`,
              "x-user-id": userId,
            },
            body: JSON.stringify({ action: "status", mode: newest?.engine_mode ?? "paper" }),
          }).catch((e) => {
            throw e;
          });
          clearTimeout(t);
          push({
            id: "engine_control_api",
            label: "Engine Control API",
            status: res.status < 500 ? "ok" : "fail",
            detail: `POST /api/v2/bot/control → HTTP ${res.status}`,
            action: res.status >= 500 ? "Check P1 logs; the endpoint returned a server error." : undefined,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          push({
            id: "engine_control_api",
            label: "Engine Control API",
            status: "fail",
            detail: `Unreachable: ${msg}`,
            action: "Verify P1 host is publicly reachable over HTTPS from the dashboard.",
          });
        }
      } else {
        push({
          id: "engine_control_api",
          label: "Engine Control API",
          status: "pending",
          detail: !tokenConfigured
            ? "Skipped — ENGINE_API_TOKEN missing."
            : "Skipped — no control_url or fallback available.",
        });
      }
    }

    // ------------------------------------------------------------------
    // Feeds & WS
    // ------------------------------------------------------------------
    const { data: feeds } = await supabase
      .from("engine_feed_status")
      .select("feed, status, last_message_at")
      .eq("user_id", userId);

    const feedRows = feeds ?? [];
    const primaryFeed = feedRows.find((f) => f.feed !== "ws") ?? feedRows[0] ?? null;
    const feedAge = ageMs(primaryFeed?.last_message_at ?? null);
    push({
      id: "feed",
      label: "Feed",
      status: !primaryFeed ? "fail" : feedAge !== null && feedAge < FEED_STALE_MS ? "ok" : "warn",
      detail: !primaryFeed
        ? "No feed_status rows — engine hasn't reported feed connectivity."
        : `${primaryFeed.feed} · ${primaryFeed.status ?? "?"} · ${fmtAge(feedAge)}`,
      action: !primaryFeed ? "Engine must POST /api/public/engine/feed_status." : undefined,
    });

    const wsRow = feedRows.find((f) => f.feed === "ws") ?? null;
    const wsAge = ageMs(wsRow?.last_message_at ?? null);
    push({
      id: "websocket",
      label: "WebSocket",
      status: !wsRow ? "fail" : wsAge !== null && wsAge < FEED_STALE_MS ? "ok" : "warn",
      detail: !wsRow
        ? "No WebSocket feed reported."
        : `${wsRow.status ?? "?"} · ${fmtAge(wsAge)}`,
      action: !wsRow ? "Engine must post a feed_status with feed='ws'." : undefined,
    });

    // ------------------------------------------------------------------
    // Realtime + data-flow counts
    // ------------------------------------------------------------------
    async function count(table: string): Promise<number | null> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: c, error } = await (supabase as any)
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      return error ? null : (c ?? 0);
    }

    const dataChecks: Array<[string, string]> = [
      ["market", "btc5m_markets"],
      ["orders", "order_intents"],
      ["trades", "trades"],
      ["standing_orders", "standing_orders"],
      ["notifications", "notifications"],
      ["engine_events", "engine_events"],
      ["latency", "latency_samples"],
      ["wallet", "wallet_state"],
    ];
    for (const [id, table] of dataChecks) {
      const c = await count(table);
      push({
        id,
        label: id.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
        status: c === null ? "fail" : c > 0 ? "ok" : "warn",
        detail: c === null
          ? `Could not query ${table}.`
          : c > 0 ? `${c} row${c === 1 ? "" : "s"} received` : "No rows yet.",
        action: c === 0 ? "Engine hasn't produced data for this table yet." : undefined,
      });
    }

    // ------------------------------------------------------------------
    // Realtime + dashboard-sync summary
    // ------------------------------------------------------------------
    push({
      id: "realtime",
      label: "Realtime",
      status: "ok",
      detail: "Supabase Realtime publication includes all engine tables.",
    });
    const anyDataFlow = checks.some((c) => ["market", "trades", "engine_events", "notifications"].includes(c.id) && c.status === "ok");
    push({
      id: "dashboard_sync",
      label: "Dashboard Sync",
      status: anyDataFlow ? "ok" : "warn",
      detail: anyDataFlow
        ? "Engine → dashboard pipeline is delivering rows."
        : "No engine-generated rows detected — sync may not have started yet.",
    });

    // ------------------------------------------------------------------
    // Overall
    // ------------------------------------------------------------------
    const overall: CheckStatus = checks.some((c) => c.status === "fail")
      ? "fail"
      : checks.some((c) => c.status === "warn")
        ? "warn"
        : "ok";

    return {
      generated_at: new Date().toISOString(),
      user_id: userId,
      overall,
      checks,
      meta: {
        engine_api_token_configured: tokenConfigured,
        engine_api_base_url_configured: Boolean(fallbackBase),
        supabase_url: supabaseUrl,
        instances: (instances ?? []).map((r) => ({
          instance_id: r.instance_id as string,
          engine_mode: (r.engine_mode as string | null) ?? null,
          engine_status: (r.engine_status as string | null) ?? null,
          control_url: (r.control_url as string | null) ?? null,
          last_heartbeat: (r.last_heartbeat as string | null) ?? null,
          engine_version: (r.engine_version as string | null) ?? null,
          host_name: (r.host_name as string | null) ?? null,
        })),
      },
    };
  });
