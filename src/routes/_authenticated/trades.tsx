import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { RealtimeIndicator } from "@/components/app/realtime-indicator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList } from "@/hooks/use-realtime";
import type { Tables } from "@/integrations/supabase/types";
import { fmtAgo, fmtNum, fmtPrice, fmtUsd } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/trades")({
  head: () => ({ meta: [{ title: "Trades — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: TradesPage,
});

type Trade = Tables<"trades">;

function TradesPage() {
  const { user } = useAuth();
  const { rows, loading, error, status, refetch } = useRealtimeList<Trade>(
    "trades",
    user?.id,
    { orderBy: { column: "created_at", ascending: false }, limit: 300 },
  );

  return (
    <>
      <PageHeader
        title="Trades"
        description="Every executed trade, paper or live, with settlement and PnL."
        actions={<RealtimeIndicator status={status} />}
      />
      <TableView
        columns={[
          { key: "market_id", header: "Market", render: (r) => <span className="font-mono text-xs">{String(r.market_id)}</span> },
          { key: "side", header: "Side", render: (r) => <Badge variant="outline">{String(r.side)}</Badge> },
          { key: "shares", header: "Shares", render: (r) => fmtNum(Number(r.shares), 2) },
          { key: "price", header: "Price", render: (r) => fmtPrice(Number(r.price)) },
          { key: "mode", header: "Mode" },
          { key: "status", header: "Status", render: (r) => <Badge variant="outline">{String(r.status)}</Badge> },
          { key: "result", header: "Result", render: (r) => <Badge variant="outline">{String(r.result)}</Badge> },
          { key: "pnl", header: "PnL", render: (r) => <span className={Number(r.pnl) >= 0 ? "text-emerald-500" : "text-red-500"}>{fmtUsd(Number(r.pnl))}</span> },
          { key: "created_at", header: "When", render: (r) => fmtAgo(String(r.created_at)) },
        ]}
        rows={rows as unknown as Record<string, unknown>[]}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="No trades yet"
      />
    </>
  );
}
