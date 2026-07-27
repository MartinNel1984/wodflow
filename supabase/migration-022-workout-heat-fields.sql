-- ============================================================
-- Wodflow — migration 022: move heat/lane fields from divisions to workouts
--
-- Lane count, heat duration, and transition time actually change
-- workout to workout (a barbell-heavy WOD needs longer heats than a
-- short sprint), but were only ever configurable at the division
-- level. This moves them onto each workout, and ties every heat to
-- the specific workout it was generated for so heat numbering resets
-- per workout instead of colliding across a whole division's event
-- day.
-- ============================================================

alter table public.workouts
  add column if not exists lane_count            int check (lane_count > 0),
  add column if not exists heat_duration_minutes  int check (heat_duration_minutes > 0),
  add column if not exists transition_minutes     int check (transition_minutes >= 0);

-- Seed every existing workout from its division's old values so
-- nothing goes blank mid-migration.
update public.workouts w
set lane_count = d.lane_count,
    heat_duration_minutes = d.heat_duration_minutes,
    transition_minutes = d.transition_minutes
from public.divisions d
where d.id = w.division_id;

alter table public.heats
  add column if not exists workout_id uuid references public.workouts(id) on delete cascade;

-- Best-effort backfill: a division with exactly one workout can only
-- mean its existing heats belong to that workout. Divisions with
-- multiple workouts are left with workout_id null on old heats —
-- there's no reliable way to attribute historical heats retroactively,
-- and those heats are already scored/complete.
update public.heats h
set workout_id = w.id
from public.workouts w
where w.division_id = h.division_id
  and workout_id is null
  and (select count(*) from public.workouts w2 where w2.division_id = h.division_id) = 1;

alter table public.heats drop constraint if exists heats_division_id_heat_number_key;
alter table public.heats add constraint heats_workout_id_heat_number_key unique (workout_id, heat_number);

alter table public.divisions
  drop column if exists lane_count,
  drop column if exists heat_duration_minutes,
  drop column if exists transition_minutes;
