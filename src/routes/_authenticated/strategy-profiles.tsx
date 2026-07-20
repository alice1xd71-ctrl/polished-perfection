import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { TableView } from "@/components/app/table-view";
import { useSupabaseList } from "@/hooks/use-supabase-query";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/strategy-profiles")({
  head: () => ({ meta: [{ title: "Strategy Profiles — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: ProfilesPage,
});

function ProfilesPage() {
  const { data, loading, error, refetch } = useSupabaseList<Record<string, unknown>>(
    "strategy_profiles",
    { orderBy: { column: "updated_at" } },
  );

  return (
    <>
      <PageHeader
        title="Strategy Profiles"
        description="Named snapshots of engine parameters, safely re-applied while stopped."
        actions={<Button size="sm" disabled><Plus className="mr-2 h-4 w-4" /> New profile</Button>}
      />
      <TableView
        columns={[
          { key: "name", header: "Name" },
          { key: "notes", header: "Notes" },
          { key: "last_used_at_ms", header: "Last used (ms)" },
          { key: "updated_at", header: "Updated" },
        ]}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        emptyTitle="No strategy profiles"
        emptyDescription="Create a profile to snapshot the engine's parameters."
      />
    </>
  );
}
