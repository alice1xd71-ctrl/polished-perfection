import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { RealtimeIndicator } from "@/components/app/realtime-indicator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList } from "@/hooks/use-realtime";
import type { Tables } from "@/integrations/supabase/types";
import { fmtAgo, fmtPrice } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ledger")({
  head: () => ({ meta: [{ title: "Ledger — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: LedgerPage,
});

type OrderLog = Tables<"order_log">;

function LedgerPage() {
  const { user } = useAuth();
  const { rows, loading, error, status, refetch } = useRealtimeList<OrderLog>(
    "order_log",
    user?.id,
    { orderBy: { column: "ts_ms", ascending: false }, limit: 500 },
  );

  return (
    <>
      <PageHeader
        title="Ledger"
        description="Every state transition in the order lifecycle."
        actions={<RealtimeIndicator status={status} />}
      />
      <TableView
        columns={[
          { key: "ts_ms", header: "When", render: (r) => fmtAgo(Number(r.ts_ms)) },
          { key: "event", header: "Event", render: (r) => <Badge variant="outline">{String(r.event)}</Badge> },
          { key: "phase", header: "Phase" },
          { key: "market_id", header: "Market", render: (r) => <span className="font-mono text-xs">{String(r.market_id)}</span> },
          { key: "side", header: "Side" },
          { key: "shares", header: "Shares" },
          { key: "price", header: "Price", render: (r) => r.price === null ? "—" : fmtPrice(Number(r.price)) },
          { key: "exchange_order_id", header: "Exchange ID", render: (r) => r.exchange_order_id ? <span className="font-mono text-xs">{String(r.exchange_order_id).slice(0, 10)}</span> : "—" },
        ]}
        rows={rows as unknown as Record<string, unknown>[]}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Ledger empty"
      />
    </>
  );
}
