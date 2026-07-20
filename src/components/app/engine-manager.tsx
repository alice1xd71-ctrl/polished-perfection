/**
 * Engine Manager — per-mode engine instance cards with control buttons.
 *
 * Renders exactly two cards (PAPER_V1, LIVE_V2) built from the
 * `engine_instances` realtime rows filtered by `engine_mode`. Each card
 * exposes Start / Stop / Restart / Reconnect controls that call the
 * `controlEngine` server function, which forwards to the external engine.
 *
 * When no row exists for a mode, the card renders an explicit
 * "not registered" empty state so operators can distinguish
 * "engine offline" from "engine never connected".
 */
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, Play, Square, RotateCcw, PlugZap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { fmtAgo, fmtMs, fmtNum, fmtUsd } from "@/lib/format";
import { controlEngine } from "@/lib/engine-control.functions";

type EngineInst = Tables<"engine_instances">;
type WalletRow = Tables<"wallet_state">;
type OrderIntent = Tables<"order_intents">;
type Trade = Tables<"trades">;

type Mode = "paper" | "live";

export function EngineManager({
  instances,
  nowTick,
  wallet,
  orders,
  trades,
}: {
  instances: EngineInst[];
  nowTick: number;
  wallet: WalletRow | null;
  orders: OrderIntent[];
  trades: Trade[];
}) {
  const byMode = useMemo(() => {
    const paper = instances.find((i) => (i.engine_mode ?? "").toLowerCase() === "paper") ?? null;
    const live = instances.find((i) => (i.engine_mode ?? "").toLowerCase() === "live") ?? null;
    return { paper, live };
  }, [instances]);

  const openPositions = useMemo(() => trades.filter((t) => t.status === "OPEN").length, [trades]);
  const activeOrders = useMemo(
    () =>
      orders.filter((o) =>
        ["created", "submitting", "submitted", "resting", "pending"].includes(o.status),
      ).length,
    [orders],
  );

  // PnL split by mode. Trades carry a `mode` column populated by the engine.
  const pnlByMode = useMemo(() => {
    const acc: Record<Mode, { daily: number; total: number }> = {
      paper: { daily: 0, total: 0 },
      live: { daily: 0, total: 0 },
    };
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayMs = dayStart.getTime();
    for (const t of trades) {
      const raw = String(t.mode ?? "").toUpperCase();
      const m: Mode | null = raw.startsWith("LIVE") ? "live" : raw.startsWith("PAPER") ? "paper" : null;
      if (!m) continue;
      const p = Number(t.pnl ?? 0);
      acc[m].total += p;
      if (new Date(t.created_at).getTime() >= dayMs) acc[m].daily += p;
    }
    return acc;
  }, [trades]);

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cpu className="h-4 w-4" /> Engine Manager
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          <EngineModeCard
            mode="paper"
            label="PAPER_V1"
            inst={byMode.paper}
            nowTick={nowTick}
            wallet={wallet}
            activeOrders={activeOrders}
            openPositions={openPositions}
            pnl={pnlByMode.paper}
          />
          <EngineModeCard
            mode="live"
            label="LIVE_V2"
            inst={byMode.live}
            nowTick={nowTick}
            wallet={wallet}
            activeOrders={activeOrders}
            openPositions={openPositions}
            pnl={pnlByMode.live}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function EngineModeCard({
  mode,
  label,
  inst,
  nowTick,
  wallet,
  activeOrders,
  openPositions,
  pnl,
}: {
  mode: Mode;
  label: string;
  inst: EngineInst | null;
  nowTick: number;
  wallet: WalletRow | null;
  activeOrders: number;
  openPositions: number;
  pnl: { daily: number; total: number };
}) {
  const control = useServerFn(controlEngine);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: "start" | "stop" | "restart" | "reconnect") {
    if (busy) return;
    setBusy(action);
    try {
      const res = await control({ data: { action, mode } });
      if (res.ok) toast.success(`${label}: ${action} sent`);
      else toast.error(`${label}: ${res.error}`);
    } catch (err) {
      toast.error(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  const beat = inst?.last_heartbeat ? nowTick - new Date(inst.last_heartbeat).getTime() : null;
  const running =
    !!inst &&
    beat !== null &&
    beat < 60_000 &&
    (inst.engine_status ?? "").toLowerCase() !== "stopped";
  const state = !inst
    ? "not registered"
    : beat === null
      ? "idle"
      : running
        ? "running"
        : beat < 5 * 60_000
          ? "reconnecting"
          : "stopped";

  const stateColor =
    state === "running"
      ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
      : state === "reconnecting"
        ? "bg-yellow-500/15 text-yellow-500 border-yellow-500/30"
        : state === "not registered"
          ? "bg-muted text-muted-foreground"
          : "bg-red-500/15 text-red-500 border-red-500/30";

  const mem =
    inst?.memory_used_mb != null && inst?.memory_total_mb
      ? `${fmtNum(Number(inst.memory_used_mb), 0)} / ${fmtNum(Number(inst.memory_total_mb), 0)} MB`
      : inst?.memory_used_mb != null
        ? `${fmtNum(Number(inst.memory_used_mb), 0)} MB`
        : "—";

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{label}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {inst?.instance_id ?? `${mode} · awaiting registration`}
          </p>
        </div>
        <Badge variant="outline" className={`text-[10px] uppercase ${stateColor}`}>
          {state}
        </Badge>
      </div>

      {!inst ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No engine has registered for {mode.toUpperCase()} yet. Start the engine with
          <code className="mx-1 rounded bg-muted px-1">ENGINE_MODE={mode}</code> and confirm it
          posts to <code className="rounded bg-muted px-1">/api/public/engine/register</code>.
        </p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <Field label="Status" value={inst.engine_status ?? "—"} />
          <Field label="Heartbeat" value={inst.last_heartbeat ? fmtAgo(inst.last_heartbeat) : "—"} />
          <Field label="Feed" value={feedShort(inst)} />
          <Field label="WebSocket" value={wsShort(inst)} />
          <Field label="Market" value={inst.current_market_id ? String(inst.current_market_id).slice(0, 14) : "—"} />
          <Field label="Strategy" value={inst.active_strategy ?? "—"} />
          <Field label="Uptime" value={inst.uptime_seconds ? fmtUptime(Number(inst.uptime_seconds)) : "—"} />
          <Field label="Wallet" value={fmtUsd(Number(wallet?.balance_usdc ?? 0))} />
          <Field label="Active orders" value={fmtNum(activeOrders)} />
          <Field label="Positions" value={fmtNum(openPositions)} />
          <Field
            label="Today's PnL"
            value={<span className={pnl.daily >= 0 ? "text-emerald-500" : "text-red-500"}>{fmtUsd(pnl.daily)}</span>}
          />
          <Field
            label="Total PnL"
            value={<span className={pnl.total >= 0 ? "text-emerald-500" : "text-red-500"}>{fmtUsd(pnl.total)}</span>}
          />
          <Field label="Version" value={inst.engine_version ?? "—"} />
          <Field label="Commit" value={inst.git_commit ? String(inst.git_commit).slice(0, 8) : "—"} />
          <Field label="CPU" value={inst.cpu_percent != null ? `${fmtNum(Number(inst.cpu_percent), 1)}%` : "—"} />
          <Field label="Memory" value={mem} />
          <Field label="Latency" value={fmtMs(inst.heartbeat_latency_ms ?? null)} />
          <Field label="Host" value={inst.host_name ?? "—"} />
        </dl>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="default" disabled={!!busy || running} onClick={() => run("start")}>
          {busy === "start" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
          Start
        </Button>
        <Button size="sm" variant="outline" disabled={!!busy || !running} onClick={() => run("stop")}>
          {busy === "stop" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Square className="mr-1.5 h-3.5 w-3.5" />}
          Stop
        </Button>
        <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("restart")}>
          {busy === "restart" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
          Restart
        </Button>
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run("reconnect")}>
          {busy === "reconnect" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PlugZap className="mr-1.5 h-3.5 w-3.5" />}
          Reconnect
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </>
  );
}

function fmtUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function feedShort(inst: EngineInst): string {
  const meta = inst.meta as Record<string, unknown> | null;
  const v = meta && typeof meta === "object" ? meta["feed_status"] : null;
  return v ? String(v) : "—";
}

function wsShort(inst: EngineInst): string {
  const meta = inst.meta as Record<string, unknown> | null;
  const v = meta && typeof meta === "object" ? meta["ws_status"] : null;
  return v ? String(v) : "—";
}
