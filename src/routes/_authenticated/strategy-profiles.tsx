import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Upload, Download, Copy, Archive, ArchiveRestore, Trash2, Play, Pause,
  History, RotateCcw, Search, Tag, MoreHorizontal,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeList } from "@/hooks/use-realtime";
import {
  STRATEGY_TYPES, DEFAULT_MODES, defaultProfile, strategyProfileSchema,
  toExportEnvelope, parseImportPayload, validateConfig,
  type StrategyProfileInput, type StrategyConfig,
} from "@/lib/strategy-profiles";

export const Route = createFileRoute("/_authenticated/strategy-profiles")({
  head: () => ({
    meta: [
      { title: "Strategy Profiles — P4 Bot" },
      { name: "description", content: "Manage, version, import and export trading strategy profiles." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilesPage,
});

type ProfileRow = {
  id: number;
  user_id: string;
  name: string;
  description: string;
  strategy_type: string;
  enabled: boolean;
  default_mode: string;
  status: string;
  tags: string[] | null;
  version: number;
  is_active: boolean;
  notes: string;
  config: StrategyConfig;
  created_at: string;
  updated_at: string;
  last_used_at_ms: number | null;
};

type VersionRow = {
  id: number;
  profile_id: number;
  version: number;
  name: string;
  description: string;
  strategy_type: string;
  enabled: boolean;
  default_mode: string;
  tags: string[] | null;
  notes: string;
  config: StrategyConfig;
  change_summary: string;
  created_at: string;
};

type AuditRow = {
  id: number;
  ts_ms: number;
  level: string;
  category: string;
  message: string;
  meta: Record<string, unknown> | null;
};

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; profile: ProfileRow }
  | null;

const now = () => Date.now();

async function logAudit(userId: string, message: string, meta: Record<string, unknown>) {
  await supabase.from("audit_log").insert({
    user_id: userId,
    ts_ms: now(),
    level: "info",
    category: "strategy_profile",
    message,
    meta: meta as never,
  });
}

function ProfilesPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const { rows, status, error } = useRealtimeList<ProfileRow>(
    "strategy_profiles",
    userId,
    { orderBy: { column: "updated_at", ascending: false }, limit: 500 },
  );

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [sort, setSort] = useState<"updated" | "name" | "version">("updated");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.strategy_type !== typeFilter) return false;
      if (!s) return true;
      return (
        r.name.toLowerCase().includes(s) ||
        r.description.toLowerCase().includes(s) ||
        (r.tags ?? []).some((t) => t.toLowerCase().includes(s))
      );
    });
    out = [...out].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "version") return b.version - a.version;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return out;
  }, [rows, search, statusFilter, typeFilter, sort]);

  useEffect(() => {
    if (selectedId && !rows.some((r) => r.id === selectedId)) setSelectedId(null);
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0]!.id);
  }, [rows, filtered, selectedId]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <>
      <PageHeader
        title="Strategy Profiles"
        description="Named, versioned configuration snapshots. Standing Limit Order remains the primary strategy — profiles power alternatives and experiments."
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Import JSON
            </Button>
            <Button size="sm" onClick={() => setEditor({ mode: "create" })} disabled={!userId}>
              <Plus className="mr-2 h-4 w-4" /> New profile
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search name, description, tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {STRATEGY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Last modified</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="version">Version</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <ErrorState message={error} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,340px)_1fr]">
        <div className="rounded-md border bg-card">
          <ScrollArea className="h-[calc(100vh-320px)] min-h-[400px]">
            {status === "connecting" && rows.length === 0 ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No profiles"
                  description="Create a strategy profile or import one from JSON."
                />
              </div>
            ) : (
              <ul>
                {filtered.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelectedId(p.id)}
                      className={`w-full border-b px-3 py-2 text-left hover:bg-accent/50 ${
                        selectedId === p.id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{p.name}</span>
                        {p.is_active && <Badge variant="default" className="shrink-0">Active</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <Badge variant="outline">{p.strategy_type}</Badge>
                        <Badge variant={p.default_mode === "live" ? "destructive" : "secondary"}>
                          {p.default_mode}
                        </Badge>
                        <Badge variant="outline">v{p.version}</Badge>
                        {p.status === "archived" && <Badge variant="outline">archived</Badge>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        <div className="rounded-md border bg-card p-4">
          {selected ? (
            <ProfileDetail
              key={selected.id}
              profile={selected}
              onEdit={() => setEditor({ mode: "edit", profile: selected })}
            />
          ) : (
            <EmptyState title="Select a profile" description="Pick a profile from the list to see its configuration, versions and audit trail." />
          )}
        </div>
      </div>

      {editor && userId && (
        <EditorDialog
          key={editor.mode === "edit" ? `edit-${editor.profile.id}` : "create"}
          userId={userId}
          existing={editor.mode === "edit" ? editor.profile : null}
          onClose={() => setEditor(null)}
        />
      )}

      {importOpen && userId && (
        <ImportDialog userId={userId} onClose={() => setImportOpen(false)} existingNames={rows.map((r) => r.name)} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Detail panel                                                        */
/* ------------------------------------------------------------------ */

function ProfileDetail({ profile, onEdit }: { profile: ProfileRow; onEdit: () => void }) {
  const userId = profile.user_id;

  async function toggleEnabled() {
    const { error } = await supabase
      .from("strategy_profiles")
      .update({ enabled: !profile.enabled, updated_at_ms: now() })
      .eq("id", profile.id);
    if (error) return toast.error(error.message);
    await logAudit(userId, profile.enabled ? "deactivated" : "activated", { profile_id: profile.id, name: profile.name });
    toast.success(profile.enabled ? "Deactivated" : "Activated");
  }

  async function toggleActive() {
    if (!profile.is_active) {
      await supabase
        .from("strategy_profiles")
        .update({ is_active: false, updated_at_ms: now() })
        .eq("user_id", userId)
        .neq("id", profile.id);
    }
    const { error } = await supabase
      .from("strategy_profiles")
      .update({ is_active: !profile.is_active, updated_at_ms: now() })
      .eq("id", profile.id);
    if (error) return toast.error(error.message);
    await logAudit(userId, profile.is_active ? "unset_active" : "set_active", { profile_id: profile.id, name: profile.name });
    toast.success(profile.is_active ? "Cleared active profile" : "Set as active profile");
  }

  async function archive() {
    const { error } = await supabase
      .from("strategy_profiles")
      .update({ status: profile.status === "archived" ? "active" : "archived", updated_at_ms: now() })
      .eq("id", profile.id);
    if (error) return toast.error(error.message);
    await logAudit(userId, profile.status === "archived" ? "unarchived" : "archived", { profile_id: profile.id });
    toast.success(profile.status === "archived" ? "Unarchived" : "Archived");
  }

  async function remove() {
    const { error } = await supabase.from("strategy_profiles").delete().eq("id", profile.id);
    if (error) return toast.error(error.message);
    await logAudit(userId, "deleted", { profile_id: profile.id, name: profile.name });
    toast.success("Deleted");
  }

  async function duplicate() {
    const base = profile.name.replace(/ \(copy( \d+)?\)$/, "");
    const copyName = `${base} (copy)`;
    const t = now();
    const { error } = await supabase.from("strategy_profiles").insert({
      user_id: userId,
      name: copyName,
      description: profile.description,
      strategy_type: profile.strategy_type,
      enabled: false,
      default_mode: profile.default_mode,
      tags: profile.tags ?? [],
      notes: profile.notes,
      config: profile.config as never,
      created_at_ms: t,
      updated_at_ms: t,
    });
    if (error) return toast.error(error.message);
    await logAudit(userId, "duplicated", { source_id: profile.id, new_name: copyName });
    toast.success("Duplicated");
  }

  function exportJson() {
    const envelope = toExportEnvelope({
      name: profile.name,
      description: profile.description,
      strategy_type: profile.strategy_type as StrategyProfileInput["strategy_type"],
      enabled: profile.enabled,
      default_mode: profile.default_mode as StrategyProfileInput["default_mode"],
      tags: profile.tags ?? [],
      notes: profile.notes,
      config: profile.config,
    });
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${profile.name.replace(/[^a-z0-9-_]+/gi, "_")}.strategy.json`;
    a.click();
    URL.revokeObjectURL(url);
    void logAudit(userId, "exported", { profile_id: profile.id, name: profile.name });
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{profile.name}</h2>
            <Badge variant="outline">v{profile.version}</Badge>
            {profile.is_active && <Badge>Active</Badge>}
            <Badge variant={profile.enabled ? "default" : "secondary"}>
              {profile.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <Badge variant={profile.default_mode === "live" ? "destructive" : "secondary"}>
              {profile.default_mode}
            </Badge>
            {profile.status === "archived" && <Badge variant="outline">Archived</Badge>}
          </div>
          {profile.description && (
            <p className="mt-1 text-sm text-muted-foreground">{profile.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Last modified {new Date(profile.updated_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
          <Button size="sm" variant="outline" onClick={toggleEnabled}>
            {profile.enabled ? <><Pause className="mr-2 h-4 w-4" /> Deactivate</> : <><Play className="mr-2 h-4 w-4" /> Activate</>}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={toggleActive}>
                {profile.is_active ? "Clear active profile" : "Set as active profile"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={duplicate}>
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportJson}>
                <Download className="mr-2 h-4 w-4" /> Export JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={archive}>
                {profile.status === "archived"
                  ? <><ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive</>
                  : <><Archive className="mr-2 h-4 w-4" /> Archive</>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <ConfirmDialog
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                }
                title={`Delete "${profile.name}"?`}
                description="This permanently removes the profile and its version history. This cannot be undone."
                confirmLabel="Delete"
                destructive
                onConfirm={remove}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {profile.tags && profile.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {profile.tags.map((t) => (
            <Badge key={t} variant="outline" className="gap-1"><Tag className="h-3 w-3" />{t}</Badge>
          ))}
        </div>
      )}

      <Separator />

      <Tabs defaultValue="config" className="flex-1">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="versions"><History className="mr-1 h-4 w-4" /> Versions</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="config">
          <pre className="max-h-[520px] overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
            {JSON.stringify(profile.config, null, 2)}
          </pre>
        </TabsContent>
        <TabsContent value="versions">
          <VersionsPanel profileId={profile.id} userId={userId} currentVersion={profile.version} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditPanel profileId={profile.id} userId={userId} />
        </TabsContent>
        <TabsContent value="notes">
          <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-sm">
            {profile.notes || "No notes."}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Versions                                                             */
/* ------------------------------------------------------------------ */

function VersionsPanel({ profileId, userId, currentVersion }: { profileId: number; userId: string; currentVersion: number }) {
  const [rows, setRows] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [compare, setCompare] = useState<VersionRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("strategy_profile_versions")
      .select("*")
      .eq("profile_id", profileId)
      .order("version", { ascending: false });
    if (error) setErr(error.message);
    else setRows((data ?? []) as unknown as VersionRow[]);
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [profileId]);

  async function restore(v: VersionRow) {
    const { error } = await supabase
      .from("strategy_profiles")
      .update({
        name: v.name,
        description: v.description,
        strategy_type: v.strategy_type,
        enabled: v.enabled,
        default_mode: v.default_mode,
        tags: v.tags ?? [],
        notes: v.notes,
        config: v.config as never,
        updated_at_ms: now(),
      })
      .eq("id", profileId);
    if (error) return toast.error(error.message);
    await logAudit(userId, "restored", { profile_id: profileId, from_version: v.version });
    toast.success(`Restored to v${v.version}`);
    void load();
  }

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (err) return <ErrorState message={err} />;
  if (rows.length === 0) return <EmptyState title="No history" description="Every change creates a version." />;

  return (
    <div className="space-y-2">
      {rows.map((v) => (
        <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant={v.version === currentVersion ? "default" : "outline"}>v{v.version}</Badge>
              <span className="text-sm font-medium truncate">{v.name}</span>
              <span className="text-xs text-muted-foreground">{v.change_summary}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setCompare(v)}>View</Button>
            {v.version !== currentVersion && (
              <ConfirmDialog
                trigger={<Button size="sm" variant="outline"><RotateCcw className="mr-2 h-4 w-4" /> Restore</Button>}
                title={`Restore v${v.version}?`}
                description="This creates a new version identical to the selected one."
                confirmLabel="Restore"
                onConfirm={() => restore(v)}
              />
            )}
          </div>
        </div>
      ))}
      <Dialog open={!!compare} onOpenChange={(o) => !o && setCompare(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Version v{compare?.version} — {compare?.name}</DialogTitle>
            <DialogDescription>{compare && new Date(compare.created_at).toLocaleString()}</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
            {compare && JSON.stringify(compare.config, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Audit                                                                */
/* ------------------------------------------------------------------ */

function AuditPanel({ profileId, userId }: { profileId: number; userId: string }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("user_id", userId)
        .eq("category", "strategy_profile")
        .order("ts_ms", { ascending: false })
        .limit(200);
      if (cancel) return;
      if (error) setErr(error.message);
      else {
        const filtered = (data ?? []).filter((r) => {
          const meta = r.meta as Record<string, unknown> | null;
          const pid = meta?.profile_id ?? meta?.source_id ?? meta?.new_profile_id;
          return pid === profileId;
        });
        setRows(filtered as unknown as AuditRow[]);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [profileId, userId]);

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (err) return <ErrorState message={err} />;
  if (rows.length === 0) return <EmptyState title="No audit events" description="Actions on this profile will appear here." />;

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-md border p-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{r.message}</span>
            <span className="text-xs text-muted-foreground">{new Date(r.ts_ms).toLocaleString()}</span>
          </div>
          {r.meta && (
            <pre className="mt-1 overflow-auto text-xs text-muted-foreground">
              {JSON.stringify(r.meta, null, 0)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                               */
/* ------------------------------------------------------------------ */

function EditorDialog({
  userId, existing, onClose,
}: {
  userId: string;
  existing: ProfileRow | null;
  onClose: () => void;
}) {
  const initial: StrategyProfileInput = existing
    ? strategyProfileSchema.parse({
        name: existing.name,
        description: existing.description,
        strategy_type: existing.strategy_type as StrategyProfileInput["strategy_type"],
        enabled: existing.enabled,
        default_mode: existing.default_mode as StrategyProfileInput["default_mode"],
        tags: existing.tags ?? [],
        notes: existing.notes,
        config: existing.config,
      })
    : defaultProfile();

  const [form, setForm] = useState<StrategyProfileInput>(initial);
  const [tagsText, setTagsText] = useState((initial.tags ?? []).join(", "));
  const [configText, setConfigText] = useState(JSON.stringify(initial.config, null, 2));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    // Parse tags & config
    const tags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);
    let cfg: StrategyConfig;
    try {
      cfg = strategyProfileSchema.shape.config.parse(JSON.parse(configText));
    } catch (e) {
      return toast.error(`Invalid configuration JSON: ${(e as Error).message}`);
    }
    const parsed = strategyProfileSchema.safeParse({ ...form, tags, config: cfg });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Invalid profile");
    const crossErr = validateConfig(parsed.data.config);
    if (crossErr) return toast.error(crossErr);

    setSaving(true);
    const t = now();
    const payload = { ...parsed.data, config: parsed.data.config as never };
    if (existing) {
      const { error } = await supabase
        .from("strategy_profiles")
        .update({ ...payload, updated_at_ms: t })
        .eq("id", existing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      await logAudit(userId, "updated", { profile_id: existing.id, name: parsed.data.name });
      toast.success("Saved");
    } else {
      const { data, error } = await supabase
        .from("strategy_profiles")
        .insert({ ...payload, user_id: userId, created_at_ms: t, updated_at_ms: t })
        .select("id")
        .single();
      setSaving(false);
      if (error) return toast.error(error.message);
      await logAudit(userId, "created", { profile_id: data?.id, name: parsed.data.name });
      toast.success("Created");
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit "${existing.name}"` : "New strategy profile"}</DialogTitle>
          <DialogDescription>
            {existing
              ? `Saving creates version v${existing.version + 1}. Previous versions remain restorable.`
              : "Create a new versioned configuration snapshot."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basics">
          <TabsList>
            <TabsTrigger value="basics">Basics</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="space-y-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Strategy type</Label>
                <Select value={form.strategy_type} onValueChange={(v) => setForm({ ...form, strategy_type: v as StrategyProfileInput["strategy_type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STRATEGY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default mode</Label>
                <Select value={form.default_mode} onValueChange={(v) => setForm({ ...form, default_mode: v as StrategyProfileInput["default_mode"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEFAULT_MODES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="enabled" checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="e.g. btc, experimental" />
            </div>
          </TabsContent>

          <TabsContent value="config">
            <p className="mb-2 text-xs text-muted-foreground">
              Edit the full configuration JSON. Cross-field rules (position size ≤ exposure, slippage ≥ price tolerance, valid scheduling window, BTC 5m trigger in (0,1)) are validated on save.
            </p>
            <Textarea rows={20} className="font-mono text-xs" value={configText} onChange={(e) => setConfigText(e.target.value)} />
          </TabsContent>

          <TabsContent value="notes">
            <Textarea rows={12} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : existing ? "Save version" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Import                                                               */
/* ------------------------------------------------------------------ */

function ImportDialog({
  userId, onClose, existingNames,
}: {
  userId: string;
  onClose: () => void;
  existingNames: string[];
}) {
  const [text, setText] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    const t = await f.text();
    setText(t);
  }

  async function doImport() {
    let env;
    try { env = parseImportPayload(text); }
    catch (e) { return toast.error(`Invalid JSON: ${(e as Error).message}`); }

    const crossErr = validateConfig(env.profile.config);
    if (crossErr) return toast.error(crossErr);

    const clash = existingNames.some((n) => n.toLowerCase() === env.profile.name.toLowerCase());
    if (clash && !overwrite) {
      return toast.error(`Profile named "${env.profile.name}" already exists. Enable overwrite to replace.`);
    }

    setBusy(true);
    const t = now();
    const payload = { ...env.profile, config: env.profile.config as never };
    let profileId: number | undefined;
    if (clash && overwrite) {
      const { data: existing } = await supabase
        .from("strategy_profiles")
        .select("id")
        .eq("user_id", userId)
        .ilike("name", env.profile.name)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await supabase
          .from("strategy_profiles")
          .update({ ...payload, updated_at_ms: t })
          .eq("id", existing.id);
        if (error) { setBusy(false); return toast.error(error.message); }
        profileId = existing.id;
      }
    }
    if (!profileId) {
      const { data, error } = await supabase
        .from("strategy_profiles")
        .insert({ ...payload, user_id: userId, created_at_ms: t, updated_at_ms: t })
        .select("id")
        .single();
      if (error) { setBusy(false); return toast.error(error.message); }
      profileId = data?.id;
    }
    await logAudit(userId, "imported", { profile_id: profileId, name: env.profile.name, overwrite });
    setBusy(false);
    toast.success("Imported");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import strategy profile</DialogTitle>
          <DialogDescription>
            Paste a P4 strategy JSON export, or choose a file. The schema is validated before import.
          </DialogDescription>
        </DialogHeader>
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          className="text-sm"
        />
        <Textarea rows={14} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder='{"schema":"p4.strategy_profile","version":1,...}' />
        <div className="flex items-center gap-2">
          <Switch id="ow" checked={overwrite} onCheckedChange={setOverwrite} />
          <Label htmlFor="ow">Overwrite if a profile with the same name exists</Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={doImport} disabled={busy || !text.trim()}>{busy ? "Importing…" : "Import"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
