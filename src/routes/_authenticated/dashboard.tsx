import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/data-card";
import { RealtimeIndicator } from "@/components/app/realtime-indicator";
import { TableView } from "@/components/app/table-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList, useRealtimeRow } from "@/hooks/use-realtime";
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
import { Activity, HeartPulse, Radio, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — P4 Bot" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

// The engine heartbeat table has no numeric primary key; it's keyed by user_id.
type Heartbeat = Tables<"engine_heartbeats">;
type Trade = Tables<"trades">;
type OrderIntent = Tables<"order_intents">;
type Latency = Tables<"latency_samples">;
type Btc5m = Tables<"btc5m_markets">;
type Feed = Tables<"engine_feed_status">;
type Wallet = Tables<"wallet_state">;

function DashboardPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const wallet = useRealtimeRow<Wallet>("wallet_state", userId);
  const heartbeat = useRealtimeList<Heartbeat, "user_id">("engine_heartbeats", userId, {
    primaryKey: "user_id",
    orderBy: { column: "last_seen_at", ascending: false },
    limit: 1,
  });
  const feeds = useRealtimeList<Feed, "feed">("engine_feed_status", userId, {
    primaryKey: "feed",
    orderBy: { column: "feed", ascending: true },
    limit: 20,
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
    limit: 100,
  });
  const latency = useRealtimeList<Latency>("latency_samples", userId, {
    orderBy: { column: "ts_ms", ascending: false },
    limit: 25,
  });

  // Aggregated realtime status across all subscriptions — worst-case wins.
  const combinedStatus = useMemo(() => {
    const all = [
      wallet.status,
      heartbeat.status,
      feeds.status,
      markets.status,
      trades.status,
      orders.status,
      latency.status,
    ];
    if (all.some((s) => s === "error")) return "error" as const;
    if (all.some((s) => s === "connecting")) return "connecting" as const;
    if (all.every((s) => s === "connected")) return "connected" as const;
    if (all.some((s) => s === "closed")) return "closed" as const;
    return "idle" as const;
  }, [
    wallet.status,
    heartbeat.status,
    feeds.status,
    markets.status,
    trades.status,
    orders.status,
    latency.status,
  ]);

  const beat = heartbeat.rows[0];
  const beatMs = beat?.last_seen_at ? Date.now() - new Date(beat.last_seen_at).getTime() : null;
  const engineHealthy = beatMs !== null && beatMs < 60_000;

  const activeMarket = useMemo(() => {
    const now = Date.now();
    return (
      markets.rows.find(
        (m) => m.status === "monitoring" || m.status === "active" || (m.slot_start_ms <= now && m.slot_end_ms > now),
      ) ?? markets.rows.find((m) => m.slot_end_ms > now) ?? null
    );
  }, [markets.rows]);

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!activeMarket) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeMarket]);

  const pnl = useMemo(() => computePnl(trades.rows), [trades.rows]);

  const openPositions = useMemo(
    () => trades.rows.filter((t) => t.status === "OPEN"),
    [trades.rows],
  );
  const activeOrders = useMemo(
    () =>
      orders.rows.filter((o) =>
        ["created", "submitting", "submitted", "resting", "pending"].includes(o.status),
      ),
    [orders.rows],
  );
  const filledOrders = useMemo(
    () => orders.rows.filter((o) => o.status === "filled" || o.status === "partial"),
    [orders.rows],
  );

  const lastExec = trades.rows[0] ?? null;
  const lastLatency = latency.rows[0] ?? null;

  const countdown = activeMarket ? Math.max(0, activeMarket.slot_end_ms - nowTick) : 0;

  return (
    <>
      <PageHeader
        title="Bitcoin 5-Minute Console"
        description="Live engine telemetry for Polymarket BTC 5-minute markets."
        actions={<RealtimeIndicator status={combinedStatus} />}
      />

      {/* Top row: engine + wallet + PnL */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Engine"
          value={
            <span className="flex items-center gap-2">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  engineHealthy ? "bg-emerald-500" : beatMs === null ? "bg-muted-foreground/50" : "bg-red-500"
                }`}
              />
              {beatMs === null ? "no beat" : engineHealthy ? "healthy" : "stale"}
            </span>
          }
          hint={beat?.last_seen_at ? `beat ${fmtAgo(beat.last_seen_at)} · ${beat.mode ?? "—"}` : "waiting for heartbeat"}
        />
        <StatCard label="Wallet (USDC)" value={fmtUsd(Number(wallet.row?.balance_usdc ?? 0))} hint={`available ${fmtUsd(Number(wallet.row?.available_usdc ?? 0))}`} />
        <StatCard
          label="Daily PnL"
          value={<span className={pnl.daily >= 0 ? "text-emerald-500" : "text-red-500"}>{fmtUsd(pnl.daily)}</span>}
          hint="Realized today (UTC)"
        />
        <StatCard
          label="Total PnL"
          value={<span className={pnl.total >= 0 ? "text-emerald-500" : "text-red-500"}>{fmtUsd(pnl.total)}</span>}
          hint={`${fmtNum(trades.rows.length)} trades tracked`}
        />
      </div>

      {/* Second row: monitored market, counts, latency */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="h-4 w-4" /> Monitored market
            </CardTitle>
            {activeMarket && (
              <Badge variant={countdown < 30_000 ? "destructive" : "outline"}>
                {fmtCountdown(countdown)}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {!activeMarket ? (
              <p className="text-sm text-muted-foreground">
                No BTC 5-minute market currently monitored. The engine will populate this table when a slot becomes eligible.
              </p>
            ) : (
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Market</p>
                  <p className="mt-1 truncate font-medium">{activeMarket.question ?? activeMarket.slug ?? activeMarket.market_id}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{activeMarket.market_id}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="mt-1"><Badge variant="outline">{activeMarket.status}</Badge></p>
                  {!activeMarket.eligible && activeMarket.ineligible_reason && (
                    <p className="mt-1 text-xs text-red-500">{activeMarket.ineligible_reason}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">YES bid / ask</p>
                  <p className="mt-1 font-mono">
                    {fmtPrice(Number(activeMarket.best_bid_yes))} / {fmtPrice(Number(activeMarket.best_ask_yes))}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Last YES</p>
                  <p className="mt-1 font-mono">{fmtPrice(Number(activeMarket.last_price_yes))}</p>
                  <p className="text-xs text-muted-foreground">{fmtAgo(activeMarket.last_tick_at)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Execution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Open positions" value={fmtNum(openPositions.length)} />
            <Row label="Active orders" value={fmtNum(activeOrders.length)} />
            <Row label="Filled orders" value={fmtNum(filledOrders.length)} />
            <Row label="Last exec" value={lastExec ? `${lastExec.side} ${fmtNum(lastExec.shares, 2)} @ ${fmtPrice(lastExec.price)}` : "—"} hint={lastExec ? fmtAgo(lastExec.created_at) : undefined} />
            <Row label="Exec latency" value={fmtMs(lastLatency?.total_ms)} hint={lastLatency ? `${fmtAgo(new Date(lastLatency.ts_ms).toISOString())}` : undefined} />
          </CardContent>
        </Card>
      </div>

      {/* Feeds */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-4 w-4" /> Feed status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {feeds.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No feed status reported yet.</p>
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
              <Wallet className="h-4 w-4" /> Recent trades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trades.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trades yet.</p>
            ) : (
              <ul className="divide-y">
                {trades.rows.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        <Badge variant="outline" className="mr-2">{t.side}</Badge>
                        {fmtNum(t.shares, 2)} @ {fmtPrice(t.price)}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{t.market_id}</p>
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
      </div>

      {/* Active orders detail */}
      <div className="mt-4">
        <TableView
          title="Active orders"
          description="Orders currently in flight or resting on the book."
          columns={[
            { key: "market_id", header: "Market", render: (r) => <span className="font-mono text-xs">{String(r.market_id)}</span> },
            { key: "side", header: "Side", render: (r) => <Badge variant="outline">{String(r.side)}</Badge> },
            { key: "shares", header: "Shares", render: (r) => fmtNum(Number(r.shares), 2) },
            { key: "price", header: "Price", render: (r) => fmtPrice(Number(r.price)) },
            { key: "status", header: "Status" },
            { key: "attempts", header: "Attempts" },
            { key: "last_error", header: "Reason", render: (r) => (r.last_error ? <span className="text-red-500">{String(r.last_error)}</span> : "—") },
          ]}
          rows={activeOrders as unknown as Record<string, unknown>[]}
          loading={orders.loading}
          error={orders.error}
          onRetry={orders.refetch}
          emptyTitle="No active orders"
        />
      </div>
    </>
  );
}

function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right">
        <span className="block font-medium">{value}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
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
