import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type TableName = keyof Database["public"]["Tables"];

export function useSupabaseList<T = unknown>(
  table: TableName,
  opts?: { select?: string; limit?: number; orderBy?: { column: string; ascending?: boolean } },
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(table).select(opts?.select ?? "*");
    if (opts?.orderBy) q = q.order(opts.orderBy.column, { ascending: opts.orderBy.ascending ?? false });
    if (opts?.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) setError(error.message);
    else setData((data as T[]) ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, opts?.select, opts?.limit, opts?.orderBy?.column, opts?.orderBy?.ascending]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
