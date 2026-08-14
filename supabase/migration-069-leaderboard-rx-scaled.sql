-- Wodflow — migration 069: expose rx_or_scaled on public_leaderboard
--
-- scores.rx_or_scaled (migration-009) has been captured since Score
-- Entry started rendering an RX/Scaled toggle per lane, but
-- public_leaderboard (last redefined migration-042) never selected it,
-- so the leaderboard had no way to show or filter by it. Display/filter
-- only — this does not change ranking or points (lib/leaderboard.ts is
-- untouched), it just carries the tag through to the UI.

create or replace view public.public_leaderboard
with (security_invoker = false) as
select distinct on (s.heat_assignment_id, coalesce(s.workout_ref_id::text, s.workout_id))
  s.heat_assignment_id,
  coalesce(s.workout_ref_id::text, s.workout_id) as workout_id,
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
  coalesce(w.scoring_config, s.workout_scoring_config_snapshot) as workout_scoring_config,
  s.rx_or_scaled
from public.scores s
join public.heat_assignments ha on ha.id = s.heat_assignment_id
join public.registrations r on r.id = ha.registration_id
left join public.workouts w on w.id = s.workout_ref_id
order by s.heat_assignment_id, coalesce(s.workout_ref_id::text, s.workout_id), s.submitted_at desc;

grant select on public.public_leaderboard to anon, authenticated;
