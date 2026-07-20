/**
 * Engine → Dashboard sync endpoints.
 *
 * All routes require:
 *   Authorization: Bearer <ENGINE_API_TOKEN>
 *   x-user-id:     <supabase user_id>
 *
 * The Node.js trading engine POSTs telemetry & state changes here; the
 * dashboard reads the same rows through Supabase Realtime.
 *
 * Every write uses the service-role Supabase client (loaded lazily inside the
 * handler) with an explicit user_id column so RLS scoping is preserved when
 * the dashboard reads.
 */
import { createFileRoute } from "@tanstack/react-router";
import { requireEngineAuth, engineJson } from "@/lib/engine-auth.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
  "Access-Control-Max-Age": "86400",
} as const;

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

type Handler = (
  userId: string,
  body: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
) => Promise<Response>;

const handlers: Record<string, Handler> = {
  // ---- Engine lifecycle ----
  async register(userId, body, admin) {
    const { data, error } = await admin
      .from("engine_instances")
      .upsert(
        {
          user_id: userId,
          instance_id: String(body.instance_id ?? "default"),
          instance_name: body.instance_name ?? null,
          engine_version: body.engine_version ?? null,
          host_name: body.host_name ?? null,
          region: body.region ?? null,
          engine_mode: body.engine_mode === "live" ? "live" : "paper",
          engine_status: "online",
          active_strategy: body.active_strategy ?? null,
          control_url: body.control_url ?? null,
          last_restart_at: new Date().toISOString(),
          last_heartbeat: new Date().toISOString(),
          meta: body.meta ?? null,
        },
        { onConflict: "user_id,instance_id" },
      )
      .select()
      .single();
    if (error) return engineJson({ error: error.message }, 500);
    return engineJson({ ok: true, engine_instance: data });
  },


  async heartbeat(userId, body, admin) {
    const now = new Date().toISOString();
    const instanceId = String(body.instance_id ?? "default");
    await admin
      .from("engine_instances")
      .update({
        engine_status: body.engine_status ?? "online",
        current_market_id: body.current_market_id ?? null,
        active_strategy: body.active_strategy ?? null,
        uptime_seconds: body.uptime_seconds ?? null,
        heartbeat_latency_ms: body.heartbeat_latency_ms ?? null,
        memory_used_mb: body.memory_used_mb ?? null,
        memory_total_mb: body.memory_total_mb ?? null,
        cpu_percent: body.cpu_percent ?? null,
        last_heartbeat: now,
      })
      .eq("user_id", userId)
      .eq("instance_id", instanceId);
    await admin
      .from("engine_heartbeats")
      .upsert(
        {
          user_id: userId,
          mode: body.engine_mode ?? "paper",
          last_seen_at: now,
          version: body.engine_version ?? null,
        },
        { onConflict: "user_id" },
      );
    return engineJson({ ok: true, ts: now });
  },

  async event(userId, body, admin) {
    const { error } = await admin.from("engine_events").insert({
      user_id: userId,
      instance_id: body.instance_id ?? null,
      event_type: String(body.event_type ?? "unknown"),
      severity: body.severity ?? "info",
      source: body.source ?? "engine",
      message: body.message ?? null,
      metadata: body.metadata ?? null,
      correlation_id: body.correlation_id ?? null,
      execution_id: body.execution_id ?? null,
      duration_ms: body.duration_ms ?? null,
    });
    if (error) return engineJson({ error: error.message }, 500);
    return engineJson({ ok: true });
  },

  async feed_status(userId, body, admin) {
    const { error } = await admin.from("engine_feed_status").upsert(
      {
        user_id: userId,
        feed: String(body.feed ?? "unknown"),
        status: String(body.status ?? "connected"),
        latency_ms: body.latency_ms ?? null,
        last_message_at: body.last_message_at ?? new Date().toISOString(),
        last_error: body.last_error ?? null,
      },
      { onConflict: "user_id,feed" },
    );
    if (error) return engineJson({ error: error.message }, 500);
    return engineJson({ ok: true });
  },

  async wallet(userId, body, admin) {
    const { error } = await admin.from("wallet_state").upsert(
      {
        user_id: userId,
        balance_usdc: body.balance_usdc ?? 0,
        available_usdc: body.available_usdc ?? body.balance_usdc ?? 0,
        pending_usdc: body.pending_usdc ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) return engineJson({ error: error.message }, 500);
    return engineJson({ ok: true });
  },

  async market(userId, body, admin) {
    // Upsert a single btc5m market row.
    const { error } = await admin.from("btc5m_markets").upsert(
      {
        user_id: userId,
        market_id: String(body.market_id),
        slug: body.slug ?? null,
        question: body.question ?? null,
        yes_token_id: body.yes_token_id ?? null,
        no_token_id: body.no_token_id ?? null,
        slot_start_ms: Number(body.slot_start_ms ?? 0),
        slot_end_ms: Number(body.slot_end_ms ?? 0),
        status: body.status ?? "monitoring",
        best_bid_yes: body.best_bid_yes ?? null,
        best_ask_yes: body.best_ask_yes ?? null,
        last_price_yes: body.last_price_yes ?? null,
        last_tick_at: body.last_tick_at ?? new Date().toISOString(),
        eligible: body.eligible ?? true,
        ineligible_reason: body.ineligible_reason ?? null,
        meta: body.meta ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,market_id" },
    );
    if (error) return engineJson({ error: error.message }, 500);
    return engineJson({ ok: true });
  },

  async order(userId, body, admin) {
    const { error } = await admin.from("order_intents").upsert(
      {
        user_id: userId,
        client_order_id: String(body.client_order_id),
        exchange_order_id: body.exchange_order_id ?? null,
        status: body.status ?? "created",
        mode: body.mode ?? "paper",
        market_id: body.market_id ?? null,
        token_id: body.token_id ?? null,
        side: body.side ?? "YES",
        price: body.price ?? null,
        shares: body.shares ?? null,
        attempts: body.attempts ?? 0,
        last_error: body.last_error ?? null,
        updated_at_ms: Date.now(),
      },
      { onConflict: "user_id,client_order_id" },
    );
    if (error) return engineJson({ error: error.message }, 500);
    return engineJson({ ok: true });
  },

  async trade(userId, body, admin) {
    const { error } = await admin.from("trades").insert({
      user_id: userId,
      ...body,
    });
    if (error) return engineJson({ error: error.message }, 500);
    return engineJson({ ok: true });
  },

  async standing_order(userId, body, admin) {
    const id = body.id;
    if (!id) return engineJson({ error: "missing_id" }, 400);
    const { error } = await admin
      .from("standing_orders")
      .update({ ...body, id: undefined, user_id: undefined })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) return engineJson({ error: error.message }, 500);
    return engineJson({ ok: true });
  },

  async standing_order_event(userId, body, admin) {
    const { error } = await admin.from("standing_order_events").insert({
      user_id: userId,
      ...body,
    });
    if (error) return engineJson({ error: error.message }, 500);
    return engineJson({ ok: true });
  },

  async latency(userId, body, admin) {
    const { error } = await admin.from("latency_samples").insert({
      user_id: userId,
      ts_ms: Date.now(),
      ...body,
    });
    if (error) return engineJson({ error: error.message }, 500);
    return engineJson({ ok: true });
  },

  async log(userId, body, admin) {
    const { error } = await admin.from("order_log").insert({
      user_id: userId,
      ts_ms: Date.now(),
      ...body,
    });
    if (error) return engineJson({ error: error.message }, 500);
    return engineJson({ ok: true });
  },

  async notification(userId, body, admin) {
    const { error } = await admin.from("notifications").insert({
      user_id: userId,
      severity: body.severity ?? "info",
      source: body.source ?? "engine",
      category: body.category ?? "engine",
      title: String(body.title ?? "Notification"),
      body: body.body ?? null,
      metadata: body.metadata ?? null,
      expires_at: body.expires_at ?? null,
    });
    if (error) return engineJson({ error: error.message }, 500);
    return engineJson({ ok: true });
  },

  async contract_archive(userId, body, admin) {
    const { error } = await admin.from("btc5m_contract_history").upsert(
      { user_id: userId, ...body },
      { onConflict: "user_id,market_id" },
    );
    if (error) return engineJson({ error: error.message }, 500);
    return engineJson({ ok: true });
  },

  async audit(userId, body, admin) {
    const { error } = await admin.from("audit_log").insert({
      user_id: userId,
      ts_ms: Date.now(),
      ...body,
    });
    if (error) return engineJson({ error: error.message }, 500);
    return engineJson({ ok: true });
  },
};

export const Route = createFileRoute("/api/public/engine/$action")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params }) => {
        // Public health probe only.
        if (params.action === "health") return withCors(engineJson({ ok: true, ts: Date.now() }));
        return withCors(engineJson({ error: "method_not_allowed" }, 405));
      },
      POST: async ({ request, params }) => {
        const auth = requireEngineAuth(request);
        if (!auth.ok) return withCors(auth.response);
        const action = params.action;
        const handler = handlers[action];
        if (!handler) return withCors(engineJson({ error: "unknown_action", action }, 404));
        let body: Record<string, unknown> = {};
        try {
          const raw = await request.text();
          body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        } catch {
          return withCors(engineJson({ error: "invalid_json" }, 400));
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const res = await handler(auth.userId, body, supabaseAdmin);
          return withCors(res);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return withCors(engineJson({ error: "handler_failed", message }, 500));
        }
      },
    },
  },
});
