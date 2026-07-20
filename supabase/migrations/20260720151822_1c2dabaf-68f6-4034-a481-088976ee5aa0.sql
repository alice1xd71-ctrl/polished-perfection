
-- =====================================================================
-- Milestone 1 — Complete schema for the Polymarket trading bot (Service 1)
-- Mirrors the Node engine's SQLite schema in Postgres, adds Supabase auth
-- integration (profiles + roles), and enables RLS scoped to the owning user.
-- The external Node engine writes via service_role and bypasses RLS.
-- =====================================================================

-- ---------- Enums ----------
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'viewer');
CREATE TYPE public.pipeline_mode AS ENUM ('PAPER_V1', 'PAPER_V2', 'LIVE_V2');
CREATE TYPE public.trade_side AS ENUM ('YES', 'NO');
CREATE TYPE public.trade_status AS ENUM ('OPEN', 'SETTLED');
CREATE TYPE public.trade_result AS ENUM ('WIN', 'LOSS', 'SCRATCH', 'PENDING');

-- ---------- Shared updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =====================================================================
-- 1. Profiles (user metadata)
-- =====================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  -- First user becomes admin, subsequent users are viewers by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN (SELECT count(*) FROM public.user_roles) = 0 THEN 'admin'::app_role ELSE 'viewer'::app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- =====================================================================
-- 2. User roles + has_role security-definer function
-- =====================================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger on auth.users to create profile + first-user admin
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- 3. Trades (open + settled positions, both paper & live)
-- =====================================================================
CREATE TABLE public.trades (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_id TEXT NOT NULL,
  slot_end_ms BIGINT NOT NULL,
  side public.trade_side NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  shares BIGINT NOT NULL,
  cost DOUBLE PRECISION NOT NULL,
  result public.trade_result NOT NULL DEFAULT 'PENDING',
  pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
  balance_after DOUBLE PRECISION NOT NULL DEFAULT 0,
  dust_saved DOUBLE PRECISION NOT NULL DEFAULT 0,
  mode public.pipeline_mode NOT NULL,
  status public.trade_status NOT NULL DEFAULT 'OPEN',
  order_id TEXT,
  trade_uid TEXT,
  entry_at_ms BIGINT,
  mark_price DOUBLE PRECISION,
  unrealized_pnl DOUBLE PRECISION,
  explanation JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);
