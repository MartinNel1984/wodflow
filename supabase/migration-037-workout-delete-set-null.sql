-- Wodflow — migration 037: let workout deletion proceed when scores exist
--
-- scores.workout_ref_id (migration-009) referenced public.workouts(id)
-- with no ON DELETE action, i.e. the Postgres default RESTRICT. Any
-- workout that already had a real score recorded against it (linked
-- via this ref) could never be deleted — the organizer's "Could not
-- delete workout" error was this FK violation, silently swallowed
-- into a generic message.
--
-- migration-009's own design intent was for workout_ref_id to be an
-- ADDITIVE, nullable link — the free-text scores.workout_id column is
-- the authoritative, backward-compatible identifier. So ON DELETE SET
-- NULL is correct here: removing a workout's definition detaches the
-- ref from historical scores without destroying them or blocking the
-- delete, exactly matching that original design comment.
alter table public.scores
  drop constraint if exists scores_workout_ref_id_fkey,
  add constraint scores_workout_ref_id_fkey
    foreign key (workout_ref_id) references public.workouts(id) on delete set null;
