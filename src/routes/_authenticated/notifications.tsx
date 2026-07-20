import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { RealtimeIndicator } from "@/components/app/realtime-indicator";
import { EmptyState } from "@/components/app/empty-state";
import { DataCard } from "@/components/app/data-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, CheckCheck, Check, Download, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList } from "@/hooks/use-realtime";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fmtAgo } from "@/lib/format";
import { exportCsv, exportJson, timestampedName } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: NotificationsPage,
});

type Notif = Tables<"notifications">;

const sevClass: Record<string, string> = {
  info: "bg-sky-500/15 text-sky-500",
  warning: "bg-yellow-500/15 text-yellow-500",
  error: "bg-red-500/15 text-red-500",
  critical: "bg-red-600 text-white",
};

function NotificationsPage() {
  const { user } = useAuth();
  const { rows, loading, status, refetch } = useRealtimeList<Notif>(
    "notifications",
    user?.id,
    { orderBy: { column: "ts_ms", ascending: false }, limit: 500 },
  );

  const [q, setQ] = useState("");
  const [sevFilter, setSevFilter] = useState<string>("all");
  const [showRead, setShowRead] = useState(true);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((n) => {
      if (!showRead && n.read_at) return false;
      if (sevFilter !== "all" && n.severity !== sevFilter) return false;
      if (!needle) return true;
      return (
        n.title.toLowerCase().includes(needle) ||
        (n.body ?? "").toLowerCase().includes(needle) ||
        n.source.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, sevFilter, showRead]);

  // Critical unacknowledged first
  const pinned = useMemo(
    () => filtered.filter((n) => n.severity === "critical" && n.requires_ack && !n.acknowledged_at),
    [filtered],
  );
  const rest = useMemo(
    () => filtered.filter((n) => !(n.severity === "critical" && n.requires_ack && !n.acknowledged_at)),
    [filtered],
  );

  async function markAllRead() {
    if (!user?.id) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    refetch();
  }
  async function markRead(id: number) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    refetch();
  }
  async function acknowledge(id: number) {
    if (!user?.id) return;
    await supabase
      .from("notifications")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: user.id, read_at: new Date().toISOString() })
      .eq("id", id);
    refetch();
  }
  async function clearAll() {
    if (!user?.id) return;
    if (!confirm("Delete all read, non-critical notifications?")) return;
    await supabase.from("notifications").delete().eq("user_id", user.id).not("read_at", "is", null).neq("severity", "critical");
    refetch();
  }

  function doExport(fmt: "csv" | "json") {
    const data = filtered.map((n) => ({
      id: n.id, ts_ms: n.ts_ms, severity: n.severity, source: n.source, category: n.category,
      title: n.title, body: n.body, requires_ack: n.requires_ack, acknowledged_at: n.acknowledged_at,
      read_at: n.read_at, metadata: n.metadata,
    }));
    if (fmt === "csv") exportCsv(timestampedName("notifications", "csv"), data);
    else exportJson(timestampedName("notifications", "json"), data);
  }

  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={`${unread} unread · ${pinned.length} require acknowledgement · ${rows.length} total`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RealtimeIndicator status={status} />
            <Button variant="outline" size="sm" onClick={markAllRead} disabled={unread === 0}>
              <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all read
            </Button>
            <Button variant="outline" size="sm" onClick={() => doExport("csv")} disabled={rows.length === 0}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => doExport("json")} disabled={rows.length === 0}>JSON</Button>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={rows.length === 0}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Clear read
            </Button>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8 w-56" />
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} className="h-8 rounded border bg-background px-2 text-sm">
          <option value="all">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={showRead} onChange={(e) => setShowRead(e.target.checked)} />
          Show read
        </label>
      </div>

      <DataCard>
        {loading && rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="Engine alerts and system messages appear here." />
        ) : (
          <ul className="divide-y">
            {pinned.length > 0 && (
              <li className="bg-red-500/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-red-500">
                Critical — acknowledgement required
              </li>
            )}
            {pinned.map((n) => <Item key={n.id} n={n} onAck={acknowledge} onRead={markRead} />)}
            {rest.map((n) => <Item key={n.id} n={n} onAck={acknowledge} onRead={markRead} />)}
          </ul>
        )}
      </DataCard>
    </>
  );
}

function Item({
  n, onAck, onRead,
}: {
  n: Notif;
  onAck: (id: number) => void;
  onRead: (id: number) => void;
}) {
  const needsAck = n.severity === "critical" && n.requires_ack && !n.acknowledged_at;
  return (
    <li className={`flex items-start gap-3 px-4 py-3 ${n.read_at && !needsAck ? "opacity-70" : ""}`}>
      <span className={`mt-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sevClass[n.severity] ?? sevClass.info}`}>
        {n.severity}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-medium">{n.title}</p>
          <span className="text-xs text-muted-foreground">{fmtAgo(Number(n.ts_ms))}</span>
        </div>
        {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">{n.source}</Badge>
          <span>{n.category}</span>
          {n.acknowledged_at && (
            <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
              acked {fmtAgo(n.acknowledged_at)}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {needsAck ? (
          <Button size="sm" variant="destructive" onClick={() => onAck(n.id)}>
            <Check className="mr-1 h-3.5 w-3.5" /> Acknowledge
          </Button>
        ) : !n.read_at ? (
          <Button size="sm" variant="ghost" onClick={() => onRead(n.id)}>
            <Check className="mr-1 h-3.5 w-3.5" /> Read
          </Button>
        ) : null}
      </div>
    </li>
  );
}
