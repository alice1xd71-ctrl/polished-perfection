import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — P4 Bot" },
      { name: "description", content: "Sign in to the P4 Polymarket trading dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        // If email confirmations are OFF, a session comes back immediately.
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate({ to: "/dashboard", replace: true });
        } else {
          setInfo("Account created. Check your email to confirm, then sign in.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (e) {
      setError((e as Error).message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Sign in to P4 Bot" : "Create your operator account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Access the trading dashboard."
              : "The first account on this project becomes admin automatically."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border p-6">
          {mode === "signup" && (
            <div className="space-y-1">
              <label htmlFor="displayName" className="text-sm font-medium">Display name</label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                placeholder="Operator"
              />
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              autoComplete="email"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {info && <p className="text-sm text-primary">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <div className="pt-2 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                No account?{" "}
                <button type="button" className="text-primary hover:underline" onClick={() => { setMode("signup"); setError(null); setInfo(null); }}>
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button type="button" className="text-primary hover:underline" onClick={() => { setMode("signin"); setError(null); setInfo(null); }}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
