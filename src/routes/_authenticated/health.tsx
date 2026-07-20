import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { StatCard } from "@/components/app/data-card";
import { useSupabaseList } from "@/hooks/use-supabase-query";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/health")({
  head: () => ({ meta: [{ title: "Health Monitor — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: HealthPage,
});

function HealthPage() {
  const { data, loading, error, refetch } = useSupabaseList<Record<string, unknown>>(
    "engine_heartbeats",
    { limit: 50, orderBy: { column: "created_at" } },
  );
  const latest = data[0] as { created_at?: string; status?: string } | undefined;
  const ageSec = latest?.created_at ? Math.round((Date.now() - new Date(latest.created_at).getTime()) / 1000) : null;
  const healthy = ageSec !== null && ageSec < 60;

  return (
    <>
      <PageHeader
        title="Health Monitor"
        description="Engine heartbeats, feed diagnostics, and watchdog status."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Engine"
          value={ageSec === null ? "unknown" : healthy ? "healthy" : "stale"}
          hint={ageSec === null ? "no heartbeat yet" : `${ageSec}s since last beat`}
        />
        <StatCard label="Last status" value={latest?.status ?? "—"} />
        <StatCard label="Beats logged" value={data.length.toLocaleString()} />
      </div>
      <div className="mt-6">
        <TableView
          title="Recent heartbeats"
          columns={[
            { key: "created_at", header: "Time" },
            { key: "status", header: "Status", render: (r) => <Badge variant="outline">{String(r.status ?? "—")}</Badge> },
            { key: "message", header: "Message" },
          ]}
          rows={data}
          loading={loading}
          error={error}
          onRetry={refetch}
          emptyTitle="No heartbeats yet"
        />
      </div>
    </>
  );
}
