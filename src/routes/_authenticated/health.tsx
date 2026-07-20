import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { StatCard } from "@/components/app/data-card";
import { RealtimeIndicator } from "@/components/app/realtime-indicator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList } from "@/hooks/use-realtime";
import type { Tables } from "@/integrations/supabase/types";
import { fmtAgo, fmtMs } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/health")({
  head: () => ({ meta: [{ title: "Health — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: HealthPage,
});

type Heartbeat = Tables<"engine_heartbeats">;
type Feed = Tables<"engine_feed_status">;
type Audit = Tables<"audit_log">;

function HealthPage() {
  const { user } = useAuth();
  const heartbeat = useRealtimeList<Heartbeat, "user_id">("engine_heartbeats", user?.id, {
    primaryKey: "user_id",
    orderBy: { column: "last_seen_at", ascending: false },
    limit: 1,
  });
  const feeds = useRealtimeList<Feed, "feed">("engine_feed_status", user?.id, {
    primaryKey: "feed",
    orderBy: { column: "feed", ascending: true },
    limit: 50,
  });
  const audit = useRealtimeList<Audit>("audit_log", user?.id, {
    orderBy: { column: "ts_ms", ascending: false },
    limit: 200,
  });

  const beat = heartbeat.rows[0];
  const ageMs = beat?.last_seen_at ? Date.now() - new Date(beat.last_seen_at).getTime() : null;
  const healthy = ageMs !== null && ageMs < 60_000;

  return (
    <>
      <PageHeader
        title="Health Monitor"
        description="Engine heartbeat, feed connectivity, and recent alerts."
        actions={<RealtimeIndicator status={heartbeat.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Engine"
          value={ageMs === null ? "no beat" : healthy ? "healthy" : "stale"}
          hint={beat?.last_seen_at ? `beat ${fmtAgo(beat.last_seen_at)}` : "waiting for heartbeat"}
        />
        <StatCard label="Mode" value={beat?.mode ?? "—"} hint={beat?.version ?? undefined} />
        <StatCard label="Feeds tracked" value={feeds.rows.length.toString()} />
      </div>

      <div className="mt-6">
        <TableView
          title="Feed status"
          columns={[
            { key: "feed", header: "Feed" },
            { key: "status", header: "Status", render: (r) => <Badge variant="outline">{String(r.status)}</Badge> },
            { key: "last_message_at", header: "Last msg", render: (r) => fmtAgo(r.last_message_at as string | null) },
            { key: "latency_ms", header: "Latency", render: (r) => fmtMs(r.latency_ms as number | null) },
          ]}
          rows={feeds.rows as unknown as Record<string, unknown>[]}
          loading={feeds.loading}
          error={feeds.error}
          onRetry={feeds.refetch}
          emptyTitle="No feed status reported"
        />
      </div>

      <div className="mt-6">
        <TableView
          title="Audit log"
          description="Warnings, errors, and operational events."
          columns={[
            { key: "ts_ms", header: "When", render: (r) => fmtAgo(Number(r.ts_ms)) },
            { key: "level", header: "Level", render: (r) => {
              const lvl = String(r.level).toLowerCase();
              const cls = lvl === "error" ? "destructive" : lvl === "warn" ? "outline" : "outline";
              return <Badge variant={cls as "destructive" | "outline"}>{String(r.level)}</Badge>;
            } },
            { key: "category", header: "Category" },
            { key: "message", header: "Message" },
          ]}
          rows={audit.rows as unknown as Record<string, unknown>[]}
          loading={audit.loading}
          error={audit.error}
          onRetry={audit.refetch}
          emptyTitle="No audit events"
        />
      </div>
    </>
  );
}