CREATE INDEX idx_trades_user_mode ON public.trades(user_id, mode);
CREATE INDEX idx_trades_user_mode_settled ON public.trades(user_id, mode, settled_at DESC);
CREATE INDEX idx_trades_user_status ON public.trades(user_id, status);
CREATE INDEX idx_trades_user_created ON public.trades(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.trades_id_seq TO authenticated, service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads trades" ON public.trades FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin/operator manage trades" ON public.trades FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operator')))
  WITH CHECK (auth.uid() = user_id AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operator')));

-- =====================================================================
-- 4. Engine KV store (bankroll, per-mode counters, misc state)
-- =====================================================================
CREATE TABLE public.engine_kv (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
CREATE INDEX idx_engine_kv_key ON public.engine_kv(key);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engine_kv TO authenticated;
GRANT ALL ON public.engine_kv TO service_role;
ALTER TABLE public.engine_kv ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads kv" ON public.engine_kv FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin manage kv" ON public.engine_kv FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(),'admin'));

-- =====================================================================
-- 5. Order log (every SUBMIT/ACK/FILL/CANCEL event)
-- =====================================================================
CREATE TABLE public.order_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ts_ms BIGINT NOT NULL,
  mode public.pipeline_mode NOT NULL,
  event TEXT NOT NULL,
  market_id TEXT NOT NULL,
  token_id TEXT,
  exchange_order_id TEXT,
  side public.trade_side,
  price DOUBLE PRECISION,
  shares BIGINT,
  phase TEXT,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orderlog_user_market ON public.order_log(user_id, market_id);
CREATE INDEX idx_orderlog_user_ts ON public.order_log(user_id, ts_ms DESC);
CREATE INDEX idx_orderlog_user_mode_event_ts ON public.order_log(user_id, mode, event, ts_ms);
GRANT SELECT, INSERT ON public.order_log TO authenticated;
GRANT ALL ON public.order_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_log_id_seq TO authenticated, service_role;
ALTER TABLE public.order_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads order_log" ON public.order_log FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =====================================================================
-- 6. Audit log (structured events)
-- =====================================================================
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ts_ms BIGINT NOT NULL,
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_user_ts ON public.audit_log(user_id, ts_ms DESC);
CREATE INDEX idx_audit_user_cat_ts ON public.audit_log(user_id, category, ts_ms DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.audit_log_id_seq TO authenticated, service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads audit_log" ON public.audit_log FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =====================================================================
-- 7. Latency samples (execution latency telemetry)
-- =====================================================================
CREATE TABLE public.latency_samples (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ts_ms BIGINT NOT NULL,
  mode public.pipeline_mode NOT NULL,
  market_id TEXT NOT NULL,
  exchange_order_id TEXT,
  side public.trade_side,
  shares BIGINT,
  limit_price DOUBLE PRECISION,
  quote_age_ms INTEGER NOT NULL,
  decision_ms INTEGER NOT NULL,
  pre_submit_ms INTEGER NOT NULL,
  submit_ms INTEGER NOT NULL,
  fill_check_ms INTEGER NOT NULL,
  total_ms INTEGER NOT NULL,
  submit_at_ms BIGINT NOT NULL,
  fill_observed_ms BIGINT,
  filled_price DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_latency_user_mode_ts ON public.latency_samples(user_id, mode, ts_ms DESC);
CREATE INDEX idx_latency_order ON public.latency_samples(exchange_order_id);
GRANT SELECT, INSERT ON public.latency_samples TO authenticated;
GRANT ALL ON public.latency_samples TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.latency_samples_id_seq TO authenticated, service_role;
ALTER TABLE public.latency_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads latency" ON public.latency_samples FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =====================================================================
-- 8. Order intents (INC-004 intent-first model)
-- =====================================================================
CREATE TABLE public.order_intents (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_order_id TEXT NOT NULL,
  exchange_order_id TEXT,
  status TEXT NOT NULL,
  mode public.pipeline_mode NOT NULL,
  market_id TEXT NOT NULL,
  token_id TEXT,
  side public.trade_side NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  shares BIGINT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL,
  submitted_at_ms BIGINT,
  resting_at_ms BIGINT,
  ambiguous_at_ms BIGINT,
  failed_at_ms BIGINT,
  UNIQUE (user_id, client_order_id)
);
CREATE UNIQUE INDEX uniq_order_intents_exchange ON public.order_intents(user_id, exchange_order_id) WHERE exchange_order_id IS NOT NULL;
CREATE INDEX idx_order_intents_user_status ON public.order_intents(user_id, status);
GRANT SELECT, INSERT, UPDATE ON public.order_intents TO authenticated;
GRANT ALL ON public.order_intents TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.order_intents_id_seq TO authenticated, service_role;
ALTER TABLE public.order_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads intents" ON public.order_intents FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =====================================================================
-- 9. Quarantined exchange orders
-- =====================================================================
CREATE TABLE public.quarantined_exchange_orders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exchange_order_id TEXT NOT NULL,
  client_order_id TEXT,
  intent_id BIGINT,
  reason TEXT NOT NULL,
  payload JSONB,
  quarantined_at_ms BIGINT NOT NULL,
  UNIQUE (user_id, exchange_order_id)
);
CREATE INDEX idx_quarantine_user_coid ON public.quarantined_exchange_orders(user_id, client_order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quarantined_exchange_orders TO authenticated;
GRANT ALL ON public.quarantined_exchange_orders TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.quarantined_exchange_orders_id_seq TO authenticated, service_role;
ALTER TABLE public.quarantined_exchange_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads quarantine" ON public.quarantined_exchange_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin/op manage quarantine" ON public.quarantined_exchange_orders FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operator')))
  WITH CHECK (auth.uid() = user_id AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operator')));

-- =====================================================================
-- 10. Strategy profiles (named config snapshots)
-- =====================================================================
CREATE TABLE public.strategy_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  config JSONB NOT NULL,
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL,
  last_used_at_ms BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_profiles TO authenticated;
GRANT ALL ON public.strategy_profiles TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.strategy_profiles_id_seq TO authenticated, service_role;
ALTER TABLE public.strategy_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads profiles_strat" ON public.strategy_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin/op manage profiles_strat" ON public.strategy_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operator')))
  WITH CHECK (auth.uid() = user_id AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operator')));
CREATE TRIGGER trg_strategy_profiles_updated_at BEFORE UPDATE ON public.strategy_profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =====================================================================
-- 11. Profile sessions (which profile was active from when to when)
-- =====================================================================
CREATE TABLE public.profile_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_name TEXT NOT NULL,
  started_at_ms BIGINT NOT NULL,
  ended_at_ms BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user_profile ON public.profile_sessions(user_id, profile_name, started_at_ms DESC);
GRANT SELECT, INSERT, UPDATE ON public.profile_sessions TO authenticated;
GRANT ALL ON public.profile_sessions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.profile_sessions_id_seq TO authenticated, service_role;
ALTER TABLE public.profile_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads sessions" ON public.profile_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =====================================================================
-- 12. Engine heartbeat / health (so dashboard can show if the bot is alive)
-- =====================================================================
CREATE TABLE public.engine_heartbeats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  mode public.pipeline_mode,
  status TEXT,
  version TEXT,
  meta JSONB
);
GRANT SELECT ON public.engine_heartbeats TO authenticated;
GRANT ALL ON public.engine_heartbeats TO service_role;
ALTER TABLE public.engine_heartbeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads heartbeat" ON public.engine_heartbeats FOR SELECT TO authenticated USING (auth.uid() = user_id);
