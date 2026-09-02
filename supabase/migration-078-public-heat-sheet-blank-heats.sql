-- ============================================================
-- Wodflow — migration 078: public heat sheet should show a heat's
-- time slot even before it's filled with athletes.
--
-- The heats system is now a two-step process (buildHeatSchedule then
-- assignRosterToHeats) — a heat row can exist with a start_time and
-- no heat_assignments yet. public_heat_sheet inner-joined
-- heat_assignments, so a scheduled-but-unfilled heat produced zero
-- rows and vanished from the public page entirely, showing "No heats
-- generated" even though the schedule (and its time) already exists.
-- Tjokkie (2026-09-02): wants the heat times visible on the public
-- link as soon as they're generated, even while lanes are still
-- blank.
-- ============================================================

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
left join public.heat_assignments ha on ha.heat_id = h.id
left join public.registrations r on r.id = ha.registration_id
left join public.workouts w on w.id = h.workout_id;

grant select on public.public_heat_sheet to anon, authenticated;
