-- latest_scores (schema.sql) is `select distinct on (...) *` — a
-- Postgres view freezes its column list at CREATE time, so the three
-- columns migration-009 added to scores (workout_ref_id, rx_or_scaled,
-- tiebreak_value) were silently never added to this view. Any query
-- selecting those columns from latest_scores has been failing with
-- "column does not exist" ever since. public_leaderboard (migration-030)
-- got recreated when it needed a new column; latest_scores never did.
-- Re-running CREATE OR REPLACE VIEW with the same `select *` picks up
-- the table's current columns.

create or replace view public.latest_scores
with (security_invoker = true) as
select distinct on (heat_assignment_id, workout_id)
  *
from public.scores
order by heat_assignment_id, workout_id, submitted_at desc;

revoke select on public.latest_scores from anon;
