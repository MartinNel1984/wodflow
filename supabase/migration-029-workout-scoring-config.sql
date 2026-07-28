-- ============================================================
-- Wodflow — migration 029: per-workout scoring config
--
-- divisions.scoring_config (M17) applies one formula to every workout
-- in a division. Tjokkie now wants different workouts to carry
-- different point totals/spreads (e.g. a 100-point WOD vs a 50-point
-- WOD, with a spread he sets directly rather than always
-- auto-derived from entrant count). Nullable + additive: when a
-- workout's scoring_config is null, the division's default still
-- applies unchanged — every existing division/workout keeps behaving
-- exactly as before.
-- ============================================================

alter table public.workouts
  add column if not exists scoring_config jsonb;
