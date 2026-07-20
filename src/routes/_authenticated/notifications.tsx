import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { DataCard } from "@/components/app/data-card";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <>
      <PageHeader title="Notifications" description="Engine alerts, watchdog events, and system messages." />
      <DataCard>
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Telegram, watchdog, and settlement alerts will surface here."
        />
      </DataCard>
    </>
  );
}
