import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { RealtimeIndicator } from "@/components/app/realtime-indicator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList } from "@/hooks/use-realtime";
import type { Tables } from "@/integrations/supabase/types";
import { fmtAgo, fmtNum, fmtPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "Orders — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: OrdersPage,
});

type OrderIntent = Tables<"order_intents">;

function OrdersPage() {
  const { user } = useAuth();
  const { rows, loading, error, status, refetch } = useRealtimeList<OrderIntent>(
    "order_intents",
    user?.id,
    { orderBy: { column: "updated_at_ms", ascending: false }, limit: 300 },
  );

  return (
    <>
      <PageHeader
        title="Orders"
        description="Complete order intent lifecycle — created, submitted, resting, filled, failed."
        actions={<RealtimeIndicator status={status} />}
      />
      <TableView
        columns={[
          { key: "client_order_id", header: "Client ID", render: (r) => <span className="font-mono text-xs">{String(r.client_order_id).slice(0, 12)}</span> },
          { key: "market_id", header: "Market", render: (r) => <span className="font-mono text-xs">{String(r.market_id)}</span> },
          { key: "side", header: "Side", render: (r) => <Badge variant="outline">{String(r.side)}</Badge> },
          { key: "shares", header: "Shares", render: (r) => fmtNum(Number(r.shares), 2) },
          { key: "price", header: "Price", render: (r) => fmtPrice(Number(r.price)) },
          { key: "status", header: "Status", render: (r) => <Badge variant="outline">{String(r.status)}</Badge> },
          { key: "mode", header: "Mode" },
          { key: "attempts", header: "Attempts" },
          { key: "updated_at_ms", header: "Updated", render: (r) => fmtAgo(Number(r.updated_at_ms)) },
          { key: "last_error", header: "Reason", render: (r) => r.last_error ? <span className="text-red-500">{String(r.last_error)}</span> : "—" },
        ]}
        rows={rows as unknown as Record<string, unknown>[]}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="No orders yet"
        emptyDescription="Order intents appear here the moment the engine queues an execution."
      />
    </>
  );
}
