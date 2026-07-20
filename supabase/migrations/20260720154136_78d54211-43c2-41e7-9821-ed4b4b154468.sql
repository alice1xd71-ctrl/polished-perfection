
-- =========================================================
-- Milestone 3: Realtime + BTC 5m dashboard schema
-- =========================================================

-- ---- Wallet state (one row per user) ----
CREATE TABLE public.wallet_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_usdc numeric(20,6) NOT NULL DEFAULT 0,
  available_usdc numeric(20,6) NOT NULL DEFAULT 0,
  locked_usdc numeric(20,6) NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'engine',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_state TO authenticated;
GRANT ALL ON public.wallet_state TO service_role;
ALTER TABLE public.wallet_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_state owner read"  ON public.wallet_state FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wallet_state owner write" ON public.wallet_state FOR ALL    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---- Feed / connection health (per user, per named feed) ----
CREATE TABLE public.engine_feed_status (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed text NOT NULL, -- e.g. 'clob_ws', 'gamma', 'coingecko', 'wallet_rpc'
  status text NOT NULL DEFAULT 'unknown', -- 'connected' | 'degraded' | 'disconnected' | 'unknown'
  last_message_at timestamptz,
  latency_ms integer,
  detail jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feed)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_feed_status TO authenticated;
GRANT ALL ON public.engine_feed_status TO service_role;
ALTER TABLE public.engine_feed_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_status owner read"  ON public.engine_feed_status FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "feed_status owner write" ON public.engine_feed_status FOR ALL    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---- BTC 5-minute markets ----
CREATE TABLE public.btc5m_markets (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id text NOT NULL,             -- Polymarket condition id / market id
  slug text,
  question text,
  yes_token_id text,
  no_token_id text,
  slot_start_ms bigint NOT NULL,
  slot_end_ms bigint NOT NULL,
  status text NOT NULL DEFAULT 'upcoming', -- 'upcoming' | 'active' | 'monitoring' | 'closed' | 'settled'
  best_bid_yes numeric(10,6),
  best_ask_yes numeric(10,6),
  last_price_yes numeric(10,6),
  last_tick_at timestamptz,
  eligible boolean NOT NULL DEFAULT true,
  ineligible_reason text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, market_id)
);
CREATE INDEX btc5m_markets_user_status_idx ON public.btc5m_markets (user_id, status, slot_end_ms DESC);
CREATE INDEX btc5m_markets_user_slot_idx   ON public.btc5m_markets (user_id, slot_end_ms DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.btc5m_markets TO authenticated;
GRANT ALL ON public.btc5m_markets TO service_role;
ALTER TABLE public.btc5m_markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "btc5m owner read"  ON public.btc5m_markets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "btc5m owner write" ON public.btc5m_markets FOR ALL    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER btc5m_markets_updated_at
  BEFORE UPDATE ON public.btc5m_markets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER wallet_state_updated_at
  BEFORE UPDATE ON public.wallet_state
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER engine_feed_status_updated_at
  BEFORE UPDATE ON public.engine_feed_status
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---- Enable Supabase Realtime for dashboard-relevant tables ----
ALTER TABLE public.trades                REPLICA IDENTITY FULL;
ALTER TABLE public.order_intents         REPLICA IDENTITY FULL;
ALTER TABLE public.order_log             REPLICA IDENTITY FULL;
ALTER TABLE public.audit_log             REPLICA IDENTITY FULL;
ALTER TABLE public.engine_heartbeats     REPLICA IDENTITY FULL;
ALTER TABLE public.engine_kv             REPLICA IDENTITY FULL;
ALTER TABLE public.latency_samples       REPLICA IDENTITY FULL;
ALTER TABLE public.wallet_state          REPLICA IDENTITY FULL;
ALTER TABLE public.engine_feed_status    REPLICA IDENTITY FULL;
ALTER TABLE public.btc5m_markets         REPLICA IDENTITY FULL;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'trades','order_intents','order_log','audit_log',
    'engine_heartbeats','engine_kv','latency_samples',
    'wallet_state','engine_feed_status','btc5m_markets'
  ]) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
