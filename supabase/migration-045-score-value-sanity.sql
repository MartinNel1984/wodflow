-- Wodflow — migration 045: DB-level sanity constraint on scores.value_raw
--
-- lib/scoreValidation.ts is the primary guard and is now wired into both
-- write paths (/api/scores and the correctScore server action). This
-- constraint is deliberate belt-and-braces at the storage layer, the same
-- pattern as enforce_division_max_entries: app-level checks are the fast,
-- friendly path, but the DB is what actually makes the invariant true.
--
-- The specific bug this closes: /api/scores previously wrote `value_raw`
-- straight through as arbitrary jsonb, so { "time_seconds": -500 } would
-- store fine and then sort FIRST on the public leaderboard (finishers are
-- ranked by time ascending).
--
-- jsonb_typeof() is checked before every ::numeric cast so a non-numeric
-- value fails the constraint cleanly rather than raising 22P02 from the
-- cast itself.

create or replace function public.score_value_is_sane(v jsonb)
returns boolean language sql immutable as $$
  select
    -- must be a json object with at least one key
    v is not null
    and jsonb_typeof(v) = 'object'
    and v <> '{}'::jsonb

    -- no unrecognised keys
    and not exists (
      select 1 from jsonb_object_keys(v) as k
      where k not in ('time_seconds', 'reps', 'load_kg', 'no_rep')
    )

    -- no_rep, when present, must be a boolean
    and (
      v->'no_rep' is null
      or jsonb_typeof(v->'no_rep') = 'boolean'
    )

    -- time_seconds, when present: number, 0..86400
    and (
      v->'time_seconds' is null
      or (
        jsonb_typeof(v->'time_seconds') = 'number'
        and (v->>'time_seconds')::numeric >= 0
        and (v->>'time_seconds')::numeric <= 86400
      )
    )

    -- reps, when present: number, 0..100000
    and (
      v->'reps' is null
      or (
        jsonb_typeof(v->'reps') = 'number'
        and (v->>'reps')::numeric >= 0
        and (v->>'reps')::numeric <= 100000
      )
    )

    -- load_kg, when present: number, 0..1000
    and (
      v->'load_kg' is null
      or (
        jsonb_typeof(v->'load_kg') = 'number'
        and (v->>'load_kg')::numeric >= 0
        and (v->>'load_kg')::numeric <= 1000
      )
    )

    -- must measure something, unless it's an explicit no-rep
    and (
      (v->>'no_rep')::boolean is true
      or v->'time_seconds' is not null
      or v->'reps' is not null
      or v->'load_kg' is not null
    );
$$;

-- NOT VALID: applies to all new writes immediately without forcing a full
-- scan/validation of existing rows on a live table. Existing rows were all
-- written through the UI's parseTime() path, which already rejected
-- negatives, so there should be nothing to clean up — but see the
-- verification query at the bottom before running VALIDATE.
alter table public.scores
  drop constraint if exists scores_value_raw_sane;
alter table public.scores
  add constraint scores_value_raw_sane
  check (public.score_value_is_sane(value_raw)) not valid;

-- Tiebreaks reuse the same shape; null is normal and allowed.
alter table public.scores
  drop constraint if exists scores_tiebreak_value_sane;
alter table public.scores
  add constraint scores_tiebreak_value_sane
  check (tiebreak_value is null or public.score_value_is_sane(tiebreak_value)) not valid;

-- ------------------------------------------------------------
-- Run this AFTER the migration to see whether any existing row would
-- violate the new rules. Expect 0 rows.
--
--   select id, value_raw, tiebreak_value
--   from public.scores
--   where not public.score_value_is_sane(value_raw)
--      or (tiebreak_value is not null and not public.score_value_is_sane(tiebreak_value));
--
-- If it returns 0 rows, promote both constraints to fully validated:
--
--   alter table public.scores validate constraint scores_value_raw_sane;
--   alter table public.scores validate constraint scores_tiebreak_value_sane;
-- ------------------------------------------------------------
