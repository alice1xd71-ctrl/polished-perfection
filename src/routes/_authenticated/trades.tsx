import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { useSupabaseList } from "@/hooks/use-supabase-query";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/trades")({
  head: () => ({ meta: [{ title: "Trades — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: TradesPage,
});

function TradesPage() {
  const { data, loading, error, refetch } = useSupabaseList<Record<string, unknown>>(
    "trades",
    { limit: 200, orderBy: { column: "created_at" } },
  );

  return (
    <>
      <PageHeader title="Trades" description="Every executed trade, paper or live." />
      <TableView
        columns={[
          { key: "market_id", header: "Market" },
          { key: "side", header: "Side", render: (r) => <Badge variant="outline">{String(r.side ?? "—")}</Badge> },
          { key: "shares", header: "Shares" },
          { key: "price", header: "Price" },
          { key: "mode", header: "Mode" },
          { key: "status", header: "Status" },
          { key: "pnl", header: "PnL" },
          { key: "created_at", header: "When" },
        ]}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="No trades yet"
      />
    </>
  );
}
