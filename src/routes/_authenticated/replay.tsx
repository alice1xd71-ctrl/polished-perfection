import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { useSupabaseList } from "@/hooks/use-supabase-query";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/replay")({
  head: () => ({ meta: [{ title: "Replay — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: ReplayPage,
});

function ReplayPage() {
  const { data, loading, error, refetch } = useSupabaseList<Record<string, unknown>>(
    "audit_log",
    { limit: 500, orderBy: { column: "created_at" } },
  );
  return (
    <>
      <PageHeader
        title="Trade Replay"
        description="Step through the engine's audit log to reconstruct decisions."
      />
      <TableView
        columns={[
          { key: "created_at", header: "When" },
          { key: "level", header: "Level", render: (r) => <Badge variant="outline">{String(r.level ?? "—")}</Badge> },
          { key: "category", header: "Category" },
          { key: "message", header: "Message" },
        ]}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="No audit entries"
      />
    </>
  );
}
