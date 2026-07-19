-- ============================================================
-- Wodflow — migration 004: public leaderboard view
--
-- Self-contained (doesn't reference latest_scores from schema.sql) to
-- avoid nested security_invoker ambiguity between two views with
-- different invoker settings. Deliberately bypasses RLS
-- (security_invoker = false, same pattern as public_heat_sheet in
-- migration-001) to expose only workout scores + display names —
-- never email/phone/payment/waiver fields.
-- ============================================================

create or replace view public.public_leaderboard
with (security_invoker = false) as
select distinct on (s.heat_assignment_id, s.workout_id)
  s.heat_assignment_id,
  s.workout_id,
  s.value_raw,
  ha.registration_id,
  r.division_id,
  coalesce(
    r.team_name,
    (
      select ra.full_name
      from public.registration_athletes ra
      where ra.registration_id = r.id and ra.is_captain
      limit 1
    )
  ) as display_name
from public.scores s
join public.heat_assignments ha on ha.id = s.heat_assignment_id
join public.registrations r on r.id = ha.registration_id
order by s.heat_assignment_id, s.workout_id, s.submitted_at desc;

grant select on public.public_leaderboard to anon, authenticated;
