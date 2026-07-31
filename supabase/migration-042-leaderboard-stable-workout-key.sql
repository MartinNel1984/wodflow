-- Wodflow — migration 042: group public_leaderboard by the stable
-- workout id, not the mutable free-text label
--
-- public_leaderboard (migration-040) still deduped and grouped scores by
-- s.workout_id — a free-text label captured on the judge Score Entry page
-- at submission time, not the stable workouts.id. A UI race on that page
-- (heat switched before the workout list/selection caught up) let a judge
-- submit a score for the wrong workout, stamping it with a different
-- workout's text label. Two consequences, both seen live: (1) `distinct
-- on (heat_assignment_id, workout_id)` silently kept only the
-- most-recently-submitted row per label, dropping the other workout's
-- score entirely; (2) lib/leaderboard.ts's computeStandings groups by
-- this same workout_id, so two real workouts sharing a label collapsed
-- into one entry with a coin-flip display name and merged results —
-- explaining both the broken workout filter and the missing
-- points/medals back on "Overall".
--
-- Fix: prefer the stable s.workout_ref_id (falling back to the legacy
-- text label only when a score predates the workout builder and has no
-- ref) as the value returned in the workout_id column, and as the
-- distinct/order key. No consumer changes needed — every reader
-- (lib/leaderboard.ts, lib/seriesStandings.ts, the athlete portal) just
-- groups by whatever this column contains.

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
  coalesce(w.scoring_config, s.workout_scoring_config_snapshot) as workout_scoring_config
from public.scores s
join public.heat_assignments ha on ha.id = s.heat_assignment_id
join public.registrations r on r.id = ha.registration_id
left join public.workouts w on w.id = s.workout_ref_id
order by s.heat_assignment_id, coalesce(s.workout_ref_id::text, s.workout_id), s.submitted_at desc;

grant select on public.public_leaderboard to anon, authenticated;
