import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { useSupabaseList } from "@/hooks/use-supabase-query";

export const Route = createFileRoute("/_authenticated/markets")({
  head: () => ({ meta: [{ title: "Markets — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: MarketsPage,
});

function MarketsPage() {
  // Distinct markets appear in order_intents and trades — placeholder view.
  const { data, loading, error, refetch } = useSupabaseList<{ market_id: string | null; symbol: string | null; created_at: string }>(
    "order_intents",
    { select: "market_id,symbol,created_at", limit: 100, orderBy: { column: "created_at" } },
  );

  return (
    <>
      <PageHeader title="Markets" description="Markets discovered by the trading engine." />
      <TableView
        columns={[
          { key: "symbol", header: "Symbol" },
          { key: "market_id", header: "Market ID" },
          { key: "created_at", header: "First seen" },
        ]}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="No markets yet"
        emptyDescription="Markets will populate once the engine begins scanning Polymarket."
      />
    </>
  );
}
