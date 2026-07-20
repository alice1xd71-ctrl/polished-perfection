
-- ============ Notifications ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ts_ms BIGINT NOT NULL DEFAULT (extract(epoch from now())*1000)::bigint,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','error','critical')),
  source TEXT NOT NULL DEFAULT 'engine' CHECK (source IN ('engine','dashboard','system')),
  category TEXT NOT NULL DEFAULT 'engine',
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB,
  read_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_ts_idx ON public.notifications(user_id, ts_ms DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications(user_id) WHERE read_at IS NULL;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.notifications_id_seq TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_owner_read" ON public.notifications;
CREATE POLICY "notif_owner_read" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_owner_update" ON public.notifications;
CREATE POLICY "notif_owner_update" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_owner_delete" ON public.notifications;
CREATE POLICY "notif_owner_delete" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='notifications') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- ============ Engine Instances ============
CREATE TABLE IF NOT EXISTS public.engine_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  instance_name TEXT,
  engine_version TEXT,
  host_name TEXT,
  region TEXT,
  engine_mode TEXT NOT NULL DEFAULT 'paper' CHECK (engine_mode IN ('paper','live')),
  engine_status TEXT NOT NULL DEFAULT 'offline' CHECK (engine_status IN ('online','offline','reconnecting','degraded')),
  current_market_id TEXT,
  active_strategy TEXT,
  uptime_seconds BIGINT,
  heartbeat_latency_ms INTEGER,
  last_heartbeat TIMESTAMPTZ,
  last_restart_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB,
  UNIQUE (user_id, instance_id)
);
CREATE INDEX IF NOT EXISTS engine_instances_user_idx ON public.engine_instances(user_id, last_heartbeat DESC);
GRANT SELECT ON public.engine_instances TO authenticated;
GRANT ALL ON public.engine_instances TO service_role;
ALTER TABLE public.engine_instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "engine_inst_owner_read" ON public.engine_instances;
CREATE POLICY "engine_inst_owner_read" ON public.engine_instances FOR SELECT TO authenticated USING (auth.uid() = user_id);
ALTER TABLE public.engine_instances REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='engine_instances') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.engine_instances';
  END IF;
END $$;

-- ============ Trades: additive fields ============
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS contract_start_ms BIGINT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS contract_end_ms BIGINT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS resolution_at TIMESTAMPTZ;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS up_token_id TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS down_token_id TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS fees NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS settlement_status TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS question TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS event_id TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS trigger_price NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS target_buy_price NUMERIC;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS majority_side_at_trigger TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS engine_instance_id UUID REFERENCES public.engine_instances(id) ON DELETE SET NULL;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS market_snapshot JSONB;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS execution_latency_ms INTEGER;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS reconciliation_status TEXT;

-- ============ Standing Orders: roll tracking ============
ALTER TABLE public.standing_orders ADD COLUMN IF NOT EXISTS active_market_id TEXT;
ALTER TABLE public.standing_orders ADD COLUMN IF NOT EXISTS market_roll_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.standing_orders ADD COLUMN IF NOT EXISTS last_market_roll_at TIMESTAMPTZ;

-- ============ BTC5m Contract History ============
CREATE TABLE IF NOT EXISTS public.btc5m_contract_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id TEXT NOT NULL,
  event_id TEXT,
  question TEXT,
  slug TEXT,
  yes_token_id TEXT,
  no_token_id TEXT,
  slot_start_ms BIGINT NOT NULL,
  slot_end_ms BIGINT NOT NULL,
  resolution_at TIMESTAMPTZ,
  final_outcome TEXT,
  final_yes_price NUMERIC,
  final_no_price NUMERIC,
  winning_side TEXT,
  volume NUMERIC,
  liquidity NUMERIC,
  total_trades INTEGER NOT NULL DEFAULT 0,
  total_standing_orders INTEGER NOT NULL DEFAULT 0,
  engine_instance_id UUID REFERENCES public.engine_instances(id) ON DELETE SET NULL,
  meta JSONB,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, market_id)
);
CREATE INDEX IF NOT EXISTS btc5m_history_user_end_idx ON public.btc5m_contract_history(user_id, slot_end_ms DESC);
GRANT SELECT ON public.btc5m_contract_history TO authenticated;
GRANT ALL ON public.btc5m_contract_history TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.btc5m_contract_history_id_seq TO service_role;
ALTER TABLE public.btc5m_contract_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "btc5m_hist_owner_read" ON public.btc5m_contract_history;
CREATE POLICY "btc5m_hist_owner_read" ON public.btc5m_contract_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
ALTER TABLE public.btc5m_contract_history REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='btc5m_contract_history') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.btc5m_contract_history';
  END IF;
END $$;
