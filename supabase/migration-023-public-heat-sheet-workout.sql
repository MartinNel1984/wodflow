-- ============================================================
-- Wodflow — migration 023: fix public heat sheet after heats gained
-- a workout_id (migration 022).
--
-- heat_number now only resets to 1 per workout, not per division —
-- a division with two workouts can have two different "Heat 1"s. The
-- public heat sheet view grouped by heat_number alone, so it would
-- silently merge lanes from two unrelated heats into one displayed
-- block. Exposing heat_id (already selected but unused for grouping
-- by the page) plus workout_name/sequence lets the page group
-- correctly and label which workout each heat belongs to.
-- ============================================================

-- CREATE OR REPLACE can't reorder/insert columns into an existing view
-- (Postgres only allows appending at the end) — drop and recreate
-- instead, since nothing else in the schema depends on this view.
drop view if exists public.public_heat_sheet;

create view public.public_heat_sheet
with (security_invoker = false) as
select
  h.id as heat_id,
  h.division_id,
  h.workout_id,
  w.name as workout_name,
  w.sequence as workout_sequence,
  h.heat_number,
  h.start_time,
  ha.lane_number,
  coalesce(
    r.team_name,
    (
      select ra.full_name
      from public.registration_athletes ra
      where ra.registration_id = r.id and ra.is_captain
      limit 1
    )
  ) as display_name
from public.heats h
join public.heat_assignments ha on ha.heat_id = h.id
join public.registrations r on r.id = ha.registration_id
left join public.workouts w on w.id = h.workout_id;

grant select on public.public_heat_sheet to anon, authenticated;
