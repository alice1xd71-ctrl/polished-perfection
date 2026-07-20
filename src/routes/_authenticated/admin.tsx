import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { PermissionGuard } from "@/components/app/permission-guard";
import { TableView } from "@/components/app/table-view";
import { useSupabaseList } from "@/hooks/use-supabase-query";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administration — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <PermissionGuard role="admin">
      <AdminContent />
    </PermissionGuard>
  );
}

function AdminContent() {
  const users = useSupabaseList<Record<string, unknown>>("profiles", { orderBy: { column: "created_at" } });
  const rolesQ = useSupabaseList<Record<string, unknown>>("user_roles", { orderBy: { column: "created_at" } });

  return (
    <>
      <PageHeader title="Administration" description="Admin-only view of users and roles." />
      <div className="space-y-6">
        <TableView
          title="Users"
          columns={[
            { key: "email", header: "Email" },
            { key: "display_name", header: "Display name" },
            { key: "created_at", header: "Joined" },
          ]}
          rows={users.data}
          loading={users.loading}
          error={users.error}
          onRetry={users.refetch}
          emptyTitle="No users"
        />
        <TableView
          title="Role assignments"
          columns={[
            { key: "user_id", header: "User" },
            { key: "role", header: "Role" },
            { key: "created_at", header: "Granted" },
          ]}
          rows={rolesQ.data}
          loading={rolesQ.loading}
          error={rolesQ.error}
          onRetry={rolesQ.refetch}
          emptyTitle="No roles"
        />
      </div>
    </>
  );
}
