-- Wodflow — migration 052: fix Season Rank silently only ranking the
-- caller against themselves for real (non-organizer) athlete sessions
--
-- computeSeriesStandingsForEvents (lib/seriesStandings.ts) needs to map
-- every competitor's registration_id -> captain_profile_id across an
-- entire division to build real season standings. It queries the raw
-- `registrations` table for this. But registrations_select (rls-
-- policies.sql) only allows an organizer OR the caller's own
-- registration through — so when a genuine athlete (role='athlete')
-- views their OWN portal page, every OTHER competitor's registration
-- row is silently RLS-filtered out, leaving `placements` with only the
-- caller's own entry. computeSeriesStandings then ranks that single
-- entry as "1 of 1" — confirmed live via scripts/verify-season-rank-
-- rls.mts (a synthetic athlete session got 0 rows back for another
-- athlete's real registration). Anyone with organizer-level access
-- (is_organizer() true) never hits this, which is why it went
-- unnoticed — the feedback so far came from an organizer-level view.
--
-- Fix: a narrow view exposing ONLY registration_id + captain_profile_id
-- (never team_name/payment_status/PII) so ranking computations can
-- resolve the whole field without needing full `registrations` access.
-- Same deliberate-RLS-bypass pattern as public_leaderboard
-- (migration-004) and public_team_rosters (migration-049).

create or replace view public.public_registration_profiles
with (security_invoker = false) as
select id as registration_id, captain_profile_id
from public.registrations
where captain_profile_id is not null;

grant select on public.public_registration_profiles to anon, authenticated;
