import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/data-card";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp, Wallet, HeartPulse } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — P4 Bot" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [counts, setCounts] = useState({ trades: "—", orders: "—", profiles: "—", beats: "—" });

  useEffect(() => {
    (async () => {
      const [t, o, p, h] = await Promise.all([
        supabase.from("trades").select("id", { count: "exact", head: true }),
        supabase.from("order_intents").select("id", { count: "exact", head: true }),
        supabase.from("strategy_profiles").select("id", { count: "exact", head: true }),
        supabase.from("engine_heartbeats").select("id", { count: "exact", head: true }),
      ]);
      setCounts({
        trades: t.count?.toLocaleString() ?? "0",
        orders: o.count?.toLocaleString() ?? "0",
        profiles: p.count?.toLocaleString() ?? "0",
        beats: h.count?.toLocaleString() ?? "0",
      });
    })();
  }, []);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live overview of your Polymarket trading engine."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Trades" value={counts.trades} hint="All time" />
        <StatCard label="Open orders" value={counts.orders} hint="Intent queue" />
        <StatCard label="Profiles" value={counts.profiles} hint="Strategy snapshots" />
        <StatCard label="Heartbeats" value={counts.beats} hint="Engine pings" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Engine status
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The external Node engine reports its status via heartbeats. Detailed monitoring lives on the Health page.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Trade and order feeds will appear here once the engine begins publishing to Supabase.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" /> Positions summary
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Aggregate exposure across markets.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="h-4 w-4" /> Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No critical alerts. Notification center is empty.
          </CardContent>
        </Card>
      </div>
    </>
  );
}
