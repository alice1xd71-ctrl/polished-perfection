/**
 * Realtime primitives for the P4 dashboard.
 *
 * Design goals:
 *   - Every subscription runs inside useEffect and is torn down on unmount.
 *   - One channel per (table, user_id) — no duplicate subscriptions ever.
 *   - Payloads are applied to a stable list state with strict de-dup by primary key.
 *   - Initial rows are loaded via a single REST fetch, then kept live by postgres_changes.
 *   - Every silent failure surfaces (subscribe status, fetch error) so the UI can react.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type TableName = keyof Database["public"]["Tables"] | (string & {});

export type RealtimeStatus = "idle" | "connecting" | "connected" | "error" | "closed";

type ListOptions<PK extends string> = {
  /** Column used as primary key for de-duplication. Defaults to "id". */
  primaryKey?: PK;
  /** REST select projection. Defaults to "*". */
  select?: string;
  /** Max rows to keep in memory (newest first). Defaults to 200. */
  limit?: number;
  /** Column to order by on initial fetch. Defaults to the primary key desc. */
  orderBy?: { column: string; ascending?: boolean };
  /** Column that must equal userId (owner scoping). Defaults to "user_id". */
  ownerColumn?: string | null;
};

/**
 * Subscribe to a table filtered by user_id and keep a rolling list in state.
 * Deterministic: primary-key de-dup, stable ordering, no duplicate subscriptions.
 */
export function useRealtimeList<Row extends Record<string, unknown>, PK extends string = "id">(
  table: TableName,
  userId: string | undefined,
  options: ListOptions<PK> = {},
) {
  const {
    primaryKey = "id" as PK,
    select = "*",
    limit = 200,
    orderBy,
    ownerColumn = "user_id",
  } = options;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>("idle");

  // Keep the latest limit/orderBy in refs so the effect below can stay
  // keyed only on (table, userId, ownerColumn) — this prevents the channel
  // from tearing down and re-subscribing on every render.
  const limitRef = useRef(limit);
  const orderRef = useRef(orderBy);
  const selectRef = useRef(select);
  const pkRef = useRef<string>(primaryKey);
  limitRef.current = limit;
  orderRef.current = orderBy;
  selectRef.current = select;
  pkRef.current = primaryKey;

  const refetch = useCallback(async () => {
    if (!userId && ownerColumn) return;
    setLoading(true);
    setError(null);
    const orderCol = orderRef.current?.column ?? pkRef.current;
    const ascending = orderRef.current?.ascending ?? false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = ((supabase as any).from(table)).select(selectRef.current);
    if (ownerColumn && userId) q = q.eq(ownerColumn, userId);
    q = q.order(orderCol, { ascending }).limit(limitRef.current);
    const { data, error } = await q;
    if (error) setError(error.message);
    else setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [table, userId, ownerColumn]);

  useEffect(() => {
    if (ownerColumn && !userId) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void refetch();

    setStatus("connecting");
    const channelName = `rt:${table}:${userId ?? "public"}`;
    const filter = ownerColumn && userId ? `${ownerColumn}=eq.${userId}` : undefined;

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        (payload: RealtimePostgresChangesPayload<Row>) => {
          if (cancelled) return;
          const pk = pkRef.current;
          const cap = limitRef.current;
          setRows((prev) => {
            const next = [...prev];
            const idOf = (r: Row) => (r as Record<string, unknown>)[pk];
            if (payload.eventType === "DELETE") {
              const oldPk = (payload.old as Record<string, unknown> | null)?.[pk];
              return next.filter((r) => idOf(r) !== oldPk);
            }
            const row = payload.new as Row;
            if (!row) return prev;
            const idx = next.findIndex((r) => idOf(r) === idOf(row));
            if (idx >= 0) {
              next[idx] = row;
              return next;
            }
            // INSERT: put on top (list is newest-first by convention)
            next.unshift(row);
            if (next.length > cap) next.length = cap;
            return next;
          });
        },
      )
      .subscribe((s) => {
        if (cancelled) return;
        if (s === "SUBSCRIBED") setStatus("connected");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("error");
        else if (s === "CLOSED") setStatus("closed");
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [table, userId, ownerColumn, refetch]);

  return { rows, loading, error, status, refetch };
}

/**
 * Subscribe to a single row identified by (ownerColumn = userId) and optional
 * extra key. Used for wallet_state and single-key kv rows. Returns null when
 * the row does not exist yet.
 */
export function useRealtimeRow<Row extends Record<string, unknown>>(
  table: TableName,
  userId: string | undefined,
  extra?: { column: string; value: string } | null,
) {
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>("idle");

  const extraCol = extra?.column ?? null;
  const extraVal = extra?.value ?? null;

  useEffect(() => {
    if (!userId) {
      setRow(null);
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = ((supabase as any).from(table)).select("*").eq("user_id", userId);
      if (extraCol && extraVal !== null) q = q.eq(extraCol, extraVal);
      const { data, error } = await q.maybeSingle();
      if (cancelled) return;
      if (error && error.code !== "PGRST116") setError(error.message);
      setRow((data as Row) ?? null);
      setLoading(false);
    };

    void load();

    setStatus("connecting");
    const filter =
      extraCol && extraVal !== null
        ? `user_id=eq.${userId}` // supabase-js supports only one filter; refine client-side
        : `user_id=eq.${userId}`;

    const channel = supabase
      .channel(`rt:${table}:row:${userId}:${extraVal ?? "_"}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table, filter },
        (payload: RealtimePostgresChangesPayload<Row>) => {
          if (cancelled) return;
          if (payload.eventType === "DELETE") {
            const old = payload.old as Record<string, unknown> | null;
            if (!extraCol || (old && old[extraCol] === extraVal)) setRow(null);
            return;
          }
          const next = payload.new as Row | null;
          if (!next) return;
          if (extraCol && (next as Record<string, unknown>)[extraCol] !== extraVal) return;
          setRow(next);
        },
      )
      .subscribe((s) => {
        if (cancelled) return;
        if (s === "SUBSCRIBED") setStatus("connected");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") setStatus("error");
        else if (s === "CLOSED") setStatus("closed");
      });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [table, userId, extraCol, extraVal]);

  return { row, loading, error, status };
}
