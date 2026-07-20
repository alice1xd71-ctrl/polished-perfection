import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/data-card";
import { RealtimeIndicator } from "@/components/app/realtime-indicator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList, useRealtimeRow, type RealtimeStatus } from "@/hooks/use-realtime";
import type { Tables } from "@/integrations/supabase/types";
import {
  fmtAgo,
  fmtCountdown,
  fmtMs,
  fmtNum,
  fmtPrice,
  fmtUsd,
  computePnl,
} from "@/lib/format";
import { Activity, HeartPulse, Radio, Wallet, Target, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "BTC 5-Minute Terminal — P4 Bot" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

type Heartbeat = Tables<"engine_heartbeats">;
type EngineInst = Tables<"engine_instances">;
type Trade = Tables<"trades">;
type OrderIntent = Tables<"order_intents">;
type Btc5m = Tables<"btc5m_markets">;
type Feed = Tables<"engine_feed_status">;
type WalletRow = Tables<"wallet_state">;
type StandingOrder = Tables<"standing_orders">;
type Notif = Tables<"notifications">;

const CONTRACT_MS = 5 * 60 * 1000;

function DashboardPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const wallet = useRealtimeRow<WalletRow>("wallet_state", userId);
  const heartbeat = useRealtimeList<Heartbeat, "user_id">("engine_heartbeats", userId, {
    primaryKey: "user_id",
    orderBy: { column: "last_seen_at", ascending: false },
    limit: 1,
  });
  const instances = useRealtimeList<EngineInst>("engine_instances", userId, {
    orderBy: { column: "last_heartbeat", ascending: false },
    limit: 5,
  });
  const feeds = useRealtimeList<Feed, "feed">("engine_feed_status", userId, {
    primaryKey: "feed",
    orderBy: { column: "feed", ascending: true },
    limit: 10,
  });
  const markets = useRealtimeList<Btc5m>("btc5m_markets", userId, {
    orderBy: { column: "slot_end_ms", ascending: true },
    limit: 25,
  });
  const trades = useRealtimeList<Trade>("trades", userId, {
    orderBy: { column: "created_at", ascending: false },
    limit: 200,
  });
  const orders = useRealtimeList<OrderIntent>("order_intents", userId, {
    orderBy: { column: "updated_at_ms", ascending: false },
    limit: 50,
  });
  const standingOrders = useRealtimeList<StandingOrder>("standing_orders", userId, {
    orderBy: { column: "updated_at", ascending: false },
    limit: 25,
  });
  const notifications = useRealtimeList<Notif>("notifications", userId, {
    orderBy: { column: "ts_ms", ascending: false },
    limit: 10,
  });

  const combinedStatus = useMemo<RealtimeStatus>(() => {
    const all = [
      wallet.status, heartbeat.status, feeds.status, markets.status,
      trades.status, orders.status, standingOrders.status, notifications.status,
    ];
    if (all.some((s) => s === "error")) return "error";
    if (all.some((s) => s === "connecting")) return "connecting";
    if (all.every((s) => s === "connected")) return "connected";
    if (all.some((s) => s === "closed")) return "closed";
    return "idle";
  }, [wallet.status, heartbeat.status, feeds.status, markets.status, trades.status, orders.status, standingOrders.status, notifications.status]);

  // Live clock — ticks every second for countdown + auto-switch logic.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Exactly ONE active contract: the earliest market whose window contains
  // `now`. If none, fall back to the next upcoming one. When the current
  // contract expires, the memo recomputes and swaps automatically without
  // any refresh — that is the "auto-roll" requirement.
  const activeMarket = useMemo(() => {
    const live = markets.rows.find((m) => m.slot_start_ms <= nowTick && m.slot_end_ms > nowTick);
    if (live) return live;
    return markets.rows.find((m) => m.slot_end_ms > nowTick) ?? null;
  }, [markets.rows, nowTick]);

  const primaryInstance = instances.rows[0] ?? null;
  const beat = heartbeat.rows[0];
  const beatMs = beat?.last_seen_at ? nowTick - new Date(beat.last_seen_at).getTime() : null;
  const engineHealthy = beatMs !== null && beatMs < 60_000;
  const dbHealthy = combinedStatus === "connected";

  const pnl = useMemo(() => computePnl(trades.rows), [trades.rows]);
  const openPositions = useMemo(() => trades.rows.filter((t) => t.status === "OPEN"), [trades.rows]);
  const activeOrdersList = useMemo(
    () => orders.rows.filter((o) => ["created","submitting","submitted","resting","pending"].includes(o.status)),
    [orders.rows],
  );

  // Active standing orders currently bound to the live BTC 5-minute contract.
  const activeSlo = useMemo(() => {
    const armed = standingOrders.rows.filter((s) =>
      ["armed","monitoring","triggered","executing"].includes(s.status),
    );
    // Prefer one bound to the current active market; otherwise show the most recent.
    if (activeMarket) {
      const bound = armed.find((s) => s.active_market_id === activeMarket.market_id || s.market_id === activeMarket.market_id);
      if (bound) return bound;
    }
    return armed[0] ?? null;
  }, [standingOrders.rows, activeMarket]);

  const countdown = activeMarket ? Math.max(0, activeMarket.slot_end_ms - nowTick) : 0;
  const marketState = !activeMarket ? "closed"
    : countdown === 0 ? "closed"
    : countdown < 30_000 ? "closing"
    : "open";

  const yesBid = Number(activeMarket?.best_bid_yes ?? 0);
  const yesAsk = Number(activeMarket?.best_ask_yes ?? 0);
  const spread = yesAsk > 0 && yesBid > 0 ? yesAsk - yesBid : null;
  const upPrice = Number(activeMarket?.last_price_yes ?? 0);
  const downPrice = upPrice > 0 ? 1 - upPrice : 0;

  // Recent trades restricted to the currently active contract for the terminal.
  const recentTradesForContract = useMemo(() => {
    if (!activeMarket) return trades.rows.slice(0, 5);
    return trades.rows.filter((t) => t.market_id === activeMarket.market_id).slice(0, 5);
  }, [trades.rows, activeMarket]);

  return (
    <>
      <PageHeader
        title="BTC 5-Minute Terminal"
        description="Live control center for the currently tradable Polymarket BTC 5-minute contract."
        actions={<RealtimeIndicator status={combinedStatus} />}
      />

      {/* ============ STATUS STRIP ============ */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SystemPill label="Engine" state={engineHealthy ? "ok" : beatMs === null ? "idle" : "bad"}
          hint={beat?.last_seen_at ? `beat ${fmtAgo(beat.last_seen_at)} · ${primaryInstance?.engine_mode ?? beat.mode ?? "—"}` : "no heartbeat"} />
        <SystemPill label="Feed" state={feedState(feeds.rows)} hint={feedHint(feeds.rows)} />
        <SystemPill label="WebSocket" state={wsState(feeds.rows)} hint={primaryInstance?.host_name ?? "—"} />
        <SystemPill label="Database" state={dbHealthy ? "ok" : "idle"} hint="Supabase realtime" />
      </div>

      {/* ============ WALLET / PNL ============ */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Wallet (USDC)" value={fmtUsd(Number(wallet.row?.balance_usdc ?? 0))}
          hint={`available ${fmtUsd(Number(wallet.row?.available_usdc ?? 0))}`} />
        <StatCard label="Today's PnL"
          value={<span className={pnl.daily >= 0 ? "text-emerald-500" : "text-red-500"}>{fmtUsd(pnl.daily)}</span>}
          hint="Realized today (UTC)" />
        <StatCard label="Open positions" value={fmtNum(openPositions.length)} hint={`${fmtNum(activeOrdersList.length)} active orders`} />
        <StatCard label="Total PnL"
          value={<span className={pnl.total >= 0 ? "text-emerald-500" : "text-red-500"}>{fmtUsd(pnl.total)}</span>}
          hint={`${fmtNum(trades.rows.length)} trades`} />
      </div>

      {/* ============ ACTIVE CONTRACT ============ */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="h-4 w-4" /> Active BTC 5-Minute Contract
              {activeMarket && (
                <Badge variant="outline" className={
                  marketState === "open" ? "border-emerald-500/30 text-emerald-500" :
                  marketState === "closing" ? "border-yellow-500/30 text-yellow-500" :
                  "border-red-500/30 text-red-500"
                }>{marketState}</Badge>
              )}
            </CardTitle>
            {activeMarket && (
              <Badge variant={countdown < 30_000 ? "destructive" : "outline"} className="font-mono">
                {fmtCountdown(countdown)}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {!activeMarket ? (
              <p className="text-sm text-muted-foreground">
                No tradable BTC 5-minute contract right now. The dashboard will switch automatically
                when the engine reports the next active slot.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="truncate font-medium">{activeMarket.question ?? activeMarket.slug ?? activeMarket.market_id}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{activeMarket.market_id}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label="UP" value={fmtPrice(upPrice)} tone="emerald" />
                  <Metric label="DOWN" value={fmtPrice(downPrice)} tone="red" />
                  <Metric label="Best Bid" value={fmtPrice(yesBid)} />
                  <Metric label="Best Ask" value={fmtPrice(yesAsk)} />
                  <Metric label="Spread" value={spread === null ? "—" : fmtPrice(spread)} />
                  <Metric label="Volume" value={fmtNum(readMetaNum(activeMarket, "volume"))} />
                  <Metric label="Liquidity" value={fmtNum(readMetaNum(activeMarket, "liquidity"))} />
                  <Metric label="Majority" value={readMeta(activeMarket, "majority_side") ?? "—"} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Contract window {new Date(activeMarket.slot_start_ms).toLocaleTimeString()} → {new Date(activeMarket.slot_end_ms).toLocaleTimeString()} · last tick {fmtAgo(activeMarket.last_tick_at)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Standing Limit Order panel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" /> Standing Limit Order
            </CardTitle>
            <Link to="/standing-orders" className="text-xs text-muted-foreground hover:text-foreground">manage →</Link>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!activeSlo ? (
              <p className="text-muted-foreground">No standing limit order is armed. Configure one to begin monitoring the active contract.</p>
            ) : (
              <>
                <div>
                  <p className="truncate font-medium">{activeSlo.name}</p>
                  <Badge variant="outline" className="mt-1">{activeSlo.status}</Badge>
                </div>
                <Row label="Trigger price" value={fmtPrice(Number(activeSlo.trigger_price))} />
                <Row label="Target buy" value={fmtPrice(Number(activeSlo.target_buy_price))} />
                <Row label="Selected side" value={activeSlo.selected_side ?? "—"} />
                <Row label="Majority @ trigger" value={activeSlo.majority_side_at_trigger ?? "—"} />
                <Row label="Execution window" value={
                  activeSlo.execution_window_start && activeSlo.execution_window_end
                    ? `${new Date(activeSlo.execution_window_start).toLocaleTimeString()} → ${new Date(activeSlo.execution_window_end).toLocaleTimeString()}`
                    : "—"
                } />
                <Row label="Roll count" value={fmtNum(activeSlo.market_roll_count ?? 0)} />
                {activeSlo.last_error && <p className="text-xs text-red-500">{activeSlo.last_error}</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============ FEEDS + RECENT TRADES + EVENT STREAM ============ */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-4 w-4" /> Feed status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {feeds.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No feed status reported.</p>
            ) : (
              <ul className="divide-y">
                {feeds.rows.map((f) => (
                  <li key={f.feed} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{f.feed}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.last_message_at ? `msg ${fmtAgo(f.last_message_at)}` : "no messages"} · {fmtMs(f.latency_ms ?? null)}
                      </p>
                    </div>
                    <FeedBadge status={f.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" /> Recent trades (contract)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentTradesForContract.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trades on the active contract.</p>
            ) : (
              <ul className="divide-y">
                {recentTradesForContract.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        <Badge variant="outline" className="mr-2">{t.side}</Badge>
                        {fmtNum(t.shares, 2)} @ {fmtPrice(t.price)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{t.status}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className={t.pnl >= 0 ? "text-emerald-500" : "text-red-500"}>{fmtUsd(t.pnl)}</p>
                      <p className="text-muted-foreground">{fmtAgo(t.created_at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4" /> Live event stream
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No engine events yet.</p>
            ) : (
              <ul className="divide-y">
                {notifications.rows.slice(0, 8).map((n) => (
                  <li key={n.id} className="py-2 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-medium">{n.title}</p>
                      <span className="text-[11px] text-muted-foreground">{fmtAgo(Number(n.ts_ms))}</span>
                    </div>
                    {n.body && <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============ ACTIVE ORDERS ============ */}
      <div className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Active orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeOrdersList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders in flight.</p>
            ) : (
              <ul className="divide-y">
                {activeOrdersList.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">
                        <Badge variant="outline" className="mr-2">{o.side}</Badge>
                        {fmtNum(Number(o.shares), 2)} @ {fmtPrice(Number(o.price))}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{o.market_id}</p>
                    </div>
                    <div className="text-right text-xs">
                      <Badge variant="outline">{o.status}</Badge>
                      <p className="mt-0.5 text-muted-foreground">attempts {o.attempts}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Contract length {CONTRACT_MS / 1000}s · dashboard auto-rolls to the next contract on expiry — no refresh required.
      </p>
    </>
  );
}

/* ---------- helpers ---------- */

function readMeta(m: Btc5m | null, key: string): string | null {
  if (!m?.meta) return null;
  const v = (m.meta as Record<string, unknown>)[key];
  return v === undefined || v === null ? null : String(v);
}

function feedState(feeds: Feed[]): "ok" | "bad" | "idle" | "warn" {
  if (feeds.length === 0) return "idle";
  if (feeds.some((f) => f.status.toLowerCase() === "disconnected")) return "bad";
  if (feeds.some((f) => f.status.toLowerCase() === "degraded")) return "warn";
  return "ok";
}
function feedHint(feeds: Feed[]): string {
  if (feeds.length === 0) return "no feeds reported";
  const worst = feeds.reduce<Feed | null>((a, f) => (!a || (f.latency_ms ?? 0) > (a.latency_ms ?? 0) ? f : a), null);
  return worst ? `${worst.feed} · ${fmtMs(worst.latency_ms ?? null)}` : "";
}
function wsState(feeds: Feed[]): "ok" | "bad" | "idle" | "warn" {
  const ws = feeds.find((f) => f.feed.toLowerCase().includes("ws") || f.feed.toLowerCase().includes("polymarket"));
  if (!ws) return "idle";
  const s = ws.status.toLowerCase();
  if (s === "connected") return "ok";
  if (s === "degraded") return "warn";
  return "bad";
}

function SystemPill({ label, state, hint }: { label: string; state: "ok" | "bad" | "warn" | "idle"; hint?: string }) {
  const dot = state === "ok" ? "bg-emerald-500" : state === "warn" ? "bg-yellow-500" : state === "bad" ? "bg-red-500" : "bg-muted-foreground/50";
  const text = state === "ok" ? "healthy" : state === "warn" ? "degraded" : state === "bad" ? "down" : "idle";
  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 flex items-center gap-2 text-sm font-medium">
          <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
          {text}
        </p>
      </div>
      {hint && <p className="max-w-[55%] truncate text-right text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "emerald" | "red" }) {
  return (
    <div className="rounded-md border bg-background/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-semibold ${tone === "emerald" ? "text-emerald-500" : tone === "red" ? "text-red-500" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function FeedBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "connected") return <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20">connected</Badge>;
  if (s === "degraded") return <Badge className="bg-yellow-500/15 text-yellow-500 hover:bg-yellow-500/20">degraded</Badge>;
  if (s === "disconnected") return <Badge variant="destructive">disconnected</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}
