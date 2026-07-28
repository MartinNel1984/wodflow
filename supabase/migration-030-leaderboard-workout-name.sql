-- ============================================================
-- Wodflow — migration 030: expose workout name + per-workout scoring
-- config on public_leaderboard
--
-- The leaderboard's per-workout selector was showing the raw
-- scores.workout_id (a free-text value, sometimes a UUID-shaped
-- string) instead of a readable workout name — this is why the
-- per-workout breakdown looked unusable/like it wasn't there at all.
-- Joins through scores.workout_ref_id (M9) to the real workouts row
-- when present; falls back to the legacy free-text workout_id label
-- for older scores that predate the workout builder (M11).
-- Pure column additions at the end — CREATE OR REPLACE is safe here,
-- no need to drop the view.
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
  ) as display_name,
  s.tiebreak_value,
  coalesce(w.name, s.workout_id) as workout_name,
  w.scoring_config as workout_scoring_config
from public.scores s
join public.heat_assignments ha on ha.id = s.heat_assignment_id
join public.registrations r on r.id = ha.registration_id
left join public.workouts w on w.id = s.workout_ref_id
order by s.heat_assignment_id, s.workout_id, s.submitted_at desc;

grant select on public.public_leaderboard to anon, authenticated;
