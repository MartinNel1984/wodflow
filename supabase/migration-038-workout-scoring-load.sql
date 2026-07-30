-- Wodflow — migration 038: allow 'load' as a per-workout scoring type
--
-- workouts.scoring_type (migration-008) only allowed 'time' | 'reps',
-- while divisions.workout_scoring_type (schema.sql) already allowed
-- 'time' | 'reps' | 'load'. The judge score-entry form, latest_scores
-- view, and leaderboard already handle load_kg end to end (parseValueForType
-- falls through to load_kg, computeWorkoutResults already labels it "kg") —
-- only this constraint and the admin UI were missing the third option,
-- which is why "For weight" workouts had to be misfiled as "Max reps"
-- and showed up as "N reps" on the leaderboard instead of "N kg".
alter table public.workouts
  drop constraint if exists workouts_scoring_type_check,
  add constraint workouts_scoring_type_check
    check (scoring_type in ('time', 'reps', 'load'));
