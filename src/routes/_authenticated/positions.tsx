import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/positions")({
  head: () => ({ meta: [{ title: "Positions — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: PositionsPage,
});

type Position = { market_id: string; net_shares: number; avg_price: number };

function PositionsPage() {
  const [rows, setRows] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("trades")
      .select("market_id,side,shares,price")
      .eq("status", "OPEN");
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const map = new Map<string, { shares: number; cost: number }>();
    for (const t of data ?? []) {
      const cur = map.get(t.market_id) ?? { shares: 0, cost: 0 };
      const dir = t.side === "SELL" ? -1 : 1;
      cur.shares += dir * Number(t.shares ?? 0);
      cur.cost += dir * Number(t.shares ?? 0) * Number(t.price ?? 0);
      map.set(t.market_id, cur);
    }
    setRows(
      Array.from(map.entries()).map(([market_id, v]) => ({
        market_id,
        net_shares: v.shares,
        avg_price: v.shares !== 0 ? v.cost / v.shares : 0,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <PageHeader title="Positions" description="Aggregated exposure derived from open trades." />
      <TableView
        columns={[
          { key: "market_id", header: "Market" },
          { key: "net_shares", header: "Net shares", render: (r) => r.net_shares.toFixed(4) },
          { key: "avg_price", header: "Avg price", render: (r) => r.avg_price.toFixed(4) },
        ]}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        emptyTitle="No open positions"
      />
    </>
  );
}
