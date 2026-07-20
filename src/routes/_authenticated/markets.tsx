import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { useSupabaseList } from "@/hooks/use-supabase-query";

export const Route = createFileRoute("/_authenticated/markets")({
  head: () => ({ meta: [{ title: "Markets — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: MarketsPage,
});

function MarketsPage() {
  const { data, loading, error, refetch } = useSupabaseList<Record<string, unknown>>(
    "order_intents",
    { select: "market_id,token_id,created_at_ms", limit: 100, orderBy: { column: "created_at_ms" } },
  );

  return (
    <>
      <PageHeader title="Markets" description="Markets discovered by the trading engine." />
      <TableView
        columns={[
          { key: "market_id", header: "Market ID" },
          { key: "token_id", header: "Token" },
          { key: "created_at_ms", header: "First seen (ms)" },
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
