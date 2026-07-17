-- Final security boundary for the archived legacy application.
-- The active platform owns all future data and execution capabilities.

BEGIN;

-- Existing profiles cannot retain or reintroduce a live execution mode.
UPDATE public.profiles
SET bot_config = jsonb_set(
  COALESCE(bot_config, '{}'::jsonb),
  '{mode}',
  '"paper"'::jsonb,
  true
)
WHERE COALESCE(bot_config->>'mode', 'paper') <> 'paper';

ALTER TABLE public.profiles
  ALTER COLUMN bot_config
  SET DEFAULT '{"mode": "paper", "marketMode": "FUTURES", "leverage": 5, "maxDrawdown": 10, "maxConcurrentTrades": 3, "riskPerTrade": 2}'::jsonb;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bot_config_paper_only
  CHECK (COALESCE(bot_config->>'mode', 'paper') = 'paper')
  NOT VALID;

ALTER TABLE public.profiles
  VALIDATE CONSTRAINT profiles_bot_config_paper_only;

-- UPDATE policies must validate both the old row and the resulting row.
ALTER POLICY "Users can update their own profile"
  ON public.profiles
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can update their own trades"
  ON public.trades
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can update their own stats"
  ON public.bot_stats
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can update own neural state"
  ON public.neural_network_state
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can update own experiences"
  ON public.trade_experiences
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Trade history is audit evidence and must not be deleted by clients.
DROP POLICY IF EXISTS "Users can delete their own trades" ON public.trades;

-- Keep RLS mandatory even for table owners. Service-role credentials must
-- still be revoked because PostgreSQL roles with BYPASSRLS are exempt.
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trades FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bot_stats FORCE ROW LEVEL SECURITY;
ALTER TABLE public.neural_network_state FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trade_experiences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.neural_training_epochs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bot_logs FORCE ROW LEVEL SECURITY;

COMMIT;
