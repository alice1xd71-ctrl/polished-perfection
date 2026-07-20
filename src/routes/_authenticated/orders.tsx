import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { useSupabaseList } from "@/hooks/use-supabase-query";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "Orders — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const { data, loading, error, refetch } = useSupabaseList<Record<string, unknown>>(
    "order_intents",
    { limit: 200, orderBy: { column: "created_at" } },
  );

  return (
    <>
      <PageHeader title="Orders" description="Order intents queued for execution." />
      <TableView
        columns={[
          { key: "symbol", header: "Symbol" },
          { key: "side", header: "Side", render: (r) => <Badge variant="outline">{String(r.side ?? "—")}</Badge> },
          { key: "size", header: "Size" },
          { key: "price", header: "Price" },
          { key: "status", header: "Status" },
          { key: "created_at", header: "Created" },
        ]}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="No orders yet"
        emptyDescription="The engine will publish order intents here when strategies activate."
      />
    </>
  );
}
