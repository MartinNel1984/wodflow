-- Wodflow — migration 040: preserve per-workout scoring config across a
-- workout delete
--
-- migration-037 correctly made workout delete detach scores.workout_ref_id
-- (set null) rather than block the delete. But public_leaderboard's
-- workout_scoring_config comes from `left join workouts w on w.id =
-- s.workout_ref_id` (migration-030) — once that ref is null, the join
-- misses and the config falls back silently to the division default in
-- lib/leaderboard.ts's computeStandings. Concrete bug: an organizer
-- deletes a workout after scores were entered, and if that workout had
-- its own winner_points/gap_points override, every athlete's points for
-- that already-recorded workout quietly recompute under the division's
-- formula instead — changing standings after the fact with no warning.
--
-- Fix: snapshot the workout's scoring_config onto its scores at delete
-- time (app code, see workouts/actions.ts deleteWorkout — set-then-delete,
-- same non-transactional pattern already used elsewhere in this app), and
-- have the view prefer the live workouts row when it still exists
-- (so editing a still-live workout's config keeps affecting its scores,
-- per M17's existing behavior) and only fall back to the frozen snapshot
-- once the workout is gone.

alter table public.scores
  add column if not exists workout_scoring_config_snapshot jsonb;

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
  coalesce(w.scoring_config, s.workout_scoring_config_snapshot) as workout_scoring_config
from public.scores s
join public.heat_assignments ha on ha.id = s.heat_assignment_id
join public.registrations r on r.id = ha.registration_id
left join public.workouts w on w.id = s.workout_ref_id
order by s.heat_assignment_id, s.workout_id, s.submitted_at desc;

grant select on public.public_leaderboard to anon, authenticated;
