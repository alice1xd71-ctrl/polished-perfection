import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/positions")({
  head: () => ({ meta: [{ title: "Positions — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: PositionsPage,
});

type Position = { market_id: string | null; symbol: string | null; net_size: number; avg_price: number };

function PositionsPage() {
  const [rows, setRows] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("trades")
      .select("market_id,symbol,side,size,price")
      .eq("status", "FILLED");
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const map = new Map<string, { size: number; cost: number; symbol: string | null }>();
    for (const t of data ?? []) {
      const k = t.market_id ?? t.symbol ?? "unknown";
      const cur = map.get(k) ?? { size: 0, cost: 0, symbol: t.symbol };
      const dir = t.side === "SELL" ? -1 : 1;
      cur.size += dir * Number(t.size ?? 0);
      cur.cost += dir * Number(t.size ?? 0) * Number(t.price ?? 0);
      map.set(k, cur);
    }
    setRows(
      Array.from(map.entries()).map(([id, v]) => ({
        market_id: id,
        symbol: v.symbol,
        net_size: v.size,
        avg_price: v.size !== 0 ? v.cost / v.size : 0,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <PageHeader title="Positions" description="Aggregated exposure derived from filled trades." />
      <TableView
        columns={[
          { key: "symbol", header: "Symbol" },
          { key: "market_id", header: "Market" },
          { key: "net_size", header: "Net size", render: (r) => r.net_size.toFixed(4) },
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
