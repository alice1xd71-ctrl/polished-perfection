import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { RealtimeIndicator } from "@/components/app/realtime-indicator";
import { EmptyState } from "@/components/app/empty-state";
import { DataCard } from "@/components/app/data-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList } from "@/hooks/use-realtime";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { fmtAgo } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: NotificationsPage,
});

type Notif = Tables<"notifications">;

const sevClass: Record<string, string> = {
  info: "bg-sky-500/15 text-sky-500",
  warning: "bg-yellow-500/15 text-yellow-500",
  error: "bg-red-500/15 text-red-500",
  critical: "bg-red-600 text-white",
};

function NotificationsPage() {
  const { user } = useAuth();
  const { rows, loading, status, refetch } = useRealtimeList<Notif>(
    "notifications",
    user?.id,
    { orderBy: { column: "ts_ms", ascending: false }, limit: 200 },
  );

  async function markAllRead() {
    if (!user?.id) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    refetch();
  }
  async function clearAll() {
    if (!user?.id) return;
    if (!confirm("Delete all notifications?")) return;
    await supabase.from("notifications").delete().eq("user_id", user.id);
    refetch();
  }

  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={`${unread} unread · ${rows.length} total`}
        actions={
          <div className="flex items-center gap-2">
            <RealtimeIndicator status={status} />
            <Button variant="outline" size="sm" onClick={markAllRead} disabled={unread === 0}>
              <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all read
            </Button>
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={rows.length === 0}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Clear
            </Button>
          </div>
        }
      />
      <DataCard>
        {loading && rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="Engine alerts, watchdog events, and system messages will appear here." />
        ) : (
          <ul className="divide-y">
            {rows.map((n) => (
              <li key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.read_at ? "opacity-70" : ""}`}>
                <span className={`mt-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${sevClass[n.severity] ?? sevClass.info}`}>
                  {n.severity}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">{n.title}</p>
                    <span className="text-xs text-muted-foreground">{fmtAgo(Number(n.ts_ms))}</span>
                  </div>
                  {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{n.source}</Badge>
                    <span>{n.category}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DataCard>
    </>
  );
}
