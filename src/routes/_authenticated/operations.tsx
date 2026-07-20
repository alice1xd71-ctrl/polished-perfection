import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RealtimeIndicator } from "@/components/app/realtime-indicator";
import { StatCard, DataCard } from "@/components/app/data-card";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Activity, Cpu, Download, HardDrive, Radio, RefreshCw, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList, type RealtimeStatus } from "@/hooks/use-realtime";
import type { Tables } from "@/integrations/supabase/types";
import { fmtAgo, fmtMs, fmtNum } from "@/lib/format";
import { exportCsv, exportJson, timestampedName } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/operations")({
  head: () => ({
    meta: [{ title: "Operations — P4 Bot" }, { name: "robots", content: "noindex" }],
  }),
  component: OperationsPage,
});

type EngineEvent = Tables<"engine_events">;
type EngineInst = Tables<"engine_instances">;
type Feed = Tables<"engine_feed_status">;
type Heartbeat = Tables<"engine_heartbeats">;
type Notif = Tables<"notifications">;

const sevClass: Record<string, string> = {
  info: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  warning: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  error: "bg-red-500/15 text-red-500 border-red-500/30",
  critical: "bg-red-600 text-white border-red-600",
};

function OperationsPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const events = useRealtimeList<EngineEvent>("engine_events", userId, {
    orderBy: { column: "timestamp", ascending: false },
    limit: 200,
  });
  const instances = useRealtimeList<EngineInst>("engine_instances", userId, {
    orderBy: { column: "last_heartbeat", ascending: false },
    limit: 20,
  });
  const feeds = useRealtimeList<Feed, "feed">("engine_feed_status", userId, {
    primaryKey: "feed",
    orderBy: { column: "feed", ascending: true },
    limit: 20,
  });
  const heartbeats = useRealtimeList<Heartbeat, "user_id">("engine_heartbeats", userId, {
    primaryKey: "user_id",
    orderBy: { column: "last_seen_at", ascending: false },
    limit: 1,
  });
  const notifications = useRealtimeList<Notif>("notifications", userId, {
    orderBy: { column: "ts_ms", ascending: false },
    limit: 50,
  });

  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [q, setQ] = useState("");
  const [sevFilter, setSevFilter] = useState<string>("all");

  const combinedStatus = useMemo<RealtimeStatus>(() => {
    const all = [events.status, instances.status, feeds.status, notifications.status];
    if (all.some((s) => s === "error")) return "error";
    if (all.some((s) => s === "connecting")) return "connecting";
    if (all.every((s) => s === "connected")) return "connected";
    return "idle";
  }, [events.status, instances.status, feeds.status, notifications.status]);

  const filteredEvents = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.rows.filter((e) => {
      if (sevFilter !== "all" && e.severity !== sevFilter) return false;
      if (!needle) return true;
      return (
        e.event_type.toLowerCase().includes(needle) ||
        (e.message ?? "").toLowerCase().includes(needle) ||
        (e.source ?? "").toLowerCase().includes(needle)
      );
    });
  }, [events.rows, q, sevFilter]);

  const primary = instances.rows[0] ?? null;
  const beat = heartbeats.rows[0];
  const beatMs = beat?.last_seen_at ? nowTick - new Date(beat.last_seen_at).getTime() : null;
  const engineHealthy = beatMs !== null && beatMs < 60_000;

  const restartCount = instances.rows.reduce((s, i) => s + (i.restart_count ?? 0), 0);
  const errorEvents24h = useMemo(() => {
    const cutoff = nowTick - 24 * 3600 * 1000;
    return events.rows.filter(
      (e) => new Date(e.timestamp).getTime() >= cutoff && (e.severity === "error" || e.severity === "critical"),
    ).length;
  }, [events.rows, nowTick]);

  function exportEvents(fmt: "csv" | "json") {
    const data = filteredEvents.map((e) => ({
      timestamp: e.timestamp,
      event_type: e.event_type,
      severity: e.severity,
      source: e.source,
      instance_id: e.instance_id,
      message: e.message,
      correlation_id: e.correlation_id,
      execution_id: e.execution_id,
      duration_ms: e.duration_ms,
      metadata: e.metadata,
    }));
    if (fmt === "csv") exportCsv(timestampedName("engine_events", "csv"), data);
    else exportJson(timestampedName("engine_events", "json"), data);
  }

  return (
    <>
      <PageHeader
        title="Operations"
        description="Realtime engine health, lifecycle events, and instance telemetry."
        actions={
          <div className="flex items-center gap-2">
            <RealtimeIndicator status={combinedStatus} />
            <Button variant="outline" size="sm" onClick={() => events.refetch()}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Refresh
            </Button>
          </div>
        }
      />

      {/* Status strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Engine"
          value={engineHealthy ? "Online" : beatMs === null ? "Idle" : "Down"}
          hint={beat?.last_seen_at ? `beat ${fmtAgo(beat.last_seen_at)}` : "no heartbeat"}
        />
        <StatCard label="Instances" value={fmtNum(instances.rows.length)} hint={`${restartCount} total restarts`} />
        <StatCard label="Feeds" value={fmtNum(feeds.rows.length)} hint={feedsHint(feeds.rows)} />
        <StatCard label="Errors 24h" value={fmtNum(errorEvents24h)} hint="critical + error events" />
      </div>

      {/* Engine instances */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4" /> Engine instances
          </CardTitle>
        </CardHeader>
        <CardContent>
          {instances.rows.length === 0 ? (
            <EmptyState icon={Cpu} title="No engine instances" description="The Node.js trading engine has not registered yet." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {instances.rows.map((inst) => (
                <InstanceCard key={inst.id} inst={inst} nowTick={nowTick} primary={primary?.id === inst.id} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feed + notification stream */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className="h-4 w-4" /> Feed & WebSocket status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {feeds.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No feeds reported.</p>
            ) : (
              <ul className="divide-y">
                {feeds.rows.map((f) => (
                  <li key={f.feed} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{f.feed}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.last_message_at ? `msg ${fmtAgo(f.last_message_at)}` : "no messages"} · {fmtMs(f.latency_ms ?? null)}
                      </p>
                      {readErr(f) && <p className="mt-0.5 truncate text-xs text-red-500">{readErr(f)}</p>}
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
              <HardDrive className="h-4 w-4" /> Recent notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notifications.</p>
            ) : (
              <ul className="divide-y">
                {notifications.rows.slice(0, 10).map((n) => (
                  <li key={n.id} className="py-2 text-sm">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-medium">{n.title}</p>
                      <Badge variant="outline" className={`text-[10px] ${sevClass[n.severity] ?? ""}`}>{n.severity}</Badge>
                    </div>
                    {n.body && <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{n.source} · {fmtAgo(Number(n.ts_ms))}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event stream */}
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4" /> Engine events
          </CardTitle>
          <div className="flex items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search events…"
              className="h-8 w-48"
            />
            <select
              value={sevFilter}
              onChange={(e) => setSevFilter(e.target.value)}
              className="h-8 rounded border bg-background px-2 text-sm"
            >
              <option value="all">All severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => exportEvents("csv")}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => exportEvents("json")}>JSON</Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <EmptyState icon={Activity} title="No events" description="The engine has not emitted any lifecycle events yet." />
          ) : (
            <DataCard className="max-h-[520px] overflow-auto">
              <ul className="divide-y">
                {filteredEvents.map((e) => (
                  <li key={e.id} className="grid grid-cols-[110px_100px_1fr_120px] items-baseline gap-3 px-3 py-2 text-sm">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                    <Badge variant="outline" className={`text-[10px] ${sevClass[e.severity] ?? ""}`}>
                      {e.severity}
                    </Badge>
                    <div className="min-w-0">
                      <p className="truncate">
                        <span className="font-medium">{e.event_type}</span>
                        {e.message && <span className="text-muted-foreground"> — {e.message}</span>}
                      </p>
                      {(e.correlation_id || e.execution_id) && (
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {e.execution_id && <>exec {String(e.execution_id).slice(0, 8)} </>}
                          {e.correlation_id && <>· corr {String(e.correlation_id).slice(0, 8)}</>}
                        </p>
                      )}
                    </div>
                    <span className="text-right text-[11px] text-muted-foreground">
                      {e.source}{e.duration_ms != null && ` · ${e.duration_ms}ms`}
                    </span>
                  </li>
                ))}
              </ul>
            </DataCard>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function feedsHint(feeds: Feed[]): string {
  if (feeds.length === 0) return "no feeds";
  const down = feeds.filter((f) => f.status.toLowerCase() === "disconnected").length;
  const deg = feeds.filter((f) => f.status.toLowerCase() === "degraded").length;
  if (down === 0 && deg === 0) return "all healthy";
  return `${down} down · ${deg} degraded`;
}

function FeedBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "connected") return <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20">connected</Badge>;
  if (s === "degraded") return <Badge className="bg-yellow-500/15 text-yellow-500 hover:bg-yellow-500/20">degraded</Badge>;
  if (s === "disconnected") return <Badge variant="destructive">disconnected</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

function InstanceCard({ inst, nowTick, primary }: { inst: EngineInst; nowTick: number; primary: boolean }) {
  const beat = inst.last_heartbeat ? nowTick - new Date(inst.last_heartbeat).getTime() : null;
  const state =
    beat === null ? "idle" : beat < 60_000 ? "online" : beat < 5 * 60_000 ? "reconnecting" : "offline";
  const stateColor =
    state === "online" ? "bg-emerald-500/15 text-emerald-500" :
    state === "reconnecting" ? "bg-yellow-500/15 text-yellow-500" :
    state === "offline" ? "bg-red-500/15 text-red-500" : "bg-muted";
  const mem = inst.memory_used_mb != null && inst.memory_total_mb
    ? `${fmtNum(Number(inst.memory_used_mb), 0)} / ${fmtNum(Number(inst.memory_total_mb), 0)} MB`
    : inst.memory_used_mb != null ? `${fmtNum(Number(inst.memory_used_mb), 0)} MB` : "—";
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {inst.instance_name ?? inst.instance_id}
            {primary && <Badge variant="outline" className="ml-2 text-[10px]">PRIMARY</Badge>}
          </p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">{inst.instance_id}</p>
        </div>
        <Badge className={`text-[10px] uppercase ${stateColor}`}>{state}</Badge>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <Field label="Mode" value={inst.engine_mode ?? "—"} />
        <Field label="Status" value={inst.engine_status ?? "—"} />
        <Field label="Version" value={inst.engine_version ?? "—"} />
        <Field label="Commit" value={inst.git_commit ? String(inst.git_commit).slice(0, 8) : "—"} />
        <Field label="Host" value={inst.host_name ?? "—"} />
        <Field label="Region" value={inst.region ?? "—"} />
        <Field label="Strategy" value={inst.active_strategy ?? "—"} />
        <Field label="Market" value={inst.current_market_id ? String(inst.current_market_id).slice(0, 12) : "—"} />
        <Field label="Uptime" value={inst.uptime_seconds ? fmtUptime(Number(inst.uptime_seconds)) : "—"} />
        <Field label="Restarts" value={String(inst.restart_count ?? 0)} />
        <Field label="Memory" value={mem} />
        <Field label="CPU" value={inst.cpu_percent != null ? `${fmtNum(Number(inst.cpu_percent), 1)}%` : "—"} />
        <Field label="Beat" value={inst.last_heartbeat ? fmtAgo(inst.last_heartbeat) : "—"} />
        <Field label="Latency" value={fmtMs(inst.heartbeat_latency_ms ?? null)} />
      </dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
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
