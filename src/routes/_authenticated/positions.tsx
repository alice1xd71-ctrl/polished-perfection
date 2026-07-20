import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { RealtimeIndicator } from "@/components/app/realtime-indicator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList } from "@/hooks/use-realtime";
import type { Tables } from "@/integrations/supabase/types";
import { fmtAgo, fmtNum, fmtPrice, fmtUsd } from "@/lib/format";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/positions")({
  head: () => ({ meta: [{ title: "Positions — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: PositionsPage,
});

type Trade = Tables<"trades">;

function PositionsPage() {
  const { user } = useAuth();
  const { rows, loading, error, status, refetch } = useRealtimeList<Trade>(
    "trades",
    user?.id,
    { orderBy: { column: "created_at", ascending: false }, limit: 500 },
  );

  const open = useMemo(() => rows.filter((r) => r.status === "OPEN"), [rows]);

  return (
    <>
      <PageHeader
        title="Positions"
        description="Currently open trades not yet settled."
        actions={<RealtimeIndicator status={status} />}
      />
      <TableView
        columns={[
          { key: "market_id", header: "Market", render: (r) => <span className="font-mono text-xs">{String(r.market_id)}</span> },
          { key: "side", header: "Side", render: (r) => <Badge variant="outline">{String(r.side)}</Badge> },
          { key: "shares", header: "Shares", render: (r) => fmtNum(Number(r.shares), 2) },
          { key: "price", header: "Entry", render: (r) => fmtPrice(Number(r.price)) },
          { key: "mark_price", header: "Mark", render: (r) => r.mark_price === null ? "—" : fmtPrice(Number(r.mark_price)) },
          { key: "cost", header: "Cost", render: (r) => fmtUsd(Number(r.cost)) },
          { key: "unrealized_pnl", header: "Unrealized", render: (r) => {
            const v = r.unrealized_pnl === null ? null : Number(r.unrealized_pnl);
            return v === null ? "—" : <span className={v >= 0 ? "text-emerald-500" : "text-red-500"}>{fmtUsd(v)}</span>;
          } },
          { key: "entry_at_ms", header: "Since", render: (r) => r.entry_at_ms ? fmtAgo(Number(r.entry_at_ms)) : "—" },
        ]}
        rows={open as unknown as Record<string, unknown>[]}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="No open positions"
      />
    </>
  );
}
