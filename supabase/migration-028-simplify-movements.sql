-- ============================================================
-- Wodflow — migration 028: simplify workout_movements to Reps/Load/Rounds
--
-- Tjokkie's feedback (2026-07-28): the RX-vs-Scaled reps/load split at
-- the workout-TEMPLATE level added ambiguity he didn't want when
-- building a workout. The per-athlete RX'd/Scaled choice at score-entry
-- time (scores.rx_or_scaled, Milestone 12) is unaffected by this — it's
-- a different field on a different table. This only touches how a
-- movement's target reps/load are defined when the workout is built.
-- ============================================================

alter table public.workout_movements
  add column if not exists reps int,
  add column if not exists load text;

update public.workout_movements
set reps = coalesce(reps_rx, reps_scaled),
    load = coalesce(load_rx, load_scaled)
where reps is null and load is null;

alter table public.workout_movements
  drop column if exists reps_rx,
  drop column if exists reps_scaled,
  drop column if exists load_rx,
  drop column if exists load_scaled;
