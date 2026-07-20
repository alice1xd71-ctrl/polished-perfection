import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSignedIn(!!data.session);
      setChecking(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary" />
            <span className="text-lg font-semibold tracking-tight">P4 Bot</span>
          </div>
          <nav className="flex items-center gap-3">
            {checking ? null : signedIn ? (
              <button
                onClick={() => navigate({ to: "/dashboard" })}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Open dashboard
              </button>
            ) : (
              <Link
                to="/auth"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            Polymarket Trading Console
          </p>
          <h1 className="mt-4 text-5xl font-bold tracking-tight">
            Operator dashboard for the P4 trading engine.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Configure strategies and standing orders, monitor live market feeds,
            replay trades, and audit every fill — with the Node execution
            engine running on your own infrastructure and Supabase as the
            single source of truth.
          </p>
          <div className="mt-8 flex gap-3">
            {signedIn ? (
              <button
                onClick={() => navigate({ to: "/dashboard" })}
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Open dashboard
              </button>
            ) : (
              <Link
                to="/auth"
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Get started
              </Link>
            )}
          </div>
        </section>

        <section className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Strategy profiles", "Named snapshots of every engine parameter, safely re-applied while stopped."],
            ["Standing orders", "Configure limit-order intents, monitor fills, and quarantine rogue exchange orders."],
            ["Ledger & analytics", "Every open and settled trade, PnL attribution, latency samples, replayable audit trail."],
            ["Health & watchdog", "Engine heartbeats, write-queue depth, feed diagnostics — all in one view."],
            ["Paper + Live parity", "V1 paper and V2 live share the same execution pipeline and schema."],
            ["Two-service isolation", "The dashboard never places an order — the Node engine reads intent from Supabase."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg border border-border p-5">
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
