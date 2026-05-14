-- PoolKaro: Explicit grants for all tables
-- Run this before October 30, 2026
-- Fixes Supabase Data API access changes

-- ── profiles ──────────────────────────────────────────
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- ── rides ─────────────────────────────────────────────
GRANT SELECT ON public.rides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rides TO authenticated;

-- ── bookings ──────────────────────────────────────────
GRANT SELECT ON public.bookings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;

-- ── wallets ───────────────────────────────────────────
GRANT SELECT, UPDATE ON public.wallets TO authenticated;

-- ── wallet_transactions ───────────────────────────────
GRANT SELECT, INSERT ON public.wallet_transactions TO authenticated;

-- ── notifications ─────────────────────────────────────
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

-- ── ratings ───────────────────────────────────────────
GRANT SELECT ON public.ratings TO anon;
GRANT SELECT, INSERT ON public.ratings TO authenticated;

-- ── live_locations ────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_locations TO authenticated;

-- ── push_subscriptions ────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

-- ── work_email_verifications ──────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_email_verifications TO authenticated;

-- ── Service role gets full access to everything ───────
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ── Verify RLS is enabled on all tables ───────────────
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'profiles','rides','bookings','wallets',
      'wallet_transactions','notifications','ratings',
      'live_locations','push_subscriptions',
      'work_email_verifications'
    )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Confirm all grants applied
SELECT
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND table_name IN (
    'profiles','rides','bookings','wallets',
    'wallet_transactions','notifications','ratings',
    'live_locations','push_subscriptions',
    'work_email_verifications'
  )
GROUP BY table_name, grantee
ORDER BY table_name, grantee;
