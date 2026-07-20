import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/data-card";
import { TableView } from "@/components/app/table-view";
import { RealtimeIndicator } from "@/components/app/realtime-indicator";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList } from "@/hooks/use-realtime";
import type { Tables } from "@/integrations/supabase/types";
import { fmtAgo, fmtMs, fmtNum, fmtPrice } from "@/lib/format";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: AnalyticsPage,
});

type Latency = Tables<"latency_samples">;

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function AnalyticsPage() {
  const { user } = useAuth();
  const { rows, loading, error, status, refetch } = useRealtimeList<Latency>(
    "latency_samples",
    user?.id,
    { orderBy: { column: "ts_ms", ascending: false }, limit: 500 },
  );

  const stats = useMemo(() => {
    const totals = rows.map((r) => r.total_ms).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    return {
      count: rows.length,
      p50: percentile(totals, 50),
      p95: percentile(totals, 95),
      p99: percentile(totals, 99),
    };
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Execution latency distribution across all recorded orders."
        actions={<RealtimeIndicator status={status} />}
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Samples" value={fmtNum(stats.count)} />
        <StatCard label="p50 total" value={fmtMs(stats.p50)} />
        <StatCard label="p95 total" value={fmtMs(stats.p95)} />
        <StatCard label="p99 total" value={fmtMs(stats.p99)} />
      </div>
      <div className="mt-6">
        <TableView
          title="Recent latency samples"
          columns={[
            { key: "ts_ms", header: "When", render: (r) => fmtAgo(Number(r.ts_ms)) },
            { key: "market_id", header: "Market", render: (r) => <span className="font-mono text-xs">{String(r.market_id)}</span> },
            { key: "decision_ms", header: "Decision", render: (r) => fmtMs(Number(r.decision_ms)) },
            { key: "pre_submit_ms", header: "Pre-submit", render: (r) => fmtMs(Number(r.pre_submit_ms)) },
            { key: "submit_ms", header: "Submit", render: (r) => fmtMs(Number(r.submit_ms)) },
            { key: "fill_check_ms", header: "Fill check", render: (r) => fmtMs(Number(r.fill_check_ms)) },
            { key: "fill_observed_ms", header: "Fill observed", render: (r) => r.fill_observed_ms === null ? "—" : fmtMs(Number(r.fill_observed_ms)) },
            { key: "total_ms", header: "Total", render: (r) => fmtMs(Number(r.total_ms)) },
            { key: "filled_price", header: "Fill px", render: (r) => r.filled_price === null ? "—" : fmtPrice(Number(r.filled_price)) },
          ]}
          rows={rows as unknown as Record<string, unknown>[]}
          loading={loading}
          error={error}
          onRetry={refetch}
          emptyTitle="No latency samples"
        />
      </div>
    </>
  );
}
