/**
 * Production diagnostics page.
 *
 * Runs an end-to-end self-test of the dashboard ↔ Supabase ↔ P1 pipeline
 * for the signed-in user. Every check maps to an actionable message.
 */
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDiagnostics, type Check, type CheckStatus } from "@/lib/diagnostics.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/diagnostics")({
  component: DiagnosticsPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-lg font-semibold">Diagnostics failed to load</h1>
        <pre className="text-xs text-red-500 whitespace-pre-wrap">{error.message}</pre>
        <Button
          onClick={() => {
            reset();
            router.invalidate();
          }}
        >
          Retry
        </Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">Diagnostics not found.</div>,
});

function DiagnosticsPage() {
  const run = useServerFn(getDiagnostics);
  const q = useQuery({
    queryKey: ["diagnostics"],
    queryFn: () => run(),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const report = q.data;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Diagnostics</h1>
          <p className="text-sm text-muted-foreground">
            End-to-end self-test of the dashboard ↔ Supabase ↔ P1 pipeline. Auto-refreshes every 15 s.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {report && <OverallBadge status={report.overall} />}
          <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            {q.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Run now</span>
          </Button>
        </div>
      </div>

      {q.isLoading && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Running diagnostics…
          </CardContent>
        </Card>
      )}

      {q.error && (
        <Card>
          <CardContent className="p-6 text-sm text-red-500">
            {q.error instanceof Error ? q.error.message : String(q.error)}
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {report.checks.map((c) => (
                  <CheckRow key={c.id} check={c} />
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registered Engine Instances</CardTitle>
            </CardHeader>
            <CardContent>
              {report.meta.instances.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No engine instances registered yet. Start P1 with{" "}
                  <code>ENGINE_DASHBOARD_SYNC=on</code> and{" "}
                  <code>ENGINE_USER_ID={report.user_id}</code>.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-3">Instance</th>
                        <th className="py-1 pr-3">Mode</th>
                        <th className="py-1 pr-3">Status</th>
                        <th className="py-1 pr-3">Version</th>
                        <th className="py-1 pr-3">Host</th>
                        <th className="py-1 pr-3">Control URL</th>
                        <th className="py-1 pr-3">Last Heartbeat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.meta.instances.map((r) => (
                        <tr key={r.instance_id} className="border-t">
                          <td className="py-1.5 pr-3 font-mono">{r.instance_id}</td>
                          <td className="py-1.5 pr-3">{r.engine_mode ?? "—"}</td>
                          <td className="py-1.5 pr-3">{r.engine_status ?? "—"}</td>
                          <td className="py-1.5 pr-3">{r.engine_version ?? "—"}</td>
                          <td className="py-1.5 pr-3">{r.host_name ?? "—"}</td>
                          <td className="py-1.5 pr-3 font-mono max-w-[240px] truncate">
                            {r.control_url ?? "—"}
                          </td>
                          <td className="py-1.5 pr-3">
                            {r.last_heartbeat ? new Date(r.last_heartbeat).toLocaleTimeString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Generated {new Date(report.generated_at).toLocaleString()} · user{" "}
            <code>{report.user_id}</code>
          </p>
        </>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  if (status === "fail") return <XCircle className="h-4 w-4 text-red-500" />;
  return <Loader2 className="h-4 w-4 text-muted-foreground" />;
}

function CheckRow({ check }: { check: Check }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="pt-0.5">
        <StatusIcon status={check.status} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{check.label}</p>
        <p className="text-xs text-muted-foreground">{check.detail}</p>
        {check.action && (
          <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">Action: {check.action}</p>
        )}
      </div>
      <StatusBadge status={check.status} />
    </li>
  );
}

function StatusBadge({ status }: { status: CheckStatus }) {
  const map: Record<CheckStatus, { label: string; cls: string }> = {
    ok: { label: "OK", cls: "border-emerald-500/40 text-emerald-500" },
    warn: { label: "Warn", cls: "border-yellow-500/40 text-yellow-500" },
    fail: { label: "Fail", cls: "border-red-500/40 text-red-500" },
    pending: { label: "Pending", cls: "border-muted-foreground/30 text-muted-foreground" },
  };
  const { label, cls } = map[status];
  return (
    <Badge variant="outline" className={cls}>
      {label}
    </Badge>
  );
}

function OverallBadge({ status }: { status: CheckStatus }) {
  const map: Record<CheckStatus, { label: string; cls: string }> = {
    ok: { label: "All systems go", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/40" },
    warn: { label: "Partial — see checks", cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/40" },
    fail: { label: "Failing — see checks", cls: "bg-red-500/10 text-red-500 border-red-500/40" },
    pending: { label: "Running…", cls: "bg-muted/40 text-muted-foreground border-muted-foreground/30" },
  };
  const { label, cls } = map[status];
  return <Badge className={`px-3 py-1 border ${cls}`}>{label}</Badge>;
}
