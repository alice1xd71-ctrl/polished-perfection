
-- ============ engine_events ============
CREATE TABLE IF NOT EXISTS public.engine_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  engine_instance_id UUID,
  instance_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  source TEXT NOT NULL DEFAULT 'engine',
  message TEXT,
  metadata JSONB,
  correlation_id UUID,
  execution_id UUID,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS engine_events_user_ts_idx ON public.engine_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS engine_events_type_idx ON public.engine_events(event_type);
CREATE INDEX IF NOT EXISTS engine_events_correlation_idx ON public.engine_events(correlation_id);
CREATE INDEX IF NOT EXISTS engine_events_execution_idx ON public.engine_events(execution_id);

GRANT SELECT ON public.engine_events TO authenticated;
GRANT ALL ON public.engine_events TO service_role;

ALTER TABLE public.engine_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "engine_events_owner_read" ON public.engine_events;
CREATE POLICY "engine_events_owner_read" ON public.engine_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.engine_events REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.engine_events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ============ engine_instances additions ============
ALTER TABLE public.engine_instances
  ADD COLUMN IF NOT EXISTS git_commit TEXT,
  ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restart_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS memory_used_mb NUMERIC,
  ADD COLUMN IF NOT EXISTS memory_total_mb NUMERIC,
  ADD COLUMN IF NOT EXISTS cpu_percent NUMERIC;

-- ============ notifications additions ============
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS requires_ack BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_by UUID,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_owner_update'
  ) THEN
    CREATE POLICY "notifications_owner_update" ON public.notifications
      FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============ execution_id traceability ============
ALTER TABLE public.standing_orders       ADD COLUMN IF NOT EXISTS execution_id UUID;
ALTER TABLE public.standing_order_events ADD COLUMN IF NOT EXISTS execution_id UUID;
ALTER TABLE public.order_intents         ADD COLUMN IF NOT EXISTS execution_id UUID;
ALTER TABLE public.trades                ADD COLUMN IF NOT EXISTS execution_id UUID;
ALTER TABLE public.audit_log             ADD COLUMN IF NOT EXISTS execution_id UUID;

CREATE INDEX IF NOT EXISTS standing_orders_execution_idx       ON public.standing_orders(execution_id);
CREATE INDEX IF NOT EXISTS standing_order_events_execution_idx ON public.standing_order_events(execution_id);
CREATE INDEX IF NOT EXISTS order_intents_execution_idx         ON public.order_intents(execution_id);
CREATE INDEX IF NOT EXISTS trades_execution_idx                ON public.trades(execution_id);
CREATE INDEX IF NOT EXISTS audit_log_execution_idx             ON public.audit_log(execution_id);
