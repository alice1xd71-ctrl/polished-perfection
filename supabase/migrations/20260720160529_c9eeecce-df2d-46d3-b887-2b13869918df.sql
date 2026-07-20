
-- Extend strategy_profiles with management columns
ALTER TABLE public.strategy_profiles
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS strategy_type text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_mode text NOT NULL DEFAULT 'paper',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

-- Validation
ALTER TABLE public.strategy_profiles
  DROP CONSTRAINT IF EXISTS strategy_profiles_default_mode_chk,
  ADD CONSTRAINT strategy_profiles_default_mode_chk CHECK (default_mode IN ('paper','live'));
ALTER TABLE public.strategy_profiles
  DROP CONSTRAINT IF EXISTS strategy_profiles_status_chk,
  ADD CONSTRAINT strategy_profiles_status_chk CHECK (status IN ('active','archived'));

-- Unique name per user
CREATE UNIQUE INDEX IF NOT EXISTS strategy_profiles_user_name_key
  ON public.strategy_profiles(user_id, lower(name));

-- Versions table (immutable history)
CREATE TABLE IF NOT EXISTS public.strategy_profile_versions (
  id bigserial PRIMARY KEY,
  profile_id bigint NOT NULL REFERENCES public.strategy_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version integer NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  strategy_type text NOT NULL,
  enabled boolean NOT NULL,
  default_mode text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  config jsonb NOT NULL,
  change_summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, version)
);

GRANT SELECT, INSERT ON public.strategy_profile_versions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.strategy_profile_versions_id_seq TO authenticated;
GRANT ALL ON public.strategy_profile_versions TO service_role;
GRANT ALL ON SEQUENCE public.strategy_profile_versions_id_seq TO service_role;

ALTER TABLE public.strategy_profile_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_versions_select" ON public.strategy_profile_versions;
CREATE POLICY "own_versions_select" ON public.strategy_profile_versions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_versions_insert" ON public.strategy_profile_versions;
CREATE POLICY "own_versions_insert" ON public.strategy_profile_versions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-version trigger: snapshot into versions on insert & meaningful update
CREATE OR REPLACE FUNCTION public.snapshot_strategy_profile_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_version integer;
  summary text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.config IS NOT DISTINCT FROM OLD.config
       AND NEW.name = OLD.name
       AND NEW.description = OLD.description
       AND NEW.strategy_type = OLD.strategy_type
       AND NEW.enabled = OLD.enabled
       AND NEW.default_mode = OLD.default_mode
       AND NEW.tags = OLD.tags
       AND NEW.notes = OLD.notes THEN
      RETURN NEW;
    END IF;
    next_version := COALESCE(OLD.version, 1) + 1;
    NEW.version := next_version;
    summary := 'updated';
  ELSE
    next_version := 1;
    NEW.version := 1;
    summary := 'created';
  END IF;

  INSERT INTO public.strategy_profile_versions
    (profile_id, user_id, version, name, description, strategy_type,
     enabled, default_mode, tags, notes, config, change_summary)
  VALUES
    (NEW.id, NEW.user_id, next_version, NEW.name, NEW.description, NEW.strategy_type,
     NEW.enabled, NEW.default_mode, NEW.tags, NEW.notes, NEW.config, summary);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_profile_version_ins ON public.strategy_profiles;
CREATE TRIGGER trg_snapshot_profile_version_ins
  AFTER INSERT ON public.strategy_profiles
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_strategy_profile_version();

DROP TRIGGER IF EXISTS trg_snapshot_profile_version_upd ON public.strategy_profiles;
CREATE TRIGGER trg_snapshot_profile_version_upd
  BEFORE UPDATE ON public.strategy_profiles
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_strategy_profile_version();

-- Enable realtime
ALTER TABLE public.strategy_profiles REPLICA IDENTITY FULL;
ALTER TABLE public.strategy_profile_versions REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.strategy_profiles';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.strategy_profile_versions';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
