-- ============================================================
-- Wodflow — migration 013: configurable per-division scoring formula
--
-- Replaces the hardcoded entrants-minus-position leaderboard formula
-- with a pluggable one. 'rank_sum' matches today's existing behavior
-- exactly (the default, so nothing changes for the live rehearsal
-- leaderboard until an organizer opts into 'gap_formula' for a
-- division) — 'gap_formula' is Tjokkie's proposed 100-minus-gap
-- points table. Milestone 17 wires the leaderboard to actually read
-- this; this migration just adds the column.
-- ============================================================

alter table public.divisions
  add column if not exists scoring_config jsonb not null default '{"method": "rank_sum"}'::jsonb;
