import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { DataCard, StatCard } from "@/components/app/data-card";
import { EmptyState } from "@/components/app/empty-state";
import { useSupabaseList } from "@/hooks/use-supabase-query";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data: latency, loading } = useSupabaseList<{ latency_ms: number | null }>(
    "latency_samples",
    { select: "latency_ms", limit: 1000, orderBy: { column: "created_at" } },
  );
  const nums = latency.map((l) => Number(l.latency_ms ?? 0)).filter((n) => n > 0);
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  const max = nums.length ? Math.max(...nums) : 0;
  const min = nums.length ? Math.min(...nums) : 0;

  return (
    <>
      <PageHeader title="Analytics" description="Performance and latency metrics." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Avg latency" value={loading ? "…" : `${avg.toFixed(0)} ms`} />
        <StatCard label="Min latency" value={loading ? "…" : `${min.toFixed(0)} ms`} />
        <StatCard label="Max latency" value={loading ? "…" : `${max.toFixed(0)} ms`} />
      </div>
      <div className="mt-6">
        <DataCard title="Latency distribution" description="Chart placeholder — samples over time.">
          <EmptyState
            icon={BarChart3}
            title="Chart coming soon"
            description="A latency histogram will render here once enough samples are collected."
          />
        </DataCard>
      </div>
    </>
  );
}
