-- ============================================================
-- Wodflow — migration 008: workouts + workout_movements
--
-- Real Rumble scoresheets are multi-station, multi-round (e.g. 8
-- rounds x 3 movements). The cumulative rep-reference grid printed on
-- paper (/03 /08 /12 /16...) is derived from rounds x each movement's
-- rep count — it is computed at render time from workout_movements,
-- never stored as its own rows. What actually gets scored per
-- athlete stays a single final number (finish time, or reps/rounds
-- reached at the cap) on public.scores, unchanged in shape.
--
-- Scoped to division_id, not event_id, because RX/Scaled rep schemes
-- (reps_rx vs reps_scaled) are a per-athlete choice within one
-- division (confirmed against the real scoresheet's RX'd checkbox),
-- and a division's workouts are shared by every heat in it.
-- ============================================================

create table if not exists public.workouts (
  id               uuid primary key default gen_random_uuid(),
  division_id      uuid not null references public.divisions(id) on delete cascade,
  name             text not null,             -- "Love 8 Relationship"
  sequence         int not null default 1,
  cap_seconds      int check (cap_seconds > 0),
  scoring_type     text not null default 'time' check (scoring_type in ('time', 'reps')),
  tiebreak_enabled boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (division_id, sequence)
);

create table if not exists public.workout_movements (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null references public.workouts(id) on delete cascade,
  sequence     int not null,
  name         text not null,               -- "3 Bar Muscle-ups"
  reps_rx      int,
  reps_scaled  int,
  load_rx      text,                        -- "22.5 kg"
  load_scaled  text,
  rounds       int not null default 1 check (rounds > 0),
  unique (workout_id, sequence)
);

alter table public.workouts          enable row level security;
alter table public.workout_movements enable row level security;

drop policy if exists "workouts_select" on public.workouts;
drop policy if exists "workouts_write" on public.workouts;
create policy "workouts_select" on public.workouts
  for select to anon, authenticated using (true);
create policy "workouts_write" on public.workouts
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());

drop policy if exists "workout_movements_select" on public.workout_movements;
drop policy if exists "workout_movements_write" on public.workout_movements;
create policy "workout_movements_select" on public.workout_movements
  for select to anon, authenticated using (true);
create policy "workout_movements_write" on public.workout_movements
  for all to authenticated using (public.is_organizer()) with check (public.is_organizer());
