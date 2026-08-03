-- ============================================================
-- Wodflow — migration 049: public team roster view
--
-- The leaderboard's "tap a team name" feature needs each team's
-- athlete names, but registration_athletes is intentionally locked to
-- organizers/the athlete themselves (rls-policies.sql section 6) since
-- it carries PII — ID numbers, emails, minor/guardian details. Anon
-- callers (the public leaderboard page uses lib/supabase/public.ts's
-- cookie-free anon client) got silently empty results against that
-- table, so the roster never actually rendered clickable in
-- production despite working when tested against an authenticated
-- session locally.
--
-- Fix: a narrow view exposing only registration_id + full_name (never
-- id_number/email/guardian fields), same security-bypass pattern as
-- public_leaderboard (migration-004) — deliberately security_invoker
-- = false so anon can read it, but the column list is the actual
-- privacy boundary here since RLS can't restrict by column.
-- ============================================================

create or replace view public.public_team_rosters
with (security_invoker = false) as
select
  ra.registration_id,
  ra.full_name,
  ra.is_captain
from public.registration_athletes ra;

grant select on public.public_team_rosters to anon, authenticated;
