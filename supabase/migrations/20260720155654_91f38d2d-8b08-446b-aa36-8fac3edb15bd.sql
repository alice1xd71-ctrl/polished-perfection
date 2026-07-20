
-- =============== standing_orders ===============
CREATE TABLE public.standing_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  market_id TEXT,
  strategy_profile_id BIGINT REFERENCES public.strategy_profiles(id) ON DELETE SET NULL,
  trigger_price NUMERIC(10,6) NOT NULL,
  target_buy_price NUMERIC(10,6) NOT NULL,
  execution_window_start TIMESTAMPTZ,
  execution_window_end   TIMESTAMPTZ,
  position_size NUMERIC(18,6) NOT NULL,
  risk_profile TEXT NOT NULL DEFAULT 'balanced',
  mode public.pipeline_mode NOT NULL DEFAULT 'PAPER_V2',
  max_retries INT NOT NULL DEFAULT 3,
  notes TEXT,

  status TEXT NOT NULL DEFAULT 'armed',
  selected_side public.trade_side,
  majority_side_at_trigger public.trade_side,
  trigger_detected_at TIMESTAMPTZ,
  execution_started_at TIMESTAMPTZ,
  execution_completed_at TIMESTAMPTZ,
  order_intent_id BIGINT REFERENCES public.order_intents(id) ON DELETE SET NULL,
  exchange_order_id TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  final_status TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT standing_orders_trigger_price_chk CHECK (trigger_price > 0 AND trigger_price < 1),
  CONSTRAINT standing_orders_target_price_chk  CHECK (target_buy_price > 0 AND target_buy_price < 1),
  CONSTRAINT standing_orders_size_chk          CHECK (position_size > 0),
  CONSTRAINT standing_orders_risk_chk          CHECK (risk_profile IN ('conservative','balanced','aggressive')),
  CONSTRAINT standing_orders_status_chk        CHECK (status IN
    ('armed','monitoring','triggered','submitted','filled','cancelled','failed','expired'))
);

CREATE INDEX standing_orders_user_idx        ON public.standing_orders (user_id);
CREATE INDEX standing_orders_user_status_idx ON public.standing_orders (user_id, status);
CREATE INDEX standing_orders_market_idx      ON public.standing_orders (market_id) WHERE market_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.standing_orders TO authenticated;
GRANT ALL ON public.standing_orders TO service_role;

ALTER TABLE public.standing_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "standing_orders owner read"
  ON public.standing_orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "standing_orders owner insert"
  ON public.standing_orders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "standing_orders owner update"
  ON public.standing_orders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "standing_orders owner delete pre-exec"
  ON public.standing_orders FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status IN ('armed','monitoring'));

CREATE TRIGGER trg_standing_orders_updated_at
  BEFORE UPDATE ON public.standing_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =============== standing_order_events (append-only) ===============
CREATE TABLE public.standing_order_events (
  id BIGSERIAL PRIMARY KEY,
  standing_order_id UUID NOT NULL REFERENCES public.standing_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
  phase TEXT NOT NULL,
  event TEXT NOT NULL,
  message TEXT,
  metadata JSONB,
  latency_ms INTEGER,
  created_by TEXT NOT NULL DEFAULT 'engine',
  engine_instance_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT so_events_created_by_chk CHECK (created_by IN ('engine','dashboard','system'))
);

CREATE INDEX so_events_so_ts_idx       ON public.standing_order_events (standing_order_id, "timestamp" DESC);
CREATE INDEX so_events_user_ts_idx     ON public.standing_order_events (user_id, "timestamp" DESC);
CREATE INDEX so_events_engine_inst_idx ON public.standing_order_events (engine_instance_id) WHERE engine_instance_id IS NOT NULL;

GRANT SELECT, INSERT ON public.standing_order_events TO authenticated;
GRANT ALL ON public.standing_order_events TO service_role;

ALTER TABLE public.standing_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "so_events owner read"
  ON public.standing_order_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "so_events owner insert"
  ON public.standing_order_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
-- No UPDATE/DELETE policies for authenticated → append-only. service_role bypasses RLS.

-- =============== realtime ===============
ALTER TABLE public.standing_orders       REPLICA IDENTITY FULL;
ALTER TABLE public.standing_order_events REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='standing_orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.standing_orders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='standing_order_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.standing_order_events;
  END IF;
END $$;
