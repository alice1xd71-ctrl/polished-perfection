import type { ReactNode } from "react";
import { useAuth, useRoles, type AppRole } from "@/hooks/use-auth";
import { EmptyState } from "./empty-state";
import { ShieldAlert } from "lucide-react";

export function PermissionGuard({
  role,
  children,
  fallback,
}: {
  role: AppRole;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user } = useAuth();
  const { roles, loading } = useRoles(user?.id);
  if (loading) return null;
  const ok = roles.includes(role) || (role !== "admin" && roles.includes("admin"));
  if (ok) return <>{children}</>;
  return (
    fallback ?? (
      <EmptyState
        icon={ShieldAlert}
        title="Access denied"
        description={`This page requires the ${role} role. Ask an administrator for access.`}
      />
    )
  );
}
