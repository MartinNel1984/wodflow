-- Wodflow — migration 085: expose workout sequence on public_leaderboard
--
-- Standings table columns (app/leaderboard/[divisionId]/view.tsx) were
-- ordered alphabetically by workout_id (a UUID) in computeStandings,
-- so "Spa Day / Simunye / Hey Linda" showed up in random order instead
-- of the order the workouts actually run (Tjokkie, 2026-09-29). Adds
-- w.sequence so lib/leaderboard.ts can sort columns by it.

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
  s.rx_or_scaled,
  w.sequence as workout_sequence
from public.scores s
join public.heat_assignments ha on ha.id = s.heat_assignment_id
join public.registrations r on r.id = ha.registration_id
left join public.workouts w on w.id = s.workout_ref_id
order by s.heat_assignment_id, coalesce(s.workout_ref_id::text, s.workout_id), s.submitted_at desc;

grant select on public.public_leaderboard to anon, authenticated;
