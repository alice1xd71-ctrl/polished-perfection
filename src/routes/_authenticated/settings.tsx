import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { DataCard } from "@/components/app/data-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRoles } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — P4 Bot" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { roles } = useRoles(user?.id);
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      setDisplayName(data?.display_name ?? "");
    });
  }, [user]);

  async function save() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  }

  const dashboardUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <>
      <PageHeader title="Settings" description="Manage your account and preferences." />
      <div className="grid gap-4 lg:grid-cols-2">
        <DataCard title="Profile" description="Update your display name.">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </DataCard>
        <DataCard title="Roles" description="Permissions granted to your account.">
          <div className="flex flex-wrap gap-2">
            {roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles assigned.</p>
            ) : (
              roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)
            )}
          </div>
        </DataCard>
        <div className="lg:col-span-2">
          <DataCard
            title="Engine integration"
            description="Values the P1 engine needs in its .env file to sync with this dashboard."
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>ENGINE_USER_ID</Label>
                <div className="flex gap-2">
                  <Input readOnly value={user?.id ?? ""} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy(user?.id ?? "", "User ID")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your Supabase <code>auth.users.id</code>. Every engine write is scoped to this UUID via RLS.
                </p>
              </div>
              <div className="space-y-2">
                <Label>ENGINE_DASHBOARD_URL</Label>
                <div className="flex gap-2">
                  <Input readOnly value={dashboardUrl} className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy(dashboardUrl, "Dashboard URL")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Published dashboard base URL. Engine POSTs to{" "}
                  <code>{dashboardUrl || "<dashboard>"}/api/public/engine/*</code>.
                </p>
              </div>
              <div className="space-y-2">
                <Label>ENGINE_API_TOKEN</Label>
                <p className="text-sm text-muted-foreground">
                  Shared secret. Generate one strong random value (e.g.{" "}
                  <code className="text-xs">openssl rand -hex 32</code>) and set it in <strong>both</strong>{" "}
                  places with the exact same value:
                </p>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    Lovable → Project Settings → Secrets → <code>ENGINE_API_TOKEN</code>
                  </li>
                  <li>
                    P1 engine <code>.env</code> → <code>ENGINE_API_TOKEN</code> (and set{" "}
                    <code>BOT_CONTROL_TOKEN</code> to the same value so P1's own{" "}
                    <code>/api/v2/bot/*</code> auth matches).
                  </li>
                </ol>
                <p className="text-xs text-muted-foreground">
                  The token is never stored in a Supabase table — it lives only as an environment variable on
                  each service. It is not shown here because Lovable secrets are write-only.
                </p>
              </div>
            </div>
          </DataCard>
        </div>
      </div>
    </>
  );
}
