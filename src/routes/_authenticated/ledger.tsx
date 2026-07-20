import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { RealtimeIndicator } from "@/components/app/realtime-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList } from "@/hooks/use-realtime";
import type { Tables } from "@/integrations/supabase/types";
import { fmtAgo, fmtPrice, fmtUsd, fmtNum } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ledger")({
  head: () => ({ meta: [{ title: "Ledger — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: LedgerPage,
});

type Trade = Tables<"trades">;

function LedgerPage() {
  const { user } = useAuth();
  const { rows, loading, error, status, refetch } = useRealtimeList<Trade>(
    "trades",
    user?.id,
    { orderBy: { column: "created_at", ascending: false }, limit: 500 },
  );

  return (
    <>
      <PageHeader
        title="Ledger"
        description="Complete lifecycle of every trade — click a row to open its replay."
        actions={<RealtimeIndicator status={status} />}
      />
      <TableView
        columns={[
          { key: "created_at", header: "When", render: (r) => fmtAgo(String(r.created_at)) },
          { key: "question", header: "Market", render: (r) => (
            <div className="max-w-[280px]">
              <p className="truncate text-sm">{String(r.question ?? r.slug ?? r.market_id)}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">{String(r.market_id)}</p>
            </div>
          )},
          { key: "side", header: "Side", render: (r) => <Badge variant="outline">{String(r.side)}</Badge> },
          { key: "majority_side_at_trigger", header: "Majority@trigger", render: (r) => r.majority_side_at_trigger ?? "—" },
          { key: "trigger_price", header: "Trigger", render: (r) => r.trigger_price == null ? "—" : fmtPrice(Number(r.trigger_price)) },
          { key: "target_buy_price", header: "Target", render: (r) => r.target_buy_price == null ? "—" : fmtPrice(Number(r.target_buy_price)) },
          { key: "price", header: "Fill", render: (r) => fmtPrice(Number(r.price)) },
          { key: "shares", header: "Qty", render: (r) => fmtNum(Number(r.shares), 2) },
          { key: "fees", header: "Fees", render: (r) => r.fees == null ? "—" : fmtUsd(Number(r.fees)) },
          { key: "pnl", header: "Net PnL", render: (r) => (
            <span className={Number(r.pnl) >= 0 ? "text-emerald-500" : "text-red-500"}>{fmtUsd(Number(r.pnl))}</span>
          )},
          { key: "settlement_status", header: "Settlement", render: (r) => r.settlement_status ? <Badge variant="outline">{String(r.settlement_status)}</Badge> : "—" },
          { key: "exchange_order_id", header: "Exchange", render: (r) => r.exchange_order_id ? <span className="font-mono text-[10px]">{String(r.exchange_order_id).slice(0, 10)}</span> : "—" },
          { key: "slug", header: "", render: (r) => r.slug ? (
            <Button asChild size="sm" variant="ghost">
              <a href={`https://polymarket.com/event/${String(r.slug)}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          ) : null },
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
