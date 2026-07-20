/**
 * Standing Limit Order — first-class dashboard.
 *
 * All lifecycle state is engine-owned. The dashboard is strictly:
 *   configuration + monitoring + visualization + user control.
 *
 * Realtime feeds:
 *   - standing_orders          → owner-scoped
 *   - standing_order_events    → owner-scoped, timeline for the selected order
 *   - btc5m_markets            → owner-scoped, provides live UP/DOWN prices
 *   - order_intents            → owner-scoped, resolves linked intent status
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CircleDot,
  Copy,
  Play,
  Plus,
  Timer,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";

import { PageHeader } from "@/components/app/page-header";
import { RealtimeIndicator } from "@/components/app/realtime-indicator";
import { StatCard } from "@/components/app/data-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList } from "@/hooks/use-realtime";
import { supabase } from "@/integrations/supabase/client";
import { fmtPrice, fmtMs, fmtCountdown, fmtAgo } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/standing-orders")({
  head: () => ({
    meta: [
      { title: "Standing Limit Order — P4 Bot" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StandingOrdersPage,
});

// -------- types (mirror the migration; DB is the source of truth) --------

type Mode = "PAPER_V1" | "PAPER_V2" | "LIVE_V2";
type Risk = "conservative" | "balanced" | "aggressive";
type SOStatus =
  | "armed"
  | "monitoring"
  | "triggered"
  | "submitted"
  | "filled"
  | "cancelled"
  | "failed"
  | "expired";
type Side = "YES" | "NO";

type StandingOrder = {
  id: string;
  user_id: string;
  name: string;
  market_id: string | null;
  strategy_profile_id: number | null;
  trigger_price: number;
  target_buy_price: number;
  execution_window_start: string | null;
  execution_window_end: string | null;
  position_size: number;
  risk_profile: Risk;
  mode: Mode;
  max_retries: number;
  notes: string | null;
  status: SOStatus;
  selected_side: Side | null;
  majority_side_at_trigger: Side | null;
  trigger_detected_at: string | null;
  execution_started_at: string | null;
  execution_completed_at: string | null;
  order_intent_id: number | null;
  exchange_order_id: string | null;
  retry_count: number;
  last_error: string | null;
  final_status: string | null;
  created_at: string;
  updated_at: string;
};

type SOEvent = {
  id: number;
  standing_order_id: string;
  user_id: string;
  timestamp: string;
  phase: string;
  event: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  latency_ms: number | null;
  created_by: "engine" | "dashboard" | "system";
  engine_instance_id: string | null;
};

type Btc5mMarket = {
  market_id: string;
  status: string;
  eligible: boolean;
  slot_start_ms: number;
  slot_end_ms: number;
  question: string | null;
  best_bid_yes: number | null;
  best_ask_yes: number | null;
  last_price_yes: number | null;
};

type OrderIntent = {
  id: number;
  status: string;
  side: Side;
  shares: number;
  price: number;
  attempts: number;
  last_error: string | null;
};

const STATUS_STYLE: Record<SOStatus, string> = {
  armed:       "bg-blue-500/10 text-blue-500 border-blue-500/30",
  monitoring:  "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
  triggered:   "bg-amber-500/10 text-amber-500 border-amber-500/30",
  submitted:   "bg-violet-500/10 text-violet-500 border-violet-500/30",
  filled:      "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  cancelled:   "bg-muted text-muted-foreground border-muted-foreground/30",
  failed:      "bg-destructive/10 text-destructive border-destructive/40",
  expired:     "bg-muted text-muted-foreground border-muted-foreground/30",
};

const IS_TERMINAL = (s: SOStatus) =>
  s === "filled" || s === "cancelled" || s === "failed" || s === "expired";
const IS_PRE_EXEC = (s: SOStatus) => s === "armed" || s === "monitoring";

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------

function StandingOrdersPage() {
  const { user } = useAuth();
  const uid = user?.id;

  const so = useRealtimeList<StandingOrder>("standing_orders", uid, {
    orderBy: { column: "created_at", ascending: false },
    limit: 100,
  });
  const markets = useRealtimeList<Btc5mMarket, "market_id">("btc5m_markets", uid, {
    primaryKey: "market_id",
    orderBy: { column: "slot_start_ms", ascending: false },
    limit: 20,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    so.rows.find((r) => r.id === selectedId) ?? so.rows[0] ?? null;

  const active = so.rows.filter((r) => !IS_TERMINAL(r.status));
  const history = so.rows.filter((r) => IS_TERMINAL(r.status));

  return (
    <>
      <PageHeader
        title="Standing Limit Order"
        description="Primary production strategy — BTC 5-minute markets. Direction is decided at trigger time from live majority side."
        actions={
          <div className="flex items-center gap-2">
            <RealtimeIndicator status={so.status} label="orders" />
            <NewStandingOrderDialog userId={uid} markets={markets.rows} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active" value={active.length.toLocaleString()} hint="armed + monitoring + in-flight" />
        <StatCard
          label="Filled today"
          value={history
            .filter(
              (r) =>
                r.status === "filled" &&
                r.execution_completed_at &&
                new Date(r.execution_completed_at).getTime() >
                  new Date().setUTCHours(0, 0, 0, 0),
            )
            .length.toLocaleString()}
        />
        <StatCard
          label="Failed / expired"
          value={history
            .filter((r) => r.status === "failed" || r.status === "expired")
            .length.toLocaleString()}
          hint="last 100"
        />
        <StatCard
          label="Eligible markets"
          value={markets.rows.filter((m) => m.eligible).length.toLocaleString()}
          hint="BTC 5m slots"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <OrderList
          rows={so.rows}
          loading={so.loading}
          error={so.error}
          onSelect={setSelectedId}
          selectedId={selected?.id ?? null}
        />
        {selected ? (
          <OrderDetail order={selected} userId={uid} markets={markets.rows} />
        ) : (
          <EmptyDetail />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------
// Order list (left column)
// ---------------------------------------------------------------

function OrderList({
  rows,
  loading,
  error,
  onSelect,
  selectedId,
}: {
  rows: StandingOrder[];
  loading: boolean;
  error: string | null;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  return (
    <Card className="flex min-h-[520px] flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Standing orders</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {error && (
          <div className="mx-4 mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            {error}
          </div>
        )}
        {loading && rows.length === 0 && (
          <div className="p-4 text-xs text-muted-foreground">Loading…</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="p-4 text-xs text-muted-foreground">
            No standing orders yet. Create one to arm the engine.
          </div>
        )}
        <ScrollArea className="max-h-[520px]">
          <ul className="divide-y">
            {rows.map((r) => {
              const isSelected = r.id === selectedId;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => onSelect(r.id)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-accent/50 ${
                      isSelected ? "bg-accent/60" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{r.name}</span>
                      <Badge variant="outline" className={STATUS_STYLE[r.status]}>
                        {r.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>trg {fmtPrice(r.trigger_price)}</span>
                      <span>buy {fmtPrice(r.target_buy_price)}</span>
                      <span>{r.mode}</span>
                      <span className="ml-auto">{fmtAgo(r.updated_at)}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function EmptyDetail() {
  return (
    <Card className="flex min-h-[520px] items-center justify-center">
      <div className="text-center text-sm text-muted-foreground">
        <CircleDot className="mx-auto mb-2 h-6 w-6" />
        Select a standing order to see its live state and timeline.
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------
// Order detail (right column)
// ---------------------------------------------------------------

function OrderDetail({
  order,
  userId,
  markets,
}: {
  order: StandingOrder;
  userId: string | undefined;
  markets: Btc5mMarket[];
}) {
  const [busy, setBusy] = useState(false);

  const events = useRealtimeList<SOEvent>("standing_order_events", userId, {
    orderBy: { column: "timestamp", ascending: false },
    limit: 200,
    // channel scoped per user; we filter to this order client-side
  });
  const orderEvents = useMemo(
    () => events.rows.filter((e) => e.standing_order_id === order.id),
    [events.rows, order.id],
  );

  // Linked live market (if pinned)
  const pinned = order.market_id
    ? markets.find((m) => m.market_id === order.market_id) ?? null
    : null;

  // Linked order intent (single-row lookup on demand)
  const [intent, setIntent] = useIntent(userId, order.order_intent_id);

  const [now, setNow] = useTick(1000);
  const countdown = useMemo(() => {
    const endMs = order.execution_window_end
      ? new Date(order.execution_window_end).getTime()
      : pinned?.slot_end_ms ?? 0;
    if (!endMs) return null;
    return endMs - now;
  }, [order.execution_window_end, pinned?.slot_end_ms, now]);

  const upBid = pinned?.best_bid_yes ?? null;
  const upAsk = pinned?.best_ask_yes ?? null;
  const upLast = pinned?.last_price_yes ?? null;
  const downLast =
    upLast !== null && upLast !== undefined ? 1 - upLast : null;

  const canDelete = IS_PRE_EXEC(order.status);
  const canCancel =
    order.status === "triggered" || order.status === "submitted";

  const handleDelete = async () => {
    if (!confirm(`Delete standing order "${order.name}"?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("standing_orders")
      .delete()
      .eq("id", order.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Deleted");
  };

  const handleCancel = async () => {
    if (!userId) return;
    setBusy(true);
    // Owner marks cancellation intent. The engine sees the state change and
    // handles exchange-side cancel + writes the terminal lifecycle event.
    const { error } = await supabase
      .from("standing_orders")
      .update({ status: "cancelled" as SOStatus })
      .eq("id", order.id);
    if (!error) {
      await supabase.from("standing_order_events").insert({
        standing_order_id: order.id,
        user_id: userId,
        phase: "cancel",
        event: "Cancel Requested",
        message: "User requested cancellation from dashboard.",
        created_by: "dashboard",
      });
    }
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Cancel requested");
  };

  const handleDuplicate = async () => {
    if (!userId) return;
    setBusy(true);
    const { error } = await supabase.from("standing_orders").insert({
      user_id: userId,
      name: `${order.name} (copy)`,
      market_id: order.market_id,
      strategy_profile_id: order.strategy_profile_id,
      trigger_price: order.trigger_price,
      target_buy_price: order.target_buy_price,
      execution_window_start: order.execution_window_start,
      execution_window_end: order.execution_window_end,
      position_size: order.position_size,
      risk_profile: order.risk_profile,
      mode: order.mode,
      max_retries: order.max_retries,
      notes: order.notes,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Duplicated");
  };

  return (
    <div className="flex min-h-[520px] flex-col gap-4">
      {/* Header + controls */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="truncate text-base">{order.name}</CardTitle>
              <Badge variant="outline" className={STATUS_STYLE[order.status]}>
                {order.status}
              </Badge>
              <Badge variant="outline">{order.mode}</Badge>
              <Badge variant="outline">{order.risk_profile}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Updated {fmtAgo(order.updated_at)} · Created {fmtAgo(order.created_at)}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDuplicate} disabled={busy}>
              <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={busy || !canCancel}
            >
              <XCircle className="mr-1 h-3.5 w-3.5" /> Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleDelete}
              disabled={busy || !canDelete}
              title={canDelete ? "Delete" : "Cannot delete once execution begins"}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <MetricRow label="Trigger price" value={fmtPrice(order.trigger_price)} icon={<Zap className="h-3.5 w-3.5" />} />
          <MetricRow label="Target buy price" value={fmtPrice(order.target_buy_price)} />
          <MetricRow label="Position size" value={order.position_size.toLocaleString()} />
          <MetricRow
            label="Execution window"
            value={
              countdown === null
                ? "—"
                : countdown > 0
                  ? fmtCountdown(countdown)
                  : "closed"
            }
            icon={<Timer className="h-3.5 w-3.5" />}
          />
          <MetricRow label="Retry count" value={`${order.retry_count} / ${order.max_retries}`} />
          <MetricRow
            label="Selected side"
            value={
              order.selected_side ? (
                <Badge variant="outline">{order.selected_side}</Badge>
              ) : (
                "—"
              )
            }
          />
        </CardContent>
      </Card>

      {/* Live market + linked intent */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" /> Live market
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Market</span>
              <span className="truncate font-mono text-xs">
                {order.market_id ?? "next eligible slot"}
              </span>
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-2 text-center">
              <PriceCell label="UP bid" value={upBid} tone="up" />
              <PriceCell label="UP ask" value={upAsk} tone="up" />
              <PriceCell label="UP last" value={upLast} tone="up" />
              <PriceCell
                label="DOWN last"
                value={downLast}
                tone="down"
                span={3}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Majority at trigger</span>
              <span>
                {order.majority_side_at_trigger ? (
                  <Badge variant="outline">
                    {order.majority_side_at_trigger}
                  </Badge>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Trigger detected at</span>
              <span>{order.trigger_detected_at ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ArrowUpRight className="h-4 w-4" /> Linked order
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {order.order_intent_id === null ? (
              <p className="text-muted-foreground">
                No order intent yet. It's created when the trigger fires.
              </p>
            ) : intent === undefined ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : intent === null ? (
              <p className="text-muted-foreground">
                Intent #{order.order_intent_id} not found.
              </p>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Intent #</span>
                  <span className="font-mono">{intent.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline">{intent.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Side</span>
                  <span>{intent.side}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Shares @ price</span>
                  <span>
                    {intent.shares.toLocaleString()} @ {fmtPrice(intent.price)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Attempts</span>
                  <span>{intent.attempts}</span>
                </div>
                {intent.last_error && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                    {intent.last_error}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Exchange order</span>
                  <span className="font-mono">
                    {order.exchange_order_id ?? "—"}
                  </span>
                </div>
              </div>
            )}
            {order.last_error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                <span className="font-medium">Last error:</span> {order.last_error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card className="flex-1">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm">Execution timeline</CardTitle>
          <RealtimeIndicator status={events.status} label="events" />
        </CardHeader>
        <CardContent className="p-0">
          {events.error && (
            <div className="mx-4 mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {events.error}
            </div>
          )}
          {orderEvents.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">
              No events yet. The engine will populate this as the lifecycle progresses.
            </div>
          ) : (
            <ScrollArea className="max-h-[360px]">
              <ol className="divide-y">
                {orderEvents.map((e) => (
                  <li key={e.id} className="px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          e.phase === "error"
                            ? "border-destructive/40 text-destructive"
                            : ""
                        }
                      >
                        {e.phase}
                      </Badge>
                      <span className="font-medium">{e.event}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {fmtAgo(e.timestamp)}
                        {e.latency_ms !== null && (
                          <>
                            {" "}
                            · {fmtMs(e.latency_ms)}
                          </>
                        )}
                      </span>
                    </div>
                    {e.message && (
                      <p className="mt-1 text-xs text-muted-foreground">{e.message}</p>
                    )}
                    {e.created_by !== "engine" && (
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        via {e.created_by}
                        {e.engine_instance_id ? ` · ${e.engine_instance_id}` : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------

function MetricRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function PriceCell({
  label,
  value,
  tone,
  span = 1,
}: {
  label: string;
  value: number | null | undefined;
  tone: "up" | "down";
  span?: number;
}) {
  const cls =
    tone === "up"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500"
      : "border-rose-500/30 bg-rose-500/5 text-rose-500";
  return (
    <div
      className={`rounded-md border p-2 ${cls}`}
      style={{ gridColumn: `span ${span}` }}
    >
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-0.5 font-mono text-sm">{fmtPrice(value ?? null)}</div>
    </div>
  );
}

// ---------------------------------------------------------------
// Hooks (local)
// ---------------------------------------------------------------

/** Lightweight rerender tick. Cleaned up on unmount — no timer leak. */
function useTick(ms: number): [number, () => void] {
  const [t, setT] = useState(Date.now());
  useMemoInterval(() => setT(Date.now()), ms);
  return [t, () => setT(Date.now())];
}

function useMemoInterval(fn: () => void, ms: number) {
  // Standalone useEffect keeps timer lifecycle explicit and testable.
  useMemoEffect(() => {
    const id = window.setInterval(fn, ms);
    return () => window.clearInterval(id);
  }, [ms]);
}
// Local alias so the timer is trivially auditable in one file.
import { useEffect as useMemoEffect } from "react";

/** Fetch a single linked order intent (owner-scoped by RLS). */
function useIntent(userId: string | undefined, intentId: number | null) {
  const [row, setRow] = useState<OrderIntent | null | undefined>(undefined);
  useMemoEffect(() => {
    if (!userId || intentId === null) {
      setRow(intentId === null ? null : undefined);
      return;
    }
    let cancelled = false;
    setRow(undefined);
    supabase
      .from("order_intents")
      .select("id,status,side,shares,price,attempts,last_error")
      .eq("id", intentId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRow((data as OrderIntent | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, intentId]);
  return [row, setRow] as const;
}

// ---------------------------------------------------------------
// New standing order dialog
// ---------------------------------------------------------------

function NewStandingOrderDialog({
  userId,
  markets,
}: {
  userId: string | undefined;
  markets: Btc5mMarket[];
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    market_id: "" as string,
    trigger_price: "0.55",
    target_buy_price: "0.50",
    position_size: "10",
    risk_profile: "balanced" as Risk,
    mode: "PAPER_V2" as Mode,
    max_retries: "3",
    notes: "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!userId) {
      toast.error("Not signed in.");
      return;
    }
    const trigger = Number(form.trigger_price);
    const target = Number(form.target_buy_price);
    const size = Number(form.position_size);
    const retries = Number(form.max_retries);
    if (!form.name.trim()) return toast.error("Name is required.");
    if (!(trigger > 0 && trigger < 1)) return toast.error("Trigger price must be between 0 and 1.");
    if (!(target > 0 && target < 1)) return toast.error("Target buy price must be between 0 and 1.");
    if (!(size > 0)) return toast.error("Position size must be > 0.");
    if (!(retries >= 0 && retries <= 20)) return toast.error("Max retries 0–20.");

    setBusy(true);
    // Owner-scoped insert. RLS requires user_id = auth.uid(); the engine
    // takes over lifecycle state and writes the first 'Armed' event.
    const { data, error } = await supabase
      .from("standing_orders")
      .insert({
        user_id: userId,
        name: form.name.trim(),
        market_id: form.market_id || null,
        trigger_price: trigger,
        target_buy_price: target,
        position_size: size,
        risk_profile: form.risk_profile,
        mode: form.mode,
        max_retries: retries,
        notes: form.notes.trim() || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      setBusy(false);
      toast.error(error?.message ?? "Failed to create standing order.");
      return;
    }

    // Configuration audit event — dashboard-authored, never a lifecycle transition.
    await supabase.from("standing_order_events").insert({
      standing_order_id: data.id,
      user_id: userId,
      phase: "config",
      event: "Created",
      message: "Standing limit order created from dashboard.",
      created_by: "dashboard",
    });

    setBusy(false);
    setOpen(false);
    setForm((f) => ({ ...f, name: "", notes: "" }));
    toast.success("Standing order created — engine will arm it on next scan.");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> New standing order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Standing Limit Order</DialogTitle>
          <DialogDescription>
            Direction is decided at trigger time from the live majority side. It is not chosen here.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. BTC-5m 55/50 balanced"
            />
          </Field>

          <Field label="Market (optional)" hint="Leave blank to use the next eligible slot.">
            <Select
              value={form.market_id || "__any"}
              onValueChange={(v) => set("market_id", v === "__any" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Next eligible" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any">Next eligible</SelectItem>
                {markets
                  .filter((m) => m.eligible)
                  .map((m) => (
                    <SelectItem key={m.market_id} value={m.market_id}>
                      {(m.question ?? m.market_id).slice(0, 60)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Trigger price" hint="YES price 0–1">
              <Input
                type="number" step="0.001" min="0" max="1"
                value={form.trigger_price}
                onChange={(e) => set("trigger_price", e.target.value)}
              />
            </Field>
            <Field label="Target buy price" hint="Limit price 0–1">
              <Input
                type="number" step="0.001" min="0" max="1"
                value={form.target_buy_price}
                onChange={(e) => set("target_buy_price", e.target.value)}
              />
            </Field>
            <Field label="Position size" hint="shares">
              <Input
                type="number" step="0.01" min="0"
                value={form.position_size}
                onChange={(e) => set("position_size", e.target.value)}
              />
            </Field>
            <Field label="Max retries">
              <Input
                type="number" step="1" min="0" max="20"
                value={form.max_retries}
                onChange={(e) => set("max_retries", e.target.value)}
              />
            </Field>
            <Field label="Risk profile">
              <Select value={form.risk_profile} onValueChange={(v) => set("risk_profile", v as Risk)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">conservative</SelectItem>
                  <SelectItem value="balanced">balanced</SelectItem>
                  <SelectItem value="aggressive">aggressive</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Mode">
              <Select value={form.mode} onValueChange={(v) => set("mode", v as Mode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAPER_V1">PAPER_V1</SelectItem>
                  <SelectItem value="PAPER_V2">PAPER_V2</SelectItem>
                  <SelectItem value="LIVE_V2">LIVE_V2</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Notes (optional)">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            <Play className="mr-1.5 h-4 w-4" /> Arm order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
