import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { useSupabaseList } from "@/hooks/use-supabase-query";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/standing-orders")({
  head: () => ({ meta: [{ title: "Standing Orders — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: StandingOrdersPage,
});

function StandingOrdersPage() {
  const { data, loading, error, refetch } = useSupabaseList<Record<string, unknown>>(
    "order_intents",
    { limit: 200, orderBy: { column: "created_at_ms" } },
  );
  const standing = data.filter((r) => r.status === "OPEN" || r.status === "PENDING" || r.status === "RESTING");

  return (
    <>
      <PageHeader
        title="Standing Orders"
        description="Long-lived limit-order intents watched by the engine."
      />
      <TableView
        columns={[
          { key: "market_id", header: "Market" },
          { key: "side", header: "Side", render: (r) => <Badge variant="outline">{String(r.side ?? "—")}</Badge> },
          { key: "shares", header: "Shares" },
          { key: "price", header: "Limit" },
          { key: "status", header: "Status" },
          { key: "created_at_ms", header: "Created (ms)" },
        ]}
        rows={standing}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="No standing orders"
      />
    </>
  );
}
