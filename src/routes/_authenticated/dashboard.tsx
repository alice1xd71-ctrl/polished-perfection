import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — P4 Bot" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<string>("…");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setEmail(u.user?.email ?? "");
      if (u.user) {
        const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
        setRole(r?.map((x) => x.role).join(", ") || "none");
      }
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary" />
            <span className="text-lg font-semibold tracking-tight">P4 Bot</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">{email}</span>
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium uppercase tracking-wide">
              {role}
            </span>
            <button
              onClick={signOut}
              className="rounded-md border border-input px-3 py-1.5 hover:bg-accent"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Milestone 1 complete — authentication, database schema, and RLS are live.
          Trading UI ships in the next milestones.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Strategy profiles", value: "Milestone 5" },
            { label: "Standing orders", value: "Milestone 5" },
            { label: "Ledger", value: "Milestone 4" },
            { label: "Analytics", value: "Milestone 4" },
            { label: "Trade replay", value: "Milestone 4" },
            { label: "Engine health", value: "Milestone 4" },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-border p-5">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-lg font-medium">{c.value}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
