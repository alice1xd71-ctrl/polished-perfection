import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { RealtimeIndicator } from "@/components/app/realtime-indicator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList } from "@/hooks/use-realtime";
import type { Tables } from "@/integrations/supabase/types";
import { fmtAgo, fmtCountdown, fmtPrice } from "@/lib/format";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/markets")({
  head: () => ({ meta: [{ title: "Markets — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: MarketsPage,
});

type Btc5m = Tables<"btc5m_markets">;

function MarketsPage() {
  const { user } = useAuth();
  const { rows, loading, error, status, refetch } = useRealtimeList<Btc5m>(
    "btc5m_markets",
    user?.id,
    { orderBy: { column: "slot_end_ms", ascending: true }, limit: 200 },
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <PageHeader
        title="BTC 5-Minute Markets"
        description="Every Bitcoin 5-minute market the engine is tracking."
        actions={<RealtimeIndicator status={status} />}
      />
      <TableView
        columns={[
          { key: "market_id", header: "Market", render: (r) => <span className="font-mono text-xs">{String(r.market_id)}</span> },
          { key: "question", header: "Question", render: (r) => <span className="truncate">{String(r.question ?? r.slug ?? "—")}</span> },
          { key: "status", header: "Status", render: (r) => <Badge variant="outline">{String(r.status)}</Badge> },
          { key: "eligible", header: "Eligible", render: (r) => (r.eligible ? <Badge className="bg-emerald-500/15 text-emerald-500">yes</Badge> : <Badge variant="destructive">no</Badge>) },
          { key: "best_bid_yes", header: "Bid YES", render: (r) => fmtPrice(Number(r.best_bid_yes)) },
          { key: "best_ask_yes", header: "Ask YES", render: (r) => fmtPrice(Number(r.best_ask_yes)) },
          { key: "last_price_yes", header: "Last YES", render: (r) => fmtPrice(Number(r.last_price_yes)) },
          { key: "slot_end_ms", header: "Closes in", render: (r) => {
            const end = Number(r.slot_end_ms);
            const remaining = Math.max(0, end - now);
            return remaining > 0 ? fmtCountdown(remaining) : "closed";
          } },
          { key: "last_tick_at", header: "Last tick", render: (r) => fmtAgo(r.last_tick_at as string | null) },
          { key: "ineligible_reason", header: "Reason", render: (r) => r.ineligible_reason ? <span className="text-red-500">{String(r.ineligible_reason)}</span> : "—" },
        ]}
        rows={rows as unknown as Record<string, unknown>[]}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="No BTC 5-minute markets tracked yet"
        emptyDescription="Markets will populate as the engine discovers eligible slots."
      />
    </>
  );
}
