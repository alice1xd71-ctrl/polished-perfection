import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { useSupabaseList } from "@/hooks/use-supabase-query";

export const Route = createFileRoute("/_authenticated/ledger")({
  head: () => ({ meta: [{ title: "Ledger — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: LedgerPage,
});

function LedgerPage() {
  const { data, loading, error, refetch } = useSupabaseList<Record<string, unknown>>(
    "order_log",
    { limit: 500, orderBy: { column: "created_at" } },
  );

  return (
    <>
      <PageHeader title="Ledger" description="Immutable order-log entries from the engine." />
      <TableView
        columns={[
          { key: "created_at", header: "Time" },
          { key: "event", header: "Event" },
          { key: "phase", header: "Phase" },
          { key: "market_id", header: "Market" },
          { key: "side", header: "Side" },
          { key: "shares", header: "Shares" },
          { key: "price", header: "Price" },
        ]}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="Ledger is empty"
      />
    </>
  );
}
